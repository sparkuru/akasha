# Type Safety

> Conventions derived from the agreed `session.md` design. No application code
> exists yet — revisit and correct against real code when M1 lands. Until then
> these are the rules sub-agents follow.

## TypeScript config

- `strict: true`. Also enable `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`.
- `module`/`moduleResolution` set for Bun (`"bundler"` resolution); target modern
  ESNext. No CommonJS `require`.
- Type-check gate: `tsc --noEmit` must pass with zero errors before commit.

## `interface` vs `type`

- Use `interface` for object shapes that model domain entities and may be
  implemented or extended: `Capsule`, `Darshan`, `Gnosis`, `AkashaError`.
- Use `type` for unions, intersections, and mapped/utility types:
  `DarshanCapability`, `PresignOptions`.

## Type placement

- Shared domain types live in their `core/*.ts` owner module and are re-exported
  from `src/index.ts`: `Capsule` → `core/capsule.ts`, `Darshan` +
  `DarshanCapability` + `ForbiddenKnowledge` → `core/darshan.ts`, `Gnosis` →
  `core/gnosis.ts`.
- A layer never redefines a type it can import from `core`. Engines and service
  import domain types; they do not invent parallel shapes.
- HTTP/transport types (Elysia schema-inferred) live under `server/` only and
  never leak downward.

## Narrowing untyped config

- `Gnosis.raw` is `Record<string, string>` — the config layer must NOT
  pre-extract backend fields. Each engine narrows the keys it needs at
  construction and validates via `requiredGnosis()`.
- Read `raw` keys explicitly (`raw.endpoint`), never spread `raw` into a typed
  struct blindly. Missing required keys → `ForbiddenKnowledge` / `invalid_gnosis`.

## Capabilities

- `clearance(): Set<DarshanCapability>` is the single source of truth for what an
  engine supports. Consumers type-check against the `DarshanCapability` union;
  never compare raw strings.

## Anchors (decided, `session.md` §3)

```ts
export interface Capsule {
  key: string
  name: string
  isDir: boolean
  size?: number
  lastModified?: string
  etag?: string
  storageClass?: string
  extra?: Record<string, unknown>
}

export type DarshanCapability =
  | "list_buckets" | "read" | "download" | "upload" | "delete" | "presign"
```

## Forbidden

- No `any`. Use `unknown` + narrowing (`extra?: Record<string, unknown>` is the
  one sanctioned escape hatch for backend-specific blobs).
- No non-null assertions (`!`) to silence `noUncheckedIndexedAccess`; narrow
  properly.
- No `as` casts across layer boundaries to bypass the domain types.
