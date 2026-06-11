# Research: ElysiaJS 1.x idiomatic conventions (typed HTTP API for M4)

- **Query**: Current Elysia 1.x conventions for OpenAPI, Eden client, file upload, DI/context, error handling, zero-network route testing — mapped onto Akasha's `core`/`service` layers.
- **Scope**: external (elysiajs.com docs) + internal (installed package + repo specs/code)
- **Date**: 2026-06-11

## Version reality check (important)

`package.json` pins `"elysia": "^1.1.0"`, but the **installed resolution is `elysia@1.4.28`**
(`node_modules/elysia/package.json` line 4). The caret allows the whole 1.x line, so the code
we write must target **1.4**, not literal 1.1. This matters because the OpenAPI story changed
between 1.1 and 1.2+.

Evidence from `node_modules/elysia/package.json`:
- `peerDependencies`: `"@sinclair/typebox": ">= 0.34.0 < 1"`, `"openapi-types": ">= 12.0.0"`,
  `"file-type": ">= 20.0.0"` (file-type is a peer dep used by `t.File()` MIME validation).
- `devDependencies` includes **`"@elysiajs/openapi": "^1.4.1"`** — Elysia itself dev-depends on
  the new `@elysiajs/openapi` plugin, confirming it is the current/canonical one for 1.4.

**Recommendation: align the pin to `"elysia": "^1.3.0"` (or `^1.4.0`)** so the lockfile intent
matches what we code against, and so `@elysiajs/openapi` (1.2+) is guaranteed available. Keeping
`^1.1.0` while installing 1.4 is the one footgun to flag to implementation.

---

## 1. OpenAPI generation — use `@elysiajs/openapi` (NOT `@elysiajs/swagger`)

- **Old (Elysia ≤1.1):** `@elysiajs/swagger` — bundled Swagger UI, generated an OpenAPI 3.0 doc
  from route `t` schemas.
- **Current (Elysia 1.2+, and what 1.4.28 expects):** **`@elysiajs/openapi`**. `@elysiajs/swagger`
  is deprecated/superseded; new code on 1.2+ should use `@elysiajs/openapi`. It serves a Scalar UI
  at `/openapi` by default and exposes the raw spec at `/openapi/json`. Match the plugin major to
  the Elysia major (`@elysiajs/openapi@^1.4`).

Install:

```bash
bun add elysia @elysiajs/openapi
# (file-type is a transitive peer pulled for t.File MIME checks; bun resolves it)
```

Wiring + how `t` schemas feed the spec (route schemas are auto-collected):

```ts
import { Elysia, t } from "elysia"
import { openapi } from "@elysiajs/openapi"

export const app = new Elysia()
  .use(
    openapi({
      // served at /openapi (Scalar UI) and /openapi/json (raw spec)
      documentation: {
        info: { title: "Akasha API", version: "0.1.0" },
      },
    }),
  )
  // Any route's `query`/`params`/`body`/`response` t-schema is reflected into the spec.
  .get(
    "/api/remotes",
    () => listRemotes(),
    {
      // `detail` adds OpenAPI metadata (tags/summary) for this operation
      detail: { tags: ["remotes"], summary: "List rclone.conf remotes" },
      response: t.Array(RemoteSchema), // <-- documents the 200 body
    },
  )
```

Notes:
- The plugin reads each route's `t` schemas (`query`, `params`, `body`, `headers`, `response`)
  directly — there is no separate registration step. Defining schemas (M4 `server/schemas.ts`)
  is what populates the docs.
- For our `AkashaError` boundary shape, document error responses by adding numeric status keys to
  `response`, e.g. `response: { 200: OkSchema, 404: AkashaErrorSchema, 500: AkashaErrorSchema }`.
- Reference: elysiajs.com/plugins/openapi (current) vs the legacy elysiajs.com/plugins/swagger.

---

## 2. Eden typed client — `@elysiajs/eden`, `treaty` vs `edenFetch`

Install (match the major): `bun add @elysiajs/eden` (`@^1.4`). Eden is the type-safe client that
consumes `export type App = typeof app`.

- **`treaty` (recommended):** object/proxy-style, ergonomic — `client.api.remotes.get()`,
  `client.api.object.upload.post({ ... })`. Best DX, full body/query/response inference. Use this
  for tests and the Web package.
- **`edenFetch`:** fetch-style, string path + options — `fetch("/api/remotes", { method: "GET" })`.
  Lighter, smaller type surface; prefer only if treaty's proxy types get heavy.

The contract export already exists in `src/server/app.ts`:

```ts
export const app = new Elysia()/* …routes… */
export type App = typeof app   // <-- this is the public typed contract
```

