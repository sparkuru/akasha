import type { AkashaError } from "../server/schemas.ts"
import { type Capsule, type Remote, can, errorText } from "./logic.ts"

/**
 * Frontend view layer — pure DOM construction, no network.
 *
 * Every function takes already-fetched data plus event callbacks and returns a
 * detached `HTMLElement`; it never calls the client itself. Capability gating is
 * read straight from `remote.clearance` via `logic.can()` — a disabled/absent
 * button, not a try/catch probe. This split keeps rendering Tier-B testable under
 * `@happy-dom` while the load-bearing decisions stay in `logic.ts` (Tier A).
 */

type Attrs = Record<string, string | boolean | undefined>

/** Tiny `createElement` helper: tag + attrs + children (strings become text nodes). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (value === true) node.setAttribute(key, "")
    else node.setAttribute(key, value)
  }
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child)
  }
  return node
}

/** A dismissable error banner carrying the human-mapped `AkashaError` line. */
export function renderError(error: AkashaError): HTMLElement {
  return el("div", { class: "toast error", role: "alert" }, errorText(error))
}

/** The remote picker: one button per remote, typed name + clearance count. */
export function renderRemoteList(
  remotes: Remote[],
  onSelect: (remote: Remote) => void,
): HTMLElement {
  const list = el("ul", { class: "remotes" })
  for (const remote of remotes) {
    const button = el(
      "button",
      { type: "button", class: "remote", "data-remote": remote.name },
      `${remote.name} (${remote.type})`,
    )
    button.addEventListener("click", () => onSelect(remote))
    list.append(el("li", {}, button))
  }
  return list
}

/** Handlers wired by the controller; each receives the row's full ref. */
export interface ObjectHandlers {
  onOpen: (capsule: Capsule) => void
  onDownload: (capsule: Capsule) => void
  onDelete: (capsule: Capsule) => void
}

/**
 * The object table for a directory. Per-row action buttons are gated by the
 * remote's clearance: download needs `download`/`presign`, delete needs `delete`.
 */
export function renderObjectTable(
  remote: Remote,
  capsules: Capsule[],
  handlers: ObjectHandlers,
): HTMLElement {
  const canDownload = can(remote, "download") || can(remote, "presign")
  const canDelete = can(remote, "delete")
  const table = el("table", { class: "objects" })
  for (const capsule of capsules) {
    const name = el(
      "button",
      { type: "button", class: capsule.isDir ? "name dir" : "name" },
      capsule.isDir ? `${capsule.name}/` : capsule.name,
    )
    name.addEventListener("click", () => handlers.onOpen(capsule))

    const actions = el("td", { class: "actions" })
    if (!capsule.isDir) {
      const dl = el("button", { type: "button", class: "download", disabled: !canDownload }, "↓")
      if (canDownload) dl.addEventListener("click", () => handlers.onDownload(capsule))
      const del = el("button", { type: "button", class: "delete", disabled: !canDelete }, "✕")
      if (canDelete) del.addEventListener("click", () => handlers.onDelete(capsule))
      actions.append(dl, del)
    }

    table.append(
      el(
        "tr",
        { class: capsule.isDir ? "row dir" : "row" },
        el("td", { class: "cell-name" }, name),
        el("td", { class: "cell-size" }, capsule.size === undefined ? "" : String(capsule.size)),
        actions,
      ),
    )
  }
  return table
}

/**
 * The action toolbar for the current remote+path. The upload control is rendered
 * only when the remote has `upload` clearance; otherwise it is omitted entirely.
 */
export function renderToolbar(
  remote: Remote,
  onUpload: (file: File) => void,
  onRefreshIndex: () => void,
): HTMLElement {
  const bar = el("div", { class: "toolbar" })
  if (can(remote, "upload")) {
    const input = el("input", { type: "file", class: "upload-input" })
    input.addEventListener("change", () => {
      const file = input.files?.[0]
      if (file) onUpload(file)
    })
    bar.append(el("label", { class: "upload" }, "Upload", input))
  }
  const reindex = el("button", { type: "button", class: "reindex" }, "Refresh index")
  reindex.addEventListener("click", () => onRefreshIndex())
  bar.append(reindex)
  return bar
}

/** A text preview pane (small files); binary previews use an image/object URL. */
export function renderPreview(name: string, body: Node | string): HTMLElement {
  return el("section", { class: "preview" }, el("h3", {}, name), el("pre", {}, body))
}

/** Pretty-print the persisted index JSON. */
export function renderIndex(index: unknown): HTMLElement {
  return el("section", { class: "index" }, el("pre", {}, JSON.stringify(index, null, 2)))
}
