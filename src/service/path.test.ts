import { describe, expect, it } from "bun:test"
import { ForbiddenKnowledge } from "../core/darshan.ts"
import { purify, seal } from "./path.ts"

describe("purify", () => {
  it("normalizes slashes and strips empty/dot segments", () => {
    expect(purify("/a//b/./c/")).toBe("a/b/c")
    expect(purify("a\\b\\c")).toBe("a/b/c")
    expect(purify("")).toBe("")
  })

  it("rejects .. traversal", () => {
    expect(() => purify("a/../../etc")).toThrow(ForbiddenKnowledge)
    expect(() => purify("..")).toThrow(ForbiddenKnowledge)
    expect(() => purify("foo/../../bar")).toThrow(ForbiddenKnowledge)
  })
})

describe("seal", () => {
  it("re-attaches a trailing slash for directories", () => {
    expect(seal("a/b", true)).toBe("a/b/")
    expect(seal("a/b", false)).toBe("a/b")
    expect(seal("", true)).toBe("")
  })

  it("rejects .. traversal", () => {
    expect(() => seal("../x", true)).toThrow(ForbiddenKnowledge)
  })
})
