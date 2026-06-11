# M2: LocalDarshan + Config Parser + CLI

## Goal

Prove the core abstraction is vendor-clean by shipping the first real engine
(`LocalDarshan`, zero-network) end to end: parse a rclone.conf into `Gnosis`,
summon the engine via `Akademiya`, and drive it from a Bun CLI. This is
milestone M2 in `session.md` §9 — `akasha ls local:root/` and `akasha recall`
must work against the local filesystem with no S3 involved.

## What I already know (from M1 + specs)

- M1 landed `core/` (`Capsule`, `Darshan`, `Gnosis`, `Akademiya`,
  `ForbiddenKnowledge`, `InvalidGnosis`, `validateRequiredGnosis`).
- Engine contract + authoring rules: `.trellis/spec/engines/*.md`.
- Service rules + `irminsul.json` index format: `.trellis/spec/service/*.md`.
- Config delegation rules: `.trellis/spec/engines/config-compat.md`.
- Layering hard-rules + naming theme: `.trellis/spec/core/*.md`.
- Docker is the run/test environment (`docker compose run --rm verify`).

## Requirements

- **Config layer** — rclone.conf INI parser → `Gnosis[]` (`name`, `type`, `raw`).
  Parses every section regardless of `type`; preserves all keys verbatim in
  `raw`; `type` required. Non-S3 sections must parse without error.
- **`engines/local.ts` — `LocalDarshan`** (`typeName = "local"`): implements the
  required `Darshan` methods over the local filesystem rooted at `raw.root`.
  Maps the root to a single virtual bucket (non-bucket backend convention).
  `clearance()` reflects exactly what local fs supports (no `presign`).
  `requiredGnosis()` → `{ root }`. Registered via `enroll` in `engines/index.ts`.
- **Service layer** (only what `ls`/`recall` need):
  - `service/path.ts` — `seal()`/`purify()` normalization + `..` traversal guard.
  - `service/browser.ts` — parse `remote:bucket/prefix`, list a directory to
    `Capsule[]` via the summoned engine.
  - `service/house-of-wisdom.ts` — write/update `irminsul.json` snapshots
    (`recall`) per the decided format; `first_indexed_at` preserved on re-entry.
- **CLI** (`cli/terminal.ts`, `cli/commands.ts`): a Bun entrypoint with the M2
  subset of commands (scope TBD — see Open Questions). At minimum `ls` + `recall`.
- Tests (`bun test`, zero-network): config parser, `LocalDarshan` against a temp
  dir, `path` traversal guard, `house-of-wisdom` re-entry update, and an
  end-to-end `Akademiya.summon("local") → list` path.

## Acceptance Criteria

- [ ] `akasha ls local:<bucket>/<prefix>` lists a real local directory.
- [ ] `akasha recall ...` writes/updates `irminsul.json` with the decided shape;
      `first_indexed_at` preserved, `indexed_at` refreshed on re-run.
- [ ] rclone.conf parser yields correct `Gnosis` for an S3 and a local section;
      a non-S3 section parses without error.
- [ ] `LocalDarshan.clearance()` omits `presign`; calling `presign` is handled
      per spec (capability-gated, not a crash).
- [ ] `path.seal/purify` rejects `..` traversal.
- [ ] No S3 SDK / Elysia import anywhere in the `local` path; engines sealed.
- [ ] `docker compose run --rm verify` green (typecheck + tests + lint).

## Definition of Done

- Zero-network tests for config, engine, path, index, and summon→list.
- `docker compose run --rm verify` green.
- No layering / naming violations.

## Out of Scope

- `S3Darshan` and any cloud backend (M3).
- Elysia routes / HTTP API / Eden client (M4); Web UI (M5).
- rclone `obscure`/`reveal` for password backends (extension phase) — local
  needs no secrets.
- `WebdavDarshan` (M6).

## Decision (ADR-lite)

**Context**: three M2 implementation calls. **Decided by developer 2026-06-11**:

1. **INI parser = hand-rolled minimal** (`config/` — likely `config/rclone.ts`).
   rclone.conf is simple INI; no dependency, full control over quirks (comments
   `#`/`;`, blank values, whitespace). Keep it small and unit-tested.
2. **CLI framework = citty** (UnJS). Add as a dependency; gives subcommand
   routing + usage for `cli/terminal.ts`. Hand-rolled dispatch rejected to keep
   command growth clean.
3. **M2 commands = `ls` + `recall` + `remotes` + `cat`.** `remotes` lists parsed
   config (exercises the parser), `cat` reads a file via `readBytes` (exercises
   the read path). `buckets`/`get`/`put`/`rm`/`url`/`browse` deferred.

**Consequences**: one new runtime dep (`citty`); the config parser is ours to
maintain. A fuller local vertical slice (list + read + index + config listing)
proves the abstraction more convincingly than the bare minimum.

## Technical Notes

- Specs to load: `engines/*.md`, `service/*.md`, `core/*.md`,
  `server/quality-guidelines.md`.
- Run/verify only via Docker (host has no Bun).
