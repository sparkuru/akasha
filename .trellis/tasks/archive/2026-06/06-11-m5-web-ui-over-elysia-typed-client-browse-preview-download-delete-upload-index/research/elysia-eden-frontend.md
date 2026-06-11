# Research: Web UI over Elysia + Eden (Bun toolchain)

- **Query**: How is a Web UI idiomatically built/served for a Bun + ElysiaJS + Eden project? Framework choice, serving/dev loop, treaty browser client, build tooling, zero-network UI testing — mapped onto the Akasha repo.
- **Scope**: mixed (internal repo grounding + external Elysia/Eden/Bun knowledge)
- **Date**: 2026-06-11

## Repo facts grounding every decision

Verified against installed code, not memory:

| Fact | Source |
|---|---|
| `export type App = ReturnType<typeof buildApp>` | `src/server/app.ts:90` |
| eden installed = **1.4.9**, elysia = **1.4.28** | `node_modules/@elysiajs/eden/package.json`, `node_modules/elysia/package.json` |
| Default `treaty` export **is treaty2** (current API) | `eden/dist/index.d.ts`: `export { Treaty, treaty } from './treaty2.js'` |
| `treaty(domain: string \| App, config?: Treaty.Config)` | `eden/dist/treaty2/index.d.ts` |
| Treaty response = `{ data, error, response, status, headers }`; on failure `data:null`, `error:{ status, value }` | `eden/dist/treaty2/types.d.ts:66-90` |
| `@elysiajs/static` is **NOT installed** (only `eden` + `openapi`) | `node_modules/@elysiajs/` lists `eden`, `openapi` only |
| Single tsconfig, `"include": ["src"]`, `lib:["ESNext","DOM"]`, **no `jsx` setting** | `tsconfig.json` |
| Biome `files.include` = `["src/**/*.ts","src/**/*.json"]` (no JSX/TSX globs) | `biome.json` |
| Bun version pinned by env = **1.3.14** (HTML-import fullstack + `Bun.serve` static routes are GA) | `bun --version` |
| M4 test pattern: `treaty(app)` with in-memory `FakeDarshan`, `caps` string selects clearance | `src/server/app.test.ts:21-80,252-266` |

**Wire shapes the UI consumes** (`src/server/schemas.ts`):
- `RemoteSchema` → `{ name, type, clearance: Capability[] }` where `Capability ∈ list_buckets|read|download|upload|delete|presign` (`schemas.ts:36-50`). The UI gates buttons on `remote.clearance`.
- `CapsuleSchema` → `{ key, name, isDir, size?, lastModified?, etag?, storageClass?, extra? }` (`schemas.ts:53-62`).
- `UrlResponse` → `{ url: string, kind: "presigned"|"proxy", expiresIn? }` (`schemas.ts:98-102`). For `kind:"proxy"` the `url` is a same-origin path like `/api/object/read?ref=...` (`app.test.ts:191`) → use directly in `<img src>` / download anchor. For `kind:"presigned"` it's an absolute off-origin URL.
- `AkashaError` → `{ code: forbidden_knowledge|invalid_gnosis|not_found|backend_error|validation, message, detail? }` (`schemas.ts:16-33`). This is exactly the `error.value` body treaty surfaces on failure.
- `UploadBody` → multipart `{ ref: string, file: t.File({maxSize:"50m"}) }` (`schemas.ts:92-95`).

**Route → treaty path mapping** (treaty turns `/api/x/y` into `client.api.x.y.<method>()`):

| HTTP | treaty call |
|---|---|
| `GET /api/remotes` | `client.api.remotes.get()` |
| `GET /api/buckets?remote=` | `client.api.buckets.get({ query: { remote } })` |
| `GET /api/objects?ref=` | `client.api.objects.get({ query: { ref } })` |
| `GET /api/object/stat?ref=` | `client.api.object.stat.get({ query:{ref} })` |
| `GET /api/object/read?ref=&maxBytes=` | `client.api.object.read.get({ query })` (returns bytes) |
| `GET /api/object/url?ref=&expiresIn=` | `client.api.object.url.get({ query })` |
| `POST /api/object/upload` (multipart) | `client.api.object.upload.post({ ref, file })` |
| `DELETE /api/object?ref=` | `client.api.object.delete({ query:{ref} })` |
| `POST /api/index/recall` (json body) | `client.api.index.recall.post({ ref })` |
| `GET /api/index?index=` | `client.api.index.get({ query })` |

(Note `object` is both a leaf with `.delete()` and a parent of `.stat/.read/.url/.upload`; treaty supports both on the same node.)

---

## Findings

### 1. Frontend framework options

The project so far has **zero frontend deps**, a single `src`-only tsconfig with **no JSX**, Biome scoped to `src/**/*.ts`, and an explicit "minimal dependency tree" value. That heavily biases the answer.

