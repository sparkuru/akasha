# Elysia Guidelines

> **Status: To fill once `server/` lands.** Decided route plan and rules below
> (`session.md` §1, §6); concrete Elysia patterns follow real code.

## Decided rules

- `server/` is an **adapter** — it builds the Elysia app, declares routes +
  schemas, maps service results/errors to HTTP. No browse/path/index logic.
- Validate external input with Elysia/`t` schema (`server/schemas.ts`); let core
  validate `Gnosis` and engine capability separately.
- Errors return the unified `AkashaError` shape
  (see [core error-handling](../core/error-handling.md)).
- Service context lives in `server/surasthana.ts`.

## Proposed routes (`session.md` §6)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/remotes` | list rclone.conf remotes |
| GET | `/api/buckets` | list buckets (when capable) |
| GET | `/api/objects` | list a directory by `remote/bucket/prefix` |
| GET | `/api/object/stat` | object metadata |
| GET | `/api/object/read` | small-file preview / first N bytes |
| GET | `/api/object/url` | presigned URL (when capable) |
| POST | `/api/object/upload` | upload a file |
| DELETE | `/api/object` | delete an object |
| POST | `/api/index/recall` | refresh current directory index |
| GET | `/api/index` | read persisted index |

## What to document once code exists

- Elysia app composition (plugins, `surasthana` context injection).
- How `clearance()` is surfaced to clients so the UI can gate actions.
- OpenAPI/Eden client generation and where the typed client is consumed.
- CLI command ↔ route parity table (`cli/commands.ts`:
  remotes/buckets/ls/cat/get/put/rm/url/browse).
