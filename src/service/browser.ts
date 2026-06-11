import type { Akademiya } from "../core/akademiya.ts"
import type { Capsule } from "../core/capsule.ts"
import { type Darshan, ForbiddenKnowledge } from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
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
}
