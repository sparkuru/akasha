# M4: Elysia API + service layer (routes, schema, OpenAPI)

## Goal

Stand up the HTTP API for Akasha on ElysiaJS so the Web UI (M5) and the existing
CLI drive the **same** service layer. The server is an adapter only: parse →
call service → map to HTTP. Prove the `Darshan` → service → two-interface
architecture holds by adding routes WITHOUT forking browse/path/index logic into
the transport.

## What I already know (from repo + specs)

* `core`, `engines` (local + s3), `config` (rclone parser) are done.
* `service/` exists but is partial:
  * `browser.ts` — `Browser` has only `list()` + `read()` + `parseAddress()`.
    Missing the use cases the routes need: `stat`, `download`, `upload`,
    `delete`, `url`(presign), `listBuckets`, `listRemotes`.
  * `path.ts` (`seal`/`purify`) and `house-of-wisdom.ts` (irminsul index) done.
* `server/app.ts` is a stub with only `/health`. Missing `routes.ts`,
  `schemas.ts`, `surasthana.ts`, OpenAPI, Eden client.
* `cli/commands.ts` has `remotes/ls/cat/recall`; spec names parity targets
  `remotes/buckets/ls/cat/get/put/rm/url/browse`.
* Route plan is already decided in
  [`spec/server/elysia-guidelines.md`](../../spec/server/elysia-guidelines.md)
  (10 routes) and `session.md` §6.
* Deps present: `elysia@^1.1.0`. Missing: OpenAPI plugin, Eden, (maybe) nothing
  else.

## Route plan (decided — spec/server/elysia-guidelines.md)

| Method | Route | Service call |
|---|---|---|
| GET | `/api/remotes` | list rclone.conf remotes |
| GET | `/api/buckets` | listBuckets (capability-gated) |
| GET | `/api/objects` | list a dir by `remote/bucket/prefix` |
| GET | `/api/object/stat` | object metadata |
| GET | `/api/object/read` | small-file preview / first N bytes |
| GET | `/api/object/url` | presigned URL (capability-gated, proxy fallback) |
| POST | `/api/object/upload` | upload a file |
| DELETE | `/api/object` | delete an object |
| POST | `/api/index/recall` | refresh current directory index |
| GET | `/api/index` | read persisted index |

## Decisions

* (Q1 ✓) Scope = **Service extension + complete Server** (all 10 routes incl.
  upload/delete/url write ops). CLI stays at `remotes/ls/cat/recall`; full CLI
  parity (`buckets/get/put/rm/url/browse`) deferred to a later task.

* (Q2 ✓) **Both OpenAPI + Eden in M4.** Wire the OpenAPI plugin (generated docs)
  and export `App` type + at least one Eden `treaty` typed-client test, so M5
  inherits a verified typed contract.

* (Q4 ✓) **Boot-time load once.** Read `rclone.conf` at startup from an env var
  (`AKASHA_CONFIG`, default `rclone.conf`), parse remotes + `createAkademiya()`,
  build one `Surasthana` and `.decorate()` it onto every route. Reload = restart.

