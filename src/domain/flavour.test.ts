import { describe, expect, it } from 'vitest'
import { FLAVOUR_TABLE, flavourFor, type FlavourKey, type FlavourTable } from './flavour'

const table: FlavourTable = {
  level_up: ['a', 'b', 'c'],
}

describe('flavourFor (m9-plan commit 1)', () => {
  it('is deterministic: the same key, seed and table always return the same line', () => {
    const a = flavourFor(table, 'level_up', 'seed-1', 'fallback')
    const b = flavourFor(table, 'level_up', 'seed-1', 'fallback')
    expect(a).toBe(b)
  })

  it('can return different lines for different seeds', () => {
    const results = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6'].map((seed) => flavourFor(table, 'level_up', seed, 'fallback')),
    )
    expect(results.size).toBeGreaterThan(1)
  })

  it('never returns anything outside the pool', () => {
    for (const seed of ['x', 'y', 'z', 'w', 'level-20', 'level-97']) {
      expect(table.level_up).toContain(flavourFor(table, 'level_up', seed, 'fallback'))
    }
  })

  it('falls back on a key the table has nothing for', () => {
    expect(flavourFor(table, 'daily_quest_arrived', 'seed', 'fallback line')).toBe('fallback line')
  })

  it('falls back on a key present but empty', () => {
    expect(flavourFor({ level_up: [] }, 'level_up', 'seed', 'fallback line')).toBe('fallback line')
  })

  it('falls back on every key for an entirely empty table', () => {
    expect(flavourFor({}, 'level_up', 'seed', 'fallback line')).toBe('fallback line')
    expect(flavourFor({}, 'boss_slain', 'seed', 'fallback line')).toBe('fallback line')
  })
})

describe('FLAVOUR_TABLE, reviewed (m9-plan commit 4)', () => {
  const FALLBACK_LINE: Record<FlavourKey, string> = {
    level_up: 'New stat points are waiting to be spent.',
    daily_quest_arrived: '[Daily Quest has arrived.]',
    rest_token_spent: 'Yesterday is forgiven and your streak holds. Nothing has been taken away.',
    penalty_issued: '[You have failed to complete the Daily Quest. A Penalty Quest has been issued.]',
    red_gate_cleared: '[Red Gate cleared.]',
    red_gate_failed: '[Red Gate failed.]',
    boss_slain: '[Boss slain.]',
    deload_recorded: 'The System will not ask again for five weeks.',
  }

  it('has no entry for ARISE — the one line the voice keeps fixed', () => {
    expect(Object.keys(FLAVOUR_TABLE)).not.toContain('arise')
  })

  it('has a non-empty pool for every key the call sites use', () => {
    for (const key of Object.keys(FALLBACK_LINE) as FlavourKey[]) {
      expect(FLAVOUR_TABLE[key]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('has no duplicate line within any one pool', () => {
    for (const pool of Object.values(FLAVOUR_TABLE)) {
      expect(new Set(pool).size).toBe(pool!.length)
    }
  })

  it('keeps each call site\'s original line as one of its own pool\'s options, so old behaviour stays reachable', () => {
    for (const key of Object.keys(FALLBACK_LINE) as FlavourKey[]) {
      expect(FLAVOUR_TABLE[key]).toContain(FALLBACK_LINE[key])
    }
  })
})
