import { ForbiddenKnowledge } from "../core/darshan.ts"

/**
 * Path normalization + traversal guard (the ward / purification).
 *
 * Every external path/key must pass through here before it reaches an engine
 * (see `.trellis/spec/service/service-guidelines.md`). These are pure functions;
 * `..` escapes are rejected with `ForbiddenKnowledge`.
 */

/**
 * `purify()` — collapse a path into clean, forward-slashed segments and reject
 * any `..` traversal. Leading/trailing slashes are stripped; `.` segments and
 * empty segments are dropped. Throws on a `..` segment.
 */
export function purify(path: string): string {
  const segments: string[] = []
  for (const part of path.split(/[\\/]+/)) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      throw new ForbiddenKnowledge(`path traversal rejected: "${path}"`)
    }
    segments.push(part)
  }
  return segments.join("/")
}

/**
 * `seal()` — purify a path and re-attach a trailing slash when the caller
 * intended a directory (prefix). Use this for keys/prefixes handed to engines.
 */
export function seal(path: string, asDir = false): string {
  const cleaned = purify(path)
  if (asDir && cleaned !== "") {
    return `${cleaned}/`
  }
  return cleaned
}
