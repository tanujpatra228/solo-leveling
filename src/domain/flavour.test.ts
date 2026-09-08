import { describe, expect, it } from 'vitest'
import { FLAVOUR_TABLE, flavourFor, type FlavourTable } from './flavour'

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

  it('has no entry for ARISE — the one line the voice keeps fixed', () => {
    expect(Object.keys(FLAVOUR_TABLE)).not.toContain('arise')
  })
})
