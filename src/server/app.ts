import { Elysia } from "elysia"

/**
 * Minimal bootable Elysia app — proves the stack runs.
 *
 * No domain routes yet; the real API (routes/schemas/OpenAPI) lands in M4.
 * A single health route is enough to confirm the server boots.
 */
export const app = new Elysia().get("/health", () => ({ status: "ok" }))

export type App = typeof app

// Boot when run directly (`bun run src/server/app.ts`).
if (import.meta.main) {
  app.listen(3000)
  console.log(`Akasha listening on http://localhost:${app.server?.port}`)
}
