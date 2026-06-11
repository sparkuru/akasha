import { Buffer } from "node:buffer"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import type { Capsule } from "../core/capsule.ts"
import {
  BackendFault,
  CapsuleNotFound,
  type Darshan,
  type DarshanCapability,
  ForbiddenKnowledge,
} from "../core/darshan.ts"
import type { Gnosis } from "../core/gnosis.ts"

type WebdavFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

interface WebdavResponse {
  href: string
  status?: number
  isDir: boolean
  size?: number
  lastModified?: string
  etag?: string
}

export class WebdavDarshan implements Darshan {
  static readonly typeName = "webdav"
  readonly typeName = WebdavDarshan.typeName

  private readonly baseUrl: URL
  private readonly fetcher: WebdavFetch
  private readonly authHeader?: string

  static requiredGnosis(): Set<string> {
    return new Set(["url"])
  }

  constructor(gnosis: Gnosis, fetcher: WebdavFetch = fetch) {
    const rawUrl = gnosis.raw.url
    if (rawUrl === undefined || rawUrl === "") {
      throw new ForbiddenKnowledge(`WebdavDarshan requires a non-empty "url"`)
    }
    const user = gnosis.raw.user
    const pass = gnosis.raw.pass
    const hasAuth = (user !== undefined && user !== "") || (pass !== undefined && pass !== "")
    const baseUrl = parseWebdavUrl(rawUrl)
    if (hasAuth && baseUrl.protocol !== "https:") {
      throw new ForbiddenKnowledge("WebDAV credentials require an https url")
    }

    this.baseUrl = baseUrl
    this.fetcher = fetcher
    if (hasAuth) {
      this.authHeader = `Basic ${Buffer.from(`${user ?? ""}:${pass ?? ""}`, "utf8").toString(
        "base64",
      )}`
    }
  }

  async listObjects(bucket: string, prefix = "", _delimiter?: string): Promise<Capsule[]> {
    const target = this.resourceUrl(bucket, directoryKey(prefix), true)
    const response = await this.request("PROPFIND", target, "list", {
      headers: {
        Depth: "1",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: propfindBody(),
    })
    const xml = await response.text()
    const rootPath = encodedRootPath(this.baseUrl.pathname, bucket)
    const targetPath = trimTrailingSlash(target.pathname)
    const capsules: Capsule[] = []

    for (const entry of parseMultistatus(xml)) {
      if (!isSuccessStatus(entry.status)) {
        continue
      }
      const key = keyFromEntry(entry, target, rootPath, targetPath)
      if (key === "") {
        continue
      }
      capsules.push(capsuleFromResponse(key, entry))
    }

    capsules.sort((a, b) => a.name.localeCompare(b.name))
    return capsules
  }

  async stat(bucket: string, key: string): Promise<Record<string, unknown>> {
    const target = this.resourceUrl(bucket, key)
    const head = await this.fetchRaw("HEAD", target, "stat")
    if (head.status === 404) {
      throw new CapsuleNotFound("WebDAV stat: object not found")
    }
    if (head.status === 405 || head.status === 501) {
      return this.statViaPropfind(bucket, key)
    }
    if (!isHttpSuccess(head.status)) {
      throw new BackendFault(`WebDAV stat failed: HTTP ${head.status}`)
    }
    return statFromHeaders(key, head.headers)
  }

  async readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array> {
    const response = await this.request("GET", this.resourceUrl(bucket, key), "read")
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
      return bytes.subarray(0, maxBytes)
    }
    return bytes
  }

  async download(bucket: string, key: string, dest: string): Promise<string> {
    const bytes = await this.readBytes(bucket, key)
    await mkdir(dirname(dest), { recursive: true })
    await Bun.write(dest, bytes)
    return dest
  }

  async uploadFile(
    bucket: string,
    source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    await this.ensureParentCollections(bucket, key)
    const body = await toBytes(source)
    await this.request("PUT", this.resourceUrl(bucket, key), "upload", { body: streamBytes(body) })
    return key
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.request("DELETE", this.resourceUrl(bucket, key), "delete")
  }

  clearance(): Set<DarshanCapability> {
    return new Set<DarshanCapability>(["read", "download", "upload", "delete"])
  }

