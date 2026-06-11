# Polish Web UI file browser

## Goal

Make the Akasha Web UI feel like a usable file browser instead of a plain debug
page. The first polish pass should improve visual hierarchy, scanning, and
action clarity without changing backend APIs or introducing a frontend framework.

## What I Already Know

- The current UI is vanilla TypeScript plus inline CSS in `src/frontend/index.html`.
- The existing frontend architecture is `logic.ts` for DOM-free decisions,
  `view.ts` for pure DOM construction, and `main.ts` for controller glue.
- The UI must keep supporting manual path entry for `bucket/prefix` and
  `remote://bucket/prefix`.
- Production deployment is Docker Compose based; do not rely on host Bun/npm.
- `compose.prod.yaml` and `deploy/config/rclone.conf` have local deployment
  changes that must not be overwritten or committed in this task.

## Requirements

- Keep the first screen as the actual file browser, not a landing page.
- Upgrade the shell layout:
  - left sidebar for remotes,
  - main workspace with current location,
  - path/address form as a primary control.
- Improve remote selection:
  - show remote name, type, and capability count,
  - make selected/hover states visually clear enough for repeated use.
- Improve object listing:
  - add table headers,
  - show type, name, size, last modified, and actions,
  - make file vs directory rows easier to scan.
- Improve action controls:
  - keep capability gating,
  - make download/delete/refresh/upload controls visually discoverable.
- Improve states:
  - empty directory or exact object fallback should not look like a broken page,
  - error banner should be readable and not leak internal detail.
- Keep responsive behavior acceptable on narrow screens.

## Acceptance Criteria

- [x] The UI has a polished file-browser layout with sidebar, main toolbar, and
  object table hierarchy.
- [x] Table rows include readable type/name/size/modified/action columns.
- [x] Remote list and path entry are visually clear and remain keyboard usable.
- [x] Empty object lists render a clear empty state.
- [x] Existing full rclone path and `bucket/prefix` flows still work.
- [x] Unit tests cover new rendering behavior.
- [x] Docker verification/build passes and production compose is refreshed.

## Definition of Done

- Tests added or updated.
- `docker compose run --rm verify` passes.
- `docker compose -f compose.prod.yaml build` passes.
- `docker compose -f compose.prod.yaml up -d` refreshes the running app.
- Work is committed without including unrelated local deployment config.

## Out of Scope

- New backend routes or changed API schemas.
- React/Vue/Svelte or a new build system.
- Authentication or multi-user session UI.
- Full file preview redesign.

## Technical Notes

- Relevant files: `src/frontend/index.html`, `src/frontend/view.ts`,
  `src/frontend/view.test.ts`, `src/frontend/main.ts` if needed.
- Specs: `.trellis/spec/frontend/index.md` and
  `.trellis/spec/frontend/web-ui-guidelines.md`.

## Verification

- `docker compose run --rm verify` passed: typecheck, 122 tests, Biome lint.
- `docker compose -f compose.prod.yaml build` passed; frontend bundle rebuilt.
- `docker compose -f compose.prod.yaml up -d` restarted production.
- Smoke checks passed:
  - `GET /api/remotes` returned 200.
  - `GET /` returned the updated SPA shell.
  - `GET /assets/main.js` returned 200 with the updated bundle.
  - Docker health state is `healthy`.
