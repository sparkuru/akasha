import { describe, expect, it } from "bun:test"
import { treaty } from "@elysiajs/eden"
import { Akademiya } from "../core/akademiya.ts"
import type { Capsule } from "../core/capsule.ts"
import {
  CapsuleNotFound,
  type Darshan,
  type DarshanCapability,
  type PresignOptions,
} from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { Browser } from "../service/browser.ts"
import { buildApp } from "./app.ts"
import type { Surasthana } from "./surasthana.ts"

/**
 * In-memory engine — zero network. `caps` selects the clearance set so one class
 * stands in for a full S3-style backend and a read-only one. A `missing` key
 * triggers a `CapsuleNotFound` so the 404 mapping can be exercised.
 */
class FakeDarshan implements Darshan {
  static readonly typeName = "fake"
  readonly typeName = FakeDarshan.typeName
  private readonly caps: Set<DarshanCapability>

  static requiredGnosis(): Set<string> {
    return new Set()
  }

  constructor(gnosis: Gnosis) {
    const caps = (gnosis.raw.caps ?? "").split(",").filter((s) => s !== "")
    this.caps = new Set(caps as DarshanCapability[])
  }

  listObjects(_bucket: string, prefix = ""): Promise<Capsule[]> {
    if (prefix.startsWith("missing")) {
      throw new CapsuleNotFound("fake list: not found")
    }
    return Promise.resolve([{ key: "a.txt", name: "a.txt", isDir: false, size: 3 }])
  }
  stat(_bucket: string, key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ key, isDir: false, size: 42 })
  }
  readBytes(_bucket: string, _key: string): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array([104, 105]))
  }
  download(_bucket: string, _key: string, dest: string): Promise<string> {
    return Promise.resolve(dest)
  }
  uploadFile(
    _bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    void source
    return Promise.resolve(key)
  }
  delete(_bucket: string, _key: string): Promise<void> {
    return Promise.resolve()
  }
  listBuckets(): Promise<string[]> {
    return Promise.resolve(["one", "two"])
  }
  presign(bucket: string, key: string, options?: PresignOptions): Promise<string> {
    return Promise.resolve(`https://signed.invalid/${bucket}/${key}?e=${options?.expiresIn ?? 0}`)
  }

  clearance(): Set<DarshanCapability> {
    return this.caps
  }
}

const FULL = "list_buckets,read,download,upload,delete,presign"
const READ_ONLY = "read"

function appWith(...remotes: Gnosis[]): ReturnType<typeof buildApp> {
  const browser = new Browser(remotes, new Akademiya().enroll(FakeDarshan))
  const surasthana: Surasthana = { browser }
  return buildApp(surasthana)
}

const s3like: Gnosis = { name: "s3r", type: "fake", raw: { caps: FULL } }
const readOnly: Gnosis = { name: "ro", type: "fake", raw: { caps: READ_ONLY } }

describe("GET /api/remotes", () => {
  it("lists remotes with their clearance set", async () => {
    const app = appWith(s3like, readOnly)
    const res = await app.handle(new Request("http://localhost/api/remotes"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([
      {
        name: "s3r",
        type: "fake",
        clearance: ["list_buckets", "read", "download", "upload", "delete", "presign"],
      },
      { name: "ro", type: "fake", clearance: ["read"] },
    ])
  })
})

describe("GET /api/objects", () => {
  it("returns 200 and the listed capsules", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/api/objects?ref=s3r:bucket/sub"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ key: "a.txt", name: "a.txt", isDir: false, size: 3 }])
  })

  it("maps a not-found domain error to a 404 AkashaError", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/api/objects?ref=s3r:bucket/missing"))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
  })

  it("maps an unknown remote to a 403 forbidden_knowledge", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/api/objects?ref=ghost:bucket/x"))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "forbidden_knowledge" })
  })

  it("maps a traversal attempt to a 403 forbidden_knowledge", async () => {
    const app = appWith(s3like)
    const res = await app.handle(
      new Request("http://localhost/api/objects?ref=s3r:bucket/../../etc"),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "forbidden_knowledge" })
  })
})

describe("GET /api/buckets", () => {
  it("lists buckets for a list_buckets-capable remote", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/api/buckets?remote=s3r"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(["one", "two"])
  })

  it("returns 403 when the remote lacks list_buckets clearance", async () => {
    const app = appWith(readOnly)
    const res = await app.handle(new Request("http://localhost/api/buckets?remote=ro"))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "forbidden_knowledge" })
  })
})

