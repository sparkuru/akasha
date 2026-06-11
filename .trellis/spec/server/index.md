# Server / Interface Layer Guidelines

> The ElysiaJS HTTP boundary (`server/`) and the Bun CLI (`cli/`). Adapter-only:
> these layers translate transport ↔ service calls and carry no storage logic.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Elysia Guidelines](./elysia-guidelines.md) | Routes, schema validation, OpenAPI, error mapping, CLI parity | To fill (needs code) |
| [Quality Guidelines](./quality-guidelines.md) | Bun test, lint, what must be tested | To fill (needs code) |

## Layer rules (decided)

1. **Elysia is only a server adapter** — no storage business rules under `server/`.
2. **Two-layer validation** — Elysia validates external requests via schema; core
   validates config + engine capability.
3. **Typed contract is the API** — Eden/OpenAPI output is what the Web UI, tests,
   and third parties consume.
4. **CLI ⇄ Web parity** — both drive the same service; never fork browse logic.

---

**Language**: All documentation should be written in **English**.
