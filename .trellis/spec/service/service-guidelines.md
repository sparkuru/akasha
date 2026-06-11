# Service Guidelines

> **Status: To fill once the service layer lands.** Decided anchors below
> (`session.md` §5, reference §E); concrete rules follow real code.

## Decided anchors

- **`service/browser.ts`** — browsing use cases, bucket/prefix parsing.
- **`service/path.ts`** — `seal()` / `purify()` path normalization + traversal
  guard. Every external path passes through here.
- **`service/house-of-wisdom.ts`** — directory snapshot persistence to
  `irminsul.json` (default). Re-entering a directory updates in place.

## Index file format (`irminsul.json`, decided)

```json
{
  "version": 1,
  "directories": {
    "<bucket>/<prefix>": {
      "path": "...", "bucket": "...", "prefix": ".../",
      "first_indexed_at": "<iso>", "indexed_at": "<iso>",
      "item_count": 0,
      "items": [ { "name": "...", "path": "...", "type": "file|dir",
                   "size": 0, "modified": "<iso>" } ]
    }
  }
}
```

Rules: `first_indexed_at` is preserved on re-entry; `indexed_at` refreshes every
time; items are plain objects — fields can be appended without migration.

## What to document once code exists

- The presign-fallback rule: when an engine lacks `presign`, the service falls
  back to server-side proxied download instead of erroring (`session.md` §10).
- Bucket/prefix parsing for `remote:bucket/prefix` syntax.
- Where capability checks gate each use case.
