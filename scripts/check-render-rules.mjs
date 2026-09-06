/**
 * Tripwire for standards rule 13 (Zustand selectors return stable identities).
 * Line-based, so a selector split across lines slips past — a backstop for the
 * rule, not a proof of it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not URL.pathname: on Windows the latter yields "/F:/..." and
// every path built from it resolves against the wrong drive root.
const ROOT = fileURLToPath(new URL('../src', import.meta.url))
const STORE_HOOKS = ['useApp']

/** Everything a selector may not do, and why, in the order we check for it. */
const OFFENCES = [
  { re: /=>\s*s\.[A-Za-z0-9_]+\s*\(/, why: 'calls a store method — returns a fresh object each read' },
  { re: /=>\s*\(?\s*\{/, why: 'builds an object literal' },
  { re: /=>\s*\[/, why: 'builds an array literal' },
  {
    re: /=>\s*s\.[A-Za-z0-9_.]+\s*\.\s*(filter|map|flatMap|slice|sort|concat|reverse)\s*\(/,
    why: 'builds a new array — select the slice and derive in useMemo',
  },
]

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

const selectorStart = new RegExp(`\\b(${STORE_HOOKS.join('|')})\\(\\s*\\(?\\s*[A-Za-z0-9_]+\\s*\\)?\\s*=>`)
const failures = []

for (const file of sourceFiles(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    // Comments quote the bad shapes on purpose.
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return
    if (!selectorStart.test(line)) return
    const selector = line.slice(line.search(selectorStart))
    const offence = OFFENCES.find((o) => o.re.test(selector))
    if (offence) {
      const where = join('src', relative(ROOT, file)).replaceAll('\\', '/')
      failures.push(`${where}:${index + 1}: selector ${offence.why}\n    ${line.trim()}`)
    }
  })
}

if (failures.length > 0) {
  console.error(`\nUnstable Zustand selectors (standards rule 13):\n\n${failures.join('\n\n')}\n`)
  console.error('Select the slice and derive in useMemo, or derive once in recompute().\n')
  process.exit(1)
}

console.log(`check:render — ${STORE_HOOKS.join(', ')} selectors clean`)
