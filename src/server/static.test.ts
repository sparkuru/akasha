import { describe, expect, it } from "bun:test"
import { appWith, s3like } from "./fake-darshan.ts"

/**
 * Tier C — static-serve wiring guard, zero network.
 *
 * Boots the app and asserts the SPA shell loads at `/` and that `/api` still wins
 * over the catch-all. Cheap regression fence for the `app.ts` mount order.
 */
describe("static web serving", () => {
  it("serves the SPA shell with the #app root at /", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
    const html = await res.text()
    expect(html).toContain('id="app"')
    expect(html).toContain("/assets/main.js")
  })

  it("keeps /api routes ahead of the static catch-all", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/api/remotes"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
  })

  it("404s a missing asset instead of streaming an empty 200", async () => {
    const app = appWith(s3like)
    const res = await app.handle(new Request("http://localhost/assets/nope.js"))
    expect(res.status).toBe(404)
  })
})
