# Fix full rclone path entry

## Goal

The Web UI should open a known object when the user enters either `bucket/prefix`
or a full rclone-style path such as
`genie://aidea-ota/a2d/FOTA/rb-2.1.0-v2/ota_genie02_full_rb-2.1.0-v2_20260108_024843_encrypted_signed.bin`.
This fixes the current no-op behavior for S3 credentials that can access a
specific bucket path but cannot list buckets globally.

## What I Already Know

- The production compose file is currently mounting `/tmp/tmp/rclone.conf`; this
  is a local deployment edit and must not be overwritten.
- The user confirmed `/tmp/tmp/rclone.conf` and the full `genie://...bin` path
  exist.
- The manual path entry currently sends `makeRef(remote.name, path)` for every
  input, so a full rclone path under selected remote `genie` becomes an invalid
  internal ref shape.
- S3 directory listing anchors non-empty prefixes with a trailing slash. Opening
  an exact object key through the directory-list API can therefore render an
  empty table even when the file exists.

## Requirements

- Accept manual input in both forms:
  - `bucket/prefix`
  - `remote://bucket/prefix`
- Convert full rclone paths to the app's internal `remote:bucket/prefix` ref
  before calling typed APIs.
- When opening a manual path, handle exact object keys by falling back from an
  empty directory listing to object metadata/URL behavior.
- Keep the existing explicit bucket-list button behavior; do not reintroduce
  automatic bucket listing on remote selection.
- Do not edit local deployment config changes in `compose.prod.yaml` or
  `deploy/config/rclone.conf`.

## Acceptance Criteria

- [x] Entering `genie://aidea-ota/a2d/FOTA/rb-2.1.0-v2/ota_genie02_full_rb-2.1.0-v2_20260108_024843_encrypted_signed.bin` opens a usable file action instead of silently rendering nothing.
- [x] Entering `aidea-ota/a2d/FOTA/rb-2.1.0-v2/ota_genie02_full_rb-2.1.0-v2_20260108_024843_encrypted_signed.bin` under remote `genie` works the same way.
- [x] Existing directory navigation still works for `bucket/prefix`.
- [x] Unit tests cover full rclone path normalization and exact-file fallback.
- [x] Docker verification/build passes and the compose deployment is refreshed.

## Definition of Done

- Tests added or updated.
- Lint, typecheck, and tests pass through Docker.
- Production compose image rebuilt and restarted.
- Task changes committed without including unrelated local deployment config.

## Technical Notes

- Frontend files inspected: `src/frontend/main.ts`, `src/frontend/logic.ts`,
  `src/frontend/view.ts`, `src/frontend/*.test.ts`.
- Service parsing accepts only internal `remote:bucket/prefix` refs via
  `parseAddress()`; rclone `remote://bucket/prefix` is a UI input format, not a
  service-layer ref.
- S3 `listObjects()` intentionally treats a non-empty prefix as a directory and
  appends `/`.
- The confirmed object is `application/octet-stream` and about 9.6GB, so the
  exact-file fallback renders an actionable file row and uses download for the
  row open action instead of trying to preview the binary body.

## Verification

- `docker compose run --rm verify` passed: typecheck, 119 tests, Biome lint.
- `docker compose -f compose.prod.yaml build` passed; production bundle rebuilt.
- `docker compose -f compose.prod.yaml up -d` restarted the `akasha` service.
- Smoke checks passed:
  - `GET /api/remotes` returned 200 and exposed the `genie` S3 remote.
  - `GET /assets/main.js` returned 200 with the updated bundle.
  - `GET /api/object/stat?ref=genie:aidea-ota/...encrypted_signed.bin`
    returned 200 with `size: 9588270448`.
  - Docker health state is `healthy`.
