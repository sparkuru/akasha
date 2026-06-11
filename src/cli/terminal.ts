import { defineCommand, runMain } from "citty"
import { catCommand, lsCommand, recallCommand, remotesCommand } from "./commands.ts"

/**
 * Terminal — the Akasha Terminal CLI entry (query origin).
 *
 * Adapter-only: routes subcommands into the service layer via citty. M2 ships
 * the `remotes` / `ls` / `cat` / `recall` subset.
 */
const main = defineCommand({
  meta: {
    name: "akasha",
    description: "Akasha — query the void: browse vendor-clean object storage",
  },
  subCommands: {
    remotes: remotesCommand,
    ls: lsCommand,
    cat: catCommand,
    recall: recallCommand,
  },
})

runMain(main)