#### (a) React + Vite
- Eden usage: `const client = treaty<App>(location.origin)` in a module; call inside `useEffect`/event handlers, store `data`/`error` in state. Works fine.
- Weight: adds `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` (6+ deps), a `jsx` tsconfig, a Vite config, and a second dev server. This is the heaviest option and the worst fit for the stated "minimal" value.
- DX: best ecosystem, hot-reload, familiar. Overkill for a browse/preview/upload/delete panel.

#### (b) Bun-native / vanilla-TS, bundled by `Bun.build` (or Bun's HTML import), served static by Elysia — **RECOMMENDED**
- Eden usage: identical `treaty<App>(location.origin)`; render with plain DOM (`document.createElement`, template strings, or a ~1KB signal lib if desired). No framework runtime.
- Weight: **zero new runtime deps**. Build uses `Bun.build` (already in the toolchain) or Bun's built-in HTML entrypoint (`Bun.serve({ static })` / `bun build ./index.html`). No Vite, no JSX, no extra tsconfig strictly required (can keep `.ts` only).
- DX: single process, single port, single `bun` toolchain. Slightly more manual DOM code, but the M5 surface (a remote picker, a file table, a preview pane, upload/delete buttons) is small enough that this stays readable. Best fit for a small, dependency-averse codebase.
- Bun 1.3 supports `import "./app.html"` fullstack and `bun build ./index.html --outdir dist` which bundles linked `.ts`/`.css` automatically — no bundler config file at all.

#### (c) Svelte / Vue + Vite
- Eden usage: same treaty import; bind `data`/`error` to reactive state. Ergonomic.
- Weight: lighter runtime than React but still adds the framework, a Vite plugin, a compiler, `.svelte`/`.vue` SFC tooling, and a second tsconfig + Biome reconfig. Middle ground.
- DX: very pleasant reactivity for little code; Svelte's compiled output is tiny. If a framework is wanted at all, Svelte 5 (runes) is the lightest ergonomic pick. But it still violates "zero extra build server / minimal deps" more than option (b).

**Recommendation**: **(b) Bun-native vanilla-TS bundled with `Bun.build`/Bun HTML import, served static by Elysia.** It keeps the single-process, single-toolchain, zero-extra-dep posture the repo already has, and the M5 UI is small enough that no component framework earns its weight. If reactivity friction becomes real, the smallest escalation is **Svelte 5**, not React.

### 2. Serving + dev loop

Two canonical setups:

**(a) Single process / single port — Elysia serves built static assets. RECOMMENDED for this repo.**
Because `@elysiajs/static` is not installed and we avoid new deps, serve via **Bun static routes on the underlying server** or `app.get("*", ...)` returning `Bun.file`. The Eden client is then **same-origin** → `treaty<App>(location.origin)` with no CORS, no proxy.

