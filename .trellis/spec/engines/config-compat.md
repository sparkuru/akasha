# Config Compatibility (rclone.conf)

> Conventions derived from the agreed `session.md` design (§4, reference §D).
> Revisit against the real parser when it lands.

## Core rule: fields are delegated to engines

Keep rclone.conf compatibility (INI + `type`), but the config layer must
**never hard-read backend-specific fields**. It parses each section into a
neutral `Gnosis` and hands `raw` to the engine. This is the prerequisite for
supporting arbitrary backends.

```ts
export interface Gnosis {
  name: string                  // section name, e.g. "genie"
  type: string                  // the rclone `type` value, verbatim
  raw: Record<string, string>   // every other key in the section, untouched
}
```

## Parsing rules

- Parse **every** section regardless of `type`. An unknown/unsupported `type`
  (sftp, drive, crypt) must still produce a valid `Gnosis`; it only fails later
  if someone tries to `summon` an engine that isn't registered.
- Preserve all keys verbatim in `raw` — do not drop, rename, or coerce.
- `type` is required; a section without it is a parse error.
- Field interpretation belongs to the engine's constructor + `requiredGnosis()`,
  not here.

## Per-engine field reads (each from `raw`, no cross-talk)

| Engine | keys read from `raw` |
|---|---|
| `S3Darshan` | `access_key_id`, `secret_access_key`, `endpoint`, `region`, `force_path_style` |
| `WebdavDarshan` | `url`, `user`, `pass` |
| `LocalDarshan` | `root` |

## obscure vs plaintext

rclone obscures password/token fields (sftp `pass`, webdav `pass`, drive `token`,
crypt `password`); S3 access keys are plaintext. MVP supports plaintext / S3 keys
only. Password backends need a rclone `reveal` implementation — deferred to the
extension phase. Until then, surface a clear error rather than sending an
obscured value as if it were plaintext.

## Compatibility fixtures

A test rclone.conf must include each shape from `session.md` reference §D:
`[genie]` (s3, plaintext), `[myserver]` (sftp, obscured), `[nutstore]` (webdav),
`[gdrive]` (drive/OAuth JSON token), `[secret]` (crypt nested on another remote).
All must parse without error even when the matching engine isn't built.

## Index persistence note

The on-disk index default is `irminsul.json`; its format is owned by the service
layer (see [service-guidelines](../service/service-guidelines.md)), not config.
