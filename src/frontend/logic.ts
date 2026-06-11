import type { Treaty } from "@elysiajs/eden"
import type { App } from "../server/app.ts"
import type { AkashaError } from "../server/schemas.ts"

/**
 * Frontend logic layer — the load-bearing, DOM-free decisions.
 *
 * This module is the *adapter* brain: which typed call to make, how to surface an
 * `AkashaError`, and which actions a remote's `clearance()` permits. It depends
 * ONLY on the typed `App` contract via Eden (`import type`) — never on `core`,
 * `engines`, `service`, or `server` runtime (see
 * `.trellis/spec/guides/cross-layer-thinking-guide.md`). Keeping it DOM-free lets
 * Tier A tests drive it against `treaty(appWith(fake))` with zero network, exactly
 * like `src/server/app.test.ts`.
 */

/** A capability literal mirroring the server's clearance set. */
export type Capability = "list_buckets" | "read" | "download" | "upload" | "delete" | "presign"

/** A parsed remote with its declared clearance set (the `/api/remotes` shape). */
export interface Remote {
  name: string
  type: string
  clearance: Capability[]
}

/** A listed object/prefix entry (the `Capsule` wire shape). */
export interface Capsule {
  key: string
  name: string
  isDir: boolean
  size?: number
  lastModified?: string
  etag?: string
  storageClass?: string
  extra?: Record<string, unknown>
}

/** The `/api/object/url` response: a presigned absolute URL or a same-origin proxy path. */
export interface UrlInfo {
  url: string
  kind: "presigned" | "proxy"
  expiresIn?: number
}

/** The Eden client type — identical whether built from `location.origin` or `treaty(app)`. */
export type AkashaClient = Treaty.Create<App>

/**
 * A non-throwing result. Treaty never throws by default; failures arrive as an
 * `AkashaError` body, so the UI branches on `ok` instead of try/catch probing.
 */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: AkashaError }

/** Does this remote's clearance permit `cap`? Drives capability-gated controls. */
export function can(remote: Remote, cap: Capability): boolean {
  return remote.clearance.includes(cap)
}

/**
 * Map an `AkashaError` to a single user-facing line — never a raw stack or secret.
 * The server already strips vendor/credential detail; this only adds a human prefix.
 */
export function errorText(error: AkashaError): string {
  switch (error.code) {
    case "forbidden_knowledge":
      return `No clearance: ${error.message}`
    case "validation":
      return `Bad input: ${error.message}`
    case "invalid_gnosis":
      return `Invalid config: ${error.message}`
    case "not_found":
      return `Not found: ${error.message}`
    default:
      return error.message
  }
}

/** Build a `remote:bucket/prefix` ref from parts (no leading/trailing slash noise). */
export function makeRef(remote: string, path: string): string {
  return `${remote}:${path.replace(/^\/+/, "")}`
}

/** Narrow a treaty failure into our `Outcome` error arm. */
function fail<T>(value: unknown): Outcome<T> {
  return { ok: false, error: value as AkashaError }
}

export async function listRemotes(client: AkashaClient): Promise<Outcome<Remote[]>> {
  const { data, error } = await client.api.remotes.get()
  if (error) return fail(error.value)
  return { ok: true, value: data as Remote[] }
}

export async function listBuckets(
  client: AkashaClient,
  remote: string,
): Promise<Outcome<string[]>> {
  const { data, error } = await client.api.buckets.get({ query: { remote } })
  if (error) return fail(error.value)
  return { ok: true, value: data }
}

export async function listObjects(client: AkashaClient, ref: string): Promise<Outcome<Capsule[]>> {
  const { data, error } = await client.api.objects.get({ query: { ref } })
  if (error) return fail(error.value)
  return { ok: true, value: data as Capsule[] }
}

export async function statObject(
  client: AkashaClient,
  ref: string,
): Promise<Outcome<Record<string, unknown>>> {
  const { data, error } = await client.api.object.stat.get({ query: { ref } })
  if (error) return fail(error.value)
  return { ok: true, value: data as Record<string, unknown> }
}

export async function objectUrl(
  client: AkashaClient,
  ref: string,
  expiresIn?: number,
): Promise<Outcome<UrlInfo>> {
  const query = expiresIn === undefined ? { ref } : { ref, expiresIn }
  const { data, error } = await client.api.object.url.get({ query })
  if (error) return fail(error.value)
  return { ok: true, value: data as UrlInfo }
}

export async function uploadObject(
  client: AkashaClient,
  ref: string,
  file: File,
): Promise<Outcome<{ ok: boolean; key: string; size: number }>> {
  const { data, error } = await client.api.object.upload.post({ ref, file })
  if (error) return fail(error.value)
  return { ok: true, value: data }
}

export async function deleteObject(client: AkashaClient, ref: string): Promise<Outcome<true>> {
  // DELETE has no body but a required query → treaty signature is (body, options).
  const { error } = await client.api.object.delete(undefined, { query: { ref } })
  if (error) return fail(error.value)
  return { ok: true, value: true }
}

export async function readIndex(client: AkashaClient, index?: string): Promise<Outcome<unknown>> {
  const query = index === undefined ? {} : { index }
  const { data, error } = await client.api.index.get({ query })
  if (error) return fail(error.value)
  return { ok: true, value: data }
}

export async function recallIndex(client: AkashaClient, ref: string): Promise<Outcome<unknown>> {
  const { data, error } = await client.api.index.recall.post({ ref })
  if (error) return fail(error.value)
  return { ok: true, value: data }
}
