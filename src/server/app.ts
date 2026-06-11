import { openapi } from "@elysiajs/openapi"
import { Elysia } from "elysia"
import { loadRcloneConf } from "../config/rclone.ts"
import { BackendFault, CapsuleNotFound, ForbiddenKnowledge } from "../core/darshan.ts"
import { InvalidGnosis } from "../core/gnosis.ts"
import { LocalDarshan, S3Darshan } from "../engines/index.ts"
import { routes } from "./routes.ts"
import type { AkashaError } from "./schemas.ts"
import { web } from "./static.ts"
import { type Surasthana, buildSurasthana } from "./surasthana.ts"

/**
 * The Akasha HTTP app — an adapter only.
 *
 * Wires the OpenAPI plugin, injects the boot-time `Surasthana` via `.decorate()`,
 * mounts the route plugin, and maps domain errors to the unified `AkashaError`
 * boundary shape via `.error()` + `.onError()`. It contains NO browse/path/index
 * logic (see `.trellis/spec/server/elysia-guidelines.md`).
 *
 * Error mapping (per `.trellis/spec/core/error-handling.md`): never leak a vendor
 * SDK error, stack, or secret to the client — only `error.message`, which engines
 * already build credential-free.
 */
export function buildApp(surasthana: Surasthana) {
  return (
    new Elysia()
      .use(
        openapi({
          documentation: {
            info: { title: "Akasha API", version: "0.1.0" },
          },
        }),
      )
      .decorate("surasthana", surasthana)
      // Register domain errors so onError can narrow on a typed `code`.
      .error({
        FORBIDDEN_KNOWLEDGE: ForbiddenKnowledge,
        INVALID_GNOSIS: InvalidGnosis,
        NOT_FOUND: CapsuleNotFound,
        BACKEND_FAULT: BackendFault,
      })
      .onError(({ code, error, set }): AkashaError => {
        switch (code) {
          case "NOT_FOUND": {
            set.status = 404
            return { code: "not_found", message: error.message }
          }
          case "FORBIDDEN_KNOWLEDGE": {
            set.status = 403
            return { code: "forbidden_knowledge", message: error.message }
          }
          case "INVALID_GNOSIS": {
            set.status = 400
            return { code: "invalid_gnosis", message: error.message, detail: error.missing }
          }
          case "BACKEND_FAULT": {
            // Log once, at the conversion point; never log-and-rethrow per layer.
            console.error(`[akasha] backend_error: ${error.message}`)
            set.status = 500
            return { code: "backend_error", message: error.message }
          }
          case "VALIDATION": {
            set.status = 422
            return { code: "validation", message: error.message }
          }
          default: {
            set.status = 500
            return { code: "backend_error", message: "internal error" }
          }
        }
      })
      .use(routes)
      // The SPA shell + assets at `/` and `/assets/*` (registered last so /api wins).
      .use(web)
  )
}

/**
 * Build the app from the rclone config at `AKASHA_CONFIG` (default `rclone.conf`).
 *
 * Loaded once at boot (M4 decision Q4); reloading config means restarting.
 */
export async function bootApp() {
  const configPath = process.env.AKASHA_CONFIG ?? "rclone.conf"
  const remotes = await loadRcloneConf(configPath)
  const surasthana = buildSurasthana(remotes, [LocalDarshan, S3Darshan])
  return buildApp(surasthana)
}

export type App = ReturnType<typeof buildApp>

// Boot when run directly (`bun run src/server/app.ts`).
if (import.meta.main) {
  const app = await bootApp()
  app.listen(3000)
  console.log(`Akasha listening on http://localhost:${app.server?.port}`)
}
