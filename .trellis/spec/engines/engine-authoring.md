# Engine Authoring

> **Status: To fill once the first engine lands.** The interface below is
> decided in `session.md` §3.2–3.3; concrete authoring rules (error mapping,
> streaming, pagination) get documented from real `S3Darshan`/`LocalDarshan` code.

## Decided contract

```ts
export interface Darshan {
  readonly typeName: string

  listObjects(bucket: string, prefix?: string, delimiter?: string): Promise<Capsule[]>
  stat(bucket: string, key: string): Promise<Record<string, unknown>>
  readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array>
  download(bucket: string, key: string, dest: string): Promise<string>
  uploadFile(bucket: string, source: Blob | Uint8Array | ReadableStream, key: string): Promise<string>
  delete(bucket: string, key: string): Promise<void>

  listBuckets?(): Promise<string[]>
  presign?(bucket: string, key: string, options?: PresignOptions): Promise<string>
  clearance(): Set<DarshanCapability>
}
```

Construction/registration:

```ts
type DarshanCtor = {
  typeName: string
  requiredGnosis(): Set<string>
  new (gnosis: Gnosis): Darshan
}
// Akademiya.enroll(...ctors)  registers; Akademiya.summon(gnosis) builds.
```

## Authoring checklist (to expand with real examples)

- [ ] Implement every required method; optional methods (`listBuckets`,
      `presign`) only when the backend supports them, and reflect that in
      `clearance()`.
- [ ] `requiredGnosis()` lists the `raw` keys the engine needs; `summon` validates
      before construction.
- [ ] Map vendor SDK errors to `backend_error`; throw `ForbiddenKnowledge` for
      genuinely unsupported operations.
- [ ] No upper-layer imports; engine depends only on `core` types + its SDK.
- [ ] Register in `engines/index.ts` via `enroll`.

## Non-bucket backends

bucket/key is unnatural for WebDAV/local. Convention (`session.md` §10): map the
root to a single virtual bucket and use `bucket + prefix/key` uniformly.
