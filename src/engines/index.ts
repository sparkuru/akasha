import { Akademiya } from "../core/akademiya.ts"
import { LocalDarshan } from "./local.ts"
import { S3Darshan } from "./s3.ts"
import { WebdavDarshan } from "./webdav.ts"

/**
 * Built-in engine enrollment.
 *
 * Adding a storage type = one new engine file + one `enroll` line here; no
 * upper layer changes (see `core/directory-structure.md`).
 */
export function createAkademiya(): Akademiya {
  return new Akademiya().enroll(LocalDarshan, S3Darshan, WebdavDarshan)
}

export { LocalDarshan, S3Darshan, WebdavDarshan }
