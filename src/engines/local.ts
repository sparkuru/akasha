import { stat as fsStat, mkdir, readdir, rm } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import type { Capsule } from "../core/capsule.ts"
import { type Darshan, type DarshanCapability, ForbiddenKnowledge } from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"

/**
 * LocalDarshan — the local-filesystem school (zero-network).
 *
 * Proves the abstraction is vendor-clean: it implements the uniform
 * `bucket + prefix/key` contract over the local fs rooted at `raw.root`. The fs
 * has no native bucket concept, so the root is mapped to a single virtual bucket
 * (non-bucket backend convention, see `engines/engine-authoring.md`). The bucket
 * name is accepted but only the `root` is authoritative.
 *
 * `clearance()` declares exactly what local fs supports — notably NO `presign`
 * and NO `list_buckets`; those optional methods are not implemented, and calling
 * them throws `ForbiddenKnowledge`.
 */
export class LocalDarshan implements Darshan {
  static readonly typeName = "local"
  readonly typeName = LocalDarshan.typeName

  private readonly root: string

  /** The `raw` keys local fs needs: just the filesystem `root`. */
  static requiredGnosis(): Set<string> {
    return new Set(["root"])
  }

  constructor(gnosis: Gnosis) {
    const root = gnosis.raw.root
    if (root === undefined || root === "") {
      // Defensive: Akademiya.summon validates before construction.
      throw new ForbiddenKnowledge(`LocalDarshan requires a non-empty "root"`)
    }
    this.root = resolve(root)
  }

  /**
   * Resolve a `bucket + key` to an absolute path under `root`, guarding against
   * traversal escapes. The virtual bucket is treated as a top-level directory so
   * the uniform shape holds; an empty bucket maps to the root itself.
   */
  private locate(bucket: string, key: string): string {
    const rel = bucket === "" ? key : join(bucket, key)
    const target = resolve(this.root, rel)
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new ForbiddenKnowledge(`path escapes the configured root: "${rel}"`)
    }
    return target
  }

  async listObjects(bucket: string, prefix = "", _delimiter?: string): Promise<Capsule[]> {
    const dir = this.locate(bucket, prefix)
    const entries = await readdir(dir, { withFileTypes: true })
    const capsules: Capsule[] = []
    for (const entry of entries) {
      const isDir = entry.isDirectory()
      const childKey = prefix === "" ? entry.name : `${stripTrailingSlash(prefix)}/${entry.name}`
      const info = await fsStat(join(dir, entry.name))
      const capsule: Capsule = {
        key: isDir ? `${childKey}/` : childKey,
        name: entry.name,
        isDir,
        lastModified: info.mtime.toISOString(),
      }
      if (!isDir) {
        capsule.size = info.size
      }
      capsules.push(capsule)
    }
    capsules.sort((a, b) => a.name.localeCompare(b.name))
    return capsules
  }

  async stat(bucket: string, key: string): Promise<Record<string, unknown>> {
    const target = this.locate(bucket, key)
    const info = await fsStat(target)
    return {
      key,
      size: info.size,
      isDir: info.isDirectory(),
      lastModified: info.mtime.toISOString(),
      mode: info.mode,
    }
  }

  async readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array> {
    const target = this.locate(bucket, key)
    const file = Bun.file(target)
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
      return bytes.subarray(0, maxBytes)
    }
    return bytes
  }

  async download(bucket: string, key: string, dest: string): Promise<string> {
    const target = this.locate(bucket, key)
    await mkdir(dirname(dest), { recursive: true })
    await Bun.write(dest, Bun.file(target))
    return dest
  }

  async uploadFile(
    bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    const target = this.locate(bucket, key)
    await mkdir(dirname(target), { recursive: true })
    // Normalize every source shape to bytes so `Bun.write` sees one concrete type.
    const bytes = await toBytes(source)
    await Bun.write(target, bytes)
    return key
  }

  async delete(bucket: string, key: string): Promise<void> {
    const target = this.locate(bucket, key)
    await rm(target, { recursive: true, force: true })
  }

  /** Local fs supports read/download/upload/delete — never presign/list_buckets. */
  clearance(): Set<DarshanCapability> {
    return new Set<DarshanCapability>(["read", "download", "upload", "delete"])
  }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s
}

/** Collapse any accepted upload source into a `Uint8Array`. */
async function toBytes(source: Blob | Uint8Array | ReadableStream): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    return source
  }
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer())
  }
  return new Uint8Array(await new Response(source).arrayBuffer())
}
