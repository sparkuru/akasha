# Error Handling

> **Status: To fill once M1 code lands.** The shapes below are decided in
> `session.md`; the concrete throw/catch/log conventions get documented after
> the code exists.

## Decided contracts

- **`ForbiddenKnowledge`** — the "not supported / refused" error, thrown by the
  core/engine layers (e.g. unknown `type` in `Akademiya.summon`, or a capability
  the engine lacks). Defined in `core/darshan.ts`.
- **Capability declaration, not exception probing** — UI/CLI read `clearance()`
  to know up front which operations are available; do NOT discover capability by
  try/catching a failed call.
- **`AkashaError`** — the unified error structure returned at the Elysia boundary
  (see [server guidelines](../server/elysia-guidelines.md)):

  ```ts
  export interface AkashaError {
    code: "forbidden_knowledge" | "invalid_gnosis" | "not_found" | "backend_error"
    message: string
    detail?: unknown
  }
  ```

## What to document once code exists

- Where each `code` is produced and how core exceptions map to it.
- Whether engines throw typed errors or return results; the boundary that
  converts vendor SDK errors into `backend_error`.
- Validation errors: `invalid_gnosis` from `requiredGnosis()` checks vs. Elysia
  schema rejection of external requests (two-layer validation, `session.md` §1).
- Logging policy for caught-and-rethrown vs. swallowed errors
  (cross-ref [logging is folded into server quality guidelines]).
