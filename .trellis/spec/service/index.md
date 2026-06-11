# Service Layer Guidelines

> Use-case layer shared by CLI and Web: browsing, path normalization, capability
> gating, index persistence. Depends on `core` + `Darshan`; never on ElysiaJS.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Service Guidelines](./service-guidelines.md) | Shared service rules, `seal`/`purify`, index format | To fill (needs code) |

## Layer rules (decided)

1. **CLI and Web share one service** — browse/path/index logic lives here once,
   never duplicated in `server/` or `cli/`.
2. **Capability gating, not exception probing** — read `Darshan.clearance()` to
   decide whether to offer preview/delete/upload.
3. **Path safety is mandatory** — every external path goes through `seal()` /
   `purify()` before reaching an engine (traversal guard).

---

**Language**: All documentation should be written in **English**.
