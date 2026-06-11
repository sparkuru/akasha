import type { Gnosis } from "../core/gnosis.ts"

/**
 * Config compatibility (rclone.conf).
 *
 * A hand-rolled minimal INI parser. It parses EVERY `[section]` regardless of
 * `type` and preserves all keys verbatim into `raw` — it must never hard-read a
 * backend-specific field (see `.trellis/spec/engines/config-compat.md`). Field
 * interpretation belongs to each engine's constructor + `requiredGnosis()`.
 */

/** Thrown when a section is malformed (e.g. missing the required `type` key). */
export class MalformedGnosis extends Error {
  override readonly name = "MalformedGnosis"
}

/** A raw INI section before `type` extraction. */
interface RawSection {
  name: string
  keys: Record<string, string>
}

/**
 * Parse rclone.conf text into `Gnosis[]`.
 *
 * Rules: every section is parsed regardless of its `type`; `type` is required
 * (a section without it is a parse error); all other keys are preserved verbatim
 * into `raw`; `#` and `;` start comments; blank values are kept; surrounding
 * whitespace is trimmed.
 */
export function parseRcloneConf(text: string): Gnosis[] {
  const sections: RawSection[] = []
  let current: RawSection | undefined

  const lines = text.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === "") continue
    if (line.startsWith("#") || line.startsWith(";")) continue

    if (line.startsWith("[")) {
      const close = line.indexOf("]")
      if (close === -1) {
        throw new MalformedGnosis(`unterminated section header: "${rawLine}"`)
      }
      const name = line.slice(1, close).trim()
      if (name === "") {
        throw new MalformedGnosis(`empty section name: "${rawLine}"`)
      }
      current = { name, keys: {} }
      sections.push(current)
      continue
    }

    const eq = line.indexOf("=")
    if (eq === -1) {
      throw new MalformedGnosis(`expected "key = value", got: "${rawLine}"`)
    }
    if (current === undefined) {
      throw new MalformedGnosis(`key outside any section: "${rawLine}"`)
    }
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key === "") {
      throw new MalformedGnosis(`empty key: "${rawLine}"`)
    }
    current.keys[key] = value
  }

  return sections.map(toGnosis)
}

/** Lift a raw section into a `Gnosis`, extracting (and removing) `type`. */
function toGnosis(section: RawSection): Gnosis {
  const { type, ...raw } = section.keys
  if (type === undefined || type === "") {
    throw new MalformedGnosis(`section "[${section.name}]" is missing required "type"`)
  }
  return { name: section.name, type, raw }
}

/**
 * Load and parse an rclone.conf from a file path via Bun's file API.
 *
 * Throws if the file does not exist (Bun's `text()` rejects on a missing file).
 */
export async function loadRcloneConf(path: string): Promise<Gnosis[]> {
  const file = Bun.file(path)
  const text = await file.text()
  return parseRcloneConf(text)
}
