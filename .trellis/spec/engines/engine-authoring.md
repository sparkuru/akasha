# Engine Authoring

> Conventions derived from the agreed `session.md` design (§3.2–3.3, §7) and
> confirmed against the real `LocalDarshan` (M2) and `S3Darshan` (M3) engines.

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
7. **Error mapping**: catch vendor SDK errors and rethrow as domain errors —
   `CapsuleNotFound` for a genuine miss, `BackendFault` (with `{ cause }`) for
   everything else, `ForbiddenKnowledge` for unsupported operations
   (see [core/error-handling](../core/error-handling.md)). Route EVERY public
   method through one mapper so no raw SDK exception can escape (S3Darshan wraps
   each `client.send` in a private `send()` helper; `presign` has its own
   try/catch because it does not go through `send`).
8. **Dependencies**: import only `core` types + the backend SDK. No `service` /
   `server` / `cli` imports.
9. **Register**: add one `enroll(<Name>Darshan)` line in `engines/index.ts`.
   Nothing upstream changes.

## Built-in engine scope (`session.md` §7)

| Engine | type | dependency | note |
|---|---|---|---|
| `S3Darshan` | `s3` | AWS SDK JS v3 | covers S3/TOS/OSS/COS/MinIO/R2 (all S3-compatible) |
| `LocalDarshan` | `local` | Bun/Node fs | local fs, zero-network tests, proves the abstraction |
| `WebdavDarshan` | `webdav` | native `fetch` | WebDAV class-1 browsing and mutation |

Rule: do NOT add a native per-vendor engine (e.g. OSS SDK) unless an S3-compat
gap forces it.

## Testing an engine (zero-network, decided at M3)

The quality gate stays network-free even for network engines. The seam:

- **Constructor takes an optional injected client** as a second arg —
  `constructor(gnosis: Gnosis, client?: S3Client)`. Production omits it and the
  engine builds a real client from `Gnosis.raw`; tests pass a client whose
  transport is replaced.
- For S3 the test builds a real `S3Client` (construction does no I/O) and swaps
  its `.send` for a scripted mock keyed by command class name
  (`ListObjectsV2Command`, `HeadObjectCommand`, …), returning canned output
  shapes or rejecting with a fake `{ name, $metadata.httpStatusCode }` error.
  One localized `send as unknown as typeof client.send` cast adapts the mock to
  the SDK's overloaded signature — acceptable because it neither crosses an
  Akasha layer boundary nor bypasses a domain type.
- **`presign` needs no mock**: `getSignedUrl` signs locally with zero network, so
  a real client built from `raw` produces a deterministic URL to assert on
  (`X-Amz-Signature=`, `X-Amz-Expires=`, the key).
- Assert both directions: the **command input** sent (Bucket/Key/Prefix/Delimiter/
  ContinuationToken/Body) and the **mapped output** (`Capsule` fields,
  `CapsuleNotFound`/`BackendFault` on error, no secret in the message).

A pure-fs engine like `LocalDarshan` needs none of this — it tests against a real
temp dir. The injected-client seam is specifically for SDK/network engines.

## Non-bucket backends

bucket/key is unnatural for WebDAV/local. Map the root to a single virtual bucket
and keep the uniform `bucket + prefix/key` shape (`session.md` §10).

## Scenario: Adding a new network `Darshan`

### 1. Scope / Trigger

- Trigger: implementing a storage integration whose backend semantics differ
  from S3, but must still satisfy the existing `Darshan` contract.

### 2. Signatures

- Engine file: `src/engines/<type>.ts`
- Class: `<Name>Darshan implements Darshan`
- Constructor: `constructor(gnosis: Gnosis, injectedClientOrFetcher?: ...)`
- Static contract: `static readonly typeName = "<rclone-type>"`
- Static config contract: `static requiredGnosis(): Set<string>`
- Registration: add the class to `createAkademiya().enroll(...)` in
  `src/engines/index.ts`.

### 3. Contracts

- Read only `Gnosis.raw` in the engine constructor.
- Required config fields are named only through `requiredGnosis()`.
- Optional capabilities (`listBuckets`, `presign`) are implemented only when the
  backend genuinely supports them.
- `clearance()` must exactly match implemented capabilities.
- Network engines must accept an injected client/fetcher so tests stay
  zero-network.
- Non-bucket backends map the configured root plus `bucket + key` onto their own
  path model; upper layers remain backend-blind.

### 4. Validation & Error Matrix

| Condition | Domain error |
|---|---|
| Unknown `type` | `ForbiddenKnowledge` from `Akademiya.summon` |
| Missing required raw key | `InvalidGnosis` from `validateRequiredGnosis` |
| Constructor defensive missing key | `ForbiddenKnowledge` |
| Backend 404 / missing resource | `CapsuleNotFound` |
| Backend/network/protocol failure | `BackendFault` |
| Unsupported operation | Absence from `clearance()`; do not probe with try/catch |

### 5. Good/Base/Bad Cases

- Good: `WebdavDarshan` uses native `fetch`, declares read/download/upload/delete,
  omits presign/list buckets, and relies on `Browser.url()` proxy fallback.
- Base: `LocalDarshan` maps a non-bucket filesystem root to the same
  `bucket + key` contract.
- Bad: adding WebDAV branches to `service/`, `server/`, `cli/`, or `frontend/`.

### 6. Tests Required

- Type name and `requiredGnosis()`.
- `clearance()` plus absence/presence of optional methods.
- Registration via `createAkademiya()`.
- One zero-network success test per public method.
- Backend 404 maps to `CapsuleNotFound`.
- Network/protocol failure maps to `BackendFault` with no secrets in the
  surfaced message.
- Config parser preserves backend-specific raw fields without interpreting them.

### 7. Wrong vs Correct

#### Wrong

```ts
if (remote.type === "webdav") {
  // service/server code chooses WebDAV behavior directly
}
```

#### Correct

```ts
export function createAkademiya(): Akademiya {
  return new Akademiya().enroll(LocalDarshan, S3Darshan, WebdavDarshan)
}
```

Upper layers summon through `Akademiya` and gate on `clearance()`.

## S3-compat field hints (reference §C)

- `S3Darshan` reads `access_key_id` + `secret_access_key` (required) and
  `endpoint`, `region`, `force_path_style` (optional) from `raw`. `region`
  defaults to `us-east-1` when absent — the AWS SDK requires a region even though
  most S3-compat servers ignore it. `force_path_style` is a string in rclone.conf;
  coerce `"true"`/`"1"`/`"yes"` to boolean before passing `forcePathStyle`.
- OSS: `endpoint=https://oss-cn-<region>.aliyuncs.com`, `region=cn-<region>`,
  `force_path_style=false` (must be virtual-host).
- COS: `endpoint=https://cos.<region>.myqcloud.com`, bucket carries an APPID
  suffix (`mybucket-1250000000`).
- MinIO / R2: usually need `force_path_style=true`.
