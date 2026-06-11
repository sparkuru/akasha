import { t } from "elysia"

/**
 * Elysia `t` schemas — the transport-layer contract.
 *
 * These drive BOTH request/response validation AND the generated OpenAPI doc
 * (see `.trellis/spec/server/elysia-guidelines.md` rule 2). They are the public
 * API surface. HTTP/transport types stay here in `server/` and never leak down
 * into `core`/`service` (rule 5).
 *
 * Two-layer validation: these schemas validate external HTTP input only; `core`
 * validates `Gnosis` + engine capability separately (rule 1).
 */

/** The unified error wire shape returned at the boundary (`AkashaError`). */
export const AkashaErrorSchema = t.Object({
  code: t.Union([
    t.Literal("forbidden_knowledge"),
    t.Literal("invalid_gnosis"),
    t.Literal("not_found"),
    t.Literal("backend_error"),
    t.Literal("validation"),
  ]),
  message: t.String(),
  detail: t.Optional(t.Unknown()),
})

/** The boundary error shape, defined here at the server boundary (not in core). */
export interface AkashaError {
  code: "forbidden_knowledge" | "invalid_gnosis" | "not_found" | "backend_error" | "validation"
  message: string
  detail?: unknown
}

/** A capability literal as surfaced to clients (mirrors `DarshanCapability`). */
const CapabilitySchema = t.Union([
  t.Literal("list_buckets"),
  t.Literal("read"),
  t.Literal("download"),
  t.Literal("upload"),
  t.Literal("delete"),
  t.Literal("presign"),
])

/** A parsed remote with its declared clearance set. */
export const RemoteSchema = t.Object({
  name: t.String(),
  type: t.String(),
  clearance: t.Array(CapabilitySchema),
})

/** A listed object/prefix entry (the `Capsule` wire shape). */
export const CapsuleSchema = t.Object({
  key: t.String(),
  name: t.String(),
  isDir: t.Boolean(),
  size: t.Optional(t.Number()),
  lastModified: t.Optional(t.String()),
  etag: t.Optional(t.String()),
  storageClass: t.Optional(t.String()),
  extra: t.Optional(t.Record(t.String(), t.Unknown())),
})

/** `?ref=remote:bucket/prefix` — the addressing query shared by most routes. */
export const RefQuery = t.Object({
  ref: t.String({ description: "remote:bucket/prefix-or-key" }),
})

/** `?remote=name` — for the bucket listing route. */
export const RemoteQuery = t.Object({
  remote: t.String({ description: "remote name from the rclone.conf" }),
})

/** Read route query: a ref plus an optional byte cap for previews. */
export const ReadQuery = t.Object({
  ref: t.String({ description: "remote:bucket/key" }),
  maxBytes: t.Optional(t.Numeric({ description: "cap preview to first N bytes" })),
})

/** URL route query: a ref plus an optional presign validity (seconds). */
export const UrlQuery = t.Object({
  ref: t.String({ description: "remote:bucket/key" }),
  expiresIn: t.Optional(t.Numeric({ description: "presign validity in seconds" })),
})

/** Index route query: optional override for the irminsul file path. */
export const IndexQuery = t.Object({
  index: t.Optional(t.String({ description: "path to the irminsul.json index" })),
})

/** Multipart upload body: target ref + the file blob. */
export const UploadBody = t.Object({
  ref: t.String({ description: "remote:bucket/key target" }),
  file: t.File({ maxSize: "50m" }),
})

/** The URL route response: presigned or proxy. */
export const UrlResponse = t.Object({
  url: t.String(),
  kind: t.Union([t.Literal("presigned"), t.Literal("proxy")]),
  expiresIn: t.Optional(t.Number()),
})

/** The upload route response. */
export const UploadResponse = t.Object({
  ok: t.Boolean(),
  key: t.String(),
  size: t.Number(),
})

/** The delete route response. */
export const DeleteResponse = t.Object({
  ok: t.Boolean(),
})
