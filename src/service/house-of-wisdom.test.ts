import { describe, expect, it } from "bun:test"
import type { Capsule } from "../core/capsule.ts"
import { type Irminsul, recordDirectory } from "./house-of-wisdom.ts"

const ITEMS: Capsule[] = [
  {
    key: "hello.txt",
    name: "hello.txt",
    isDir: false,
    size: 10,
    lastModified: "2026-01-01T00:00:00.000Z",
  },
  { key: "nested/", name: "nested", isDir: true },
]

function empty(): Irminsul {
  return { version: 1, directories: {} }
}

describe("recordDirectory", () => {
  it("writes a snapshot with the decided shape", () => {
    const out = recordDirectory(empty(), "vault", "", ITEMS, "2026-06-11T10:00:00.000Z")
    const dir = out.directories.vault
    expect(dir).toBeDefined()
    expect(dir?.bucket).toBe("vault")
    expect(dir?.prefix).toBe("")
    expect(dir?.item_count).toBe(2)
    expect(dir?.first_indexed_at).toBe("2026-06-11T10:00:00.000Z")
    expect(dir?.indexed_at).toBe("2026-06-11T10:00:00.000Z")
    expect(dir?.items[0]).toEqual({
      name: "hello.txt",
      path: "hello.txt",
      type: "file",
      size: 10,
      modified: "2026-01-01T00:00:00.000Z",
    })
    expect(dir?.items[1]).toEqual({ name: "nested", path: "nested/", type: "dir" })
  })

  it("keys nested prefixes as bucket/prefix and normalizes the trailing slash", () => {
    const out = recordDirectory(empty(), "vault", "docs", ITEMS, "2026-06-11T10:00:00.000Z")
    const dir = out.directories["vault/docs"]
    expect(dir).toBeDefined()
    expect(dir?.prefix).toBe("docs/")
  })

  it("preserves first_indexed_at and refreshes indexed_at on re-entry", () => {
    const first = recordDirectory(empty(), "vault", "", ITEMS, "2026-06-11T10:00:00.000Z")
    const second = recordDirectory(
      first,
      "vault",
      "",
      ITEMS.slice(0, 1),
      "2026-06-12T12:00:00.000Z",
    )
    const dir = second.directories.vault
    expect(dir?.first_indexed_at).toBe("2026-06-11T10:00:00.000Z")
    expect(dir?.indexed_at).toBe("2026-06-12T12:00:00.000Z")
    expect(dir?.item_count).toBe(1)
  })
})
