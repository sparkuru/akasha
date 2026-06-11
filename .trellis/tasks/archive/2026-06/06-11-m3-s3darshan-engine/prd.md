# M3: S3Darshan engine over AWS SDK v3

## Goal

Ship the second concrete engine, `S3Darshan`, proving the `Darshan` abstraction
holds against a real, network-backed, vendor SDK. One engine covers every
S3-compatible backend (AWS S3 / 火山 TOS / 阿里 OSS / 腾讯 COS / MinIO / Cloudflare
R2) by reading their rclone `type=s3` profiles. No `service`/`server`/`cli`
changes beyond registering the engine — the milestone succeeds only if the upper
layers stay untouched.

## Requirements

* New file `src/engines/s3.ts`, class `S3Darshan implements Darshan`
  (`engines/engine-authoring.md` checklist).
* `static typeName = "s3"` — the literal rclone key, never themed.
* `static requiredGnosis()` returns the minimal hard-required `raw` keys:
  `access_key_id`, `secret_access_key`. `endpoint`, `region`,
  `force_path_style` are read from `raw` but optional (see Technical Notes).
* Construct an `S3Client` from `Gnosis.raw` in the constructor — read config from
  `raw` only, never the config layer.
* Implement the full required contract:
  `listObjects`, `stat`, `readBytes`, `download`, `uploadFile`, `delete`.
* Implement both optional methods — S3 genuinely supports them:
  `listBuckets`, `presign` (GET + PUT, `expiresIn`).
* `clearance()` returns the complete capability set:
  `list_buckets`, `read`, `download`, `upload`, `delete`, `presign` — and it MUST
  match the methods actually implemented.
* Error mapping: catch `@aws-sdk` errors inside the engine and rethrow as domain
  errors. Distinguish "not found" (NoSuchKey / NotFound / 404) from other backend
  failures so `server/` can map `not_found` vs `backend_error` later. Throw
  `ForbiddenKnowledge` only for genuinely unsupported operations. Never leak
  secrets in error messages.
* `listObjects` maps S3 `CommonPrefixes` → directory `Capsule`s and `Contents` →
  file `Capsule`s, using `delimiter` (default `/`) for the
  folder-style hierarchy; preserve `size`, `lastModified`, `etag`, `storageClass`.
* Register: one `enroll(S3Darshan)` line added to `src/engines/index.ts`.
* Dependencies imported by the engine: only `core` types + the AWS SDK. Add
  `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `package.json`.

## Acceptance Criteria

* [ ] `S3Darshan` implements every `Darshan` required method + `listBuckets` +
  `presign`; `clearance()` matches.
* [ ] `requiredGnosis()` is validated by `Akademiya.summon` before construction;
  a missing `access_key_id`/`secret_access_key` throws `InvalidGnosis`.
* [ ] Engine catches SDK errors and rethrows domain errors; a missing-key read
  surfaces a distinguishable not-found signal (not a raw `@aws-sdk` exception).
* [ ] `createAkademiya()` enrolls both `LocalDarshan` and `S3Darshan`; summoning
  a `type=s3` Gnosis returns a working engine.
* [ ] Zero-network unit tests cover command construction + response mapping for
  list/stat/read/download/upload/delete/presign/listBuckets via an injected fake
  S3 client (no real network, no MinIO needed in the gate).
* [ ] `tsc --noEmit`, `bun test`, `biome check src` all green in-container.
* [ ] `trellis-check` passes all spec dimensions.

## Definition of Done

* `src/engines/s3.ts` + `src/engines/s3.test.ts` added; `engines/index.ts`
  enrolls it; `package.json` has the two AWS SDK deps; `bun.lock` updated.
* Full quality gate green via `docker compose run --rm verify`.
* No `service`/`server`/`cli` source changed (registration in `engines/` only).
* Specs synced if anything was decided that the engine specs don't yet capture.

## Out of Scope

* Elysia API / routes / OpenAPI (M4).
* Web UI (M5).
* Native per-vendor engines (OSS/COS native SDKs) — S3-compat must cover them.
* WebDAV / obscured-password backends (extension phase).
* A live MinIO integration test in the CI gate. (May be noted as a follow-up; the
  gate stays zero-network.)

## Technical Notes

* **Testability without network**: have the constructor build a real `S3Client`
  by default, but allow an injected client/sender for tests (e.g. an optional
  second constructor arg or a small seam the engine `send()`s through). Tests
  feed a fake whose `send(command)` returns canned shapes and asserts the command
  type + input. This keeps the gate zero-network, matching M2.
* **endpoint/region/force_path_style**: AWS S3 proper needs only `region`;
  S3-compatible vendors set a custom `endpoint`. MinIO/R2 usually need
  `force_path_style=true`; OSS must stay virtual-host (`false`). Read all three
  from `raw`, coerce `force_path_style` from its string form, and pass through to
  the `S3Client` config. Default region to a sane fallback (e.g. `us-east-1`)
  when absent, since many S3-compat servers ignore it but the SDK requires one.
* **obscure vs plaintext** (`config-compat.md`): S3 access keys are plaintext —
  in scope. Do not attempt to reveal obscured fields.
* **Stream handling**: `readBytes`/`download` consume the SDK response body
  (a web `ReadableStream`/`Blob` under Bun); normalize to bytes the same way
  `LocalDarshan.toBytes` does. Respect `maxBytes` in `readBytes`.
* **Reference**: `session.md` §3.2, §7, §C, §D; `engines/engine-authoring.md`
  (S3-compat field hints), `engines/config-compat.md` (per-engine raw keys),
  `core/error-handling.md` (not_found vs backend_error mapping).
