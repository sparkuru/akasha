# Config Compatibility (rclone.conf)

> **Status: To fill once the config parser lands.** Decided shape and rules are
> below (`session.md` §4, reference §D); concrete parsing conventions follow the
> real implementation.

## Decided rules

- Keep rclone.conf compatibility (INI + `type`), but **do not hard-read S3 fields
  in the config layer.** Field interpretation is delegated to engines — this is
  the prerequisite for supporting arbitrary backends.

  ```ts
  export interface Gnosis {
    name: string
    type: string
    raw: Record<string, string>
  }
  ```

- Per-engine field reads (each from `raw`, no cross-talk):
  - `S3Darshan`: `access_key_id / secret_access_key / endpoint / region / force_path_style`
  - `WebdavDarshan`: `url / user / pass`
  - `LocalDarshan`: `root`

- **obscure vs plaintext:** rclone obscures password/token fields; S3 access keys
  are plaintext. MVP may support only plaintext / S3 keys; password backends need
  a rclone `reveal` implementation in a later phase.

## Input samples to stay compatible with

See `session.md` reference §D for real `[genie]` (s3), `[myserver]` (sftp),
`[nutstore]` (webdav), `[gdrive]` (drive/OAuth), `[secret]` (crypt) sections.
Non-S3 sections must parse without error even if the engine isn't built yet.

## What to document once code exists

- INI parser choice and how repeated/quoted values are handled.
- How unknown `type` sections are surfaced (parse-but-defer vs. reject).
- Test fixtures: a sample rclone.conf with each backend shape.
