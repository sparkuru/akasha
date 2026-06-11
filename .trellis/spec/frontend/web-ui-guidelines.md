# Web UI Guidelines

> Conventions for the `src/frontend/` Web UI, decided in M5 (2026-06-11). Grounded
> in [`research/elysia-eden-frontend.md`](../../tasks/archive/2026-06/) and the
> existing `server/` adapter rules. Stack: pure Bun + vanilla TS, no framework.

## File layout

```
src/frontend/
  client.ts      # treaty<App>(location.origin) — the one browser client value
  logic.ts       # DOM-free: can(), errorText(), makeRef(), client-driven calls (Tier A)
  view.ts        # DOM construction, capability-gated controls (Tier B)
  main.ts        # browser-only controller: nav state + Outcome→banner glue
  index.html     # SPA shell; links /assets/main.js, inline CSS
  dist/          # bun build output (gitignored)
```

Served by `src/server/static.ts` (the `web` Elysia plugin), mounted **after**
`.use(routes)` in `app.ts` so `/api/*` and `/openapi/*` win over the `/` +
`/assets/*` catch-all.

## Typed client (Eden)

- One client: `export const client: AkashaClient = treaty<App>(location.origin)`.
  In the **browser** pass the origin **string**; in **tests** pass the **App
  instance** (`treaty(appWith(fake))`). Same `Treaty.Create<App>` type both ways.
- `import type { App }` and `import type { AkashaError }` are **type-only** — never
  a runtime import of server code. The bundle must contain no `S3Darshan`,
  `aws-sdk`, `buildSurasthana`, etc. (grep the built `main.js` to confirm).
- Treaty path mapping: `/api/object/url` → `client.api.object.url.get({ query })`;
  `DELETE /api/object` has no body but a required query, so its signature is
  `(undefined, { query })` — two args, body first.
- Treaty never throws by default: every call returns `{ data, error }`. Wrap each
  in an `Outcome<T>` (`{ ok:true, value } | { ok:false, error }`) so callers branch
  on `ok`, not try/catch.

## Capability gating

- Read clearance straight from the `/api/remotes` response: `can(remote, cap)`.
- Download needs `download` **or** `presign`; upload needs `upload`; delete needs
  `delete`. A lacking capability → the control is disabled or omitted, matching the
  server-side gate (a forbidden call still 403s, but the UI never relies on that).

## Error surfacing

- Map `AkashaError.code` to a human line in `errorText()`; default to
  `error.message`. Never render a stack or `detail` blob that could leak internals.
- The controller routes any `Outcome` failure to a single `#banner` toast.

## Build & serve

- `bun run build:web` → `bun build ./src/frontend/main.ts --outdir src/frontend/dist
  --minify --target browser`. `dev:web` adds `--watch`.
- The shell is served from source (`index.html` always exists); only the JS bundle
  needs a prior build. `static.ts` 404s a missing asset (Bun.file streams an empty
  200 otherwise) and rejects `..` in the asset path.

## Testing (tiered, zero-network)

- **Tier A (primary)** — `logic.test.ts`: drive the logic functions against
  `treaty(appWith(fake))`, reusing `server/fake-darshan.ts`. Proves capability
  gating + error surfacing with no DOM and no fetch. Mirror of `app.test.ts`.
- **Tier B** — `view.test.ts`: register `@happy-dom` in-file
  (`GlobalRegistrator.register()` before importing the view; `unregister()` in
  `afterAll`), assert gated button state and the error line. Only DOM-coupled
  assertions belong here.
- **Tier C** — `server/static.test.ts`: boot the app, assert `/` serves the shell
  (`id="app"`) and `/api` still wins. One-line wiring guard.
- Keep `bun test` network-free; `@happy-dom/global-registrator` is the only new dev
  dep this layer adds.

## Hard rules (enforced)

- No `core`/`engines`/`service`/`server` **runtime** import in `src/frontend/`.
- No browse/path/index logic in the UI — it calls the typed API only.
- Capability via `clearance()`, never discovered by try/catch.
- No secret/stack in any rendered error.
- Biome + `tsc` cover `src/frontend/` already (root config is `src`-wide); no
  separate tsconfig/biome config is added.