  private async statViaPropfind(bucket: string, key: string): Promise<Record<string, unknown>> {
    const target = this.resourceUrl(bucket, key)
    const response = await this.request("PROPFIND", target, "stat", {
      headers: {
        Depth: "0",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: propfindBody(),
    })
    const first = parseMultistatus(await response.text()).find((entry) =>
      isSuccessStatus(entry.status),
    )
    if (first === undefined) {
      throw new CapsuleNotFound("WebDAV stat: object not found")
    }
    return statFromResponse(key, first)
  }

  private async ensureParentCollections(bucket: string, key: string): Promise<void> {
    const dirs = parentCollectionKeys(bucket, key)
    for (const dir of dirs) {
      const response = await this.fetchRaw("MKCOL", this.resourceUrl("", dir), "mkdir")
      if (response.status === 405) {
        continue
      }
      if (response.status === 404) {
        throw new CapsuleNotFound("WebDAV mkdir: parent collection not found")
      }
      if (!isHttpSuccess(response.status)) {
        throw new BackendFault(`WebDAV mkdir failed: HTTP ${response.status}`)
      }
    }
  }

  private async request(
    method: string,
    url: URL,
    op: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const response = await this.fetchRaw(method, url, op, init)
    if (response.status === 404) {
      throw new CapsuleNotFound(`WebDAV ${op}: object not found`)
    }
    if (!isHttpSuccess(response.status)) {
      throw new BackendFault(`WebDAV ${op} failed: HTTP ${response.status}`)
    }
    return response
  }

  private async fetchRaw(
    method: string,
    url: URL,
    op: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers)
    if (this.authHeader !== undefined) {
      headers.set("Authorization", this.authHeader)
    }
    try {
      return await this.fetcher(url, { ...init, method, headers })
    } catch (err) {
      throw new BackendFault(`WebDAV ${op} failed: ${errName(err) ?? "UnknownError"}`, {
        cause: err,
      })
    }
  }