Consume from a separate Web package or a test (treaty):

```ts
import { treaty } from "@elysiajs/eden"
import type { App } from "akasha/server/app" // type-only import; no runtime coupling

// Against a running server (Web package):
const client = treaty<App>("localhost:3000")

// GET with query params -> /api/objects?ref=remote:bucket/prefix
const { data, error } = await client.api.objects.get({
  query: { ref: "myremote:bucket/prefix/" },
})

// POST with a JSON body -> /api/index/recall
const recall = await client.api.index.recall.post({
  ref: "myremote:bucket/prefix/",
})
```

For **tests with zero network**, treaty can wrap the app instance directly instead of a URL
(no port bind):

```ts
const client = treaty(app) // pass the Elysia instance, not a host string
const res = await client.api.remotes.get()
```

Web package guidance: import `App` as a **type-only** dependency (`import type { App }`) so the Web
bundle never pulls server runtime code. Per `spec/server/elysia-guidelines.md` rule 2, this typed
client *is* the public API contract.

---

## 3. File upload — `multipart/form-data` with `t.File()` / `t.Files()`

Confirmed present in the installed 1.4.28 type system
(`node_modules/elysia/dist/type-system/index.d.ts`):

```
File: TFile;                                   // t.File()
Files: (options?: FilesOptions) => TUnsafe<File[]>;  // t.Files()
```

When the `body` schema contains a `t.File()`/`t.Files()`, Elysia auto-detects `multipart/form-data`,
parses it, and hands the handler a Web-standard `File` object (a `Blob` subclass). No manual
`request.formData()` needed.

POST upload route (`POST /api/object/upload`, per the M4 route plan):

```ts
import { t } from "elysia"

app.post(
  "/api/object/upload",
  async ({ body, surasthana }) => {
    const { ref, file } = body
    // `file` is a Web `File`. Read it into bytes for the engine:
    const bytes = new Uint8Array(await file.arrayBuffer())
    // (or stream:) const stream = file.stream()
    await surasthana.browser.put(ref, bytes, {
      contentType: file.type,
      name: file.name,
    })
    return { ok: true, name: file.name, size: file.size }
  },
  {
    type: "multipart/form-data", // optional; inferred from t.File, explicit is clearer for OpenAPI
    body: t.Object({
      ref: t.String(),                 // remote:bucket/prefix target
      file: t.File({ maxSize: "50m" }), // validates presence + size; MIME via file-type peer dep
    }),
  },
)
```

- `t.File({ type: "image/*", maxSize: "10m" })` validates MIME and size at the boundary
  (HTTP-layer validation per spec rule 1; the engine still does domain checks).
- Multiple files: `files: t.Files()` → handler gets `File[]`.
- The service `put`/upload method should accept `Uint8Array` (or a stream) — engines turn it into
  the S3 PutObject body. This keeps HTTP `File` types inside `server/` (spec rule 5: no HTTP types
  leak down).

---

## 4. Dependency injection / context — inject the "Surasthana" once at boot

Three mechanisms, all chainable and type-tracked into `App`:

| Method | Semantics | Lifetime | Use for |
|---|---|---|---|
| `.decorate(key, value)` | attaches a **fixed value** to every `Context` | built once, shared | **boot-time singletons / services** |
| `.derive(({…}) => ({…}))` | computes new context fields **per request** from the existing context | per request | request-scoped values (auth, parsed headers) |
| `.state(key, value)` | mutable value under `context.store` | per app, mutable | counters / mutable shared state |

**Recommendation for the Surasthana context: use `.decorate()`.** The Surasthana (parsed rclone
remotes + the `Akademiya` engine registry, wrapped in a `Browser`) is built once at boot and is
immutable for the app's life — exactly what `decorate` is for. `derive` would needlessly rebuild it
per request; `state` is for mutable store values.

`server/surasthana.ts` (context object) + wiring in `server/app.ts`:

```ts
// server/surasthana.ts
import { Akademiya } from "../core/akademiya.ts"
import { Browser } from "../service/browser.ts"
import type { Gnosis } from "../core/gnosis.ts"
import type { DarshanCtor } from "../core/akademiya.ts"

export interface Surasthana {
  browser: Browser
  // expose remotes/clearances etc. as needed by routes
}

export function buildSurasthana(remotes: Gnosis[], schools: DarshanCtor[]): Surasthana {
  const akademiya = new Akademiya().enroll(...schools) // e.g. enroll(S3Darshan, LocalDarshan)
  const browser = new Browser(remotes, akademiya)      // Browser(remotes, akademiya) — see src/service/browser.ts:61
  return { browser }
}
```

