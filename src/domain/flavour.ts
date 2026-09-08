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
 * The committed table (m9-plan commit 4): reviewed by a person before it
 * ships, not invented here as a placeholder. Empty until that review
 * lands — `flavourFor` treats an empty or missing pool identically to a
 * missing key, so this file being incomplete never breaks anything.
 */
export const FLAVOUR_TABLE: FlavourTable = {}

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
