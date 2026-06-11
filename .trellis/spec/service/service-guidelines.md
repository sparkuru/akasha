# Service Guidelines

> Conventions derived from the agreed `session.md` design (§5, §10, reference §E).
> `Browser` + `path.ts` + `house-of-wisdom.ts` landed M1/M2; the full use-case
> surface (`stat`/`upload`/`delete`/`url`/`listBuckets`/`listRemotes`/`readIndex`/
> `recall`) landed M4 as the shared source of truth for CLI + `server/`.

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

## `Browser` use-case surface (landed M4)

`Browser(remotes, akademiya)` is the one object both `cli/` and `server/` drive.
Every method parses via `parseAddress` (→ `purify`, traversal-guarded) and gates
on `engine.clearance()` before touching an engine. Signatures (source of truth —
`src/service/browser.ts`):

```ts
list(ref): Promise<Capsule[]>                          // gate: read
read(ref, maxBytes?): Promise<Uint8Array>              // gate: read
stat(ref): Promise<Record<string, unknown>>            // gate: read
listRemotes(): RemoteSummary[]                         // {name,type,clearance[]}
listBuckets(remote): Promise<string[]>                 // gate: list_buckets
upload(ref, source: Uint8Array | ReadableStream): Promise<string>  // gate: upload
delete(ref): Promise<void>                             // gate: delete
url(ref, expiresIn?): Promise<UrlResult>               // presign or proxy fallback
readIndex(indexPath?): Promise<Irminsul>
recall(ref, indexPath?): Promise<IrminsulDirectory>    // list + persist snapshot
```

### Rule: `upload` takes bytes/stream, never a Web `File`

**Why**: a Web `File` is an HTTP/transport type. Spec rule 5 (server) forbids
HTTP types leaking below the boundary. `server/routes.ts` converts the uploaded
`t.File()` to a `Uint8Array` *before* calling `Browser.upload`.

### Rule: `url()` is the presign-fallback contract (§4 made concrete)

```ts
export interface UrlResult {
  url: string
  kind: "presigned" | "proxy"
  expiresIn?: number
}
```

- `presign` clearance present → real vendor-signed URL, `kind:"presigned"`
  (carries `expiresIn` when one was requested).
- absent → relative URL back to our own read route
  (`/api/object/read?ref=…`), `kind:"proxy"`. Never throw "not supported".

### Rule: `recall` is the only index-write use case

Both interfaces call `Browser.recall` (list → `recordDirectory` → `saveIrminsul`)
rather than re-sequencing list+persist themselves. (The legacy CLI `recall`
command still composes the lower-level `house-of-wisdom` helpers directly; new
callers use `Browser.recall`.)

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
