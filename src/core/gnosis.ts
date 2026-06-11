/**
 * Gnosis — the keys that summon a Darshan (RemoteConfig).
 *
 * `raw` carries untyped backend config (`Record<string, string>`). The config
 * layer must NOT pre-extract backend fields; each engine narrows the keys it
 * needs at construction.
 */
export interface Gnosis {
  /** Logical remote name (e.g. the rclone remote alias). */
  name: string
  /** Literal backend `type` key: `s3` / `local` / `webdav`. Never themed. */
  type: string
  /** Untyped backend config. Engines read explicit keys from here. */
  raw: Record<string, string>
}

/**
 * InvalidGnosis — config validation failure (missing required `raw` keys).
 *
 * Maps to `invalid_gnosis` at the HTTP boundary. Carries the names of the
 * missing keys in `detail` (never the values — no secrets).
 */
export class InvalidGnosis extends Error {
  override readonly name = "InvalidGnosis"
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(`invalid gnosis: missing required field(s): ${missing.join(", ")}`)
    this.missing = missing
  }
}

/**
 * Validate that every required `raw` key is present and non-empty.
 *
 * Called by `Akademiya.summon` BEFORE constructing an engine. Throws
 * `InvalidGnosis` (the `invalid_gnosis` path) when any required key is missing.
 */
export function validateRequiredGnosis(gnosis: Gnosis, required: Set<string>): void {
  const missing: string[] = []
  for (const field of required) {
    const value = gnosis.raw[field]
    if (value === undefined || value === "") {
      missing.push(field)
    }
  }
  if (missing.length > 0) {
    throw new InvalidGnosis(missing)
  }
}