* (Q3 ✓) **Lightweight proxy-URL fallback.** `/api/object/url` returns a real
  presigned URL when the engine has `presign` clearance; otherwise a relative
  proxy URL pointing at our own `/api/object/read?ref=…`. Response carries
  `{ url, kind: "presigned" | "proxy", expiresIn? }`. Reuses the read route — no
  separate streaming/Range proxy this milestone (that's a later hardening).

## Requirements

* **Service extension** (`service/`, shared with CLI — single source of truth):
  add the use cases the routes need beyond today's `list`/`read`:
  `stat`, `upload` (`put`, accepts `Uint8Array`/stream), `delete`, `url`
  (presign + proxy fallback), `listBuckets`, `listRemotes`, `readIndex`. All
  paths pass through `path.ts`; capability-gate via `darshan.clearance()`.
* **Server** (`server/`, adapter only):
  * `server/surasthana.ts` — `buildSurasthana(remotes, schools)` →
    `Akademiya.enroll(...)` + `Browser`; built once at boot.
  * `server/schemas.ts` — Elysia `t` schemas (request/response + `t.File` upload
    + `AkashaErrorSchema` wire shape) driving both validation and OpenAPI.
  * `server/routes.ts` — thin handlers: read `{ surasthana }`, call service, map.
  * `server/app.ts` — `openapi()` plugin, `.decorate("surasthana", …)`,
    `.error()`+`.onError()` domain→HTTP mapping, `export type App`. Boot reads
    `AKASHA_CONFIG` (default `rclone.conf`).
* **Deps**: bump `elysia` pin `^1.1.0` → `^1.4.0` (1.4.28 already installed);
  `bun add @elysiajs/openapi@^1.4 @elysiajs/eden@^1.4`.
* **Two-layer validation**: Elysia `t` schema at transport, `core` at domain.
* **Unified error mapping**: `CapsuleNotFound`→404, `ForbiddenKnowledge`→403,
  `InvalidGnosis`→400, `BackendFault`→500, Elysia `VALIDATION`→422; body is the
  `AkashaError` shape `{ code, message, detail? }`. Never leak SDK error/stack/secret.
* Responses listing a remote/engine include its `clearance()` set.
* **Eden typed client**: `export type App`; at least one `treaty(app)` test that
  exercises the typed contract end-to-end.
* **Zero-network tests** via `app.handle(new Request(...))` + a fake Surasthana /
  `StubDarshan` (reuse `core/akademiya.test.ts` stub). No port bind, no S3.

## Acceptance Criteria

* [ ] All 10 routes implemented, each delegating to a service method; no
  browse/path/index logic in `server/` or `cli/`.
* [ ] Service gains `stat/upload/delete/url/listBuckets/listRemotes/readIndex`,
  each path-guarded and capability-gated; covered by zero-network unit tests.
* [ ] `/api/object/url` returns `kind:"presigned"` for an S3 remote and
  `kind:"proxy"` for a non-presign remote (no "not supported" error).
* [ ] OpenAPI doc served (`/openapi`); `export type App` consumed by a passing
  `treaty(app)` typed-client test.
* [ ] Error responses use the `AkashaError` shape with correct HTTP status; no
  vendor/stack/secret leakage.
* [ ] `tsc --noEmit`, `bun test`, `biome check src` all green; zero-network.
* [ ] No `core`/`engines`/`config` behavior changed beyond additive needs;
  `cli/` untouched. `trellis-check` passes all spec dimensions.

## Technical Approach

Server-as-adapter over the extended service, per
[`spec/server/elysia-guidelines.md`](../../spec/server/elysia-guidelines.md) and
the research in [`research/elysia-1x-conventions.md`](research/elysia-1x-conventions.md):
inject `Surasthana` via `.decorate()`; `t.File()` for upload; `.error()`/`.onError()`
for the unified `AkashaError` boundary; `@elysiajs/openapi` for docs; Eden `treaty`
for the typed contract. The `AkashaError` wire shape is defined at the server
boundary (schemas.ts) — domain errors stay in `core`.

## Decision (ADR-lite)

**Context**: M4 must expose an HTTP API without forking browse/path/index logic
out of the service, on an Elysia version (1.4.28) newer than the pinned 1.1.

**Decision**: (1) Extend `service/` with all route-backing use cases first, then
build a thin `server/` adapter. (2) Bump the Elysia pin to `^1.4` and adopt the
current `@elysiajs/openapi` + `@elysiajs/eden` (not the legacy swagger plugin).
(3) Inject one boot-time `Surasthana` via `.decorate()`. (4) Satisfy the
no-"unsupported" rule with a lightweight proxy-URL fallback that reuses the read
route. (5) Keep CLI at its current command set; parity deferred.

**Consequences**: Web UI (M5) inherits a verified typed contract and OpenAPI doc.
Streaming/Range proxy and full CLI parity are explicit follow-ups. Pin bump
touches `package.json`/`bun.lock` but no `core`/`engines` behavior.

## Definition of Done

* `server/{app,routes,schemas,surasthana}.ts` + tests; service extended + tests.
* Full quality gate green via `docker compose run --rm verify`.
* Specs synced if anything new is decided.

## Out of Scope

* Web UI (M5).
* WebdavDarshan / non-S3 engines (M6).
* Full CLI parity commands (`buckets/get/put/rm/url/browse`) — later task.
* Streaming / HTTP Range proxy download — `/api/object/url` proxy fallback this
  milestone is a relative URL to the existing read route, not a range server.
* Auth / multi-tenant config — one boot-time `rclone.conf` per server process.

## Technical Notes

* Server-as-adapter + route plan: `spec/server/elysia-guidelines.md`.
* Service rules (path guard, capability gating, presign fallback):
  `spec/service/service-guidelines.md`.
* Error mapping: `spec/core/error-handling.md`.

## Research References

* [`research/elysia-1x-conventions.md`](research/elysia-1x-conventions.md) —
  Elysia 1.4 conventions: `@elysiajs/openapi` (not swagger), Eden `treaty`,
  `t.File()` upload, `.decorate()` Surasthana injection, `.error()`/`.onError()`
  domain→HTTP mapping, `app.handle()` zero-network tests. Flags the 1.1→1.4 pin
  mismatch and that openapi/eden aren't installed yet.
