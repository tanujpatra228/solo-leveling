/**
 * Flavour: variety pools for the System's most-repeated announcements, so
 * the hundredth gate does not read identically to the first (m9-plan).
 *
 * Generated ahead of time and committed as data, never called at runtime —
 * a network call on the finish-gate path would put the app's most
 * important moment behind a request, in exactly the gym-basement
 * environment it was built to work without one (m9-plan F1, CLAUDE.md's
 * offline rule).
 *
 * `ARISE.` is deliberately absent from this table. It is the one line in
 * the System's voice canon treats as fixed, and varying it would be the
 * wrong kind of variety.
 */

export type FlavourKey =
  | 'level_up'
  | 'daily_quest_arrived'
  | 'rest_token_spent'
  | 'penalty_issued'
  | 'red_gate_cleared'
  | 'red_gate_failed'
  | 'boss_slain'
  | 'deload_recorded'

export type FlavourTable = Readonly<Partial<Record<FlavourKey, readonly string[]>>>

/**
 * The reviewed table (m9-plan commit 4). Curated down from
 * `scripts/generate-flavour.mjs`'s candidate pool — every line here was
 * read before it shipped, not generated at build time or invented as a
 * placeholder. Each pool keeps the line the app already shipped with, so
 * today's exact behaviour stays one of the possible outcomes rather than
 * being replaced outright.
 */
export const FLAVOUR_TABLE: FlavourTable = {
  level_up: [
    'New stat points are waiting to be spent.',
    'The gap between who you were and who you are just widened.',
    'Every session since the last level added up to this.',
    'Growth like this does not happen by accident.',
  ],
  daily_quest_arrived: [
    '[Daily Quest has arrived.]',
    "[Today's Daily Quest is set.]",
    '[A new Daily Quest awaits.]',
  ],
  rest_token_spent: [
    'Yesterday is forgiven and your streak holds. Nothing has been taken away.',
    'The gap is closed without a mark against it. Nothing has been taken away.',
    'One token, spent on your behalf, and nothing else. Nothing has been taken away.',
  ],
  penalty_issued: [
    '[You have failed to complete the Daily Quest. A Penalty Quest has been issued.]',
    '[The Daily Quest went unfinished. A Penalty Quest follows.]',
    "[Yesterday's Daily Quest was not met. A Penalty Quest has been issued.]",
  ],
  red_gate_cleared: [
    '[Red Gate cleared.]',
    '[The Red Gate yields.]',
    '[Red Gate closed. You are still standing.]',
  ],
  red_gate_failed: [
    '[Red Gate failed.]',
    '[The Red Gate holds.]',
    '[Red Gate closed. Nothing was claimed.]',
  ],
  boss_slain: ['[Boss slain.]', '[A boss falls.]', '[The record breaks.]'],
  deload_recorded: [
    'The System will not ask again for five weeks.',
    'This week counts as work, not rest.',
    'Recovery is the other half of the programme.',
  ],
}

/**
 * Deterministic string hash — the same shape as `shadows.ts`'s `pickName`,
 * so a given seed always lands on the same index. Selection must not be
 * ambient-random: a naive `Math.random()` pick would flicker across
 * re-renders, the same class of problem rule 13 already guards against,
 * arriving through randomness instead of selector identity (m9-plan F3).
 */
function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000
  }
  return hash
}

/**
 * The line for `key`, or `fallback` when the table has nothing usable for
 * it — a missing key, an empty pool, and an entirely empty table all take
 * this path, so an incomplete table can never leave an event with no
 * message (m9-plan F4). The table is a parameter rather than an import of
 * `FLAVOUR_TABLE`, so this stays a pure function of its inputs like the
 * rest of `src/domain/` (rule: no ambient anything).
 *
 * Pure: the same key, seed and table always return the same line.
 */
export function flavourFor(table: FlavourTable, key: FlavourKey, seed: string, fallback: string): string {
  const pool = table[key]
  if (!pool || pool.length === 0) return fallback
  return pool[hashSeed(seed) % pool.length]!
}
