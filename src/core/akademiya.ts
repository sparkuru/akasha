import { type Darshan, ForbiddenKnowledge } from "./darshan.ts"
import { type Gnosis, validateRequiredGnosis } from "./gnosis.ts"

/**
 * DarshanCtor — the constructor shape a school registers under.
 *
 * Static `typeName` is the literal backend key (`s3`/`local`/`webdav`); static
 * `requiredGnosis()` declares the `raw` keys validated before construction.
 */
export type DarshanCtor = {
  readonly typeName: string
  requiredGnosis(): Set<string>
  new (gnosis: Gnosis): Darshan
}

/**
 * Akademiya — the registry / factory of Darshan schools.
 *
 * `enroll(...ctors)` registers schools by their literal `typeName`; `summon`
 * resolves a `Gnosis` to a constructed engine, validating required keys first.
 */
export class Akademiya {
  private readonly schools = new Map<string, DarshanCtor>()

  /** Enroll one or more schools, keyed by their literal `typeName`. */
  enroll(...ctors: DarshanCtor[]): this {
    for (const ctor of ctors) {
      this.schools.set(ctor.typeName, ctor)
    }
    return this
  }

  /** Whether a school is enrolled for the given literal `type`. */
  knows(type: string): boolean {
    return this.schools.has(type)
  }

  /**
   * Summon an engine for the given Gnosis.
   *
   * Throws `ForbiddenKnowledge` when `gnosis.type` is not enrolled, and
   * `InvalidGnosis` (via `validateRequiredGnosis`) when required keys are
   * missing — both BEFORE any engine is constructed.
   */
  summon(gnosis: Gnosis): Darshan {
    const ctor = this.schools.get(gnosis.type)
    if (ctor === undefined) {
      throw new ForbiddenKnowledge(`no Darshan enrolled for type "${gnosis.type}"`)
    }
    validateRequiredGnosis(gnosis, ctor.requiredGnosis())
    return new ctor(gnosis)
  }
}
