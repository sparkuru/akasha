/**
 * Akasha — library public surface.
 *
 * Re-exports the framework-independent `core/` domain model. Interface layers
 * (`server/`, `cli/`) and engines build on top of these types.
 */
export type { Capsule } from "./core/capsule.ts"
export {
  BackendFault,
  CapsuleNotFound,
  type Darshan,
  type DarshanCapability,
  ForbiddenKnowledge,
  type PresignOptions,
} from "./core/darshan.ts"
export {
  type Gnosis,
  InvalidGnosis,
  validateRequiredGnosis,
} from "./core/gnosis.ts"
export { Akademiya, type DarshanCtor } from "./core/akademiya.ts"
export { loadRcloneConf, MalformedGnosis, parseRcloneConf } from "./config/rclone.ts"
export { createAkademiya, LocalDarshan, S3Darshan } from "./engines/index.ts"
export {
  type Address,
  Browser,
  parseAddress,
  type RemoteSummary,
  type UrlResult,
} from "./service/browser.ts"
export { purify, seal } from "./service/path.ts"
export {
  DEFAULT_IRMINSUL,
  type Irminsul,
  type IrminsulDirectory,
  type IrminsulItem,
  loadIrminsul,
  recordDirectory,
  saveIrminsul,
} from "./service/house-of-wisdom.ts"
