import { describe, expect, it } from "bun:test"
import { Akademiya } from "../core/akademiya.ts"
import type { Capsule } from "../core/capsule.ts"
import {
  type Darshan,
  type DarshanCapability,
  ForbiddenKnowledge,
  type PresignOptions,
} from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { Browser } from "./browser.ts"

/**
 * A configurable in-memory engine — zero network. `clearance` is injected so a
 * single class can stand in for both a full-featured (presign) backend and a
 * read-only one, proving capability gating without try/catch probing.
 */
class FakeDarshan implements Darshan {
  static readonly typeName = "fake"
  readonly typeName = FakeDarshan.typeName
  // Records calls for assertion.
  static lastUpload: { bucket: string; key: string; bytes: number } | undefined
  static lastDelete: { bucket: string; key: string } | undefined
  private readonly caps: Set<DarshanCapability>

  static requiredGnosis(): Set<string> {
    return new Set()
  }

  constructor(gnosis: Gnosis) {
    const caps = (gnosis.raw.caps ?? "").split(",").filter((s) => s !== "")
    this.caps = new Set(caps as DarshanCapability[])
  }

  listObjects(_bucket: string, _prefix?: string): Promise<Capsule[]> {
    return Promise.resolve([{ key: "a.txt", name: "a.txt", isDir: false, size: 1 }])
  }
  stat(_bucket: string, key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ key, isDir: false, size: 42 })
  }
  readBytes(_bucket: string, _key: string): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array([1, 2, 3]))
  }
  download(_bucket: string, _key: string, dest: string): Promise<string> {
    return Promise.resolve(dest)
  }
  async uploadFile(
    bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    const bytes = source instanceof Uint8Array ? source.byteLength : 0
    FakeDarshan.lastUpload = { bucket, key, bytes }
    return key
  }
  delete(bucket: string, key: string): Promise<void> {
    FakeDarshan.lastDelete = { bucket, key }
    return Promise.resolve()
  }
  listBuckets(): Promise<string[]> {
    return Promise.resolve(["one", "two"])
  }
  presign(bucket: string, key: string, options?: PresignOptions): Promise<string> {
    return Promise.resolve(
      `https://signed.invalid/${bucket}/${key}?e=${options?.expiresIn ?? "default"}`,
    )
  }

  clearance(): Set<DarshanCapability> {
    return this.caps
  }
}

function browserWith(caps: string): Browser {
  const remotes: Gnosis[] = [{ name: "r", type: "fake", raw: { caps } }]
  return new Browser(remotes, new Akademiya().enroll(FakeDarshan))
}

const FULL = "list_buckets,read,download,upload,delete,presign"
const READ_ONLY = "read"

describe("Browser.listRemotes", () => {
  it("returns name + type + clearance for each remote", () => {
    const browser = browserWith(FULL)
    expect(browser.listRemotes()).toEqual([
      {
        name: "r",
        type: "fake",
        clearance: ["list_buckets", "read", "download", "upload", "delete", "presign"],
      },
    ])
  })
})

describe("Browser.listBuckets", () => {
  it("lists buckets when the engine has list_buckets clearance", async () => {
    const browser = browserWith(FULL)
    expect(await browser.listBuckets("r")).toEqual(["one", "two"])
  })

  it("rejects when the engine lacks list_buckets clearance", async () => {
    const browser = browserWith(READ_ONLY)
    await expect(browser.listBuckets("r")).rejects.toThrow(ForbiddenKnowledge)
  })
})

describe("Browser.stat", () => {
  it("stats an object through the engine", async () => {
    const browser = browserWith(READ_ONLY)
    expect(await browser.stat("r:bucket/a.txt")).toMatchObject({ key: "a.txt", size: 42 })
  })

  it("purifies the key (rejects traversal)", async () => {
    const browser = browserWith(READ_ONLY)
    await expect(browser.stat("r:bucket/../../etc")).rejects.toThrow(ForbiddenKnowledge)
  })
})

describe("Browser.upload", () => {
  it("uploads bytes when the engine has upload clearance", async () => {
    const browser = browserWith(FULL)
    const key = await browser.upload("r:bucket/sub/a.txt", new Uint8Array([9, 9]))
    expect(key).toBe("sub/a.txt")
    expect(FakeDarshan.lastUpload).toEqual({ bucket: "bucket", key: "sub/a.txt", bytes: 2 })
  })

  it("rejects when the engine lacks upload clearance", async () => {
    const browser = browserWith(READ_ONLY)
    await expect(browser.upload("r:bucket/a.txt", new Uint8Array())).rejects.toThrow(
      ForbiddenKnowledge,
    )
  })
})

describe("Browser.delete", () => {
  it("deletes when the engine has delete clearance", async () => {
    const browser = browserWith(FULL)
    await browser.delete("r:bucket/a.txt")
    expect(FakeDarshan.lastDelete).toEqual({ bucket: "bucket", key: "a.txt" })
  })

  it("rejects when the engine lacks delete clearance", async () => {
    const browser = browserWith(READ_ONLY)
    await expect(browser.delete("r:bucket/a.txt")).rejects.toThrow(ForbiddenKnowledge)
  })
})

describe("Browser.url", () => {
  it("returns a presigned URL when the engine has presign clearance", async () => {
    const browser = browserWith(FULL)
    const result = await browser.url("r:bucket/a.txt", 120)
    expect(result.kind).toBe("presigned")
    expect(result.expiresIn).toBe(120)
    expect(result.url).toContain("signed.invalid")
  })

  it("falls back to a relative proxy URL when presign is absent", async () => {
    const browser = browserWith(READ_ONLY)
    const result = await browser.url("r:bucket/a.txt")
    expect(result.kind).toBe("proxy")
    expect(result.url).toBe("/api/object/read?ref=r%3Abucket%2Fa.txt")
    expect(result.expiresIn).toBeUndefined()
  })
})
