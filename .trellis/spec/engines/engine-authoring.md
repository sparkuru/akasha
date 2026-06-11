# Engine Authoring

> Conventions derived from the agreed `session.md` design (§3.2–3.3, §7).
> Revisit against real `S3Darshan` / `LocalDarshan` code when M1/M3 land.

## The contract (decided)

```ts
export interface Darshan {
  readonly typeName: string

  listObjects(bucket: string, prefix?: string, delimiter?: string): Promise<Capsule[]>
  stat(bucket: string, key: string): Promise<Record<string, unknown>>
  readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array>
  download(bucket: string, key: string, dest: string): Promise<string>
  uploadFile(bucket: string, source: Blob | Uint8Array | ReadableStream, key: string): Promise<string>
  delete(bucket: string, key: string): Promise<void>

  listBuckets?(): Promise<string[]>
  presign?(bucket: string, key: string, options?: PresignOptions): Promise<string>
  clearance(): Set<DarshanCapability>
}

type DarshanCtor = {
  typeName: string
  requiredGnosis(): Set<string>
  new (gnosis: Gnosis): Darshan
}
```

## Authoring checklist

1. **File + class**: `src/engines/<name>.ts`, class `<Name>Darshan` (theme
   naming, see [core/naming-theme](../core/naming-theme.md)). One engine per file.
2. **`typeName`** equals the literal rclone `type` key (`s3` / `local` /
   `webdav`) — never themed.
3. **`requiredGnosis()`** (static) returns the `raw` keys the engine needs.
   `Akademiya.summon` validates these before construction.
4. **Read config from `Gnosis.raw` only**, in the constructor. Do not reach into
   the config layer for typed fields.
5. **Implement every required method.** Optional methods (`listBuckets`,
   `presign`) only when the backend genuinely supports them.
6. **`clearance()`** returns exactly the `DarshanCapability` set the engine
   supports — it MUST match which optional methods are implemented. Consumers
   gate UI/CLI on this; lying here breaks them.
7. **Error mapping**: catch vendor SDK errors, rethrow as domain errors
   (see [core/error-handling](../core/error-handling.md)); throw
   `ForbiddenKnowledge` for unsupported operations.
8. **Dependencies**: import only `core` types + the backend SDK. No `service` /
   `server` / `cli` imports.
9. **Register**: add one `enroll(<Name>Darshan)` line in `engines/index.ts`.
   Nothing upstream changes.

## Built-in engine scope (`session.md` §7)

| Engine | type | dependency | note |
|---|---|---|---|
| `S3Darshan` | `s3` | AWS SDK JS v3 | covers S3/TOS/OSS/COS/MinIO/R2 (all S3-compatible) |
| `LocalDarshan` | `local` | Bun/Node fs | local fs, zero-network tests, proves the abstraction |
| `WebdavDarshan` | `webdav` | WebDAV client or fetch | extension phase |

Rule: do NOT add a native per-vendor engine (e.g. OSS SDK) unless an S3-compat
gap forces it.

## Non-bucket backends

bucket/key is unnatural for WebDAV/local. Map the root to a single virtual bucket
and keep the uniform `bucket + prefix/key` shape (`session.md` §10).

## S3-compat field hints (reference §C)

- OSS: `endpoint=https://oss-cn-<region>.aliyuncs.com`, `region=cn-<region>`,
  `force_path_style=false` (must be virtual-host).
- COS: `endpoint=https://cos.<region>.myqcloud.com`, bucket carries an APPID
  suffix (`mybucket-1250000000`).
