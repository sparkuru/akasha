# Quality Guidelines

> Conventions derived from the agreed `session.md` design (§1, §8, §9). Tooling
> commands are provisional until the project is scaffolded — confirm and correct
> when M1 lands.

## Tooling (Bun)

- **Runtime / package manager / test runner: Bun.** No npm/yarn/pnpm, no Jest.
- Test command: `bun test`. Tests live next to code as `*.test.ts`.
- Type gate: `tsc --noEmit` (or `bun` equivalent) — zero errors before commit.
- Lint/format: choose one toolchain (Biome preferred for a Bun project) and
  pin the exact command here once set up. Do not mix multiple formatters.

## Testing rules

- **`LocalDarshan` is the zero-network test backend.** Core and service tests run
  against `local` to prove the abstraction is vendor-clean (`session.md` M2). No
  test requires real cloud credentials.
- Must have tests:
  - `Akademiya` enroll/summon, including unknown-type → `ForbiddenKnowledge` and
    missing-field → `invalid_gnosis`.
  - `seal()` / `purify()` path guard, including `..` traversal rejection.
  - `irminsul.json` re-entry: `first_indexed_at` preserved, `indexed_at` updated.
  - capability gating: a missing capability is not offered / falls back.
- S3 engine: test against a local S3-compatible mock (e.g. MinIO) or recorded
  fixtures, not a live vendor bucket.

## Review standards (enforced)

These are hard-rules; a change violating them must be fixed before merge:

- No ElysiaJS / HTTP / vendor-SDK import below `server/` and `engines/`
  (see [core/directory-structure](../core/directory-structure.md)).
- No duplicated browse/path/index logic between `cli/` and `server/`.
- Capability declared via `clearance()`, never discovered by try/catch.
- `clearance()` matches the optional methods the engine actually implements.
- Config layer reads no backend-specific fields
  (see [engines/config-compat](../engines/config-compat.md)).
- Our own identifiers follow the [naming theme](../core/naming-theme.md);
  external `type` values and protocol fields stay literal.
- No secrets (keys, tokens, obscured passwords) in logs or error `detail`.

## Pre-commit checklist

1. `tsc --noEmit` clean.
2. `bun test` green.
3. Lint/format clean.
4. Layering + naming review rules above hold.
