import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { Capsule } from "../core/capsule.ts"
import {
  BackendFault,
  CapsuleNotFound,
  type Darshan,
  type DarshanCapability,
  ForbiddenKnowledge,
  type PresignOptions,
} from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"

/** SDK region fallback: many S3-compat servers ignore it, but the SDK requires one. */
const DEFAULT_REGION = "us-east-1"
/** Presign default validity when the caller omits `expiresIn` (seconds). */
const DEFAULT_PRESIGN_EXPIRY = 3600

/**
 * S3Darshan — the S3-compatible school (one engine, every vendor).
 *
 * A single engine covers AWS S3, 火山 TOS, 阿里 OSS, 腾讯 COS, MinIO and Cloudflare
 * R2: they all speak the S3 API, so they all arrive here as rclone `type=s3`
 * profiles. The constructor reads only `Gnosis.raw` (never the config layer) and
 * builds an `S3Client`; tests inject a client so the suite stays zero-network.
 *
 * Unlike `LocalDarshan`, this backend genuinely supports every capability —
 * `clearance()` declares all six, including `list_buckets` and `presign`.
 *
 * Vendor SDK errors never escape: each operation maps "missing" to
 * `CapsuleNotFound` and everything else to `BackendFault`
 * (see `core/error-handling.md`).
 */
export class S3Darshan implements Darshan {
  static readonly typeName = "s3"
  readonly typeName = S3Darshan.typeName

  private readonly client: S3Client

  /** The `raw` keys S3 cannot work without; endpoint/region/style are optional. */
  static requiredGnosis(): Set<string> {
    return new Set(["access_key_id", "secret_access_key"])
  }

  /**
   * @param gnosis parsed rclone section; reads `access_key_id`,
   *   `secret_access_key`, `endpoint`, `region`, `force_path_style` from `raw`.
   * @param client injected for tests (zero-network); omitted in production so a
   *   real `S3Client` is built from `raw`.
   */
  constructor(gnosis: Gnosis, client?: S3Client) {
    const accessKeyId = gnosis.raw.access_key_id
    const secretAccessKey = gnosis.raw.secret_access_key
    if (!accessKeyId || !secretAccessKey) {
      // Defensive: Akademiya.summon validates requiredGnosis before construction.
      throw new ForbiddenKnowledge("S3Darshan requires access_key_id and secret_access_key")
    }

    if (client !== undefined) {
      this.client = client
      return
    }

    const config: S3ClientConfig = {
      credentials: { accessKeyId, secretAccessKey },
      region: gnosis.raw.region || DEFAULT_REGION,
    }
    const endpoint = gnosis.raw.endpoint
    if (endpoint) {
      config.endpoint = endpoint
    }
    if (isTrue(gnosis.raw.force_path_style)) {
      config.forcePathStyle = true
    }
    this.client = new S3Client(config)
  }

  async listObjects(bucket: string, prefix = "", delimiter = "/"): Promise<Capsule[]> {
    // Folder semantics: a non-empty prefix names a directory, so anchor it with a
    // trailing slash before handing it to S3 (matches LocalDarshan's behaviour).
    const anchored = prefix === "" || prefix.endsWith("/") ? prefix : `${prefix}/`
    const capsules: Capsule[] = []
    let token: string | undefined
    do {
      const input: ListObjectsV2CommandInput = {
        Bucket: bucket,
        Prefix: anchored,
        Delimiter: delimiter,
      }
      if (token !== undefined) {
        input.ContinuationToken = token
      }
      const out = await this.send(() => this.client.send(new ListObjectsV2Command(input)), "list")

      for (const cp of out.CommonPrefixes ?? []) {
        if (cp.Prefix === undefined) {
          continue
        }
        capsules.push({
          key: cp.Prefix,
          name: leafName(cp.Prefix),
          isDir: true,
        })
      }
      for (const obj of out.Contents ?? []) {
        if (obj.Key === undefined || obj.Key === anchored) {
          // Skip the zero-length "directory marker" object some tools write.
          continue
        }
        capsules.push(fileCapsule(obj.Key, obj.Size, obj.LastModified, obj.ETag, obj.StorageClass))
      }

      token = out.IsTruncated ? out.NextContinuationToken : undefined
    } while (token !== undefined)

    capsules.sort((a, b) => a.name.localeCompare(b.name))
    return capsules
  }

  async stat(bucket: string, key: string): Promise<Record<string, unknown>> {
    const out = await this.send(
      () => this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
      "stat",
    )
    const info: Record<string, unknown> = { key, isDir: false }
    if (out.ContentLength !== undefined) {
      info.size = out.ContentLength
    }
    if (out.LastModified !== undefined) {
      info.lastModified = out.LastModified.toISOString()
    }
    if (out.ETag !== undefined) {
      info.etag = out.ETag
    }
    if (out.ContentType !== undefined) {
      info.contentType = out.ContentType
    }
    if (out.StorageClass !== undefined) {
      info.storageClass = out.StorageClass
    }
    return info
  }

