import type { Akademiya } from "../core/akademiya.ts"
import type { Capsule } from "../core/capsule.ts"
import { type Darshan, type DarshanCapability, ForbiddenKnowledge } from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import {
  type Irminsul,
  type IrminsulDirectory,
  loadIrminsul,
  recordDirectory,
  saveIrminsul,
} from "./house-of-wisdom.ts"
import { purify } from "./path.ts"

/**
 * Browsing use cases shared by CLI and Web.
 *
 * Owns `remote:bucket/prefix` parsing, engine summoning, and capability gating.
 * Depends only on `core` + the `Akademiya` registry — never on a vendor SDK or
 * Elysia (see `.trellis/spec/service/service-guidelines.md`).
 */

/** A parsed `remote:bucket/prefix-or-key` reference. */
export interface Address {
  /** The remote/section name (the part before `:`). */
  remote: string
  /** The first path segment after the remote — the (virtual) bucket. */
  bucket: string
  /** The purified remainder (prefix for `ls`, key for `cat`). */
  path: string
}

/**
 * Parse `remote:bucket/prefix` into an `Address`.
 *
 * The portion after `:` is purified (traversal-guarded); its first segment is
 * the bucket, the rest is the path. `remote:` alone yields an empty bucket+path.
 */
export function parseAddress(ref: string): Address {
  const colon = ref.indexOf(":")
  if (colon === -1) {
    throw new ForbiddenKnowledge(`expected "remote:bucket/prefix", got "${ref}"`)
  }
  const remote = ref.slice(0, colon).trim()
  if (remote === "") {
    throw new ForbiddenKnowledge(`empty remote in "${ref}"`)
  }
  const rest = purify(ref.slice(colon + 1))
  const slash = rest.indexOf("/")
  const bucket = slash === -1 ? rest : rest.slice(0, slash)
  const path = slash === -1 ? "" : rest.slice(slash + 1)
  return { remote, bucket, path }
}

/** A remote summary for the `listRemotes` use case (name + type + clearance). */
export interface RemoteSummary {
  name: string
  type: string
  clearance: DarshanCapability[]
}

/**
 * A URL resolution result for the `url` use case.
 *
 * `kind` is `"presigned"` when the engine has `presign` clearance (a real
 * vendor-signed URL), otherwise `"proxy"` — a relative URL pointing back at our
 * own read route, so the caller never sees a "not supported" error
 * (see `.trellis/spec/service/service-guidelines.md` §4).
 */
export interface UrlResult {
  url: string
  kind: "presigned" | "proxy"
  expiresIn?: number
}

/** Resolve a remote name to its `Gnosis` from a parsed config set. */
function findGnosis(remotes: readonly Gnosis[], remote: string): Gnosis {
  const found = remotes.find((g) => g.name === remote)
  if (found === undefined) {
    throw new ForbiddenKnowledge(`no remote named "${remote}" in config`)
  }
  return found
}

/**
 * Browser — bound to a parsed config set + an `Akademiya`.
 *
 * Summons engines on demand; never `new`s an engine class directly.
 */
export class Browser {
  constructor(
    private readonly remotes: readonly Gnosis[],
    private readonly akademiya: Akademiya,
  ) {}

  /** Summon the engine for a remote name. */
  private engineFor(remote: string): Darshan {
    return this.akademiya.summon(findGnosis(this.remotes, remote))
  }

  /** List the directory addressed by `remote:bucket/prefix`. */
  async list(ref: string): Promise<Capsule[]> {
    const { remote, bucket, path } = parseAddress(ref)
    const engine = this.engineFor(remote)
    if (!engine.clearance().has("read")) {
      throw new ForbiddenKnowledge(`remote "${remote}" cannot list (no read clearance)`)
    }
    return engine.listObjects(bucket, path)
  }

  /** Read the file addressed by `remote:bucket/key` (for `cat`). */
  async read(ref: string, maxBytes?: number): Promise<Uint8Array> {
    const { remote, bucket, path } = parseAddress(ref)
    const engine = this.engineFor(remote)
    if (!engine.clearance().has("read")) {
      throw new ForbiddenKnowledge(`remote "${remote}" cannot read (no read clearance)`)
    }
    return engine.readBytes(bucket, path, maxBytes)
  }

  /** List the parsed remotes with their type + clearance set. */
  listRemotes(): RemoteSummary[] {
    return this.remotes.map((g) => {
      const engine = this.akademiya.summon(g)
      return { name: g.name, type: g.type, clearance: [...engine.clearance()] }
    })
  }

