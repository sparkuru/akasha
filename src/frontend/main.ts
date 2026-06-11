import { client } from "./client.ts"
import {
  type Capsule,
  type Outcome,
  type Remote,
  capsuleFromStat,
  deleteObject,
  listBuckets,
  listObjects,
  listRemotes,
  makeRef,
  objectUrl,
  readIndex,
  recallIndex,
  shouldTryObjectFallback,
  statObject,
  uploadObject,
} from "./logic.ts"
import {
  el,
  renderError,
  renderIndex,
  renderObjectTable,
  renderPathEntry,
  renderPreview,
  renderRemoteList,
  renderToolbar,
} from "./view.ts"

/**
 * Frontend controller — wires the typed client to the view.
 *
 * Browser-only (touches `document`/`location` at load), so it is NOT unit-tested:
 * the load-bearing decisions live in `logic.ts` (Tier A) and rendering in
 * `view.ts` (Tier B). This file is the thin glue that holds navigation state and
 * routes `Outcome` failures to a single error banner.
 */

const root = document.getElementById("app")
if (!root) throw new Error("missing #app root")

const sidebar = el("aside", { id: "sidebar" })
const main = el("main", { id: "main" })
const banner = el("div", { id: "banner" })
root.append(banner, sidebar, main)

/** Current navigation context. */
const state: { remote: Remote | undefined; ref: string | undefined } = {
  remote: undefined,
  ref: undefined,
}

function showError(error: Parameters<typeof renderError>[0]): void {
  banner.replaceChildren(renderError(error))
}

function clearError(): void {
  banner.replaceChildren()
}

/** Unwrap an `Outcome`, surfacing the error banner and returning null on failure. */
function take<T>(outcome: Outcome<T>): T | null {
  if (!outcome.ok) {
    showError(outcome.error)
    return null
  }
  clearError()
  return outcome.value
}

async function refreshRemotes(): Promise<void> {
  const remotes = take(await listRemotes(client))
  if (!remotes) return
  sidebar.replaceChildren(el("h2", {}, "Remotes"), renderRemoteList(remotes, selectRemote))
}

async function selectRemote(remote: Remote): Promise<void> {
  state.remote = remote
  state.ref = undefined
  clearError()
  main.replaceChildren(el("h2", {}, remote.name), remotePathEntry(remote))
}

async function showBuckets(remote: Remote): Promise<void> {
  state.remote = remote
  const buckets = take(await listBuckets(client, remote.name))
  if (!buckets) return
  const list = el("ul", { class: "buckets" })
  for (const bucket of buckets) {
    const button = el("button", { type: "button", class: "bucket" }, bucket)
    button.addEventListener("click", () => openRef(makeRef(remote.name, bucket)))
    list.append(el("li", {}, button))
  }
  main.replaceChildren(el("h2", {}, `${remote.name} buckets`), remotePathEntry(remote), list)
}

function remotePathEntry(remote: Remote): HTMLElement {
  return renderPathEntry(remote, {
    onOpen: (path) => void openRef(makeRef(remote.name, path), { objectFallback: true }),
    onListBuckets: () => void showBuckets(remote),
  })
}

async function openRef(ref: string, options: { objectFallback?: boolean } = {}): Promise<void> {
  const remote = state.remote
  if (!remote) return
  state.ref = ref
  const capsules = take(await listObjects(client, ref))
  if (!capsules) return
  if (options.objectFallback === true && shouldTryObjectFallback(ref, capsules)) {
    const openedObject = await openObjectRef(remote, ref)
    if (openedObject) return
  }
  const toolbar = renderToolbar(
    remote,
    (file) => upload(ref, file),
    () => refreshIndex(ref),
  )
  const table = renderObjectTable(remote, capsules, {
    onOpen: (capsule) => navigate(ref, capsule),
    onDownload: (capsule) => download(childRef(ref, capsule)),
    onDelete: (capsule) => remove(childRef(ref, capsule)),
  })
  main.replaceChildren(el("h2", {}, ref), remotePathEntry(remote), toolbar, table)
}

async function openObjectRef(remote: Remote, ref: string): Promise<boolean> {
  const stat = await statObject(client, ref)
  if (!stat.ok) return false
  clearError()
  const capsule = capsuleFromStat(ref, stat.value)
  const table = renderObjectTable(remote, [capsule], {
    onOpen: () => download(ref),
    onDownload: () => download(ref),
    onDelete: () => remove(ref),
  })
  main.replaceChildren(el("h2", {}, ref), remotePathEntry(remote), table)
  return true
}

/** Join a directory ref with a child entry's name. */
function childRef(ref: string, capsule: Capsule): string {
  const base = ref.endsWith("/") || ref.endsWith(":") ? ref : `${ref}/`
  return `${base}${capsule.name}`
}

function navigate(ref: string, capsule: Capsule): void {
  if (capsule.isDir) void openRef(childRef(ref, capsule))
  else void preview(childRef(ref, capsule), capsule.name)
}

/** Preview a small file by fetching its proxy/presigned URL and showing the body. */
async function preview(ref: string, name: string): Promise<void> {
  const info = take(await objectUrl(client, ref))
  if (!info) return
  main.querySelector(".preview")?.remove()
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
  if (isImage) {
    main.append(renderPreview(name, el("img", { src: info.url, alt: name })))
    return
  }
  const res = await fetch(info.url)
  main.append(renderPreview(name, await res.text()))
}

async function download(ref: string): Promise<void> {
  const info = take(await objectUrl(client, ref))
  if (!info) return
  const anchor = el("a", { href: info.url, download: "", target: "_blank", rel: "noopener" })
  anchor.click()
}

async function upload(ref: string, file: File): Promise<void> {
  const target = makeRefWithName(ref, file.name)
  const result = take(await uploadObject(client, target, file))
  if (result) await openRef(ref)
}

/** Build the upload target ref by appending the file name to the current dir. */
function makeRefWithName(ref: string, name: string): string {
  const base = ref.endsWith("/") || ref.endsWith(":") ? ref : `${ref}/`
  return `${base}${name}`
}

async function remove(ref: string): Promise<void> {
  if (!confirm(`Delete ${ref}?`)) return
  const result = take(await deleteObject(client, ref))
  if (result && state.ref) await openRef(state.ref)
}

async function refreshIndex(ref: string): Promise<void> {
  const recalled = take(await recallIndex(client, ref))
  if (!recalled) return
  const index = take(await readIndex(client))
  if (index !== null) main.append(renderIndex(index))
}

void refreshRemotes()
