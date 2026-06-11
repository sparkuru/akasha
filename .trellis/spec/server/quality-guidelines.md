# Quality Guidelines

> Conventions derived from the agreed `session.md` design (§1, §8, §9).
> Tooling pinned at M1 (2026-06-11).

## Tooling (Bun) — pinned at M1

- **Runtime / package manager / test runner: Bun.** No npm/yarn/pnpm, no Jest.
- Test command: `bun test`. Tests live next to code as `*.test.ts`.
- Type gate: `bun run typecheck` (`tsc --noEmit`) — zero errors before commit.
- **Lint/format: Biome** (`biome.json`). Commands: `bun run lint`
  (`biome check src`) and `bun run format` (`biome format --write src`). Biome is
  scoped to `src/**` via `files.include` — do NOT lint repo tooling dirs
  (`.trellis`, `.claude`, …). Do not add a second formatter.

## Environment — Docker

Bun is not assumed to be installed on the host. The repo ships a Docker dev
environment (`Dockerfile`, `compose.yaml`):

- One-shot quality gate: `docker compose run --rm verify` runs
  install → typecheck → test → lint and exits non-zero on any failure.
- Boot the server: `docker compose up app` (Elysia on `:3000`).
- Ad-hoc: `docker run --rm -v "$PWD":/app -w /app oven/bun:1 sh -c '<cmd>'`
  (the container shell is dash — no bash-only constructs like `PIPESTATUS`).
- `node_modules` lives in the container / an anonymous volume; it is gitignored.
- Installs retry (flaky-network resilience): bun's strict integrity check fails
  hard on corrupted tarballs, so install loops are wrapped with retries.

## Scenario: Docker production deployment

### 1. Scope / Trigger

- Trigger: changing runtime image, Compose deployment, environment variables,
  mounted config/data paths, or server boot wiring.

### 2. Signatures

- Dev quality gate: `docker compose run --rm verify`
- Production build: `docker compose -f compose.prod.yaml build`
- Production start: `docker compose -f compose.prod.yaml up -d`
- Production service name: `akasha`
- Image name: `akasha:prod`

### 3. Contracts

Environment variables:

| Name | Required | Default | Purpose |
|---|---:|---|---|
| `PORT` | no | `3000` | Elysia listen port inside the container |
| `AKASHA_CONFIG` | yes in prod | `/config/rclone.conf` | rclone-compatible config path |
| `AKASHA_INDEX` | no | `/data/irminsul.json` in prod | persisted index path |
| `AKASHA_PORT` | no | `3000` | host port published by Compose |

Production mounts:

| Host path / volume | Container path | Mode | Purpose |
|---|---|---|---|
| `./deploy/config/rclone.conf` | `/config/rclone.conf` | read-only | backend config |
| `akasha_data` | `/data` | read-write | index/local storage data |

Image build contract:

- `Dockerfile` keeps a `dev` target for bind-mounted development and a `prod`
  target for deployment.
- The production image must contain `src/frontend/dist/main.js`; build it with
  `bun run build:web` during `docker build`.
- Production deployment must not bind-mount the entire repo.

### 4. Validation & Error Matrix

| Condition | Expected result |
|---|---|
| Missing/invalid config file | container starts but API boot fails; fix mounted config |
| `/api/remotes` healthcheck fails | container becomes unhealthy |
| Frontend bundle missing | `/assets/main.js` smoke test fails |
| `PORT` is non-numeric | app falls back to `3000` |
| New engine registered only in tests | `bootApp` test must fail until it uses `createAkademiya()` |

### 5. Good/Base/Bad Cases

- Good: `compose.prod.yaml` uses the `prod` target, read-only config mount,
  writable data volume, restart policy, and healthcheck.
- Base: `compose.yaml` remains the development/verification entrypoint using the
  `dev` target and repo bind mount.
- Bad: installing Bun/npm packages on the host, bind-mounting the whole repo in
  production, or starting production without building the Web UI bundle.

### 6. Tests Required

- `docker compose run --rm verify`
- `docker compose -f compose.prod.yaml build`
- `docker compose -f compose.prod.yaml up -d`
- Smoke tests:
  - `GET /api/remotes` returns 200.
  - `GET /` returns the SPA shell.
  - `GET /assets/main.js` returns 200.
  - Docker health state is `healthy`.
- Unit test: `bootApp()` uses the built-in registry, including all currently
  built-in engines.

### 7. Wrong vs Correct

#### Wrong

```yaml
services:
  app:
    volumes:
      - .:/app
    command: bun run dev
```

#### Correct

```yaml
services:
  akasha:
    build:
      context: .
      target: prod
    volumes:
      - ./deploy/config/rclone.conf:/config/rclone.conf:ro
      - akasha_data:/data
```

## Testing rules

- **`LocalDarshan` is the zero-network test backend.** Core and service tests run
  against `local` to prove the abstraction is vendor-clean (`session.md` M2). No
  test requires real cloud credentials.
- Must have tests:
  - `Akademiya` enroll/summon, including unknown-type → `ForbiddenKnowledge` and
    missing-field → `invalid_gnosis`.
  - `seal()` / `purify()` path guard, including `..` traversal rejection.
  - `irminsul.json` re-entry: `first_indexed_at` preserved, `indexed_at` updated.
  - capability gating: a missing capability is not offered / falls back.
- S3 engine: test against a local S3-compatible mock (e.g. MinIO) or recorded
  fixtures, not a live vendor bucket.

## Review standards (enforced)

These are hard-rules; a change violating them must be fixed before merge:

- No ElysiaJS / HTTP / vendor-SDK import below `server/` and `engines/`
  (see [core/directory-structure](../core/directory-structure.md)).
- No duplicated browse/path/index logic between `cli/` and `server/`.
- Capability declared via `clearance()`, never discovered by try/catch.
- `clearance()` matches the optional methods the engine actually implements.
- Config layer reads no backend-specific fields
  (see [engines/config-compat](../engines/config-compat.md)).
- Our own identifiers follow the [naming theme](../core/naming-theme.md);
  external `type` values and protocol fields stay literal.
- No secrets (keys, tokens, obscured passwords) in logs or error `detail`.

## Pre-commit checklist

1. `tsc --noEmit` clean.
2. `bun test` green.
3. Lint/format clean.
4. Layering + naming review rules above hold.
