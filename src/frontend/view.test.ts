import { GlobalRegistrator } from "@happy-dom/global-registrator"

// Register a DOM into Bun's global scope BEFORE the view layer builds any nodes.
GlobalRegistrator.register()

import { afterAll, describe, expect, it } from "bun:test"
import type { Capsule, Remote } from "./logic.ts"
import { renderError, renderObjectTable, renderToolbar } from "./view.ts"

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
const file: Capsule = { key: "a.txt", name: "a.txt", isDir: false, size: 3 }
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
