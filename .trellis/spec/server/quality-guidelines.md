# Quality Guidelines

> Conventions derived from the agreed `session.md` design (§1, §8, §9).
> Tooling pinned at M1 (2026-06-11).

## Tooling (Bun) — pinned at M1

- **Runtime / package manager / test runner: Bun.** No npm/yarn/pnpm, no Jest.
- Test command: `bun test`. Tests live next to code as `*.test.ts`.
- Type gate: `bun run typecheck` (`tsc --noEmit`) — zero errors before commit.
- **Lint/format: Biome** (`biome.json`). Commands: `bun run lint`
  (`biome check src`) and `bun run format` (`biome format --write src`). Biome is
  scoped to `src/**` via `files.include` — do NOT lint repo tooling dirs
  (`.trellis`, `.claude`, …). Do not add a second formatter.

## Environment — Docker

Bun is not assumed to be installed on the host. The repo ships a Docker dev
environment (`Dockerfile`, `compose.yaml`):

- One-shot quality gate: `docker compose run --rm verify` runs
  install → typecheck → test → lint and exits non-zero on any failure.
- Boot the server: `docker compose up app` (Elysia on `:3000`).
- Ad-hoc: `docker run --rm -v "$PWD":/app -w /app oven/bun:1 sh -c '<cmd>'`
  (the container shell is dash — no bash-only constructs like `PIPESTATUS`).
- `node_modules` lives in the container / an anonymous volume; it is gitignored.
- Installs retry (flaky-network resilience): bun's strict integrity check fails
  hard on corrupted tarballs, so install loops are wrapped with retries.

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
