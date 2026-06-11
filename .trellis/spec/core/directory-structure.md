# Directory Structure

> Decided in `session.md` §2 and §5. This is the agreed target layout for the
> from-scratch Bun project, not a description of existing code (no code yet).

## `src/` layout

```
src/
  core/
    capsule.ts              # Capsule data model
    darshan.ts              # Darshan interface, capability types, ForbiddenKnowledge
    gnosis.ts               # Gnosis type + config validation
    akademiya.ts            # registry / factory
  config/
    rclone.ts               # hand-rolled rclone.conf INI parser → Gnosis[] (MalformedGnosis on bad section)
  engines/
    index.ts                # createAkademiya(): enroll built-in engines (one line per engine)
    s3.ts                   # S3Darshan (covers s3/tos/oss/cos/minio/r2)
    local.ts                # LocalDarshan (local fs, zero-network tests)
    webdav.ts               # WebdavDarshan (extension phase)
  service/
    browser.ts              # browsing use cases, bucket/prefix parsing
    house-of-wisdom.ts      # directory snapshot persistence (irminsul.json)
    path.ts                 # seal/purify path normalization + traversal guard
  server/
    app.ts                  # Elysia app creation
    routes.ts               # HTTP routes
    schemas.ts              # Elysia/t schema
    surasthana.ts           # web service context
  cli/
    terminal.ts             # Bun CLI entry
    commands.ts             # remotes/buckets/ls/cat/get/put/rm/url/browse
  frontend/                 # optional Web UI
  index.ts                  # library exports
```

## Layering rules (hard constraints)

1. **Dependency direction is one-way:** interface → service → core → engines → config.
   A lower layer never imports an upper one.
2. **`core/`, `engines/`, `service/`, `config` must not import ElysiaJS** or any
   HTTP type. Elysia lives only under `server/`.
3. **Interface layers (`server/`, `cli/`, `frontend/`) are adapter-only** — no
   browsing, path, or index logic. They call `service`/`core` abstractions and
   are blind to `s3/local/webdav`.
4. **All backend differences are sealed in `engines/`.** Adding a storage type =
   one new engine file + one `enroll` call; no upper layer changes.
5. **CLI and Web share one service.** Never duplicate browse/path/index logic
   between `cli/` and `server/`.

## File naming

- Files: kebab-case (`house-of-wisdom.ts`), one primary export concept per file.
- The `type` registration keys stay literal: `s3 / local / webdav`. Theme flavor
  is applied only to our own identifiers (see [Naming Theme](./naming-theme.md)).
