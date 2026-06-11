# M1: Project Skeleton & Core Abstractions

## Goal

Stand up the from-scratch Bun + ElysiaJS + TypeScript project and land the
framework-independent `core/` model layer with unit tests. This is milestone M1
in `session.md` §9 — the foundation every later milestone builds on. No storage
engine, no HTTP API, no CLI behavior yet.

## What I already know (from session.md + filled specs)

- Stack: Bun (runtime/pm/test), TypeScript (strict), ElysiaJS (initialized but
  not wired with routes until M4).
- Core abstractions to implement: `Capsule`, `Darshan` (+ `DarshanCapability`),
  `Gnosis`, `Akademiya`, `ForbiddenKnowledge`.
- Layering hard-rules and naming theme are specified in
  `.trellis/spec/core/{directory-structure,naming-theme,type-safety,error-handling}.md`.
- Target `src/` layout is fixed (`.trellis/spec/core/directory-structure.md`).

## Requirements

- Initialize the Bun project: `package.json`, `tsconfig.json` (strict +
  `noUncheckedIndexedAccess` etc. per `core/type-safety.md`), `bun` lockfile.
- Add ElysiaJS as a dependency and a minimal bootable `server/app.ts` (creates
  an Elysia instance, no domain routes) to prove the stack boots — full API is M4.
- Implement `core/`:
  - `core/capsule.ts` — `Capsule` interface.
  - `core/darshan.ts` — `Darshan` interface, `DarshanCapability` union,
    `PresignOptions`, `ForbiddenKnowledge` error class.
  - `core/gnosis.ts` — `Gnosis` interface + `validateRequiredGnosis(gnosis, required)`.
  - `core/akademiya.ts` — `Akademiya` registry: `enroll(...ctors)`, `summon(gnosis)`.
  - `src/index.ts` — library exports.
- Unit tests (`bun test`) for the core layer (see Acceptance Criteria).
- Naming theme applied to all our identifiers; `type` keys stay literal.

## Acceptance Criteria

- [ ] `bun install` + `bun run` boot the minimal Elysia app without errors.
- [ ] `tsc --noEmit` passes with the strict flags from `core/type-safety.md`.
- [ ] `Akademiya.summon` returns the right engine ctor for a registered `type`.
- [ ] `Akademiya.summon` throws `ForbiddenKnowledge` for an unknown `type`.
- [ ] `Akademiya.summon` throws (invalid_gnosis path) when `requiredGnosis()`
      fields are missing from `Gnosis.raw`.
- [ ] `core/` modules import nothing from `engines/service/server/cli` and do not
      import ElysiaJS.
- [ ] Core types are exported from `src/index.ts`.
- [ ] `bun test` is green.

## Definition of Done

- Tests added for `Akademiya` enroll/summon happy + error paths.
- `tsc --noEmit` and `bun test` green; lint/format clean.
- No layering / naming violations (review rules in
  `.trellis/spec/server/quality-guidelines.md`).

## Out of Scope

- `LocalDarshan` / `S3Darshan` / any engine implementation (M2/M3).
- rclone.conf INI parsing end-to-end (M1 ships the `Gnosis` type + validation;
  the actual parser can land with the first engine that needs real config).
- Elysia routes / schemas / OpenAPI / Eden client (M4).
- CLI commands (M2+).

## Decision (ADR-lite)

**Context**: M1 needs three scope/tooling calls before implementation.
**Decision** (confirmed by developer 2026-06-11):

1. **Lint/format = Biome** — single fast tool, native TS, minimal config. Pin
   the exact `biome check` command in `server/quality-guidelines.md` once set up.
2. **Test `Akademiya` with a test-only `StubDarshan`** defined inside the test
   file — M1 stays self-contained; no dependency on M2's `LocalDarshan`.
3. **Config = `Gnosis` type + `validateRequiredGnosis` only.** No rclone.conf
   INI parser in M1; it lands with the first engine that needs real config (M2).

**Consequences**: M1 ships a bootable stack + a fully unit-tested core registry
without any engine or parser. The INI parser and real engines are clean,
independent follow-ups.

## Technical Approach

- Scaffold: `bun init`-style `package.json` + `tsconfig.json` (strict flags from
  `core/type-safety.md`), Biome config, `elysia` dependency.
- `server/app.ts`: minimal `new Elysia()` that boots (a health route is fine);
  no domain logic — proves the stack runs, full API deferred to M4.
- `core/` per the interfaces quoted in `session.md` §3 and the core specs.
- Tests: `core/*.test.ts` with an in-test `StubDarshan` exercising
  enroll/summon happy path + unknown-type + missing-required-field.

## Technical Notes

- Specs to load for implementation:
  `.trellis/spec/core/*.md`, `.trellis/spec/server/quality-guidelines.md`.
- Anchors (interfaces) are quoted verbatim in those specs and in `session.md`
  §3.
