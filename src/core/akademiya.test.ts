import { describe, expect, it } from "bun:test"
import { Akademiya } from "./akademiya.ts"
import type { Capsule } from "./capsule.ts"
import { type Darshan, type DarshanCapability, ForbiddenKnowledge } from "./darshan.ts"
import { type Gnosis, InvalidGnosis } from "./gnosis.ts"

/**
 * StubDarshan — a test-only school proving enroll/summon without depending on a
 * real engine (M1 ADR-lite decision #2). `typeName` stays literal.
 */
class StubDarshan implements Darshan {
  static readonly typeName = "stub"
  readonly typeName = StubDarshan.typeName
  readonly endpoint: string

  static requiredGnosis(): Set<string> {
    return new Set(["endpoint"])
  }

  constructor(gnosis: Gnosis) {
    const endpoint = gnosis.raw.endpoint
    if (endpoint === undefined) {
      throw new Error("unreachable: validated before construction")
    }
    this.endpoint = endpoint
  }

  listObjects(_bucket: string, _prefix?: string, _delimiter?: string): Promise<Capsule[]> {
    return Promise.resolve([])
  }
  stat(_bucket: string, _key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }
  readBytes(_bucket: string, _key: string, _maxBytes?: number): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array())
  }
  download(_bucket: string, _key: string, dest: string): Promise<string> {
    return Promise.resolve(dest)
  }
  uploadFile(
    _bucket: string,
    _source: Blob | Uint8Array | ReadableStream,
    key: string,
  ): Promise<string> {
    return Promise.resolve(key)
  }
  delete(_bucket: string, _key: string): Promise<void> {
    return Promise.resolve()
  }

  clearance(): Set<DarshanCapability> {
    return new Set<DarshanCapability>(["read"])
  }
}

function gnosis(overrides: Partial<Gnosis> = {}): Gnosis {
  return {
    name: "test-remote",
    type: "stub",
    raw: { endpoint: "https://example.invalid" },
    ...overrides,
  }
}

describe("Akademiya", () => {
  it("summons the enrolled engine on the happy path", () => {
    const akademiya = new Akademiya().enroll(StubDarshan)

    const engine = akademiya.summon(gnosis())

    expect(engine).toBeInstanceOf(StubDarshan)
    expect(engine.typeName).toBe("stub")
    expect(engine.clearance().has("read")).toBe(true)
  })

  it("knows() reflects enrollment", () => {
    const akademiya = new Akademiya()
    expect(akademiya.knows("stub")).toBe(false)
    akademiya.enroll(StubDarshan)
    expect(akademiya.knows("stub")).toBe(true)
  })

  it("throws ForbiddenKnowledge for an unknown type", () => {
    const akademiya = new Akademiya().enroll(StubDarshan)

    expect(() => akademiya.summon(gnosis({ type: "ghost" }))).toThrow(ForbiddenKnowledge)
  })

  it("throws InvalidGnosis when a required field is missing", () => {
    const akademiya = new Akademiya().enroll(StubDarshan)

    expect(() => akademiya.summon(gnosis({ raw: {} }))).toThrow(InvalidGnosis)
  })

  it("throws InvalidGnosis when a required field is empty", () => {
    const akademiya = new Akademiya().enroll(StubDarshan)

    expect(() => akademiya.summon(gnosis({ raw: { endpoint: "" } }))).toThrow(InvalidGnosis)
  })
})
