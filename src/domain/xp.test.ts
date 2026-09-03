import { describe, expect, it } from 'vitest'
import {
  GATE_CLEAR_BONUS,
  STAT_POINTS_PER_LEVEL,
  XP_DAILY_QUEST,
  computeSessionXp,
  cumulativeXpForLevel,
  levelFromTotalXp,
  xpToNext,
} from './xp'

describe('the level curve', () => {
  it('is exactly 100 * level^1.5 as the brief states', () => {
    expect(xpToNext(1)).toBe(100)
    expect(xpToNext(4)).toBe(800) // 100 * 8
    expect(xpToNext(9)).toBe(2700) // 100 * 27
  })

  it('gets steeper, so later levels cost more than earlier ones', () => {
    expect(xpToNext(20)).toBeGreaterThan(xpToNext(10) * 2)
  })
})

describe('levelFromTotalXp', () => {
  it('starts at level 1 with nothing earned', () => {
    const state = levelFromTotalXp(0)
    expect(state.level).toBe(1)
    expect(state.xpIntoLevel).toBe(0)
    expect(state.statPointsEarned).toBe(0)
  })

  it('levels up exactly on the threshold', () => {
    expect(levelFromTotalXp(99).level).toBe(1)
    expect(levelFromTotalXp(100).level).toBe(2)
  })

  it('grants three stat points per level gained', () => {
    const state = levelFromTotalXp(cumulativeXpForLevel(10))
    expect(state.level).toBe(10)
    expect(state.statPointsEarned).toBe(9 * STAT_POINTS_PER_LEVEL)
  })

  it('reports progress through the current level', () => {
    // Halfway through level 2, which costs 100 * 2^1.5 = 282.84
    const state = levelFromTotalXp(100 + xpToNext(2) / 2)
    expect(state.level).toBe(2)
    expect(state.progress).toBeCloseTo(0.5, 6)
  })

  it('is consistent with cumulativeXpForLevel across many levels', () => {
    for (const level of [2, 5, 13, 27, 50]) {
      expect(levelFromTotalXp(cumulativeXpForLevel(level)).level).toBe(level)
    }
  })
})

describe('computeSessionXp', () => {
  it('sums the four sources as specified', () => {
    const xp = computeSessionXp({
      tonnageKg: 12000,
      hardSets: 20,
      exercisePRs: 1,
      gateRank: 'C',
      fatigueMultiplier: 1,
    })
    expect(xp.fromTonnage).toBe(1000) // 12000 / 12
    expect(xp.fromHardSets).toBe(400) // 20 * 20
    expect(xp.fromPRs).toBe(50)
    expect(xp.fromGateClear).toBe(GATE_CLEAR_BONUS.C)
    expect(xp.total).toBe(1000 + 400 + 50 + 450)
  })

  it('pays nothing for a gate clear when no gate was cleared', () => {
    const xp = computeSessionXp({
      tonnageKg: 0,
      hardSets: 0,
      exercisePRs: 0,
      gateRank: null,
      fatigueMultiplier: 1,
    })
    expect(xp.total).toBe(0)
  })

  it('applies the fatigue multiplier to the whole total', () => {
    const xp = computeSessionXp({
      tonnageKg: 1200,
      hardSets: 10,
      exercisePRs: 0,
      gateRank: null,
      fatigueMultiplier: 0.75,
    })
    expect(xp.subtotal).toBe(300)
    expect(xp.total).toBe(225)
  })

  it('pays more for a harder gate', () => {
    expect(GATE_CLEAR_BONUS.S).toBeGreaterThan(GATE_CLEAR_BONUS.E)
  })
})

/**
 * The brief sets a calibration target rather than a rule: a consistent year of
 * this hunter's training should land somewhere around level 50. This test is
 * how that target stays true if the constants are ever retuned.
 */
describe('calibration: one consistent year of training', () => {
  it('lands near level 50', () => {
    const sessionsPerWeek = 6
    const weeks = 52
    const sessions = sessionsPerWeek * weeks

    // A representative session from the actual training week: mid-teens tonnage,
    // around twenty hard sets, a personal record roughly every third session.
    const perSession = computeSessionXp({
      tonnageKg: 12000,
      hardSets: 20,
      exercisePRs: 1 / 3,
      gateRank: 'C',
      fatigueMultiplier: 1,
    }).total

    const dailyQuests = 365 * XP_DAILY_QUEST
    const totalXp = sessions * perSession + dailyQuests
    const { level } = levelFromTotalXp(totalXp)

    expect(level).toBeGreaterThanOrEqual(40)
    expect(level).toBeLessThanOrEqual(60)
  })

  it('does not let a single week of work reach level 50', () => {
    const oneWeek = 6 * computeSessionXp({
      tonnageKg: 12000,
      hardSets: 20,
      exercisePRs: 1,
      gateRank: 'C',
      fatigueMultiplier: 1,
    }).total
    expect(levelFromTotalXp(oneWeek).level).toBeLessThan(20)
  })
})
