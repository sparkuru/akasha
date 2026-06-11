import type { Capsule } from "../core/capsule.ts"

/**
 * HouseOfWisdom (Bayt al-Hikmah) — directory snapshot persistence to
 * `irminsul.json`.
 *
 * Each visited directory writes a snapshot of its direct children; re-entry
 * updates in place. `first_indexed_at` is preserved across re-entries;
 * `indexed_at` refreshes on every write (see
 * `.trellis/spec/service/service-guidelines.md`).
 */

/** Default on-disk index file (the Irminsul, root of knowledge). */
export const DEFAULT_IRMINSUL = "irminsul.json"

/** One persisted child of a directory snapshot. Plain object, append-friendly. */
export interface IrminsulItem {
  name: string
  path: string
  type: "file" | "dir"
  size?: number
  modified?: string
}

/** A single directory snapshot. */
export interface IrminsulDirectory {
  path: string
  bucket: string
  prefix: string
  first_indexed_at: string
  indexed_at: string
  item_count: number
  items: IrminsulItem[]
}

/** The whole index file shape. */
export interface Irminsul {
  version: 1
  directories: Record<string, IrminsulDirectory>
}

function emptyIrminsul(): Irminsul {
  return { version: 1, directories: {} }
}

/** Load the index from disk, or return an empty one if the file is absent. */
export async function loadIrminsul(path: string = DEFAULT_IRMINSUL): Promise<Irminsul> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return emptyIrminsul()
  }
  const parsed = (await file.json()) as Irminsul
  return parsed
}

/** Persist the index to disk (pretty-printed). */
export async function saveIrminsul(
  irminsul: Irminsul,
  path: string = DEFAULT_IRMINSUL,
): Promise<void> {
  await Bun.write(path, `${JSON.stringify(irminsul, null, 2)}\n`)
}

/** Map a `Capsule` to the persisted item shape. */
function toItem(capsule: Capsule): IrminsulItem {
  const item: IrminsulItem = {
    name: capsule.name,
    path: capsule.key,
    type: capsule.isDir ? "dir" : "file",
  }
  if (capsule.size !== undefined) item.size = capsule.size
  if (capsule.lastModified !== undefined) item.modified = capsule.lastModified
  return item
}

/**
 * Record (or update) the snapshot for one directory.
 *
 * `first_indexed_at` is preserved when the directory was already indexed;
 * `indexed_at` is set to `now` on every call. Pure: returns a new `Irminsul`.
 */
export function recordDirectory(
  irminsul: Irminsul,
  bucket: string,
  prefix: string,
  items: readonly Capsule[],
  now: string = new Date().toISOString(),
): Irminsul {
  const normalizedPrefix = prefix === "" ? "" : prefix.endsWith("/") ? prefix : `${prefix}/`
  const key = normalizedPrefix === "" ? bucket : `${bucket}/${stripSlash(normalizedPrefix)}`
  const existing = irminsul.directories[key]
  const snapshot: IrminsulDirectory = {
    path: key,
    bucket,
    prefix: normalizedPrefix,
    first_indexed_at: existing?.first_indexed_at ?? now,
    indexed_at: now,
    item_count: items.length,
    items: items.map(toItem),
  }
  return {
    version: 1,
    directories: { ...irminsul.directories, [key]: snapshot },
  }
}

function stripSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s
}
