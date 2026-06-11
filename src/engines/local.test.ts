import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type Darshan, ForbiddenKnowledge } from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { LocalDarshan } from "./local.ts"

const BUCKET = "vault"

describe("LocalDarshan", () => {
  let root: string
  let engine: LocalDarshan

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "akasha-local-"))
    await Bun.write(join(root, BUCKET, "hello.txt"), "konnichiwa")
    await Bun.write(join(root, BUCKET, "nested", "deep.txt"), "deep content")
    const gnosis: Gnosis = { name: "home", type: "local", raw: { root } }
    engine = new LocalDarshan(gnosis)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it("declares typeName and requiredGnosis literally", () => {
    expect(LocalDarshan.typeName).toBe("local")
    expect(engine.typeName).toBe("local")
    expect(LocalDarshan.requiredGnosis()).toEqual(new Set(["root"]))
  })

  it("clearance omits presign and list_buckets", () => {
    const clearance = engine.clearance()
    expect(clearance.has("read")).toBe(true)
    expect(clearance.has("download")).toBe(true)
    expect(clearance.has("upload")).toBe(true)
    expect(clearance.has("delete")).toBe(true)
    expect(clearance.has("presign")).toBe(false)
    expect(clearance.has("list_buckets")).toBe(false)
  })

  it("does not implement the optional presign/listBuckets methods", () => {
    // viewed through the Darshan interface, the optional methods are absent
    const asDarshan: Darshan = engine
    expect(asDarshan.presign).toBeUndefined()
    expect(asDarshan.listBuckets).toBeUndefined()
  })

  it("lists a directory into Capsules with isDir/size", async () => {
    const capsules = await engine.listObjects(BUCKET)
    const names = capsules.map((c) => c.name)
    expect(names).toEqual(["hello.txt", "nested"])

    const file = capsules.find((c) => c.name === "hello.txt")
    expect(file?.isDir).toBe(false)
    expect(file?.size).toBe("konnichiwa".length)
    expect(file?.key).toBe("hello.txt")
    expect(file?.lastModified).toBeDefined()

    const dir = capsules.find((c) => c.name === "nested")
    expect(dir?.isDir).toBe(true)
    expect(dir?.key).toBe("nested/")
    expect(dir?.size).toBeUndefined()
  })

  it("lists a nested prefix", async () => {
    const capsules = await engine.listObjects(BUCKET, "nested")
    expect(capsules.map((c) => c.name)).toEqual(["deep.txt"])
    expect(capsules[0]?.key).toBe("nested/deep.txt")
  })

  it("reads file bytes, honoring maxBytes", async () => {
    const all = await engine.readBytes(BUCKET, "hello.txt")
    expect(new TextDecoder().decode(all)).toBe("konnichiwa")

    const clipped = await engine.readBytes(BUCKET, "hello.txt", 5)
    expect(new TextDecoder().decode(clipped)).toBe("konni")
  })

  it("stats a file", async () => {
    const info = await engine.stat(BUCKET, "hello.txt")
    expect(info.size).toBe("konnichiwa".length)
    expect(info.isDir).toBe(false)
  })

  it("uploads then deletes a file", async () => {
    await engine.uploadFile(BUCKET, new TextEncoder().encode("written"), "out/new.txt")
    const back = await engine.readBytes(BUCKET, "out/new.txt")
    expect(new TextDecoder().decode(back)).toBe("written")

    await engine.delete(BUCKET, "out/new.txt")
    await expect(engine.readBytes(BUCKET, "out/new.txt")).rejects.toThrow()
  })

  it("rejects traversal that escapes the root", async () => {
    await expect(engine.listObjects(BUCKET, "../../etc")).rejects.toThrow(ForbiddenKnowledge)
  })
})
