# Docker Production Deployment

## Goal

Make Akasha deployable through Docker Compose without touching the host runtime environment. The deployment should build the app image, include the Web UI bundle, mount runtime config/data, and run the Elysia server in a production-shaped container.

## What I Already Know

- User requested continuing the project using Docker deployment.
- Project policy: dev/build/deploy with Docker; do not affect host env.
- Existing `compose.yaml` is development-oriented: bind-mounts the repo, uses an anonymous `node_modules` volume, and runs `bun run dev`.
- Existing Dockerfile is single-stage and does not build the frontend bundle.
- Static serving expects frontend assets at `src/frontend/dist/main.js`.
- `bootApp()` currently loads config from `AKASHA_CONFIG` but listens on fixed port `3000`.
- `bootApp()` currently registers `LocalDarshan` and `S3Darshan` directly, which skips the M6 `WebdavDarshan` in production server boot.

## Assumptions

- Keep `compose.yaml` for development and one-shot verification.
- Add production deployment via `compose.prod.yaml` instead of replacing dev Compose.
- Use container paths:
  - `/config/rclone.conf` for storage backend config
  - `/data/irminsul.json` for persisted index data
- Publish app port `3000` by default, overridable via environment.
- Do not add a reverse proxy, TLS termination, registry push, or remote host deployment in this task.

## Requirements

- Convert Dockerfile to a production-capable multi-stage image.
- Build frontend assets during the image build.
- Keep tests/typecheck/lint available through Docker Compose verification.
- Add `compose.prod.yaml` with a production `akasha` service.
- Production service must:
  - build the production target image
  - expose `${AKASHA_PORT:-3000}:3000`
  - set `AKASHA_CONFIG=/config/rclone.conf`
  - set `AKASHA_INDEX=/data/irminsul.json`
  - mount config read-only and data writable
  - include restart policy and healthcheck
- Server boot must use the built-in engine registry so WebDAV is available.
- Server boot must honor `AKASHA_INDEX` and `PORT`.
- Add scripts or documented command comments for production build/up/down/logs.
- Verify through Docker only.

## Acceptance Criteria

- [x] `docker compose run --rm verify` passes.
- [x] `docker compose -f compose.prod.yaml build` succeeds.
- [x] `docker compose -f compose.prod.yaml up -d` starts the production service.
- [x] `/` serves the Web UI shell and `/assets/main.js` exists in the container image.
- [x] `/api/remotes` responds from the production container using mounted config.
- [x] WebDAV remotes can be summoned by production boot via `createAkademiya()`.
- [x] No host Bun/npm install required.

## Completion Evidence

- `docker compose run --rm verify` passed: typecheck, 114 tests, Biome lint.
- `docker compose -f compose.prod.yaml build` passed and produced `akasha:prod`.
- `docker compose -f compose.prod.yaml up -d` started `30-akasha-akasha-1`.
- Smoke tests passed:
  - `GET /api/remotes` -> 200
  - `GET /` -> 200
  - `GET /assets/main.js` -> 200
- Docker healthcheck status: `healthy`.

## Definition Of Done

- Docker-based quality gate green.
- Production Compose build and smoke test green.
- Deployment files committed.
- Trellis task archived and journal recorded.

## Out Of Scope

- TLS/reverse proxy.
- Registry publish.
- Remote server SSH deployment.
- Secrets manager integration.
- Kubernetes/Swarm.

## Research References

- [`research/docker-compose-production.md`](research/docker-compose-production.md) — use multi-stage image builds and a production Compose override/deployment file.
