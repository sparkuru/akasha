# Naming Theme (Mandatory Convention)

> Decided in `session.md` ★ section. This is a firm project rule, not an
> aspiration — sub-agents MUST apply it when naming our own identifiers.

**Rule:** class names, function names, file names, and CLI subcommands use the
Akasha (Genshin / Sumeru "Akasha System") imagery below, so the code itself
carries the theme.

**Single red line:** stay readable; never sacrifice semantic clarity. Config
`type` values (`s3/oss/local/webdav`) and external protocol fields keep their
literal names — flavor is added only to *our own* identifiers.

## Concept → name mapping

| Code concept | Akasha name | Imagery |
|---|---|---|
| Project / whole system | `akasha` | The Void System |
| Creator (Trellis identity) | `Rukdvta` | abbrev. of `Rukkhadevata` |
| CLI entry / query origin | `terminal.ts` / `Terminal` | Akasha Terminal |
| Engine abstraction (StorageEngine) | `Darshan` (school base class) | the six Darshans |
| Concrete engine (S3/Local/WebDAV) | `S3Darshan` / `LocalDarshan` / `WebdavDarshan` | each school's praxis |
| Engine registry / factory | `Akademiya` | the Akademiya |
| register() | `enroll("s3", S3Darshan)` | enrolling a school |
| create_engine() | `Akademiya.summon(gnosis)` | summon by identity |
| Config / credential (RemoteConfig) | `Gnosis` | carries the keys |
| List item type (ObjectEntry) | `Capsule` | Knowledge Capsule |
| Index store | `HouseOfWisdom` | Bayt al-Hikmah |
| Index file on disk | `irminsul.json` | Irminsul, root of knowledge |
| capabilities() | `clearance()` | clearance level |
| required_fields | `requiredGnosis()` | power needed to summon |
| NotSupported exception | `ForbiddenKnowledge` | knowledge the system refuses |
| iter_items / query | `recall()` / `query()` | recall from the void |
| path normalize / traversal guard | `seal()` / `purify()` | ward / purification |
| Elysia service context | `Surasthana` | Sanctuary of Surasthana |

## Landing strategy

Keep the functional directory skeleton from
[Directory Structure](./directory-structure.md); rename classes/files per the
table. E.g. `core/darshan.ts` defines `Darshan`, `Capsule`, `ForbiddenKnowledge`;
`core/akademiya.ts` defines `Akademiya`; `service/house-of-wisdom.ts` handles
`irminsul.json`. The `type` registration keys remain `s3/local/webdav`.

A wider imagery vocabulary (for picking new names) lives in `session.md` §
"周边意象词库".
