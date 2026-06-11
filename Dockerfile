# Akasha dev/runtime image — Bun + ElysiaJS + TypeScript.
# Single stage is enough for M1: install deps, carry source, boot the server.
FROM oven/bun:1

WORKDIR /app

# Install dependencies first for layer caching. bun.lock is optional on first
# build (it gets created); copy it when present for reproducible installs.
COPY package.json bun.lock* ./
# Retry install — bun's strict integrity check fails hard on tarballs corrupted
# by flaky networks; a couple of retries makes the build reliable.
RUN for i in 1 2 3 4 5; do bun install && break; \
      echo "bun install failed (attempt $i), retrying..."; sleep 3; done

# Application source.
COPY . .

EXPOSE 3000

# Default: boot the minimal Elysia app. Override in compose for test/lint.
CMD ["bun", "run", "dev"]