  async readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array> {
    const out = await this.send(
      () => this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
      "read",
    )
    if (out.Body === undefined) {
      throw new BackendFault(`S3 read returned an empty body for "${key}"`)
    }
    const bytes = await out.Body.transformToByteArray()
    if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
      return bytes.subarray(0, maxBytes)
    }
    return bytes
  }

  async download(bucket: string, key: string, dest: string): Promise<string> {
    const bytes = await this.readBytes(bucket, key)
    await mkdir(dirname(dest), { recursive: true })
    await Bun.write(dest, bytes)
    return dest
  }

  async uploadFile(
    bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    const body = await toBytes(source)
    await this.send(
      () => this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body })),
      "upload",
    )
    return key
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.send(
      () => this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
      "delete",
    )
  }

  async listBuckets(): Promise<string[]> {
    const out = await this.send(() => this.client.send(new ListBucketsCommand({})), "list_buckets")
    const names: string[] = []
    for (const b of out.Buckets ?? []) {
      if (b.Name !== undefined) {
        names.push(b.Name)
      }
    }
    return names
  }

  async presign(bucket: string, key: string, options?: PresignOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? DEFAULT_PRESIGN_EXPIRY
    const command =
      options?.method === "PUT"
        ? new PutObjectCommand({ Bucket: bucket, Key: key })
        : new GetObjectCommand({ Bucket: bucket, Key: key })
    try {
      return await getSignedUrl(this.client, command, { expiresIn })
    } catch (err) {
      throw asBackendFault(err, "presign")
    }
  }

  /** S3 supports the full set — this MUST mirror the implemented methods above. */
  clearance(): Set<DarshanCapability> {
    return new Set<DarshanCapability>([
      "list_buckets",
      "read",
      "download",
      "upload",
      "delete",
      "presign",
    ])
  }

  /**
   * Run one SDK call, translating vendor errors into domain errors so the
   * service layer never sees a raw `@aws-sdk` exception.
   */
  private async send<T>(call: () => Promise<T>, op: string): Promise<T> {
    try {
      return await call()
    } catch (err) {
      if (isNotFound(err)) {
        throw new CapsuleNotFound(`S3 ${op}: object or bucket not found`)
      }
      throw asBackendFault(err, op)
    }
  }
}

/** Coerce an rclone boolean field (`"true"`/`"1"`/`"yes"`) to a real boolean. */
function isTrue(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes"
}

/** Last path segment of an S3 key/prefix, ignoring a trailing slash. */
function leafName(keyOrPrefix: string): string {
  const trimmed = keyOrPrefix.endsWith("/") ? keyOrPrefix.slice(0, -1) : keyOrPrefix
  const slash = trimmed.lastIndexOf("/")
  return slash === -1 ? trimmed : trimmed.slice(slash + 1)
}

/** Build a file `Capsule`, attaching optional metadata only when present. */
function fileCapsule(
  key: string,
  size: number | undefined,
  lastModified: Date | undefined,
  etag: string | undefined,
  storageClass: string | undefined,
): Capsule {
  const capsule: Capsule = { key, name: leafName(key), isDir: false }
  if (size !== undefined) {
    capsule.size = size
  }
  if (lastModified !== undefined) {
    capsule.lastModified = lastModified.toISOString()
  }
  if (etag !== undefined) {
    capsule.etag = etag
  }
  if (storageClass !== undefined) {
    capsule.storageClass = storageClass
  }
  return capsule
}

/** Collapse any accepted upload source into a `Uint8Array` (mirrors LocalDarshan). */
async function toBytes(source: Blob | Uint8Array | ReadableStream): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    return source
  }
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer())
  }
  return new Uint8Array(await new Response(source).arrayBuffer())
}

/** Whether an unknown SDK error denotes a clean "not found" (no `as` casts). */
function isNotFound(err: unknown): boolean {
  const name = errName(err)
  if (name === "NoSuchKey" || name === "NotFound" || name === "NoSuchBucket") {
    return true
  }
  return httpStatus(err) === 404
}

/** Wrap a non-not-found error as a `BackendFault`, never leaking the raw type. */
function asBackendFault(err: unknown, op: string): BackendFault {
  return new BackendFault(`S3 ${op} failed: ${errName(err) ?? "UnknownError"}`, { cause: err })
}

/** Read the `name` of an unknown SDK error via `in`-narrowing (no `as` casts). */
function errName(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "name" in value) {
    const name = value.name
    return typeof name === "string" ? name : undefined
  }
  return undefined
}

/** Read `$metadata.httpStatusCode` from an unknown SDK error, if present. */
function httpStatus(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || !("$metadata" in value)) {
    return undefined
  }
  const meta = value.$metadata
  if (typeof meta !== "object" || meta === null || !("httpStatusCode" in meta)) {
    return undefined
  }
  const code = meta.httpStatusCode
  return typeof code === "number" ? code : undefined
}
