FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN for i in 1 2 3 4 5; do bun install && break; \
      echo "bun install failed (attempt $i), retrying..."; sleep 3; done

FROM deps AS dev

COPY . .

EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM deps AS build

COPY . .
RUN bun run typecheck
RUN bun test
RUN bun run lint
RUN bun run build:web

FROM oven/bun:1 AS prod-deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN for i in 1 2 3 4 5; do bun install --production && break; \
      echo "bun install --production failed (attempt $i), retrying..."; sleep 3; done

FROM oven/bun:1 AS prod

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV AKASHA_CONFIG=/config/rclone.conf
ENV AKASHA_INDEX=/data/irminsul.json

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY src ./src
COPY --from=build /app/src/frontend/dist ./src/frontend/dist

EXPOSE 3000
CMD ["bun", "run", "src/server/app.ts"]
