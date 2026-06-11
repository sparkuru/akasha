import { Akademiya } from "../core/akademiya.ts"
import type { Capsule } from "../core/capsule.ts"
import {
  CapsuleNotFound,
  type Darshan,
  type DarshanCapability,
  type PresignOptions,
} from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { Browser } from "../service/browser.ts"
import { buildApp } from "./app.ts"
import type { Surasthana } from "./surasthana.ts"

/**
 * Shared zero-network test rig.
 *
 * In-memory engine + `appWith()` builder reused by both the server route tests
 * (`app.test.ts`) and the frontend Tier-A logic tests (`frontend/logic.test.ts`),
 * so the fake backend lives in exactly one place. `caps` selects the clearance
 * set; a `missing` prefix raises `CapsuleNotFound` to exercise the 404 mapping.
 */
export class FakeDarshan implements Darshan {
  static readonly typeName = "fake"
  readonly typeName = FakeDarshan.typeName
  private readonly caps: Set<DarshanCapability>

  static requiredGnosis(): Set<string> {
    return new Set()
  }

  constructor(gnosis: Gnosis) {
    const caps = (gnosis.raw.caps ?? "").split(",").filter((s) => s !== "")
    this.caps = new Set(caps as DarshanCapability[])
  }

  listObjects(_bucket: string, prefix = ""): Promise<Capsule[]> {
    if (prefix.startsWith("missing")) {
      throw new CapsuleNotFound("fake list: not found")
    }
    return Promise.resolve([{ key: "a.txt", name: "a.txt", isDir: false, size: 3 }])
  }
  stat(_bucket: string, key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ key, isDir: false, size: 42 })
  }
  readBytes(_bucket: string, _key: string): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array([104, 105]))
  }
  download(_bucket: string, _key: string, dest: string): Promise<string> {
    return Promise.resolve(dest)
  }
  uploadFile(
    _bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    void source
    return Promise.resolve(key)
  }
  delete(_bucket: string, _key: string): Promise<void> {
    return Promise.resolve()
  }
  listBuckets(): Promise<string[]> {
    return Promise.resolve(["one", "two"])
  }
  presign(bucket: string, key: string, options?: PresignOptions): Promise<string> {
    return Promise.resolve(`https://signed.invalid/${bucket}/${key}?e=${options?.expiresIn ?? 0}`)
  }

  clearance(): Set<DarshanCapability> {
    return this.caps
  }
}

export const FULL = "list_buckets,read,download,upload,delete,presign"
export const READ_ONLY = "read"

/** Build an app whose only engine is the in-memory `FakeDarshan`. */
export function appWith(...remotes: Gnosis[]): ReturnType<typeof buildApp> {
  const browser = new Browser(remotes, new Akademiya().enroll(FakeDarshan))
  const surasthana: Surasthana = { browser }
  return buildApp(surasthana)
}

export const s3like: Gnosis = { name: "s3r", type: "fake", raw: { caps: FULL } }
export const readOnly: Gnosis = { name: "ro", type: "fake", raw: { caps: READ_ONLY } }
