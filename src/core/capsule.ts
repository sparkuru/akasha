/**
 * Capsule — a Knowledge Capsule recalled from the void.
 *
 * The single domain shape for a listed object/prefix entry. Owned by this
 * module and re-exported from `src/index.ts`; no other layer redefines it.
 */
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
