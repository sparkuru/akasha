# Error Handling

> Conventions derived from the agreed `session.md` design. Revisit against real
> code when M1 lands.

## Error model

Two distinct error surfaces:

1. **Domain errors** thrown inside `core` / `engines` / `service`.
2. **`AkashaError`** — the serialized shape returned at the Elysia boundary.

The interface layer (`server/`) is the only place that converts (1) into (2).

## Domain errors

- **`ForbiddenKnowledge`** (defined in `core/darshan.ts`) — thrown for
  "refused / not supported": unknown `type` in `Akademiya.summon`, or an
  operation the engine does not implement. Extends `Error`, carries a stable
  message.
- **Invalid config** — `Akademiya.summon` validates `Gnosis` against
  `requiredGnosis()` BEFORE constructing the engine; missing keys throw
  **`InvalidGnosis`** (added at M1, `core/gnosis.ts`; maps to `invalid_gnosis`).
  It carries only the missing field *names* (`.missing`) — never values — per the
  no-secrets rule. `validateRequiredGnosis` treats both `undefined` and `""` as
  missing.
- **`CapsuleNotFound`** (added at M3, `core/darshan.ts`; maps to `not_found`) —
  the addressed object/bucket genuinely does not exist. Engines MUST translate a
  vendor "missing" error into this; for S3 that is `NoSuchKey` / `NotFound` /
  `NoSuchBucket` or HTTP `404` (`S3Darshan.isNotFound`). Distinct from a backend
  failure so the boundary can return `404`, not `502`.
- **`BackendFault`** (added at M3, `core/darshan.ts`; maps to `backend_error`) —
  any vendor-SDK / network / engine failure that is NOT a clean "not found".
  Constructed with `new BackendFault(message, { cause: originalError })` — the
  original SDK error rides on `.cause` for logs; the `message` is the only thing
  the boundary may surface and MUST NOT contain credentials (build it from the
  operation name + `error.name`, never from `Gnosis.raw`).
- **Capability declaration, not exception probing** — never discover whether an
  operation is supported by try/catching it. Read `clearance()` first. Calling an
  unsupported op is a programming error and may throw `ForbiddenKnowledge`.

## `AkashaError` (boundary shape, decided)

```ts
export interface AkashaError {
  code: "forbidden_knowledge" | "invalid_gnosis" | "not_found" | "backend_error"
  message: string
  detail?: unknown
}
```

Mapping rules (applied in `server/`):

| Source | `code` |
|---|---|
| `ForbiddenKnowledge` | `forbidden_knowledge` |
| `InvalidGnosis` (`requiredGnosis()` / `Gnosis` validation failure) | `invalid_gnosis` |
| `CapsuleNotFound` (object/bucket/remote not found) | `not_found` |
| `BackendFault` (vendor SDK / network / engine failure) | `backend_error` |

`detail` may carry the original error for logs; never put secrets
(keys, tokens) in `message` or `detail`.

## Engine error policy

- Engines catch vendor SDK errors and rethrow as a domain error (or a typed
  engine error) — the service layer must never see a raw `@aws-sdk` exception.
- Distinguish "not found" from "backend error" so the boundary can map correctly.

## Logging

- Log at the boundary where an error is converted to `AkashaError`
  (`backend_error` at `warn`/`error`, `not_found`/`invalid_gnosis` at `info`).
- Do not log-and-rethrow at every layer (no duplicate stack spam). Log once,
  at the conversion point. Redact credential fields from `Gnosis.raw`.
