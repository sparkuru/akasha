# Elysia Guidelines

> Conventions derived from the agreed `session.md` design (§1, §6). The server
> landed M4; the "Landed M4" section below records the concrete wiring against
> real `server/` code.

## Server is an adapter only

`server/` builds the Elysia app, declares routes + schemas, injects the service
context, and maps service results/errors to HTTP. It contains **no** browse,
path, or index logic — all of that lives in the service layer.

| Module | Owns |
|---|---|
| `server/app.ts` | Elysia app creation, plugin wiring |
| `server/routes.ts` | HTTP route handlers (thin: parse → call service → map) |
| `server/schemas.ts` | Elysia `t` schemas for request/response validation |
| `server/surasthana.ts` | web service context (`Surasthana`) injected into routes |

## Rules

1. **Two-layer validation.** Elysia `t` schema validates external HTTP input;
   `core` validates `Gnosis` + engine capability. Don't push transport validation
   into core, and don't re-validate domain rules in routes.
2. **Typed contract is the public API.** Generate OpenAPI; expose an Eden typed
   client for the Web UI and tests. Treat the schema as the contract — Web UI,
   tests, and third parties depend on the typed interface, not ad-hoc JSON.
3. **Unified errors.** Map domain errors to `AkashaError`
   (see [core/error-handling](../core/error-handling.md)) and return them with
   the matching HTTP status. Never leak a vendor SDK error or a stack to the
   client.
4. **Surface capabilities.** Responses that list a remote/engine include its
   `clearance()` set so the UI can gate preview/delete/upload without probing.
5. **No storage types below the boundary leak up, and no HTTP types leak down.**
   Elysia-inferred types stay in `server/`.

## Route plan (decided, `session.md` §6)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/remotes` | list rclone.conf remotes |
| GET | `/api/buckets` | list buckets (capability-gated) |
| GET | `/api/objects` | list a directory by `remote/bucket/prefix` |
| GET | `/api/object/stat` | object metadata |
| GET | `/api/object/read` | small-file preview / first N bytes |
| GET | `/api/object/url` | presigned URL (capability-gated) |
| POST | `/api/object/upload` | upload a file |
| DELETE | `/api/object` | delete an object |
| POST | `/api/index/recall` | refresh current directory index |
| GET | `/api/index` | read persisted index |

## CLI parity (`cli/`)

The Bun CLI (`cli/terminal.ts`, `cli/commands.ts`) drives the same service with
commands `remotes/buckets/ls/cat/get/put/rm/url/browse`. Each command maps to the
same service call as its sibling route — never fork browsing behavior between the
two interfaces. (M4 shipped `remotes/ls/cat/recall`; the rest are a follow-up
task — the Web routes already cover the full surface via `Browser`.)

## Landed M4 — concrete wiring

### Dependencies (decided)

`elysia@^1.4` (1.1 was the original pin; 1.4 is what installs). OpenAPI via
**`@elysiajs/openapi`** — NOT the legacy `@elysiajs/swagger` — served at
`/openapi` (UI) + `/openapi/json` (raw). Typed client via **`@elysiajs/eden`**
`treaty`. Route `t` schemas auto-populate the OpenAPI doc; defining
`server/schemas.ts` IS the documentation step.

### Context injection — `.decorate()` once at boot

```ts
// server/surasthana.ts
buildSurasthana(remotes, schools, indexPath?): Surasthana  // Akademiya.enroll(...) + new Browser
// server/app.ts
buildApp(surasthana) = new Elysia().use(openapi(...)).decorate("surasthana", surasthana)…
export type App = typeof app
bootApp()  // reads AKASHA_CONFIG (default "rclone.conf"), parses remotes, builds Surasthana
```

Use `.decorate()` (immutable boot singleton), never `.derive()` (per-request) or
`.state()` (mutable). One `rclone.conf` per process; reload = restart
(`AKASHA_CONFIG` env). Every handler destructures `{ surasthana }` — no globals.

### `/api/object/url` response contract

```ts
{ url: string, kind: "presigned" | "proxy", expiresIn?: number }
```

Presigned for engines with `presign` clearance; otherwise a relative proxy URL
to `/api/object/read` (see [service-guidelines](../service/service-guidelines.md)
`url()`). Upload route takes `t.File()` and converts to `Uint8Array` before the
service call — HTTP `File` never reaches the service.

### Zero-network route tests (required)

Test via `app.handle(new Request("http://localhost/api/..."))` with a fake
`Surasthana` backed by an in-memory engine (reuse the `StubDarshan`/`FakeDarshan`
pattern) — no port bind, no S3. Cover: representative read/write/error paths,
both `kind:"presigned"` and `kind:"proxy"`, the `AkashaError` body + status, the
served OpenAPI doc, and at least one `treaty(app)` Eden call exercising `App`.
