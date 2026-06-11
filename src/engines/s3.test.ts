import { describe, expect, it } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { S3Client } from "@aws-sdk/client-s3"
import { BackendFault, CapsuleNotFound, type Darshan } from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { createAkademiya } from "../engines/index.ts"
import { S3Darshan } from "./s3.ts"

const BUCKET = "vault"

/** A command as seen by the mocked `send`: its class name + typed input. */
type SeenCommand = { constructor: { name: string }; input: Record<string, unknown> }

/** Canned outputs keyed by command class name; an `Error` value is rejected. */
type Script = Record<string, unknown[]>

const GNOSIS: Gnosis = {
  name: "genie",
  type: "s3",
  raw: { access_key_id: "AKIDEXAMPLE", secret_access_key: "SECRET", region: "us-east-1" },
}

/**
 * Build an engine over a real `S3Client` whose `send` is replaced by a scripted
 * mock — zero network. Returns the recorded commands for assertion.
 */
function scripted(script: Script): { engine: S3Darshan; sent: SeenCommand[] } {
  const queues = new Map<string, unknown[]>(
    Object.entries(script).map(([name, outs]) => [name, [...outs]]),
  )
  const sent: SeenCommand[] = []
  const client = new S3Client({
    region: "us-east-1",
    credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "SECRET" },
  })
  const send = (command: SeenCommand): Promise<unknown> => {
    sent.push(command)
    const name = command.constructor.name
    const queue = queues.get(name)
    if (queue === undefined || queue.length === 0) {
      throw new Error(`no scripted response for ${name}`)
    }
    const next = queue.shift()
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }
  // Single localized cast: adapt the mock to S3Client's overloaded send signature.
  client.send = send as unknown as typeof client.send
  return { engine: new S3Darshan(GNOSIS, client), sent }
}

/** An SDK error carrying a `name` and `$metadata.httpStatusCode`, like the real ones. */
function sdkError(name: string, httpStatusCode?: number): Error {
  const err = new Error(`${name} (mock)`)
  err.name = name
  if (httpStatusCode !== undefined) {
    Object.assign(err, { $metadata: { httpStatusCode } })
  }
  return err
}

