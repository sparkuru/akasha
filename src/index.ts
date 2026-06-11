/**
 * Akasha — library public surface.
 *
 * Re-exports the framework-independent `core/` domain model. Interface layers
 * (`server/`, `cli/`) and engines build on top of these types.
 */
export type { Capsule } from "./core/capsule.ts"
export {
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
