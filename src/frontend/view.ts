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
  selectedName?: string,
): HTMLElement {
  const list = el("ul", { class: "remotes" })
  for (const remote of remotes) {
    const selected = remote.name === selectedName
    const button = el(
      "button",
      {
        type: "button",
        class: selected ? "remote selected" : "remote",
        "data-remote": remote.name,
        "aria-pressed": selected ? "true" : "false",
      },
      el("span", { class: "remote-name" }, remote.name),
      el("span", { class: "remote-meta" }, `${remote.type} · ${remote.clearance.length} caps`),
    )
    button.addEventListener("click", () => onSelect(remote))
    list.append(el("li", {}, button))
  }
  return list
}

export interface PathEntryHandlers {
  onOpen: (path: string) => void
  onListBuckets?: () => void
}

/** Manual `bucket/prefix` entry; avoids requiring list_buckets clearance. */
export function renderPathEntry(remote: Remote, handlers: PathEntryHandlers): HTMLElement {
  const form = el("form", { class: "path-entry" })
  const prefix = el("span", { class: "path-prefix" }, `${remote.name}:`)
  const input = el("input", {
    type: "text",
    class: "path-input",
    name: "path",
    placeholder: "bucket/prefix",
    autocomplete: "off",
    "aria-label": "Object path",
  })
  const open = el("button", { type: "submit", class: "path-open primary" }, "Open")
  form.addEventListener("submit", (event) => {
    event.preventDefault()
    handlers.onOpen(input.value.trim())
  })
  form.append(prefix, input, open)
  if (can(remote, "list_buckets") && handlers.onListBuckets !== undefined) {
    const buckets = el("button", { type: "button", class: "list-buckets secondary" }, "Buckets")
    buckets.addEventListener("click", () => handlers.onListBuckets?.())
    form.append(buckets)
  }
  return form
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
  const wrap = el("section", { class: "object-list" })
  const table = el("table", { class: "objects" })
  table.append(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { class: "cell-kind" }, "Type"),
        el("th", { class: "cell-name" }, "Name"),
        el("th", { class: "cell-size" }, "Size"),
        el("th", { class: "cell-modified" }, "Modified"),
        el("th", { class: "actions" }, "Actions"),
      ),
    ),
  )
  const body = el("tbody")
  for (const capsule of capsules) {
    const name = el(
      "button",
      { type: "button", class: capsule.isDir ? "name dir" : "name" },
      capsule.isDir ? `${capsule.name}/` : capsule.name,
    )
    name.addEventListener("click", () => handlers.onOpen(capsule))

    const actions = el("td", { class: "actions" })
    if (!capsule.isDir) {
      const dl = el(
        "button",
        { type: "button", class: "icon download", disabled: !canDownload, title: "Download" },
        "↓",
      )
      if (canDownload) dl.addEventListener("click", () => handlers.onDownload(capsule))
      const del = el(
        "button",
        { type: "button", class: "icon delete", disabled: !canDelete, title: "Delete" },
        "✕",
      )
      if (canDelete) del.addEventListener("click", () => handlers.onDelete(capsule))
      actions.append(dl, del)
    }

    body.append(
      el(
        "tr",
        { class: capsule.isDir ? "row dir" : "row" },
        el("td", { class: "cell-kind" }, capsule.isDir ? "Folder" : "File"),
        el("td", { class: "cell-name" }, name),
        el("td", { class: "cell-size" }, capsule.isDir ? "" : formatSize(capsule.size)),
        el("td", { class: "cell-modified" }, formatDate(capsule.lastModified)),
        actions,
      ),
    )
  }
  table.append(body)
  wrap.append(table)
  if (capsules.length === 0) {
    wrap.append(el("div", { class: "empty-state" }, "No objects at this path"))
  }
  return wrap
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
    bar.append(el("label", { class: "upload secondary" }, "Upload", input))
  }
  const reindex = el("button", { type: "button", class: "reindex secondary" }, "Refresh index")
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

function formatSize(size: number | undefined): string {
  if (size === undefined) return ""
  if (size < 1024) return `${size} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = size / 1024
  let unit = units[0] ?? "KB"
  for (const next of units) {
    unit = next
    if (value < 1024 || next === units.at(-1)) break
    value /= 1024
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`
}

function formatDate(value: string | undefined): string {
  if (value === undefined) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
