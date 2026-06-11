import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseRcloneConf } from "../config/rclone.ts"
import { ForbiddenKnowledge } from "../core/darshan.ts"
import { createAkademiya } from "../engines/index.ts"
import { Browser, parseAddress } from "./browser.ts"

describe("parseAddress", () => {
  it("splits remote:bucket/prefix", () => {
    expect(parseAddress("home:vault/docs")).toEqual({
      remote: "home",
      bucket: "vault",
      path: "docs",
    })
  })

  it("handles bucket-only and remote-only", () => {
    expect(parseAddress("home:vault")).toEqual({ remote: "home", bucket: "vault", path: "" })
    expect(parseAddress("home:")).toEqual({ remote: "home", bucket: "", path: "" })
  })

  it("rejects a missing colon and traversal", () => {
    expect(() => parseAddress("novault")).toThrow(ForbiddenKnowledge)
    expect(() => parseAddress("home:vault/../../etc")).toThrow(ForbiddenKnowledge)
  })
})

describe("Browser (end-to-end: config -> summon -> list)", () => {
  let root: string
  let browser: Browser

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "akasha-browser-"))
    await Bun.write(join(root, "vault", "readme.md"), "# hi")
    const conf = `[home]\ntype = local\nroot = ${root}\n`
    const remotes = parseRcloneConf(conf)
    browser = new Browser(remotes, createAkademiya())
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it("lists a directory through the summoned engine", async () => {
    const capsules = await browser.list("home:vault")
    expect(capsules.map((c) => c.name)).toEqual(["readme.md"])
  })

  it("reads a file through the summoned engine", async () => {
    const bytes = await browser.read("home:vault/readme.md")
    expect(new TextDecoder().decode(bytes)).toBe("# hi")
  })

  it("rejects an unknown remote", async () => {
    await expect(browser.list("ghost:vault")).rejects.toThrow(ForbiddenKnowledge)
  })
})
