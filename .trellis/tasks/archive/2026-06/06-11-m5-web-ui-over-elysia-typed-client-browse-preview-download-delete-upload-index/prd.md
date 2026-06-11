# M5: Web UI over Elysia typed client

## Goal

Ship the Web UI — the `frontend/` interface layer — that lets a user browse
remotes/buckets/objects, preview small files, download, delete, upload, and view
the persisted index, all driven by the **Eden typed client** against the M4
Elysia API. The UI is an adapter like CLI/server: it consumes the typed contract
(`App`) and gates actions on each engine's `clearance()` — never forking browse
logic and never bypassing the API to touch `core`/engines directly.

## What I already know (from repo + specs)

* M4 shipped the full API: 10 routes, `export type App` in `src/server/app.ts`,
  OpenAPI at `/openapi`, Eden (`@elysiajs/eden`) already a dependency.
* Responses carry `clearance()` per remote (`RemoteSummary`), so the UI can gate
  preview/download/delete/upload/url buttons without probing.
* `/api/object/url` returns `{ url, kind: "presigned"|"proxy", expiresIn? }` —
  download works for both presign and non-presign engines.
* Stack is pure Bun + Elysia + TypeScript; **no frontend tooling/bundler/JSX is
  configured yet** (tsconfig targets `src` only, has DOM lib; deps are just
  elysia/aws-sdk/citty). Adding a UI introduces the project's first frontend
  build decision.
* `session.md` §2 lists `frontend/` as the (optional) third interface layer
  alongside `server/` and `cli/`; §6 fixes the route contract.
* There is **no `spec/frontend/` layer yet** — this milestone likely creates it.

## Decisions

* (Q1 ✓) **Bun-native + vanilla TS.** No framework. Bundle with `Bun.build`;
  Elysia serves the built assets as static — single process, single port. Keeps
  the dependency tree minimal (no Vite/React). Eden `treaty<App>()` consumed in
  the browser. UI lives at `src/frontend/` (per `session.md` §2 layout).
* (Q2 ✓, follows Q1) **Elysia static-serve, same-origin.** No separate Vite dev
  server; the Eden client targets same-origin `/api/*`. Dev loop = `Bun.build`
  (watch) + Elysia.

* (Q3 ✓) **Full 6 features in MVP**: browse (remotes→buckets→objects), preview
  (small files), download (presign/proxy), delete, upload, index view. Full
  CLI/API parity; every action capability-gated.

## Decisions (continued)

* (Q4 ✓) **Tier A primary + B/C accents.** Extract UI logic (which call to
  make, branch on `error.value.code`, enable buttons from `clearance`) into pure
  functions tested via `treaty(appWith(fake))` — identical to M4
  `app.test.ts`, zero-network, zero new deps. Add **Tier B** (`@happy-dom` dev
  dep) only for genuinely DOM-rendering assertions (button disabled state, error
  toast text). Add one **Tier C** smoke test that boots the app and asserts the
  HTML shell loads (static-serve wiring guard). See
  [`research/elysia-eden-frontend.md`](research/elysia-eden-frontend.md) §5.

## Requirements (evolving)

* `frontend/` consumes `import type { App }` via Eden — typed, no runtime coupling
  to server internals; never calls `core`/engines directly.
* Capability-gated UI: buttons/actions reflect each remote's `clearance()` set.
* Browse remotes → buckets → objects (folder hierarchy via the objects route).
* Preview small files (`/api/object/read`), download (presign or proxy URL),
  delete, upload (`t.File` multipart), and view the persisted index.
* Unified error surfacing from the `AkashaError` body — no raw stacks/secrets.

## Acceptance Criteria (evolving)

* [x] UI drives every feature exclusively through the Eden typed client.
* [x] Actions are capability-gated from `clearance()`, not try/catch probing.
* [x] `tsc`, `bun test` (99 pass), `biome check` green; tests stay zero-network.
* [x] Tier A logic tests cover capability-gating + `AkashaError` surfacing via
  `treaty(appWith(fake))`; Tier B DOM assertions under a `@happy-dom` registrator;
  one Tier C smoke test guards static-serve wiring.
* [x] `trellis-check` passes all spec dimensions (new `spec/frontend/` layer added).

## Definition of Done

* `frontend/` (+ any build config) added; served/runnable; tests added.
* Full quality gate green via `docker compose run --rm verify`.
* `spec/frontend/` (or equivalent) captures the UI-layer conventions.
* No `core`/`engines`/`service`/`server` behavior changed beyond additive needs.

## Out of Scope

* WebdavDarshan / non-S3 engines (M6).
* Auth / multi-user / multi-config (one boot-time config per server).
* Streaming/Range proxy download (deferred from M4).

## Technical Notes

* Eden client contract: `import type { App } from "../server/app.ts"`; `treaty`.
* Capability gating + presign-fallback already solved server-side (M4) — the UI
  just reflects `kind` and `clearance`.
* Layering rule (`session.md` §2): `frontend/` depends only on the typed API.

## Research References

* (pending) `research/elysia-eden-frontend.md` — Bun+Elysia+Eden frontend
  integration: framework options, static-serve vs Vite-proxy, treaty browser
  client, build tooling, zero-network UI testing.
