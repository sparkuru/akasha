import { GlobalRegistrator } from "@happy-dom/global-registrator"

// Register a DOM into Bun's global scope BEFORE the view layer builds any nodes.
GlobalRegistrator.register()

import { afterAll, describe, expect, it } from "bun:test"
import type { Capsule, Remote } from "./logic.ts"
import {
  renderError,
  renderObjectTable,
  renderPathEntry,
  renderRemoteList,
  renderToolbar,
} from "./view.ts"

/**
 * Tier B — DOM rendering under `@happy-dom`, no network (a fake data input only).
 *
 * Asserts the handful of genuinely DOM-coupled behaviors: capability-gated button
 * state and the human error line. All decisions still come from `logic.ts`; this
 * only checks they reach the DOM.
 */
afterAll(() => GlobalRegistrator.unregister())

const full: Remote = {
  name: "s3r",
  type: "fake",
  clearance: ["list_buckets", "read", "download", "upload", "delete", "presign"],
}
const readOnly: Remote = { name: "ro", type: "fake", clearance: ["read"] }
const file: Capsule = {
  key: "a.txt",
  name: "a.txt",
  isDir: false,
  size: 3072,
  lastModified: "2026-01-08T03:00:46.000Z",
}
const noop = () => {}
const handlers = { onOpen: noop, onDownload: noop, onDelete: noop }

describe("renderError()", () => {
  it("renders the human-mapped error line", () => {
    const node = renderError({ code: "forbidden_knowledge", message: "no" })
    expect(node.textContent).toBe("No clearance: no")
    expect(node.getAttribute("role")).toBe("alert")
  })
})

describe("renderObjectTable() — capability-gated rows", () => {
  it("renders file-browser columns with formatted metadata", () => {
    const node = renderObjectTable(full, [file], handlers)
    expect(node.querySelector("table.objects")).not.toBeNull()
    expect(node.querySelectorAll("th").length).toBe(5)
    expect(node.querySelector(".cell-kind")?.textContent).toContain("Type")
    expect(node.textContent).toContain("File")
    expect(node.textContent).toContain("3.00 KB")
    expect(node.textContent).toContain("2026")
  })

  it("enables download/delete for a fully-capable remote", () => {
    const table = renderObjectTable(full, [file], handlers)
    expect(table.querySelector<HTMLButtonElement>(".download")?.disabled).toBe(false)
    expect(table.querySelector<HTMLButtonElement>(".delete")?.disabled).toBe(false)
  })

  it("disables download/delete for a read-only remote", () => {
    const table = renderObjectTable(readOnly, [file], handlers)
    expect(table.querySelector<HTMLButtonElement>(".download")?.disabled).toBe(true)
    expect(table.querySelector<HTMLButtonElement>(".delete")?.disabled).toBe(true)
  })

  it("renders an empty state for empty object lists", () => {
    const table = renderObjectTable(full, [], handlers)
    expect(table.querySelector(".empty-state")?.textContent).toBe("No objects at this path")
  })
})

describe("renderPathEntry() — manual path navigation", () => {
  it("submits the typed bucket/prefix path", () => {
    let opened = ""
    const form = renderPathEntry(full, {
      onOpen: (path) => {
        opened = path
      },
      onListBuckets: noop,
    })
    const input = form.querySelector<HTMLInputElement>(".path-input")
    if (!input) throw new Error("missing input")
    input.value = "bucket/allowed/prefix"
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    expect(opened).toBe("bucket/allowed/prefix")
  })

  it("renders the explicit bucket-list action only when available", () => {
    expect(
      renderPathEntry(full, { onOpen: noop, onListBuckets: noop }).querySelector(".list-buckets"),
    ).not.toBeNull()
    expect(
      renderPathEntry(readOnly, { onOpen: noop, onListBuckets: noop }).querySelector(
        ".list-buckets",
      ),
    ).toBeNull()
  })
})

describe("renderRemoteList() — remote metadata", () => {
  it("renders remote type, capability count, and selected state", () => {
    const list = renderRemoteList([full], noop, "s3r")
    const button = list.querySelector<HTMLButtonElement>(".remote")
    expect(button?.classList.contains("selected")).toBe(true)
    expect(button?.getAttribute("aria-pressed")).toBe("true")
    expect(button?.textContent).toContain("fake")
    expect(button?.textContent).toContain("6 caps")
  })
})

describe("renderToolbar() — upload gating", () => {
  it("renders the upload control when the remote has upload clearance", () => {
    const bar = renderToolbar(full, noop, noop)
    expect(bar.querySelector(".upload-input")).not.toBeNull()
  })

  it("omits the upload control when the remote lacks upload clearance", () => {
    const bar = renderToolbar(readOnly, noop, noop)
    expect(bar.querySelector(".upload-input")).toBeNull()
  })
})
