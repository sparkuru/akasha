import { Akademiya } from "../core/akademiya.ts"
import { LocalDarshan } from "./local.ts"

/**
 * Built-in engine enrollment.
 *
 * Adding a storage type = one new engine file + one `enroll` line here; no
 * upper layer changes (see `core/directory-structure.md`). S3/WebDAV land in
 * later milestones.
 */
export function createAkademiya(): Akademiya {
  return new Akademiya().enroll(LocalDarshan)
}

export { LocalDarshan }
