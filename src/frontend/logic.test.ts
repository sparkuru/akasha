import { describe, expect, it } from "bun:test"
import { treaty } from "@elysiajs/eden"
import { appWith, readOnly, s3like } from "../server/fake-darshan.ts"
import {
  type AkashaClient,
  can,
  deleteObject,
  errorText,
  listBuckets,
  listObjects,
  listRemotes,
  makeRef,
  objectUrl,
  uploadObject,
} from "./logic.ts"

/**
 * Tier A — DOM-free logic against `treaty(appWith(fake))`, zero network.
 *
 * Mirrors `src/server/app.test.ts`: the client is built from an in-memory App
 * instance, so these tests prove the load-bearing M5 behaviors (capability gating
 * off `clearance`, error surfacing off `AkashaError`) without a browser or fetch.
 */
function client(...remotes: Parameters<typeof appWith>): AkashaClient {
  return treaty(appWith(...remotes)) as AkashaClient
}

describe("can() — capability gating", () => {
  it("reads clearance straight from the remote, no probing", () => {
    const full = { name: "s3r", type: "fake", clearance: ["upload", "delete"] as const }
    expect(can({ ...full, clearance: [...full.clearance] }, "upload")).toBe(true)
    expect(can({ name: "ro", type: "fake", clearance: ["read"] }, "upload")).toBe(false)
  })
})

describe("errorText() — error surfacing", () => {
  it("maps each AkashaError code to a human line, never a raw stack", () => {
    expect(errorText({ code: "forbidden_knowledge", message: "no" })).toBe("No clearance: no")
    expect(errorText({ code: "validation", message: "bad" })).toBe("Bad input: bad")
    expect(errorText({ code: "not_found", message: "gone" })).toBe("Not found: gone")
    expect(errorText({ code: "backend_error", message: "boom" })).toBe("boom")
  })
})

describe("listRemotes()", () => {
  it("returns remotes with their clearance set", async () => {
    const out = await listRemotes(client(s3like, readOnly))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toEqual([
      {
        name: "s3r",
        type: "fake",
        clearance: ["list_buckets", "read", "download", "upload", "delete", "presign"],
      },
      { name: "ro", type: "fake", clearance: ["read"] },
    ])
    const [s3, ro] = out.value
    if (!s3 || !ro) throw new Error("expected two remotes")
    expect(can(s3, "upload")).toBe(true)
    expect(can(ro, "upload")).toBe(false)
  })
})

describe("listObjects()", () => {
  it("returns capsules on success", async () => {
    const out = await listObjects(client(s3like), makeRef("s3r", "bucket/sub"))
    expect(out).toEqual({
      ok: true,
      value: [{ key: "a.txt", name: "a.txt", isDir: false, size: 3 }],
    })
  })

  it("surfaces a not_found AkashaError without throwing", async () => {
    const out = await listObjects(client(s3like), makeRef("s3r", "bucket/missing"))
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.error.code).toBe("not_found")
    expect(errorText(out.error)).toContain("Not found")
  })

  it("surfaces forbidden_knowledge for an unknown remote", async () => {
    const out = await listObjects(client(s3like), "ghost:bucket/x")
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.error.code).toBe("forbidden_knowledge")
  })
})

describe("listBuckets()", () => {
  it("lists buckets for a list_buckets-capable remote", async () => {
    const out = await listBuckets(client(s3like), "s3r")
    expect(out).toEqual({ ok: true, value: ["one", "two"] })
  })

  it("surfaces forbidden_knowledge when the remote lacks list_buckets", async () => {
    const out = await listBuckets(client(readOnly), "ro")
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.error.code).toBe("forbidden_knowledge")
  })
})

describe("objectUrl()", () => {
  it("returns kind:presigned for a presign-capable remote", async () => {
    const out = await objectUrl(client(s3like), makeRef("s3r", "bucket/a.txt"), 120)
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.kind).toBe("presigned")
    expect(out.value.expiresIn).toBe(120)
  })

  it("returns kind:proxy for a non-presign remote", async () => {
    const out = await objectUrl(client(readOnly), makeRef("ro", "bucket/a.txt"))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.kind).toBe("proxy")
    expect(out.value.url).toContain("/api/object/read")
  })
})

describe("uploadObject()", () => {
  it("uploads a File and echoes the stored key", async () => {
    const file = new File(["payload"], "up.txt")
    const out = await uploadObject(client(s3like), makeRef("s3r", "bucket/sub/up.txt"), file)
    expect(out).toEqual({ ok: true, value: { ok: true, key: "sub/up.txt", size: 7 } })
  })

  it("surfaces forbidden_knowledge when the remote lacks upload", async () => {
    const file = new File(["x"], "up.txt")
    const out = await uploadObject(client(readOnly), makeRef("ro", "bucket/up.txt"), file)
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.error.code).toBe("forbidden_knowledge")
  })
})

describe("deleteObject()", () => {
  it("deletes for a delete-capable remote", async () => {
    const out = await deleteObject(client(s3like), makeRef("s3r", "bucket/a.txt"))
    expect(out).toEqual({ ok: true, value: true })
  })
})