describe("S3Darshan", () => {
  it("declares typeName and requiredGnosis literally", () => {
    expect(S3Darshan.typeName).toBe("s3")
    const { engine } = scripted({})
    expect(engine.typeName).toBe("s3")
    expect(S3Darshan.requiredGnosis()).toEqual(new Set(["access_key_id", "secret_access_key"]))
  })

  it("declares full clearance, matching its implemented methods", () => {
    const { engine } = scripted({})
    const clearance = engine.clearance()
    for (const cap of [
      "list_buckets",
      "read",
      "download",
      "upload",
      "delete",
      "presign",
    ] as const) {
      expect(clearance.has(cap)).toBe(true)
    }
    const asDarshan: Darshan = engine
    expect(asDarshan.presign).toBeDefined()
    expect(asDarshan.listBuckets).toBeDefined()
  })

  it("is enrolled alongside LocalDarshan in createAkademiya", () => {
    const akademiya = createAkademiya()
    expect(akademiya.knows("s3")).toBe(true)
    expect(akademiya.knows("local")).toBe(true)
    const engine = akademiya.summon(GNOSIS)
    expect(engine.typeName).toBe("s3")
  })

  it("maps CommonPrefixes to dirs and Contents to files, sorted, skipping the marker", async () => {
    const { engine, sent } = scripted({
      ListObjectsV2Command: [
        {
          CommonPrefixes: [{ Prefix: "photos/sub/" }],
          Contents: [
            { Key: "photos/", Size: 0 }, // directory marker — skipped
            {
              Key: "photos/z.txt",
              Size: 3,
              LastModified: new Date("2026-01-02T00:00:00Z"),
              ETag: '"zzz"',
              StorageClass: "STANDARD",
            },
            { Key: "photos/a.bin", Size: 7 },
          ],
          IsTruncated: false,
        },
      ],
    })
    const capsules = await engine.listObjects(BUCKET, "photos")

    expect(capsules.map((c) => c.name)).toEqual(["a.bin", "sub", "z.txt"])
    const dir = capsules.find((c) => c.name === "sub")
    expect(dir?.isDir).toBe(true)
    expect(dir?.key).toBe("photos/sub/")
    const file = capsules.find((c) => c.name === "z.txt")
    expect(file?.isDir).toBe(false)
    expect(file?.size).toBe(3)
    expect(file?.etag).toBe('"zzz"')
    expect(file?.storageClass).toBe("STANDARD")
    expect(file?.lastModified).toBe("2026-01-02T00:00:00.000Z")

    // a non-empty prefix is anchored with a trailing slash, delimiter defaults to "/"
    const input = sent[0]?.input
    expect(input?.Prefix).toBe("photos/")
    expect(input?.Delimiter).toBe("/")
  })

  it("follows the ContinuationToken across pages", async () => {
    const { engine, sent } = scripted({
      ListObjectsV2Command: [
        { Contents: [{ Key: "p1" }], IsTruncated: true, NextContinuationToken: "TOKEN2" },
        { Contents: [{ Key: "p2" }], IsTruncated: false },
      ],
    })
    const capsules = await engine.listObjects(BUCKET, "")
    expect(capsules.map((c) => c.name)).toEqual(["p1", "p2"])
    expect(sent[0]?.input.ContinuationToken).toBeUndefined()
    expect(sent[1]?.input.ContinuationToken).toBe("TOKEN2")
  })

  it("stats an object into a plain record", async () => {
    const { engine } = scripted({
      HeadObjectCommand: [
        {
          ContentLength: 42,
          LastModified: new Date("2026-01-01T00:00:00Z"),
          ETag: '"e"',
          ContentType: "text/plain",
          StorageClass: "STANDARD",
        },
      ],
    })
    const info = await engine.stat(BUCKET, "k.txt")
    expect(info).toEqual({
      key: "k.txt",
      isDir: false,
      size: 42,
      lastModified: "2026-01-01T00:00:00.000Z",
      etag: '"e"',
      contentType: "text/plain",
      storageClass: "STANDARD",
    })
  })

  it("reads bytes, honoring maxBytes", async () => {
    const payload = new TextEncoder().encode("konnichiwa")
    const { engine } = scripted({
      GetObjectCommand: [
        { Body: { transformToByteArray: () => Promise.resolve(payload) } },
        { Body: { transformToByteArray: () => Promise.resolve(payload) } },
      ],
    })
    const all = await engine.readBytes(BUCKET, "hello.txt")
    expect(new TextDecoder().decode(all)).toBe("konnichiwa")
    const clipped = await engine.readBytes(BUCKET, "hello.txt", 5)
    expect(new TextDecoder().decode(clipped)).toBe("konni")
  })

  it("downloads to a destination path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "akasha-s3-"))
    try {
      const payload = new TextEncoder().encode("downloaded")
      const { engine } = scripted({
        GetObjectCommand: [{ Body: { transformToByteArray: () => Promise.resolve(payload) } }],
      })
      const dest = join(dir, "nested", "out.txt")
      const returned = await engine.download(BUCKET, "src.txt", dest)
      expect(returned).toBe(dest)
      expect(await readFile(dest, "utf8")).toBe("downloaded")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("uploads a file, forwarding the body and returning the key", async () => {
    const { engine, sent } = scripted({ PutObjectCommand: [{}] })
    const body = new TextEncoder().encode("written")
    const key = await engine.uploadFile(BUCKET, body, "out/new.txt")
    expect(key).toBe("out/new.txt")
    const input = sent[0]?.input
    expect(input?.Bucket).toBe(BUCKET)
    expect(input?.Key).toBe("out/new.txt")
    expect(input?.Body).toEqual(body)
  })

  it("deletes a key", async () => {
    const { engine, sent } = scripted({ DeleteObjectCommand: [{}] })
    await engine.delete(BUCKET, "gone.txt")
    expect(sent[0]?.constructor.name).toBe("DeleteObjectCommand")
    expect(sent[0]?.input.Key).toBe("gone.txt")
  })

  it("lists buckets, dropping unnamed entries", async () => {
    const { engine } = scripted({
      ListBucketsCommand: [{ Buckets: [{ Name: "b1" }, {}, { Name: "b2" }] }],
    })
    expect(await engine.listBuckets()).toEqual(["b1", "b2"])
  })

  it("presigns GET and PUT URLs locally (no network)", async () => {
    // Build from raw so a real signer is constructed; presign does no network I/O.
    const engine = new S3Darshan({
      name: "genie",
      type: "s3",
      raw: {
        access_key_id: "AKIDEXAMPLE",
        secret_access_key: "SECRET",
        region: "us-east-1",
        endpoint: "https://s3.example.com",
        force_path_style: "true",
      },
    })
    const getUrl = await engine.presign(BUCKET, "report.pdf")
    expect(getUrl).toContain("report.pdf")
    expect(getUrl).toContain("X-Amz-Signature=")
    expect(getUrl).toContain("X-Amz-Expires=3600")

    const putUrl = await engine.presign(BUCKET, "upload.bin", { method: "PUT", expiresIn: 120 })
    expect(putUrl).toContain("X-Amz-Expires=120")
  })

  it("maps NoSuchKey and HTTP 404 to CapsuleNotFound", async () => {
    const byName = scripted({ GetObjectCommand: [sdkError("NoSuchKey")] })
    await expect(byName.engine.readBytes(BUCKET, "missing")).rejects.toBeInstanceOf(CapsuleNotFound)

    const byStatus = scripted({ HeadObjectCommand: [sdkError("SomethingElse", 404)] })
    await expect(byStatus.engine.stat(BUCKET, "missing")).rejects.toBeInstanceOf(CapsuleNotFound)
  })

  it("maps other SDK errors to BackendFault without leaking the raw error", async () => {
    const { engine } = scripted({ ListObjectsV2Command: [sdkError("AccessDenied", 403)] })
    let caught: unknown
    try {
      await engine.listObjects(BUCKET, "")
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(BackendFault)
    if (caught instanceof BackendFault) {
      expect(caught.message).toBe("S3 list failed: AccessDenied")
      expect(caught.message).not.toContain("SECRET")
    }
  })

  it("rejects construction without credentials defensively", () => {
    expect(() => new S3Darshan({ name: "x", type: "s3", raw: {} })).toThrow()
  })
})
