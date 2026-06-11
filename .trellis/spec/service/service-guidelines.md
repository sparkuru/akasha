# Service Guidelines

> Conventions derived from the agreed `session.md` design (§5, §10, reference §E).
> Revisit against real code when M1/M2 land.

## Responsibilities

The service layer owns all use-case logic shared by CLI and Web. It depends on
`core` + the `Darshan` abstraction and the `Akademiya` registry — never on
ElysiaJS or a vendor SDK.

| Module | Owns |
|---|---|
| `service/browser.ts` | browsing use cases, `remote:bucket/prefix` parsing, capability gating |
| `service/path.ts` | `seal()` / `purify()` path normalization + traversal guard |
| `service/house-of-wisdom.ts` | directory snapshot persistence to `irminsul.json` |

## Rules

1. **One service, two interfaces.** `cli/` and `server/` both call this layer.
   Never duplicate browse/path/index logic into either interface.
2. **All external paths pass through `path.ts`.** Call `seal()` / `purify()`
   before any path/key reaches an engine. No engine call receives an
   un-normalized, un-guarded path. Reject `..` traversal here.
3. **Capability gating, not exception probing.** Read `darshan.clearance()` to
   decide whether an operation is offered; do not try/catch to detect support.
4. **Presign fallback.** When an engine lacks the `presign` capability, fall
   back to server-side proxied download/preview through the service — never
   surface a "not supported" error to the user for this (`session.md` §10).
5. **Engines are obtained via `Akademiya.summon(gnosis)`** — the service never
   `new`s an engine class directly.

## Index file format (`irminsul.json`, decided — reference §E)

Each visited directory writes a snapshot of its direct children; re-entry updates
in place.

```json
{
  "version": 1,
  "directories": {
    "<bucket>/<prefix>": {
      "path": "<bucket>/<prefix>",
      "bucket": "<bucket>",
      "prefix": "<prefix>/",
      "first_indexed_at": "<iso8601>",
      "indexed_at": "<iso8601>",
      "item_count": 0,
      "items": [
        { "name": "...", "path": "...", "type": "file",
          "size": 0, "modified": "<iso8601>" }
      ]
    }
  }
}
```

- `first_indexed_at` is preserved across re-entries; `indexed_at` refreshes each
  write.
- `items` are plain objects — new fields can be appended without a migration.
- Default file path is `irminsul.json`; overridable (the old `--index` flag).
