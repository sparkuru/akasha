import { Elysia } from "elysia"
import { t } from "elysia"
import {
  CapsuleSchema,
  DeleteResponse,
  IndexQuery,
  ReadQuery,
  RefQuery,
  RemoteQuery,
  RemoteSchema,
  UploadBody,
  UploadResponse,
  UrlQuery,
  UrlResponse,
} from "./schemas.ts"
import type { Surasthana } from "./surasthana.ts"

/**
 * HTTP route handlers — the adapter layer.
 *
 * Every handler is thin: read `{ surasthana }`, call a service method, map the
 * result to HTTP. There is NO browse/path/index logic here — all of it lives in
 * the service `Browser` (see `.trellis/spec/server/elysia-guidelines.md`).
 *
 * Mounted as a plugin onto an app that has already `.decorate()`d `surasthana`,
 * so handlers see it fully typed. Domain errors thrown by the service bubble up
 * to the app-level `.onError()` mapper — handlers never try/catch them.
 */
export const routes = new Elysia({ name: "akasha-routes" })
  // Declare the injected context so handlers are typed; app.ts provides the value.
  .decorate("surasthana", {} as Surasthana)
  .get("/api/remotes", ({ surasthana }) => surasthana.browser.listRemotes(), {
    detail: { tags: ["remotes"], summary: "List rclone.conf remotes" },
    response: t.Array(RemoteSchema),
  })
  .get("/api/buckets", ({ surasthana, query }) => surasthana.browser.listBuckets(query.remote), {
    detail: { tags: ["buckets"], summary: "List buckets (capability-gated)" },
    query: RemoteQuery,
    response: t.Array(t.String()),
  })
  .get("/api/objects", ({ surasthana, query }) => surasthana.browser.list(query.ref), {
    detail: { tags: ["objects"], summary: "List a directory by remote:bucket/prefix" },
    query: RefQuery,
    response: t.Array(CapsuleSchema),
  })
  .get("/api/object/stat", ({ surasthana, query }) => surasthana.browser.stat(query.ref), {
    detail: { tags: ["objects"], summary: "Object metadata" },
    query: RefQuery,
    response: t.Record(t.String(), t.Unknown()),
  })
  .get(
    "/api/object/read",
    async ({ surasthana, query }) => {
      const bytes = await surasthana.browser.read(query.ref, query.maxBytes)
      // Copy into an ArrayBuffer-backed view so the body type is a plain
      // BlobPart (the engine may hand back a SharedArrayBuffer-backed array).
      const body = new Uint8Array(bytes.byteLength)
      body.set(bytes)
      // Return raw bytes; the read route is also the proxy-URL target.
      return new Response(body, {
        headers: { "content-type": "application/octet-stream" },
      })
    },
    {
      detail: { tags: ["objects"], summary: "Small-file preview / first N bytes" },
      query: ReadQuery,
    },
  )
  .get(
    "/api/object/url",
    ({ surasthana, query }) => surasthana.browser.url(query.ref, query.expiresIn),
    {
      detail: { tags: ["objects"], summary: "Presigned URL (or proxy fallback)" },
      query: UrlQuery,
      response: UrlResponse,
    },
  )
  .post(
    "/api/object/upload",
    async ({ surasthana, body }) => {
      const bytes = new Uint8Array(await body.file.arrayBuffer())
      const key = await surasthana.browser.upload(body.ref, bytes)
      return { ok: true, key, size: bytes.byteLength }
    },
    {
      detail: { tags: ["objects"], summary: "Upload a file" },
      type: "multipart/form-data",
      body: UploadBody,
      response: UploadResponse,
    },
  )
  .delete(
    "/api/object",
    async ({ surasthana, query }) => {
      await surasthana.browser.delete(query.ref)
      return { ok: true }
    },
    {
      detail: { tags: ["objects"], summary: "Delete an object" },
      query: RefQuery,
      response: DeleteResponse,
    },
  )
  .post(
    "/api/index/recall",
    ({ surasthana, body }) => surasthana.browser.recall(body.ref, surasthana.indexPath),
    {
      detail: { tags: ["index"], summary: "Refresh current directory index" },
      body: RefQuery,
    },
  )
  .get(
    "/api/index",
    ({ surasthana, query }) => surasthana.browser.readIndex(query.index ?? surasthana.indexPath),
    {
      detail: { tags: ["index"], summary: "Read persisted index" },
      query: IndexQuery,
    },
  )
