import { Elysia } from "elysia"

/**
 * Static-serve plugin — the frontend adapter's delivery half.
 *
 * Serves the SPA shell at `/` and its bundled assets at `/assets/*`, same-origin
 * with the `/api/*` routes so the Eden client needs no CORS/proxy. It is mounted
 * AFTER the API routes in `app.ts`, so `/api` and `/openapi` always win; this
 * plugin only claims `/` and `/assets/*`.
 *
 * The shell (`index.html`) is read from source so it exists without a build; the
 * `main.js` bundle is produced by `bun run build:web` into `frontend/dist/`.
 */
const FRONTEND_DIR = `${import.meta.dir}/../frontend`

export const web = new Elysia({ name: "akasha-web" })
  .get(
    "/",
    () =>
      new Response(Bun.file(`${FRONTEND_DIR}/index.html`), {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  )
  .get("/assets/*", async ({ params, status }) => {
    // Reject path traversal before touching the filesystem.
    const rel = params["*"]
    if (rel.includes("..")) return status(403, "forbidden")
    const file = Bun.file(`${FRONTEND_DIR}/dist/${rel}`)
    // `Bun.file` does not 404 on its own — a missing file streams an empty 200.
    if (!(await file.exists())) return status(404, "not found")
    return new Response(file)
  })
