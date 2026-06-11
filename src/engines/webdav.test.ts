import { describe, expect, it } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BackendFault, CapsuleNotFound, type Darshan, ForbiddenKnowledge } from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { createAkademiya } from "../engines/index.ts"
import { WebdavDarshan } from "./webdav.ts"

const GNOSIS: Gnosis = {
  name: "nutstore",
  type: "webdav",
  raw: { url: "https://dav.example.com/dav/", user: "alice", pass: "secret" },
}

interface SeenFetch {
  url: string
  method: string | undefined
  headers: Headers
  body: BodyInit | null | undefined
}

function scripted(replies: Array<Response | Error>): {
  engine: WebdavDarshan
  seen: SeenFetch[]
} {
  const queue = [...replies]
  const seen: SeenFetch[] = []
  const fetcher = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const next = queue.shift()
    if (next === undefined) {
      throw new Error("no scripted WebDAV response")
    }
    seen.push({
      url: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: init?.body,
    })
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }
  return { engine: new WebdavDarshan(GNOSIS, fetcher), seen }
}

function multistatus(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${body}</D:multistatus>`,
    { status: 207 },
  )
}

function davResponse(href: string, props: string, status = 200): string {
  return `<D:response><D:href>${href}</D:href><D:propstat><D:prop>${props}</D:prop><D:status>HTTP/1.1 ${status} Status</D:status></D:propstat></D:response>`
}

describe("WebdavDarshan", () => {
  it("declares typeName and requiredGnosis literally", () => {
    const { engine } = scripted([])
    expect(WebdavDarshan.typeName).toBe("webdav")
    expect(engine.typeName).toBe("webdav")
    expect(WebdavDarshan.requiredGnosis()).toEqual(new Set(["url"]))
  })

  it("declares read/download/upload/delete without optional presign/listBuckets", () => {
    const { engine } = scripted([])
    const clearance = engine.clearance()
    expect(clearance.has("read")).toBe(true)
    expect(clearance.has("download")).toBe(true)
    expect(clearance.has("upload")).toBe(true)
    expect(clearance.has("delete")).toBe(true)
    expect(clearance.has("presign")).toBe(false)
    expect(clearance.has("list_buckets")).toBe(false)
    const asDarshan: Darshan = engine
    expect(asDarshan.presign).toBeUndefined()
    expect(asDarshan.listBuckets).toBeUndefined()
  })

  it("is enrolled in createAkademiya", () => {
    const akademiya = createAkademiya()
    expect(akademiya.knows("webdav")).toBe(true)
    expect(akademiya.summon(GNOSIS).typeName).toBe("webdav")
  })

  it("requires https when credentials are configured", () => {
    expect(
      () =>
        new WebdavDarshan({
          name: "plain",
          type: "webdav",
          raw: { url: "http://dav.example.com/dav/", user: "alice", pass: "secret" },
        }),
    ).toThrow(ForbiddenKnowledge)
  })

  it("lists a collection with PROPFIND Depth 1 and maps capsules", async () => {
    const { engine, seen } = scripted([
      multistatus(
        [
          davResponse("/dav/vault/photos/", "<D:resourcetype><D:collection/></D:resourcetype>"),
          davResponse(
            "/dav/vault/photos/sub/",
            "<D:displayname>sub</D:displayname><D:resourcetype><D:collection/></D:resourcetype>",
          ),
          davResponse(
            "/dav/vault/photos/a%20file.txt",
            "<D:displayname>a file.txt</D:displayname><D:getcontentlength>5</D:getcontentlength><D:getlastmodified>Thu, 11 Jun 2026 03:00:00 GMT</D:getlastmodified><D:getetag>&quot;abc&quot;</D:getetag><D:resourcetype/>",
          ),
        ].join(""),
      ),
    ])

    const capsules = await engine.listObjects("vault", "photos")

    expect(capsules.map((c) => c.name)).toEqual(["a file.txt", "sub"])
    expect(capsules[0]).toEqual({
      key: "photos/a file.txt",
      name: "a file.txt",
      isDir: false,
      size: 5,
      lastModified: "2026-06-11T03:00:00.000Z",
      etag: '"abc"',
    })
    expect(capsules[1]).toEqual({ key: "photos/sub/", name: "sub", isDir: true })
    expect(seen[0]?.method).toBe("PROPFIND")
    expect(seen[0]?.url).toBe("https://dav.example.com/dav/vault/photos/")
    expect(seen[0]?.headers.get("Depth")).toBe("1")
    expect(seen[0]?.headers.get("Authorization")).toBe("Basic YWxpY2U6c2VjcmV0")
  })

  it("stats with HEAD when the server supports it", async () => {
    const { engine, seen } = scripted([
      new Response(null, {
        status: 200,
        headers: {
          "content-length": "12",
          "last-modified": "Thu, 11 Jun 2026 04:00:00 GMT",
          etag: '"head"',
        },
      }),
    ])

    await expect(engine.stat("vault", "file.txt")).resolves.toEqual({
      key: "file.txt",
      isDir: false,
      size: 12,
      lastModified: "2026-06-11T04:00:00.000Z",
      etag: '"head"',
    })
    expect(seen[0]?.method).toBe("HEAD")
  })

  it("falls back to PROPFIND Depth 0 when HEAD is not supported", async () => {
    const { engine, seen } = scripted([
      new Response(null, { status: 405 }),
      multistatus(
        davResponse(
          "/dav/vault/file.txt",
          "<D:getcontentlength>7</D:getcontentlength><D:getlastmodified>Thu, 11 Jun 2026 05:00:00 GMT</D:getlastmodified><D:resourcetype/>",
        ),
      ),
    ])

    await expect(engine.stat("vault", "file.txt")).resolves.toEqual({
      key: "file.txt",
      isDir: false,
      size: 7,
      lastModified: "2026-06-11T05:00:00.000Z",
    })
    expect(seen.map((call) => call.method)).toEqual(["HEAD", "PROPFIND"])
    expect(seen[1]?.headers.get("Depth")).toBe("0")
  })

  it("reads bytes, honoring maxBytes", async () => {
    const { engine } = scripted([new Response("konnichiwa")])
    const bytes = await engine.readBytes("vault", "hello.txt", 5)
    expect(new TextDecoder().decode(bytes)).toBe("konni")
  })

  it("downloads to a destination path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "akasha-webdav-"))
    try {
      const { engine } = scripted([new Response("downloaded")])
      const dest = join(dir, "nested", "out.txt")
      const returned = await engine.download("vault", "src.txt", dest)
      expect(returned).toBe(dest)
      expect(await readFile(dest, "utf8")).toBe("downloaded")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("creates parent collections before upload and returns the key", async () => {
    const { engine, seen } = scripted([
      new Response(null, { status: 405 }),
      new Response(null, { status: 201 }),
      new Response(null, { status: 201 }),
    ])
    const key = await engine.uploadFile("vault", new TextEncoder().encode("written"), "out/new.txt")

    expect(key).toBe("out/new.txt")
    expect(seen.map((call) => call.method)).toEqual(["MKCOL", "MKCOL", "PUT"])
    expect(seen.map((call) => call.url)).toEqual([
      "https://dav.example.com/dav/vault",
      "https://dav.example.com/dav/vault/out",
      "https://dav.example.com/dav/vault/out/new.txt",
    ])
  })

  it("deletes a resource", async () => {
    const { engine, seen } = scripted([new Response(null, { status: 204 })])
    await engine.delete("vault", "gone.txt")
    expect(seen[0]?.method).toBe("DELETE")
    expect(seen[0]?.url).toBe("https://dav.example.com/dav/vault/gone.txt")
  })

  it("maps 404 to CapsuleNotFound and network failures to BackendFault", async () => {
    const missing = scripted([new Response(null, { status: 404 })])
    await expect(missing.engine.readBytes("vault", "missing.txt")).rejects.toBeInstanceOf(
      CapsuleNotFound,
    )

    const failed = scripted([new TypeError("secret socket detail")])
    let caught: unknown
    try {
      await failed.engine.listObjects("vault")
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(BackendFault)
    if (caught instanceof BackendFault) {
      expect(caught.message).toBe("WebDAV list failed: TypeError")
      expect(caught.message).not.toContain("secret")
    }
  })

  it("maps malformed multistatus hrefs to BackendFault", async () => {
    const { engine } = scripted([
      multistatus(davResponse("/dav/vault/%E0%A4%A", "<D:resourcetype/>")),
    ])

    await expect(engine.listObjects("vault")).rejects.toThrow(BackendFault)
  })
})
