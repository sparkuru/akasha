# M6 WebdavDarshan Engine And New Engine Docs

## Goal

Implement `WebdavDarshan` as the first non-S3 network backend, register it under `type = webdav`, and document the minimal pattern for adding future engines without changing service, server, CLI, or frontend layers.

## What I Already Know

- Existing milestones M1-M5 implemented core abstractions, LocalDarshan, S3Darshan, Elysia API, and Web UI.
- `session.md` defines M6 as: "异类后端: 实现 WebdavDarshan 验证非 S3 路径，沉淀「写一个新引擎」开发文档。"
- `Darshan` already supports the required operations: list, stat, read, download, upload, delete, optional list buckets, optional presign.
- `Browser.url()` already falls back to `/api/object/read` when an engine lacks `presign`, so WebDAV does not need presigned URLs.
- `LocalDarshan` already establishes the convention for non-bucket backends: map the uniform `bucket + key` contract onto backend paths.
- Docker/Compose exists and must remain the dev/build/deploy path; no host environment changes.

## Assumptions

- M6 targets WebDAV servers with Basic auth and HTTPS URLs, such as Nutstore/Jianguoyun-style endpoints.
- M6 supports plain `user` + `pass` only. rclone-obscured passwords are out of scope.
- `WebdavDarshan` should use native `fetch` plus XML parsing rather than adding a WebDAV client dependency.
- `webdav` clearance should include `read`, `download`, `upload`, and `delete`, but not `list_buckets` or `presign`.

## Requirements

- Add `src/engines/webdav.ts` exporting `WebdavDarshan`.
- Register and export `WebdavDarshan` from `src/engines/index.ts`.
- Required gnosis fields: `url`. Optional auth fields: `user`, `pass`.
- Reject non-HTTPS password-bearing URLs unless a future explicit insecure option is introduced.
- Implement `listObjects()` via WebDAV `PROPFIND` `Depth: 1`.
- Convert WebDAV multistatus responses into `Capsule[]`, including directory detection, size, last modified, and etag when present.
- Implement `stat()` with `HEAD` when available, with a `PROPFIND Depth: 0` fallback if needed.
- Implement `readBytes()` via `GET`, respecting `maxBytes` by slicing the returned bytes.
- Implement `download()` by writing read bytes to `dest`.
- Implement `uploadFile()` via `PUT`, creating parent collections with `MKCOL` when practical.
- Implement `delete()` via WebDAV `DELETE`.
- Translate 404 responses to `CapsuleNotFound`; translate other backend/network failures to `BackendFault`; never leak credentials in error messages.
- Add tests covering success paths, XML parsing, auth headers, HTTPS enforcement, 404 mapping, and registration.
- Add docs describing the "new engine" pattern.

## Acceptance Criteria

- [x] `type = webdav` config can be summoned through `createAkademiya()`.
- [x] WebDAV list/read/stat/upload/delete operations pass zero-network unit tests using injected fetch.
- [x] WebDAV capsules are sorted and shaped consistently with Local/S3 engines.
- [x] WebDAV does not declare unsupported `list_buckets` or `presign` clearance.
- [x] Server/CLI/Web continue to work through existing service abstractions without backend-specific changes.
- [x] New engine documentation explains required files, registration, tests, and capability rules.
- [x] Docker Compose verification path remains valid.

## Completion Evidence

- `docker compose run --rm verify` passed: typecheck, 113 tests, Biome lint.

## Definition Of Done

- Tests added/updated.
- `bun run typecheck`, `bun test`, and `bun run lint` pass through Docker Compose where feasible.
- No host package installation or host environment mutation.
- Docs/spec notes updated when the implementation reveals a durable convention.

## Out Of Scope

- rclone obscure password reveal.
- OAuth/token refresh backends.
- WebDAV lock management.
- Recursive directory sync.
- `COPY` / `MOVE`.
- Third-party WebDAV client dependency.
- User-facing UI redesign.

## Research References

- [`research/webdav-protocol-mvp.md`](research/webdav-protocol-mvp.md) — WebDAV MVP can be implemented with native fetch and core HTTP/WebDAV methods.

## Technical Notes

- Relevant engine files: `src/core/darshan.ts`, `src/engines/local.ts`, `src/engines/s3.ts`, `src/engines/index.ts`.
- Relevant service behavior: `src/service/browser.ts` already gates capabilities and provides proxy URL fallback.
- Relevant specs: `.trellis/spec/core/*`, `.trellis/spec/engines/*`, `.trellis/spec/service/service-guidelines.md`, `.trellis/spec/server/quality-guidelines.md`.