Recommended wiring (no new dependency; Elysia exposes the Bun server, and Bun's `serve` accepts a `static`/route map. The cleanest no-dep path is a catch-all that streams `Bun.file` from the build dir):

```ts
// src/server/app.ts (sketch — add AFTER .use(routes), before listen)
import index from "../../frontend/dist/index.html"   // Bun bundles linked assets

// In bootApp / listen, mount the SPA. Bun 1.3 lets you hand HTML to serve():
app.get("/", () => new Response(Bun.file("frontend/dist/index.html")))
   .get("/assets/*", ({ params }) =>
      new Response(Bun.file(`frontend/dist/assets/${params["*"]}`)))
```

or, purely at the Bun layer (Elysia `.mount`/raw server), register a `static` route map. Either way: API under `/api/*` + OpenAPI under `/openapi/*` already exist; the SPA fills `/` and `/assets/*`. **Order matters**: keep `/api` routes registered before the catch-all so they win.

Dev loop for (a): run `bun --watch run src/server/app.ts`; rebuild the frontend on change with `bun build ./frontend/index.html --outdir frontend/dist --watch` in a second terminal (or a single `bun` script that runs both). No proxy needed because everything is same-origin.

**(b) Separate Vite dev server proxying `/api` → Elysia (only if option 1c React/Vite chosen).**
```ts
// vite.config.ts
import { defineConfig } from "vite"
export default defineConfig({
  root: "frontend",
  server: { proxy: { "/api": "http://localhost:3000", "/openapi": "http://localhost:3000" } },
  build: { outDir: "dist" },
})
```
In dev the browser hits Vite (e.g. `:5173`); `/api` is proxied to Elysia `:3000`, so the client stays **same-origin from the browser's view** → `treaty<App>(location.origin)` still works, no CORS. In prod, `bun build` the frontend and let Elysia serve `frontend/dist` (same as setup a). Only introduce `@elysiajs/cors` if you point the client at an absolute cross-origin API in dev — avoid that by using the proxy.

**Dev-vs-prod base URL**: with same-origin (both setups), `treaty<App>(location.origin)` needs no env switch. If you ever hardcode a dev API origin, guard it:
```ts
const API = import.meta.env?.DEV ? "http://localhost:3000" : location.origin
export const client = treaty<App>(API)   // requires CORS only in the cross-origin branch
```

### 3. Eden `treaty` browser client (verified against 1.4.9 types)

**Type-only server import** — this is the critical line that keeps server runtime out of the browser bundle. `import type` is erased at compile time (the repo's `verbatimModuleSyntax:true` enforces that the `type` keyword is explicit):

```ts
// frontend/src/client.ts
import { treaty } from "@elysiajs/eden"
import type { App } from "../../src/server/app"   // TYPE-ONLY: erased, no server code bundled

export const client = treaty<App>(location.origin)  // browser: pass a URL string
```

`treaty`'s signature is `(domain: string | App, config?)` (`eden/dist/treaty2/index.d.ts`). In the **browser** you pass the origin **string**; in **tests** you pass the **App instance** (M4 pattern). Same `treaty<App>` generic both ways.

**GET with query** (`/api/objects?ref=`):
```ts
const { data, error } = await client.api.objects.get({ query: { ref: "s3r:bucket/sub" } })
// data: Capsule[] | null ; error: { status, value: AkashaError } | null
if (error) { showError(error.value) ; return }
render(data)   // data is Capsule[], fully typed from CapsuleSchema
```

**File upload** (`POST /api/object/upload`, multipart) — treaty serializes a `File` field into `FormData` automatically when the route declares `type:"multipart/form-data"`; you just pass the object:
```ts
const fileInput = document.querySelector<HTMLInputElement>("#file")!
const file = fileInput.files![0]
const { data, error } = await client.api.object.upload.post({
  ref: "s3r:bucket/sub/up.txt",
  file,                      // a browser File — treaty wraps it in FormData
})
// data: { ok, key, size } | null
```
(`RelaxFileArrays`/`MaybeArrayFile` in `treaty2/types.d.ts:10-13` confirms `File` fields are accepted directly.)

**Reading `AkashaError` body + status on failure** — treaty never throws by default (`throwHttpError` is off unless configured); failures arrive in `error`:
```ts
const { data, error } = await client.api.buckets.get({ query: { remote: "ro" } })
if (error) {
  // error.status -> HTTP status (e.g. 403)
  // error.value  -> the AkashaError body: { code, message, detail? }
  switch (error.value.code) {
    case "forbidden_knowledge": toast(`No clearance: ${error.value.message}`) ; break
    case "validation":          toast(`Bad input: ${error.value.message}`) ; break
    default:                    toast(error.value.message)
  }
  return
}
```
The `error` union is keyed by status code (`treaty2/types.d.ts:74-90`), so `error.value` is precisely the typed `AkashaError` from `app.ts`'s `.onError()` boundary.

**Browser gotchas**:
- **Base URL**: in the browser pass a **string** (`location.origin`), never the App; passing the App pulls server code into the bundle and defeats the type-only import.
- **fetch**: treaty uses the global `fetch`; in the browser that's native. A custom `fetcher`/`fetch` init can be supplied via `Config` (`treaty2/types.d.ts:48-65`) if you need credentials/headers.
- **CORS**: none needed when same-origin (recommended). Only required if the client targets a different origin than the page — then add `@elysiajs/cors` server-side AND ensure presigned-URL hosts allow the browser. The `kind:"proxy"` URLs are same-origin so they sidestep CORS for previews/downloads.
- **`parseDate` default true**: treaty will turn ISO date strings into `Date`. Our `lastModified` is `t.Optional(t.String())` — if you want to keep it a string in the UI, be aware treaty may coerce; set `parseDate:false` in config if that bites.

### 4. Build tooling within a Bun repo

**Recommended (Bun-native, option 1b):**
- Layout: `frontend/index.html`, `frontend/src/main.ts`, `frontend/src/client.ts`. Output to `frontend/dist/`.
- `index.html` links `<script type="module" src="./src/main.ts">`. Build with **one command, no config file**:
  ```jsonc
  // package.json scripts (additions)
  "build:web": "bun build ./frontend/index.html --outdir frontend/dist --minify",
  "dev:web":   "bun build ./frontend/index.html --outdir frontend/dist --watch",
  "dev:all":   "bun --watch run src/server/app.ts"   // run alongside dev:web
  ```
  Bun resolves and bundles the linked `.ts`/`.css` from the HTML entrypoint; no Vite, no plugin.
- **tsconfig**: the root config is `src`-only and JSX-free. Since option (b) uses **no JSX**, you do **not strictly need a separate tsconfig** — but to typecheck `frontend/` you should add a second `tsconfig.json` under `frontend/` (or a project reference) whose `include` covers `frontend/**/*.ts` and keeps `lib:["ESNext","DOM"]`. Keep the root config untouched so `bun test`/`tsc --noEmit` over `src` stays clean. The type-only import of `App` reaches up into `src/server/app.ts`, which is fine for type resolution.
- **Biome/lint**: `biome.json` currently globs `src/**/*.ts` only, so `frontend/` is unlinted. Extend `files.include` to add `frontend/**/*.ts` (and `frontend/**/*.css` is ignored by Biome anyway). **No JSX means no JSX-lint surprises** — this is a concrete reason option (b) is the cleanest fit with the existing Biome setup.

**If React+Vite (option 1a) is chosen instead:**
- Layout `frontend/` with `frontend/tsconfig.json` adding `"jsx": "react-jsx"` and `lib:["ESNext","DOM"]`; root tsconfig stays JSX-free.
- `vite.config.ts` as in §2(b). Scripts: `"dev:web":"vite"`, `"build:web":"vite build"`.
- **Biome JSX implication**: Biome lints `.tsx` with React rules; you'd add `frontend/**/*.{ts,tsx}` to `files.include` and accept React-specific lint (e.g. `useExhaustiveDependencies`). This is extra config the repo currently avoids.

### 5. Zero-network UI testing under Bun

Repo gate is `bun test`, no S3, no real network (`app.test.ts` already proves this with `FakeDarshan`). Three tiers:

**Tier A — treaty-against-`treaty(app)` with a fake Surasthana (the M4 pattern). LIGHTEST + RECOMMENDED for capability-gating + error-surfacing.**
Extract UI *logic* (which call to make, how to branch on `error.value.code`, which buttons to enable from `remote.clearance`) into plain functions that take a `client`. Test them by handing a `treaty(buildApp(fakeSurasthana))` client — **identical to `app.test.ts:252-266`**, zero network:
```ts
import { treaty } from "@elysiajs/eden"
import { buildApp } from "../../src/server/app.ts"
// reuse FakeDarshan/appWith helpers from app.test.ts pattern
const client = treaty(appWith(s3like))           // App instance, in-memory
const { data } = await client.api.remotes.get()
expect(canUpload(data![0])).toBe(true)           // clearance-gating logic under test
```
This proves the load-bearing M5 behaviors — capability gating off `RemoteSummary.clearance`, error surfacing off `AkashaError` — without a DOM and without mocking fetch.

**Tier B — component/DOM testing with `@happy-dom` + `bun:test`.**
Add `@happy-dom/global-registrator` (dev dep) and register it in a test preload so `document`/`window` exist under Bun. Render the vanilla-TS view into a detached DOM, assert that, given a `clearance` set, the Upload button is disabled, and given an injected `error.value`, the error toast text renders. Use a **fake client** (a hand-written object matching the treaty call shape) so no network. This is the only tier that needs a new dev dep; reserve it for genuinely DOM-coupled rendering, not logic.

**Tier C — smoke test.** Boot `buildApp(fakeSurasthana)`, `app.handle(new Request("http://localhost/"))`, assert the HTML shell loads (200 + contains the root element id). Cheap guard that the static-serving wiring didn't regress.

**Recommendation**: **Tier A for all capability-gating and error-surfacing logic** (free, mirrors existing M4 tests, no new deps, no DOM). Add **Tier B only** for the handful of genuinely DOM-rendering assertions, behind a `@happy-dom` preload. Tier C as a one-line wiring guard. This keeps `bun test` network-free and dependency-light, consistent with the repo gate.

## Caveats / Not Found

- `@elysiajs/static` is not installed; the §2(a) serving sketch deliberately uses no-dep `Bun.file` catch-alls / Bun static routes. If the implementer prefers `@elysiajs/static`, that's one added dep — verify it pins to `^1.4` to match elysia 1.4.28.
- The exact `Bun.serve({ static: {...} })` / HTML-import ergonomics shift slightly across Bun minor versions; this was reasoned from the installed Bun 1.3.14 (HTML fullstack + static routes are GA in 1.2+). Confirm the precise `bun build ./index.html` flags against `bun build --help` at implementation time.
- I could not run live web searches in this environment (exa MCP tools were not exposed and outbound curl is sandboxed). All treaty/eden API claims above are verified directly against the **installed** `node_modules/@elysiajs/eden@1.4.9` type definitions, and all repo claims against the cited source files — these are authoritative for this codebase. Cross-checking phrasing against elysiajs.com docs is advisable but the type-level contracts here are ground truth.
- `parseDate` coercion of `lastModified` strings is a behavior to confirm empirically if the UI displays raw timestamps.
