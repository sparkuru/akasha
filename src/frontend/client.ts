import { treaty } from "@elysiajs/eden"
import type { App } from "../server/app.ts"
import type { AkashaClient } from "./logic.ts"

/**
 * The browser-side Eden client.
 *
 * Same-origin: the SPA is served by Elysia, so `location.origin` reaches the same
 * `/api/*` routes with no CORS and no proxy. `import type { App }` is erased at
 * build time (`verbatimModuleSyntax`), so NO server runtime is bundled — the
 * frontend couples only to the typed contract.
 */
export const client: AkashaClient = treaty<App>(location.origin)