```ts
// server/app.ts
import { Elysia } from "elysia"

const surasthana = buildSurasthana(remotes, [S3Darshan, LocalDarshan])

export const app = new Elysia()
  .decorate("surasthana", surasthana) // injected once; typed on every handler
  .get("/api/remotes", ({ surasthana }) => surasthana.browser /* … */)

export type App = typeof app
```

Every handler now destructures `{ surasthana }` from context with full typing — no globals, and the
`Browser`/`Akademiya` stay testable (swap a fake Surasthana, see §6). This matches
`spec/server/elysia-guidelines.md` (`server/surasthana.ts` = "web service context injected into routes").

---

## 5. Error handling — `.error()` + `.onError()` mapping domain errors to `AkashaError`

Akasha's domain errors live in `src/core/darshan.ts` (verified):
`ForbiddenKnowledge` (darshan.ts:57), `CapsuleNotFound` (darshan.ts:70), `BackendFault`
(darshan.ts:82), plus `InvalidGnosis` (core/gnosis.ts). The boundary shape `AkashaError`
(`spec/core/error-handling.md`):

```ts
export interface AkashaError {
  code: "forbidden_knowledge" | "invalid_gnosis" | "not_found" | "backend_error"
  message: string
  detail?: unknown
}
```

`.error()` registers custom error classes under string keys so `.onError()` can narrow on `code`
in a **typed** way; `.onError()` is the global mapper that sets HTTP status + returns the unified
JSON body via `set.status`.

```ts
import { Elysia } from "elysia"
import {
  ForbiddenKnowledge, CapsuleNotFound, BackendFault,
} from "../core/darshan.ts"
import { InvalidGnosis } from "../core/gnosis.ts"
import type { AkashaError } from "../core/error.ts"

export const app = new Elysia()
  // Register domain errors so `code` is one of these literals in onError:
  .error({
    FORBIDDEN_KNOWLEDGE: ForbiddenKnowledge,
    INVALID_GNOSIS: InvalidGnosis,
    NOT_FOUND: CapsuleNotFound,
    BACKEND_FAULT: BackendFault,
  })
  .onError(({ code, error, set }): AkashaError => {
    switch (code) {
      case "NOT_FOUND": // CapsuleNotFound -> 404
        set.status = 404
        return { code: "not_found", message: error.message }
      case "FORBIDDEN_KNOWLEDGE": // unsupported op -> 403
        set.status = 403
        return { code: "forbidden_knowledge", message: error.message }
      case "INVALID_GNOSIS": // missing required keys -> 400
        set.status = 400
        return { code: "invalid_gnosis", message: error.message, detail: error.missing }
      case "BACKEND_FAULT": // vendor/network failure -> 500 (or 502)
        set.status = 500
        return { code: "backend_error", message: error.message }
      default: // VALIDATION (t-schema) / NOT_FOUND route / unknown
        set.status = (code === "VALIDATION") ? 422 : 500
        return { code: "backend_error", message: "internal error" }
    }
  })
```

Mapping summary (matches `spec/core/error-handling.md` table):

| Domain error | `.error()` key | `code` | HTTP |
|---|---|---|---|
| `CapsuleNotFound` | `NOT_FOUND` | `not_found` | 404 |
| `ForbiddenKnowledge` | `FORBIDDEN_KNOWLEDGE` | `forbidden_knowledge` | 403 |
| `InvalidGnosis` | `INVALID_GNOSIS` | `invalid_gnosis` | 400 |
| `BackendFault` | `BACKEND_FAULT` | `backend_error` | 500 |
| Elysia `VALIDATION` (built-in) | — | (map to validation/422) | 422 |

Built-in `code` values Elysia provides without registration: `"VALIDATION"`, `"NOT_FOUND"`
(unmatched route), `"PARSE"`, `"INTERNAL_SERVER_ERROR"`, `"UNKNOWN"`. Per spec: never leak the
SDK error or stack — only `error.message` (engines already build a credential-free message and put
the raw error on `.cause`). Log `backend_error` at warn/error at this conversion point.

---

## 6. Zero-network route testing — `app.handle(new Request(...))` with `bun test`

`app.handle(request: Request): Promise<Response>` runs the full route pipeline (validation,
decorate, handler, onError) **without binding a port** — ideal for fast, hermetic tests. Inject a
fake Surasthana whose `Browser` uses an in-memory/stub engine so no S3/network is touched (the repo
already has `StubDarshan` in `src/core/akademiya.test.ts`).

