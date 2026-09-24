#!/usr/bin/env node
// Locale parity gate: the three copy dictionaries in src/client/locales.ts are
// flat and must hold exactly the same keys. A missing key renders a raw key id
// in the UI; an extra key is dead weight that silently hides drift. Checked on
// every PR and before any pack (npm run check-locales).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(root, 'src/client/locales.ts')
const LANGS = ['en', 'zh', 'ru']

const src = readFileSync(FILE, 'utf8')
const dicts = {}
for (const lang of LANGS) {
  const start = src.indexOf(`export const ${lang} = {`)
  if (start === -1) fail(`no "export const ${lang}" block in src/client/locales.ts`)
  // Take the object literal up to its closing brace at line start.
  const end = src.indexOf('\n}', start)
  if (end === -1) fail(`unterminated "${lang}" dictionary`)
  const body = src.slice(start, end)
  // Flat two-space-indented keys only; nested literals never appear.
  const keys = [...body.matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map((match) => match[1])
  if (new Set(keys).size !== keys.length) fail(`duplicate keys in "${lang}"`)
  dicts[lang] = keys
}

const reference = new Set(dicts.en)
let bad = false
for (const lang of LANGS.slice(1)) {
  const current = new Set(dicts[lang])
  const missing = [...reference].filter((key) => !current.has(key))
  const extra = [...current].filter((key) => !reference.has(key))
  if (missing.length || extra.length) {
    bad = true
    if (missing.length) console.error(`${lang}: missing ${missing.length} key(s): ${missing.join(', ')}`)
    if (extra.length) console.error(`${lang}: ${extra.length} key(s) not in en: ${extra.join(', ')}`)
  }
}
if (bad) process.exit(1)
console.log(`locale parity ok: ${reference.size} keys x ${LANGS.length} languages`)

function fail(message) {
  console.error(`check-locales: ${message}`)
  process.exit(1)
}
