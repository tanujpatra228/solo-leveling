/**
 * Generates candidate lines for `src/domain/flavour.ts`'s FLAVOUR_TABLE.
 *
 * A tool, not a build step (m9-plan F2) — regenerating on every build would
 * mean the shipped text differs between two builds of the same commit, and
 * a voice drift or an embarrassing line could reach the phone with no one
 * having read it. Run this by hand, read `flavour-candidates.json`, cut the
 * bad ones, and hand-write the survivors into `FLAVOUR_TABLE` yourself —
 * this script's output is deliberately not committed.
 *
 * Combines a small opener/closer bank per event rather than inventing full
 * sentences from nothing, so every candidate stays inside hand-written
 * fragments that were written to compose with each other. Some
 * combinations will still read worse than others — that is what the
 * reading-and-cutting step is for.
 *
 * Run with: node scripts/generate-flavour.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const OUT = join(root, 'flavour-candidates.json')

/**
 * Per key: `openers` combine with `closers` (cross product). A key whose
 * whole line is one unit (most of the bracketed titles) just uses a single
 * empty closer, so the bank stays uniform without forcing an artificial
 * second sentence onto a line that does not need one.
 */
const BANKS = {
  level_up: {
    openers: [
      'New stat points are waiting to be spent.',
      'The gap between who you were and who you are just widened.',
      'Every session since the last level added up to this.',
      'Growth like this does not happen by accident.',
    ],
    closers: ['', 'The next threshold is already further out than it looks.', 'Nothing here was given.'],
  },
  daily_quest_arrived: {
    openers: [
      '[The Daily Quest has arrived.]',
      "[Today's Daily Quest is set.]",
      "[The System has issued today's Daily Quest.]",
      '[A new Daily Quest awaits.]',
    ],
    closers: [''],
  },
  rest_token_spent: {
    openers: [
      'Yesterday is forgiven and your streak holds.',
      'The gap is closed without a mark against it.',
      'One token, spent on your behalf, and nothing else.',
    ],
    closers: ['Nothing has been taken away.', 'The count resets. The record does not.'],
  },
  penalty_issued: {
    openers: [
      '[You have failed to complete the Daily Quest. A Penalty Quest has been issued.]',
      '[The Daily Quest went unfinished. A Penalty Quest follows.]',
      "[Yesterday's Daily Quest was not met. A Penalty Quest has been issued.]",
    ],
    closers: [''],
  },
  red_gate_cleared: {
    openers: ['[Red Gate cleared.]', '[The Red Gate yields.]', '[Red Gate closed. You are still standing.]'],
    closers: [''],
  },
  red_gate_failed: {
    openers: ['[Red Gate failed.]', '[The Red Gate holds.]', '[Red Gate closed. Nothing was claimed.]'],
    closers: [''],
  },
  boss_slain: {
    openers: ['[Boss slain.]', '[A boss falls.]', '[The record breaks.]'],
    closers: [''],
  },
  deload_recorded: {
    openers: [
      'The System will not ask again for five weeks.',
      'This week counts as work, not rest.',
      'Recovery is the other half of the programme.',
    ],
    closers: [''],
  },
}

/** @type {Record<string, string[]>} */
const candidates = {}

for (const [key, { openers, closers }] of Object.entries(BANKS)) {
  const lines = new Set()
  for (const opener of openers) {
    for (const closer of closers) {
      lines.add(closer ? `${opener} ${closer}` : opener)
    }
  }
  candidates[key] = [...lines]
}

writeFileSync(OUT, JSON.stringify(candidates, null, 2) + '\n')

const total = Object.values(candidates).reduce((sum, lines) => sum + lines.length, 0)
console.log(`Wrote ${total} candidates across ${Object.keys(candidates).length} keys to ${OUT}`)
console.log('Read them, cut the bad ones, and hand-write the survivors into FLAVOUR_TABLE.')
