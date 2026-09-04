/**
 * Generates `src/domain/standards.data.ts` from the fetched research file at
 * `docs/research/strength-standards-sources.md`.
 *
 * The tables are transcribed by a parser rather than by hand, because six lifts
 * times two sexes times nineteen bodyweight rows is far too many numbers to copy
 * reliably, and one wrong digit would silently misrank a lift.
 *
 * Run with: node scripts/generate-standards.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const SOURCE = join(root, 'docs/research/strength-standards-sources.md')
const OUT = join(root, 'src/domain/standards.data.ts')

/** Section heading prefix mapped to the lift key used in the app. */
const LIFT_SECTIONS = [
  { match: '4.1 Squat', lift: 'squat' },
  { match: '4.2 Bench press', lift: 'bench' },
  { match: '4.3 Shoulder press', lift: 'ohp' },
  { match: '4.4 Deadlift', lift: 'deadlift' },
  { match: '4.5 Incline bench press', lift: 'incline_bench' },
  { match: '4.6 Pull ups', lift: 'pullup' },
]

const lines = readFileSync(SOURCE, 'utf8').split(/\r?\n/)

/** Parses a cell such as `78`, `+22`, `-5`, or `< 1`. */
function parseCell(raw) {
  const text = raw.trim()
  if (text === '' || text === '-') return null
  if (/^<\s*1$/.test(text)) return 0
  const value = Number.parseFloat(text.replace(/^\+/, ''))
  return Number.isFinite(value) ? value : null
}

/**
 * Walks the document collecting every `| BW | Beginner | ... |` table, tagged
 * with the lift section and the sub-label that introduced it.
 */
function collectTables() {
  const tables = []
  let lift = null
  let label = null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    const sectionMatch = /^###\s+(4\.\d.*)$/.exec(line)
    if (sectionMatch) {
      const found = LIFT_SECTIONS.find((s) => sectionMatch[1].startsWith(s.match))
      lift = found ? found.lift : null
      label = null
      continue
    }
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      lift = null
      label = null
      continue
    }

    const boldLabel = /^\*\*(Male|Female)\*\*$/.exec(line.trim())
    if (boldLabel) {
      label = boldLabel[1].toLowerCase()
      continue
    }
    const subLabel = /^####\s+(Male|Female)\s*[—-]\s*(.+)$/.exec(line.trim())
    if (subLabel) {
      const sex = subLabel[1].toLowerCase()
      label = /reps/i.test(subLabel[2]) ? sex + ':reps' : sex + ':added'
      continue
    }

    if (lift && label && /^\|\s*BW\s*\|/i.test(line)) {
      const rows = []
      let j = i + 2
      for (; j < lines.length; j += 1) {
        const row = lines[j]
        if (!row.startsWith('|')) break
        const cells = row.split('|').slice(1, -1).map(parseCell)
        const bw = cells[0]
        const thresholds = cells.slice(1, 6)
        if (bw === null || thresholds.length !== 5 || thresholds.some((v) => v === null)) continue
        rows.push({ bw, thresholds })
      }
      if (rows.length > 0) tables.push({ lift, label, rows })
      i = j - 1
    }
  }

  return tables
}

const tables = collectTables()

const barbellLifts = {}
const pullupReps = {}
const pullupAdded = {}

for (const table of tables) {
  if (table.lift === 'pullup') {
    const [sex, kind] = table.label.split(':')
    if (kind === 'reps') pullupReps[sex] = table.rows
    else if (kind === 'added') pullupAdded[sex] = table.rows
    continue
  }
  barbellLifts[table.lift] ??= {}
  barbellLifts[table.lift][table.label] = table.rows
}

function formatRows(rows, indent) {
  return rows
    .map((r) => `${indent}{ bw: ${r.bw}, thresholds: [${r.thresholds.join(', ')}] },`)
    .join('\n')
}

function formatBySex(bySex, indent) {
  const parts = []
  for (const sex of ['male', 'female']) {
    const rows = bySex[sex]
    if (!rows) continue
    parts.push(`${indent}${sex}: [\n${formatRows(rows, indent + '  ')}\n${indent}],`)
  }
  return parts.join('\n')
}

const liftEntries = Object.entries(barbellLifts)
  .map(([lift, bySex]) => `  ${lift}: {\n${formatBySex(bySex, '    ')}\n  },`)
  .join('\n')

const header = [
  '/**',
  ' * GENERATED FILE - do not edit by hand.',
  ' *',
  ' * Produced by `scripts/generate-standards.mjs` from',
  ' * `docs/research/strength-standards-sources.md`. Regenerate rather than editing.',
  ' *',
  ' * Source: StrengthLevel.com published strength standards, retrieved 2026-09-03.',
  ' * Values are one-rep maxes in kilograms indexed by bodyweight in kilograms, and',
  ' * they INCLUDE the 20 kg barbell. Each row holds the five published thresholds',
  ' * in ascending order: Beginner, Novice, Intermediate, Advanced, Elite.',
  ' *',
  ' * Pull-ups are published in two different units and are kept separate: a',
  ' * bodyweight-only rep count, and an ADDED-LOAD one-rep max where a negative',
  ' * value means assistance was required. Neither is a total-system load.',
  ' *',
  ' * See docs/NOTES.md for the licensing question and for why these are never blended',
  ' * with the ExRx tables.',
  ' */',
  '',
  "export type StandardLift = 'squat' | 'bench' | 'ohp' | 'deadlift' | 'incline_bench' | 'pullup'",
  '',
  "export type StandardsSex = 'male' | 'female'",
  '',
  '/** The five published thresholds, ascending. */',
  'export type Thresholds = readonly [number, number, number, number, number]',
  '',
  'export interface StandardRow {',
  '  /** Bodyweight in kilograms this row applies to. */',
  '  readonly bw: number',
  '  readonly thresholds: Thresholds',
  '}',
  '',
  "export const STANDARD_TIER_NAMES = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'] as const",
  '',
  '/** One-rep max standards in kg, bar weight included. */',
  'export const BARBELL_STANDARDS: Record<',
  "  Exclude<StandardLift, 'pullup'>,",
  '  Record<StandardsSex, readonly StandardRow[]>',
  '> = {',
].join('\n')

const out = [
  header,
  liftEntries,
  '}',
  '',
  '/** Bodyweight-only pull-up rep counts. Zero stands for the published "< 1". */',
  'export const PULLUP_REP_STANDARDS: Record<StandardsSex, readonly StandardRow[]> = {',
  formatBySex(pullupReps, '  '),
  '}',
  '',
  '/** Pull-up one-rep max as ADDED load in kg. Negative means assistance needed. */',
  'export const PULLUP_ADDED_LOAD_STANDARDS: Record<StandardsSex, readonly StandardRow[]> = {',
  formatBySex(pullupAdded, '  '),
  '}',
  '',
].join('\n')

writeFileSync(OUT, out)

console.log('wrote ' + OUT)
for (const [lift, bySex] of Object.entries(barbellLifts)) {
  const counts = Object.entries(bySex)
    .map(([sex, rows]) => sex + '=' + rows.length)
    .join(' ')
  console.log('  ' + lift + ': ' + counts)
}
console.log(
  '  pullup reps: ' +
    Object.entries(pullupReps)
      .map(([s, r]) => s + '=' + r.length)
      .join(' '),
)
console.log(
  '  pullup added: ' +
    Object.entries(pullupAdded)
      .map(([s, r]) => s + '=' + r.length)
      .join(' '),
)
