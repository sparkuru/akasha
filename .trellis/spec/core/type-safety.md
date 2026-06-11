# Type Safety

> **Status: To fill once M1 code lands.** Document the *actual* TypeScript
> conventions after the core layer exists — do not write aspirational rules
> that sub-agents will then mimic into out-of-place code.

## What to document here

- `interface` vs `type` alias usage (e.g. `Capsule` is declared as `interface`
  in `session.md` §3.1 — confirm and state the rule).
- Where shared types live (`core/*.ts` exports) vs. local types.
- How `Gnosis.raw: Record<string, string>` is narrowed inside each engine, and
  the rule that the config layer must NOT pre-extract backend fields.
- Capability union typing (`DarshanCapability`) and how `clearance()` returns a
  `Set<DarshanCapability>`.
- `strict` / `noUncheckedIndexedAccess` and any other tsconfig flags once chosen.
- Bun-specific type considerations (Bun globals, `Blob | Uint8Array | ReadableStream`).

## Anchor (already decided, see `session.md` §3)

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
```
