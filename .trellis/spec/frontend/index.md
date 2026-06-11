# Frontend / Web UI Layer Guidelines

> The browser Web UI (`src/frontend/`). An adapter, exactly like `server/` and
> `cli/`: it consumes the typed `App` contract via Eden and carries no
> browse/path/index logic. Added in M5 (2026-06-11).

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Web UI Guidelines](./web-ui-guidelines.md) | Eden client, capability gating, error surfacing, build/serve, tiered tests | Filled (from M5) |

## Layer rules (decided)

1. **Typed-contract only.** The UI imports `import type { App }` from
   `server/app.ts` and drives every feature through `treaty<App>(location.origin)`.
   It never imports `core`/`engines`/`service`/`server` runtime — the `type`
   import is erased at build time (`verbatimModuleSyntax`), so no server code is
   bundled.
2. **Capability-gated, never probed.** Buttons/actions reflect each remote's
   `clearance()` set via `logic.can()` — a disabled/absent control, not a
   try/catch on a forbidden call.
3. **Errors surface from `AkashaError`.** Failures arrive in treaty's `error.value`
   (the `{ code, message, detail? }` boundary shape) and are mapped to a single
   human line via `logic.errorText()` — never a raw stack or secret.
4. **Logic / view split for zero-network tests.** Load-bearing decisions live in
   `logic.ts` (DOM-free, Tier A), rendering in `view.ts` (Tier B under
   `@happy-dom`). The controller `main.ts` is browser-only glue and is not
   unit-tested.
5. **Same-origin static serve.** Elysia serves the SPA shell + bundle (`server/static.ts`)
   so `/api/*` and the UI share one origin — no CORS, no second dev server.

---

**Language**: All documentation should be written in **English**.
