# Quality Guidelines

> **Status: To fill once tooling is set up.** Bun is the runtime, package
> manager, and test runner (`session.md` §1). Document the real commands and
> standards after the project is scaffolded — do not invent CI rules that don't
> run yet.

## What to document here

- Test command (`bun test`), where tests live, naming (`*.test.ts`).
- **`LocalDarshan` is the zero-network test backend** — core/service tests run
  against it to prove the abstraction is vendor-clean (`session.md` M2).
- Lint / format tooling once chosen (Biome / ESLint / Prettier — TBD) and the
  exact commands.
- Type-check gate (`tsc --noEmit` or `bun` equivalent).
- What MUST have tests: `Akademiya` registration/summon, `seal`/`purify` path
  guard, `irminsul.json` re-entry update, capability gating.
- Review standards: enforce the layering hard-rules
  (see [core directory-structure](../core/directory-structure.md)) and the
  [naming theme](../core/naming-theme.md).

## Decided non-negotiables

- No ElysiaJS / HTTP / vendor-SDK import below `server/` and `engines/`.
- No duplicated browse/path/index logic between `cli/` and `server/`.
- Capability declared via `clearance()`, never discovered by try/catch.
