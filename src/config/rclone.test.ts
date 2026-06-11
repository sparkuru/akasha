import { describe, expect, it } from "bun:test"
import { MalformedGnosis, parseRcloneConf } from "./rclone.ts"

const SAMPLE = `
# the genie speaks s3 (plaintext keys)
[genie]
type = s3
access_key_id = AKIAEXAMPLE
secret_access_key = secret/value=with=equals
endpoint = https://s3.example.com
region = us-east-1
force_path_style = false

; an sftp remote with an obscured password
[myserver]
type = sftp
host = ssh.example.com
pass = obscured-blob

[home]
type = local
root = /tmp/akasha

[empty-value]
type = webdav
url =

[nutstore]
type = webdav
url = https://dav.jianguoyun.com/dav/
vendor = other
user = a@example.com
pass = plaintext-for-mvp
`

describe("parseRcloneConf", () => {
  it("parses an s3 section into a correct Gnosis", () => {
    const remotes = parseRcloneConf(SAMPLE)
    const genie = remotes.find((g) => g.name === "genie")
    expect(genie).toBeDefined()
    expect(genie?.type).toBe("s3")
    expect(genie?.raw.access_key_id).toBe("AKIAEXAMPLE")
    expect(genie?.raw.endpoint).toBe("https://s3.example.com")
    // value with `=` preserved verbatim (only first `=` splits)
    expect(genie?.raw.secret_access_key).toBe("secret/value=with=equals")
    // `type` is extracted, not left in raw
    expect(genie?.raw.type).toBeUndefined()
  })

  it("parses a local section into a correct Gnosis", () => {
    const remotes = parseRcloneConf(SAMPLE)
    const home = remotes.find((g) => g.name === "home")
    expect(home?.type).toBe("local")
    expect(home?.raw.root).toBe("/tmp/akasha")
  })

  it("parses a non-s3 (sftp) section without error", () => {
    const remotes = parseRcloneConf(SAMPLE)
    const server = remotes.find((g) => g.name === "myserver")
    expect(server?.type).toBe("sftp")
    expect(server?.raw.pass).toBe("obscured-blob")
  })

  it("keeps blank values", () => {
    const remotes = parseRcloneConf(SAMPLE)
    const empty = remotes.find((g) => g.name === "empty-value")
    expect(empty?.raw.url).toBe("")
  })

  it("parses a webdav section without interpreting backend fields", () => {
    const remotes = parseRcloneConf(SAMPLE)
    const nutstore = remotes.find((g) => g.name === "nutstore")
    expect(nutstore?.type).toBe("webdav")
    expect(nutstore?.raw.url).toBe("https://dav.jianguoyun.com/dav/")
    expect(nutstore?.raw.user).toBe("a@example.com")
    expect(nutstore?.raw.pass).toBe("plaintext-for-mvp")
    expect(nutstore?.raw.vendor).toBe("other")
  })

  it("skips comment and blank lines", () => {
    const remotes = parseRcloneConf(SAMPLE)
    expect(remotes.map((g) => g.name)).toEqual([
      "genie",
      "myserver",
      "home",
      "empty-value",
      "nutstore",
    ])
  })

  it("throws MalformedGnosis when a section lacks type", () => {
    expect(() => parseRcloneConf("[broken]\nroot = /x\n")).toThrow(MalformedGnosis)
  })

  it("throws MalformedGnosis for a key outside any section", () => {
    expect(() => parseRcloneConf("key = value\n")).toThrow(MalformedGnosis)
  })
})