  /**
   * List the buckets of a remote (capability-gated on `list_buckets`).
   *
   * Throws `ForbiddenKnowledge` when the engine lacks the clearance — the caller
   * should have gated on `clearance()` first (no exception probing).
   */
  async listBuckets(remote: string): Promise<string[]> {
    const engine = this.engineFor(remote)
    if (!engine.clearance().has("list_buckets") || engine.listBuckets === undefined) {
      throw new ForbiddenKnowledge(
        `remote "${remote}" cannot list buckets (no list_buckets clearance)`,
      )
    }
    return engine.listBuckets()
  }

  /** Stat the object addressed by `remote:bucket/key`. */
  async stat(ref: string): Promise<Record<string, unknown>> {
    const { remote, bucket, path } = parseAddress(ref)
    const engine = this.engineFor(remote)
    if (!engine.clearance().has("read")) {
      throw new ForbiddenKnowledge(`remote "${remote}" cannot stat (no read clearance)`)
    }
    return engine.stat(bucket, path)
  }

  /**
   * Upload `bytes` to the object addressed by `remote:bucket/key`.
   *
   * Accepts a `Uint8Array`/stream — never a Web `File` (HTTP types stay in
   * `server/`). Returns the stored key. Capability-gated on `upload`.
   */
  async upload(ref: string, source: Uint8Array | ReadableStream): Promise<string> {
    const { remote, bucket, path } = parseAddress(ref)
    const engine = this.engineFor(remote)
    if (!engine.clearance().has("upload")) {
      throw new ForbiddenKnowledge(`remote "${remote}" cannot upload (no upload clearance)`)
    }
    return engine.uploadFile(bucket, source, path)
  }

  /** Delete the object addressed by `remote:bucket/key`. Gated on `delete`. */
  async delete(ref: string): Promise<void> {
    const { remote, bucket, path } = parseAddress(ref)
    const engine = this.engineFor(remote)
    if (!engine.clearance().has("delete")) {
      throw new ForbiddenKnowledge(`remote "${remote}" cannot delete (no delete clearance)`)
    }
    await engine.delete(bucket, path)
  }

  /**
   * Resolve a URL for the object addressed by `remote:bucket/key`.
   *
   * When the engine has `presign` clearance, returns a real presigned URL
   * (`kind:"presigned"`). Otherwise falls back to a relative proxy URL pointing
   * at our own read route (`kind:"proxy"`) — never a "not supported" error
   * (`.trellis/spec/service/service-guidelines.md` §4).
   */
  async url(ref: string, expiresIn?: number): Promise<UrlResult> {
    const { remote, bucket, path } = parseAddress(ref)
    const engine = this.engineFor(remote)
    if (engine.clearance().has("presign") && engine.presign !== undefined) {
      const options = expiresIn === undefined ? undefined : { expiresIn }
      const url = await engine.presign(bucket, path, options)
      const result: UrlResult = { url, kind: "presigned" }
      if (expiresIn !== undefined) {
        result.expiresIn = expiresIn
      }
      return result
    }
    // Proxy fallback: a relative URL back to our own read route.
    return {
      url: `/api/object/read?ref=${encodeURIComponent(ref)}`,
      kind: "proxy",
    }
  }

  /** Read the persisted irminsul index (or an empty one if absent). */
  readIndex(indexPath?: string): Promise<Irminsul> {
    return loadIrminsul(indexPath)
  }

  /**
   * Re-index the directory addressed by `remote:bucket/prefix`.
   *
   * Lists the directory, writes/updates its snapshot in the irminsul index, and
   * returns the persisted snapshot. This is the single source of truth for the
   * `recall` use case — both CLI and Web call it, never re-implementing the
   * list+persist sequence themselves.
   */
  async recall(ref: string, indexPath?: string): Promise<IrminsulDirectory> {
    const { bucket, path } = parseAddress(ref)
    const capsules = await this.list(ref)
    const before = await loadIrminsul(indexPath)
    const after = recordDirectory(before, bucket, path, capsules)
    await saveIrminsul(after, indexPath)
    const normalizedPrefix = path === "" ? "" : path.endsWith("/") ? path : `${path}/`
    const key =
      normalizedPrefix === ""
        ? bucket
        : `${bucket}/${normalizedPrefix.endsWith("/") ? normalizedPrefix.slice(0, -1) : normalizedPrefix}`
    const snapshot = after.directories[key]
    if (snapshot === undefined) {
      throw new ForbiddenKnowledge(`recall failed to persist snapshot for "${ref}"`)
    }
    return snapshot
  }
}
