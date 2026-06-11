# Engines Layer Guidelines

> Concrete `Darshan` implementations. All backend (s3/local/webdav/…)
> differences are sealed here; upper layers never see them.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Engine Authoring](./engine-authoring.md) | How to write a new `Darshan` (contract, `enroll`, `clearance`) | Filled (from plan) |
| [Config Compatibility](./config-compat.md) | rclone.conf field delegation, `Gnosis.raw` parsing | Filled (from plan) |

## Layer rules (decided)

1. One S3-compatible engine (`S3Darshan`) covers s3/tos/oss/cos/minio/r2. Native
   per-vendor engines only when an S3-compat gap forces it.
2. An engine reads only the `Gnosis.raw` keys it needs; the config layer stays
   backend-agnostic.
3. Adding an engine = new file under `src/engines/` + one `enroll` in
   `engines/index.ts`. No upper-layer change. The factory is
   `createAkademiya()` (added M2) — it constructs an `Akademiya` and enrolls all
   built-in engines; callers (CLI/server) use it instead of `new Akademiya()`.

---

**Language**: All documentation should be written in **English**.