  private resourceUrl(bucket: string, key: string, collection = false): URL {
    const url = new URL(this.baseUrl)
    url.pathname = joinEncodedPath(this.baseUrl.pathname, pathSegments(bucket, key))
    if (collection && !url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`
    }
    url.search = ""
    return url
  }
}

function parseWebdavUrl(rawUrl: string): URL {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ForbiddenKnowledge("WebDAV url must use http or https")
    }
    url.username = ""
    url.password = ""
    return url
  } catch (err) {
    if (err instanceof ForbiddenKnowledge) {
      throw err
    }
    throw new ForbiddenKnowledge("invalid WebDAV url")
  }
}

function propfindBody(): string {
  return `<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:resourcetype/><D:getcontentlength/><D:getlastmodified/><D:getetag/></D:prop></D:propfind>`
}

function directoryKey(prefix: string): string {
  if (prefix === "" || prefix.endsWith("/")) {
    return prefix
  }
  return `${prefix}/`
}

function pathSegments(bucket: string, key: string): string[] {
  const segments: string[] = []
  if (bucket !== "") {
    segments.push(bucket)
  }
  for (const segment of key.split("/")) {
    if (segment !== "") {
      segments.push(segment)
    }
  }
  return segments
}

function parentCollectionKeys(bucket: string, key: string): string[] {
  const all = pathSegments(bucket, key)
  all.pop()
  const dirs: string[] = []
  for (let i = 1; i <= all.length; i += 1) {
    dirs.push(all.slice(0, i).join("/"))
  }
  return dirs
}

function joinEncodedPath(basePath: string, segments: readonly string[]): string {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
  const encoded = segments.map((segment) => encodeURIComponent(segment)).join("/")
  if (encoded === "") {
    return base === "" ? "/" : base
  }
  return `${base === "" ? "" : base}/${encoded}`
}

function encodedRootPath(basePath: string, bucket: string): string {
  return trimTrailingSlash(joinEncodedPath(basePath, bucket === "" ? [] : [bucket]))
}

function responsePath(href: string, base: URL): string {
  return new URL(decodeXml(href), base).pathname
}

function keyFromPath(path: string, rootPath: string, isDir: boolean): string {
  const cleanRoot = trimTrailingSlash(rootPath)
  const cleanPath = trimTrailingSlash(path)
  const relative =
    cleanRoot === "" || cleanRoot === "/"
      ? cleanPath.replace(/^\/+/, "")
      : cleanPath.startsWith(`${cleanRoot}/`)
        ? cleanPath.slice(cleanRoot.length + 1)
        : cleanPath.replace(/^\/+/, "")
  const decoded = relative
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => decodeURIComponent(segment))
    .join("/")
  if (decoded === "") {
    return ""
  }
  return isDir ? `${decoded}/` : decoded
}

function keyFromEntry(
  entry: WebdavResponse,
  target: URL,
  rootPath: string,
  targetPath: string,
): string {
  try {
    const path = responsePath(entry.href, target)
    if (trimTrailingSlash(path) === targetPath) {
      return ""
    }
    return keyFromPath(path, rootPath, entry.isDir)
  } catch (err) {
    throw new BackendFault("WebDAV list failed: MalformedHref", { cause: err })
  }
}

function capsuleFromResponse(key: string, entry: WebdavResponse): Capsule {
  const capsule: Capsule = {
    key,
    name: leafName(key),
    isDir: entry.isDir,
  }
  if (!entry.isDir && entry.size !== undefined) {
    capsule.size = entry.size
  }
  if (entry.lastModified !== undefined) {
    capsule.lastModified = entry.lastModified
  }
  if (entry.etag !== undefined) {
    capsule.etag = entry.etag
  }
  return capsule
}

function statFromHeaders(key: string, headers: Headers): Record<string, unknown> {
  const info: Record<string, unknown> = { key, isDir: false }
  const size = parseSize(headers.get("content-length") ?? undefined)
  const lastModified = parseHttpDate(headers.get("last-modified") ?? undefined)
  const etag = headers.get("etag") ?? undefined
  if (size !== undefined) {
    info.size = size
  }
  if (lastModified !== undefined) {
    info.lastModified = lastModified
  }
  if (etag !== undefined) {
    info.etag = etag
  }
  return info
}

function statFromResponse(key: string, entry: WebdavResponse): Record<string, unknown> {
  const info: Record<string, unknown> = { key, isDir: entry.isDir }
  if (!entry.isDir && entry.size !== undefined) {
    info.size = entry.size
  }
  if (entry.lastModified !== undefined) {
    info.lastModified = entry.lastModified
  }
  if (entry.etag !== undefined) {
    info.etag = entry.etag
  }
  return info
}

function leafName(key: string): string {
  const trimmed = key.endsWith("/") ? key.slice(0, -1) : key
  const slash = trimmed.lastIndexOf("/")
  return slash === -1 ? trimmed : trimmed.slice(slash + 1)
}

function parseMultistatus(xml: string): WebdavResponse[] {
  const responses: WebdavResponse[] = []
  for (const block of findElementBlocks(xml, "response")) {
    const href = textOf(block, "href")
    if (href === undefined) {
      continue
    }
    const status = parseStatus(textOf(block, "status"))
    const size = parseSize(textOf(block, "getcontentlength"))
    const lastModified = parseHttpDate(textOf(block, "getlastmodified"))
    const etag = textOf(block, "getetag")
    const entry: WebdavResponse = {
      href,
      isDir: hasElement(textOfBlock(block, "resourcetype") ?? "", "collection"),
    }
    if (status !== undefined) {
      entry.status = status
    }
    if (size !== undefined) {
      entry.size = size
    }
    if (lastModified !== undefined) {
      entry.lastModified = lastModified
    }
    if (etag !== undefined) {
      entry.etag = etag
    }
    responses.push(entry)
  }
  return responses
}

function findElementBlocks(xml: string, localName: string): string[] {
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>[\\s\\S]*?<\\/(?:[A-Za-z_][\\w.-]*:)?${localName}>`,
    "gi",
  )
  return [...xml.matchAll(pattern)].map((match) => match[0])
}

function textOf(xml: string, localName: string): string | undefined {
  const block = textOfBlock(xml, localName)
  if (block === undefined) {
    return undefined
  }
  return decodeXml(block.replace(/<[^>]*>/g, "").trim())
}

function textOfBlock(xml: string, localName: string): string | undefined {
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${localName}>`,
    "i",
  )
  const match = pattern.exec(xml)
  return match?.[1]
}

function hasElement(xml: string, localName: string): boolean {
  const pattern = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b`, "i")
  return pattern.test(xml)
}

function parseStatus(status: string | undefined): number | undefined {
  if (status === undefined) {
    return undefined
  }
  const match = /HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(status)
  if (match?.[1] === undefined) {
    return undefined
  }
  return Number.parseInt(match[1], 10)
}

function isSuccessStatus(status: number | undefined): boolean {
  return status === undefined || isHttpSuccess(status)
}

function isHttpSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

function parseSize(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined
  }
  const size = Number.parseInt(value, 10)
  return Number.isFinite(size) ? size : undefined
}

function parseHttpDate(value: string | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined
  }
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

function trimTrailingSlash(value: string): string {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1)
  }
  return value
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

async function toBytes(source: Blob | Uint8Array | ReadableStream): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    return source
  }
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer())
  }
  return new Uint8Array(await new Response(source).arrayBuffer())
}

function streamBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function errName(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "name" in value) {
    const name = value.name
    return typeof name === "string" ? name : undefined
  }
  return undefined
}
