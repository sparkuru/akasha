import type { Capsule } from "./capsule.ts"

/**
 * DarshanCapability — the clearance levels an engine may declare.
 *
 * `clearance()` is the single source of truth for what an engine supports;
 * consumers type-check against this union and never compare raw strings.
 */
export type DarshanCapability =
  | "list_buckets"
  | "read"
  | "download"
  | "upload"
  | "delete"
  | "presign"

/** Options for presigned-URL generation (optional engine capability). */
export type PresignOptions = {
  expiresIn?: number
  method?: "GET" | "PUT"
}

/**
 * Darshan — a school of praxis (StorageEngine abstraction).
 *
 * Every backend (S3/local/webdav) implements this uniform `bucket + prefix/key`
 * contract. Optional methods (`listBuckets`, `presign`) are present only when the
 * backend genuinely supports them, and MUST match what `clearance()` declares.
 */
export interface Darshan {
  readonly typeName: string

  listObjects(bucket: string, prefix?: string, delimiter?: string): Promise<Capsule[]>
  stat(bucket: string, key: string): Promise<Record<string, unknown>>
  readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array>
  download(bucket: string, key: string, dest: string): Promise<string>
  uploadFile(
    bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string>
  delete(bucket: string, key: string): Promise<void>

  listBuckets?(): Promise<string[]>
  presign?(bucket: string, key: string, options?: PresignOptions): Promise<string>

  clearance(): Set<DarshanCapability>
}

/**
 * ForbiddenKnowledge — knowledge the system refuses.
 *
 * Thrown for "refused / not supported": an unknown `type` in `Akademiya.summon`,
 * or an operation an engine does not implement. Maps to `forbidden_knowledge` at
 * the HTTP boundary.
 */
export class ForbiddenKnowledge extends Error {
  override readonly name = "ForbiddenKnowledge"
}