```ts
// src/server/routes.test.ts
import { describe, it, expect } from "bun:test"
import { Elysia } from "elysia"
import { registerRoutes } from "./routes.ts" // your route-registration fn
import type { Surasthana } from "./surasthana.ts"
import type { Capsule } from "../service/browser.ts"

// A fake Browser/engine — zero network, deterministic:
const fakeSurasthana = {
  browser: {
    async list(_ref: string): Promise<Capsule[]> {
      return [{ name: "a.txt", path: "bucket/a.txt", type: "file", size: 3, modified: "2026-01-01T00:00:00Z" }]
    },
  },
} as unknown as Surasthana

// Build an app with the fake context injected:
const app = new Elysia()
  .decorate("surasthana", fakeSurasthana)
  .use(registerRoutes) // registerRoutes is an Elysia plugin/fn that adds /api/* routes

describe("GET /api/objects", () => {
  it("returns 200 and the listed capsules", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/objects?ref=fake:bucket/"),
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual([
      { name: "a.txt", path: "bucket/a.txt", type: "file", size: 3, modified: "2026-01-01T00:00:00Z" },
    ])
  })

  it("maps a not-found domain error to 404 AkashaError", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/objects?ref=fake:missing/"),
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
  })
})
```

Conventions:
- Use an **absolute URL** in `new Request("http://localhost/...")` — Elysia routes on the path.
- For POST bodies: `new Request(url, { method: "POST", body: JSON.stringify({...}), headers: { "content-type": "application/json" }})`.
- For uploads: build a real `FormData` with a `new File([...], "name")` and pass as `body` — `app.handle` parses `t.File()` the same as a live request.
- Treaty (`treaty(app)`, §2) is the typed alternative to raw `app.handle` when you want the
  request to be type-checked against `App`; raw `handle` is best for asserting exact status/JSON of
  the wire shape (e.g. the `AkashaError` body).

---

## Repo mapping cheatsheet (what each finding plugs into)

| M4 module (per `spec/server/elysia-guidelines.md`) | Uses |
|---|---|
| `server/app.ts` | `openapi()` plugin (§1), `.decorate("surasthana", …)` (§4), `.error()`+`.onError()` (§5), `export type App` (§2) |
| `server/routes.ts` | thin handlers reading `{ surasthana }`, calling `surasthana.browser.*`, uploads via `t.File` body (§3) |
| `server/schemas.ts` | `t` schemas (incl. `AkashaErrorSchema`, `t.File`) that drive both validation and OpenAPI |
| `server/surasthana.ts` | `buildSurasthana(remotes, schools)` → `new Akademiya().enroll(...)` + `new Browser(remotes, akademiya)` |
| tests | `app.handle(new Request(...))` + fake Surasthana / `StubDarshan` (§6) |

Existing symbols confirmed in code:
- `Akademiya.enroll(...ctors)` / `.summon(gnosis)` — `src/core/akademiya.ts:26,45`
- `Browser` constructor `(remotes: Gnosis[], akademiya: Akademiya)` with `.list()` / `.read()` —
  `src/service/browser.ts:61-91` (note: an upload/`put` method is NOT present yet — M4 likely adds
  it to `Browser` for the `/api/object/upload` route).
- Domain errors `ForbiddenKnowledge` / `CapsuleNotFound` / `BackendFault` — `src/core/darshan.ts:57,70,82`.
- `export const app` / `export type App` already stubbed — `src/server/app.ts:9,11`.

## Caveats / Not Found

- **Version pin mismatch (action item):** `package.json` says `elysia@^1.1.0` but `1.4.28` is
  installed. All snippets above target the installed **1.4** API (`@elysiajs/openapi`, `t.File`,
  `.error()` typed keys). If the team genuinely must stay on 1.1, OpenAPI would instead use
  `@elysiajs/swagger` and `t.File` ergonomics differ slightly — recommend bumping the pin to
  `^1.3.0`/`^1.4.0` to match reality.
- `@elysiajs/openapi` / `@elysiajs/eden` are **not yet installed** in `node_modules` — only `elysia`
  core is. Implementation must `bun add` them (match major to `@^1.4`).
- Exact `@elysiajs/openapi`/`@elysiajs/eden` minor versions: `@elysiajs/openapi@^1.4.1` is the
  version Elysia 1.4.28 dev-depends on (authoritative from `node_modules/elysia/package.json:198`);
  pick the matching `@^1.4` line for eden.
- HTTP status choices (403 for ForbiddenKnowledge, 422 vs 400 for validation) are my mapping
  proposal consistent with the spec's `code` table; the spec fixes the `code` strings but does not
  mandate exact HTTP numbers — confirm during implementation.
- The `Browser` upload/`put` method referenced in §3 does not exist in `src/service/browser.ts`
  today; M4 (or the service slice) must add it. Flagged, not assumed.
