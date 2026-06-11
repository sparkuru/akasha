import { describe, expect, it } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { treaty } from "@elysiajs/eden"
import { Akademiya } from "../core/akademiya.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { Browser } from "../service/browser.ts"
import { bootApp, buildApp } from "./app.ts"
import { FakeDarshan, appWith, readOnly, s3like } from "./fake-darshan.ts"
import type { Surasthana } from "./surasthana.ts"

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

describe("bootApp", () => {
  it("uses the built-in engine registry, including WebDAV", async () => {
    const dir = await mkdtemp(join(tmpdir(), "akasha-boot-"))
    const config = join(dir, "rclone.conf")
    const previousConfig = process.env.AKASHA_CONFIG
    const previousIndex = process.env.AKASHA_INDEX
    try {
      await writeFile(
        config,
        [
          "[dav]",
          "type = webdav",
          "url = https://dav.example.com/dav/",
          "",
          "[local]",
          "type = local",
          `root = ${dir}`,
          "",
        ].join("\n"),
      )
      process.env.AKASHA_CONFIG = config
      process.env.AKASHA_INDEX = join(dir, "irminsul.json")

      const app = await bootApp()
      const res = await app.handle(new Request("http://localhost/api/remotes"))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([
        { name: "dav", type: "webdav", clearance: ["read", "download", "upload", "delete"] },
        { name: "local", type: "local", clearance: ["read", "download", "upload", "delete"] },
      ])
    } finally {
      if (previousConfig === undefined) {
        process.env.AKASHA_CONFIG = undefined
      } else {
        process.env.AKASHA_CONFIG = previousConfig
      }
      if (previousIndex === undefined) {
        process.env.AKASHA_INDEX = undefined
      } else {
        process.env.AKASHA_INDEX = previousIndex
      }
      await rm(dir, { recursive: true, force: true })
    }
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
