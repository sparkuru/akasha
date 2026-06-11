# Core / Model Layer Guidelines

> Framework-independent heart of Akasha: `core/`, plus the conventions every
> other layer must respect. Nothing here may import ElysiaJS, an HTTP type, or
> a vendor SDK.

Akasha is a single Bun + ElysiaJS + TypeScript project, not a backend/frontend
split. Spec layers mirror the runtime architecture (see `session.md` §2, §5):

```
interface   server/ (ElysiaJS) · cli/ (Bun CLI) · frontend/ (optional)
service     browsing, path seal/purify, index persistence
core/model  Darshan abstraction + Capsule / Gnosis / Akademiya   ← this layer
engines     S3Darshan / LocalDarshan / WebdavDarshan
config      rclone.conf → Gnosis(type, raw)
```

**Hard constraint (enforced in review):** the interface layer talks only to
`service` and the `Darshan` abstraction; it knows nothing about `s3/local/webdav`.
All backend differences are sealed inside `engines/`.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | `src/` layout and the layering hard-rule | Filled (decided) |
| [Naming Theme](./naming-theme.md) | Akasha imagery naming convention (mandatory) | Filled (decided) |
| [Type Safety](./type-safety.md) | TypeScript conventions, type organization | To fill (needs code) |
| [Error Handling](./error-handling.md) | `ForbiddenKnowledge`, `AkashaError`, capability-not-exception | To fill (needs code) |

---

**Language**: All documentation should be written in **English**.