describe("GET /api/object/stat", () => {
  it("returns object metadata", async () => {
    const app = appWith(s3like)
    const res = await app.handle(
      new Request("http://localhost/api/object/stat?ref=s3r:bucket/a.txt"),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ key: "a.txt", size: 42 })
  })
})

describe("GET /api/object/read", () => {
  it("returns the raw bytes", async () => {
    const app = appWith(s3like)
    const res = await app.handle(
      new Request("http://localhost/api/object/read?ref=s3r:bucket/a.txt"),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("hi")
  })
})

describe("GET /api/object/url", () => {
  it("returns kind:presigned for a presign-capable remote", async () => {
    const app = appWith(s3like)
    const res = await app.handle(
      new Request("http://localhost/api/object/url?ref=s3r:bucket/a.txt&expiresIn=120"),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kind).toBe("presigned")
    expect(body.expiresIn).toBe(120)
    expect(body.url).toContain("signed.invalid")
  })

  it("returns kind:proxy for a non-presign remote (no 'not supported' error)", async () => {
    const app = appWith(readOnly)
    const res = await app.handle(new Request("http://localhost/api/object/url?ref=ro:bucket/a.txt"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kind).toBe("proxy")
    expect(body.url).toBe("/api/object/read?ref=ro%3Abucket%2Fa.txt")
  })
})

describe("POST /api/object/upload", () => {
  it("uploads a multipart file and echoes the stored key", async () => {
    const app = appWith(s3like)
    const form = new FormData()
    form.set("ref", "s3r:bucket/sub/up.txt")
    form.set("file", new File(["payload"], "up.txt"))
    const res = await app.handle(
      new Request("http://localhost/api/object/upload", { method: "POST", body: form }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, key: "sub/up.txt", size: 7 })
  })

  it("returns 403 when the remote lacks upload clearance", async () => {
    const app = appWith(readOnly)
    const form = new FormData()
    form.set("ref", "ro:bucket/up.txt")
    form.set("file", new File(["x"], "up.txt"))
    const res = await app.handle(
      new Request("http://localhost/api/object/upload", { method: "POST", body: form }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "forbidden_knowledge" })
  })
})

describe("DELETE /api/object", () => {
  it("deletes for a delete-capable remote", async () => {
    const app = appWith(s3like)
    const res = await app.handle(
      new Request("http://localhost/api/object?ref=s3r:bucket/a.txt", { method: "DELETE" }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe("validation", () => {
  it("maps a missing required query param to a 422 AkashaError", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/api/objects"))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: "validation" })
  })
})

describe("OpenAPI", () => {
  it("serves the generated spec", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/openapi/json"))
    expect(res.status).toBe(200)
    const spec = await res.json()
    expect(spec.openapi).toBeDefined()
    expect(spec.paths["/api/remotes"]).toBeDefined()
  })
})

describe("Eden treaty typed client", () => {
  it("drives the typed contract end-to-end", async () => {
    const app = appWith(s3like)
    const client = treaty(app)
    const { data, error } = await client.api.remotes.get()
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        name: "s3r",
        type: "fake",
        clearance: ["list_buckets", "read", "download", "upload", "delete", "presign"],
      },
    ])
  })
})

describe("index routes (real irminsul round-trip)", () => {
  it("recalls a directory and reads it back via a temp index file", async () => {
    const indexPath = `${import.meta.dir}/.akasha-test-irminsul-${Date.now()}.json`
    const browser = new Browser([s3like], new Akademiya().enroll(FakeDarshan))
    const surasthana: Surasthana = { browser, indexPath }
    const app = buildApp(surasthana)
    try {
      const recall = await app.handle(
        new Request("http://localhost/api/index/recall", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref: "s3r:bucket/sub" }),
        }),
      )
      expect(recall.status).toBe(200)
      const snapshot = await recall.json()
      expect(snapshot.item_count).toBe(1)

      const read = await app.handle(new Request("http://localhost/api/index"))
      expect(read.status).toBe(200)
      const index = await read.json()
      expect(index.version).toBe(1)
      expect(index.directories["bucket/sub"].item_count).toBe(1)
    } finally {
      await Bun.file(indexPath)
        .unlink()
        .catch(() => {})
    }
  })
})
