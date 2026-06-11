# Docker Compose Production Notes

## Sources

- Docker Docs: Multi-stage builds — https://docs.docker.com/build/building/multi-stage/
- Docker Docs: Use Compose in production — https://docs.docker.com/compose/how-tos/production/

## Findings

Docker documents multi-stage builds as a way to use multiple `FROM` stages in one Dockerfile and copy only selected artifacts from one stage into another. For Akasha, that maps to a build stage that installs dependencies, type-checks, tests, and builds the browser bundle, then a runtime stage that keeps source plus production dependencies and built frontend assets.

Docker's production Compose guidance supports using a base Compose file plus a production override file. For Akasha, `compose.yaml` can remain the dev/verify entrypoint, while `compose.prod.yaml` owns restart policy, config/index mounts, healthcheck, and the deploy command.

## Recommendation

- Keep `compose.yaml` as dev/verify.
- Add `compose.prod.yaml` for deployment.
- Make the production image build frontend assets during `docker build`.
- Do not install Bun or dependencies on the host.
- Mount only runtime data/config paths in production; do not bind-mount the entire repo.
