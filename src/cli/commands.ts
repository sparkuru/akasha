import { defineCommand } from "citty"
import { loadRcloneConf } from "../config/rclone.ts"
import { createAkademiya } from "../engines/index.ts"
import { Browser, parseAddress } from "../service/browser.ts"
import {
  DEFAULT_IRMINSUL,
  loadIrminsul,
  recordDirectory,
  saveIrminsul,
} from "../service/house-of-wisdom.ts"

/**
 * Terminal subcommands (the Akasha Terminal's query origins).
 *
 * Adapter-only: every command delegates browsing/path/index logic to the
 * service layer and is blind to which engine backs a remote.
 */

const configArg = {
  config: {
    type: "string" as const,
    description: "Path to the rclone.conf",
    default: "rclone.conf",
  },
}

/** Build a `Browser` from a config file path. */
async function summonBrowser(configPath: string): Promise<Browser> {
  const remotes = await loadRcloneConf(configPath)
  return new Browser(remotes, createAkademiya())
}

/** `remotes` — load the config and list parsed remotes (name + type). */
export const remotesCommand = defineCommand({
  meta: { name: "remotes", description: "List remotes parsed from the rclone.conf" },
  args: { ...configArg },
  async run({ args }) {
    const remotes = await loadRcloneConf(args.config)
    if (remotes.length === 0) {
      console.log("(no remotes)")
      return
    }
    for (const g of remotes) {
      console.log(`${g.name}\t${g.type}`)
    }
  },
})

/** `ls <remote:bucket/prefix>` — list a directory. */
export const lsCommand = defineCommand({
  meta: { name: "ls", description: "List a directory: ls <remote:bucket/prefix>" },
  args: {
    target: { type: "positional", description: "remote:bucket/prefix", required: true },
    ...configArg,
  },
  async run({ args }) {
    const browser = await summonBrowser(args.config)
    const capsules = await browser.list(args.target)
    for (const c of capsules) {
      const tag = c.isDir ? "DIR " : "FILE"
      const size = c.size === undefined ? "" : `\t${c.size}`
      console.log(`${tag}\t${c.name}${size}`)
    }
  },
})

/** `cat <remote:bucket/key>` — print a file's bytes. */
export const catCommand = defineCommand({
  meta: { name: "cat", description: "Print a file: cat <remote:bucket/key>" },
  args: {
    target: { type: "positional", description: "remote:bucket/key", required: true },
    ...configArg,
  },
  async run({ args }) {
    const browser = await summonBrowser(args.config)
    const bytes = await browser.read(args.target)
    await Bun.write(Bun.stdout, bytes)
  },
})

/** `recall <remote:bucket/prefix>` — list + write/update irminsul.json. */
export const recallCommand = defineCommand({
  meta: { name: "recall", description: "Index a directory into irminsul.json" },
  args: {
    target: { type: "positional", description: "remote:bucket/prefix", required: true },
    index: {
      type: "string",
      description: "Path to the index file",
      default: DEFAULT_IRMINSUL,
    },
    ...configArg,
  },
  async run({ args }) {
    const browser = await summonBrowser(args.config)
    const { bucket, path } = parseAddress(args.target)
    const capsules = await browser.list(args.target)
    const before = await loadIrminsul(args.index)
    const after = recordDirectory(before, bucket, path, capsules)
    await saveIrminsul(after, args.index)
    console.log(`recalled ${capsules.length} item(s) for ${bucket}/${path} -> ${args.index}`)
  },
})
