# Manual Bucket Path Entry In Web UI

## Goal

Allow the Web UI to open a user-specified `bucket/prefix` path without requiring `list_buckets` permission, so limited S3 credentials scoped to one bucket directory can still browse.

## What I Already Know

- Production logs show `S3 list_buckets failed: AccessDenied`.
- Some storage credentials only allow access to a specific bucket path.
- Current frontend controller automatically calls `listBuckets()` when a remote declares `list_buckets` clearance.
- The service already supports direct object listing by `remote:bucket/prefix` through `/api/objects?ref=...`.
- No backend API change is required for manual path entry.

## Assumptions

- Manual path input accepts the part after `remote:`, for example `my-bucket/path/to/dir`.
- The UI should not automatically call `listBuckets()` on remote selection.
- If a remote supports list buckets, the UI can expose an explicit bucket-list action.
- Existing object browsing, upload, delete, download, and index refresh continue to work after opening a manual path.

## Requirements

- Add a Web UI control for entering `bucket/prefix` for the selected remote.
- Selecting a remote must not automatically call `/api/buckets`.
- For remotes with `list_buckets`, provide an explicit action to load buckets.
- Opening a manual path must call existing `listObjects()` with `makeRef(remote.name, path)`.
- Preserve capability gating for upload/download/delete.
- Add DOM tests for the manual path form.
- Keep all verification Docker-based.

## Acceptance Criteria

- [x] A remote can be selected without triggering `/api/buckets`.
- [x] User can enter `bucket/prefix` and open that ref.
- [x] A list-buckets-capable remote can still load buckets through an explicit action.
- [x] Docker quality gate passes.

## Completion Evidence

- `docker compose run --rm verify` passed: typecheck, 116 tests, Biome lint.
- `docker compose -f compose.prod.yaml build` passed and rebuilt `src/frontend/dist/main.js`.
- `docker compose -f compose.prod.yaml up -d` restarted the production container.
- Smoke tests passed:
  - `GET /api/remotes` -> 200
  - `GET /assets/main.js` -> 200
- Docker health status: `healthy`.

## Definition Of Done

- Tests pass through `docker compose run --rm verify`.
- Work committed, task archived, journal recorded.

## Out Of Scope

- Server-side bookmark persistence.
- Per-remote default path config.
- Changing S3 error classification.
