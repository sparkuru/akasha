import { Akademiya, type DarshanCtor } from "../core/akademiya.ts"
import type { Gnosis } from "../core/gnosis.ts"
import { Browser } from "../service/browser.ts"

/**
 * Surasthana — the web service context (Sanctuary of Surasthana).
 *
 * Built once at boot and `.decorate()`d onto every route. Immutable for the
 * app's life: it wraps the parsed rclone remotes + an `Akademiya` registry in a
 * `Browser`. Reloading config means restarting the process (M4 decision Q4).
 *
 * This is an adapter-side context only — it owns no browse/path/index logic; it
 * delegates everything to the service `Browser`.
 */
export interface Surasthana {
  browser: Browser
  /** Default on-disk index file path (overridable for the index routes). */
  indexPath?: string
}

/**
 * Build the boot-time service context from parsed remotes + the engine schools.
 *
 * Engines are enrolled into a fresh `Akademiya`; the `Browser` summons them on
 * demand. Never `new`s an engine class directly.
 */
export function buildSurasthana(
  remotes: readonly Gnosis[],
  schools: DarshanCtor[],
  indexPath?: string,
): Surasthana {
  const akademiya = new Akademiya().enroll(...schools)
  const browser = new Browser(remotes, akademiya)
  const surasthana: Surasthana = { browser }
  if (indexPath !== undefined) {
    surasthana.indexPath = indexPath
  }
  return surasthana
}
