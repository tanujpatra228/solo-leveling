import { describe, expect, it } from 'vitest'
import {
  STAT_MAX,
  ZERO_STATS,
  activeShadowCap,
  deriveStats,
  questBiasFromAllocation,
  unspentPoints,
} from './stats'
import type { DerivedStatsInput } from './stats'

const idle: DerivedStatsInput = {
  standardScores: [],
  tonnage28Kg: 0,
  currentStreak: 0,
  cardioMinutes28: 0,
  bodyweightReps28: 0,
  setsLogged28: 0,
  setsWithRpe28: 0,
  distinctRpeValues28: 0,
  sessionsLogged28: 0,
  sessionsWithBodyweight28: 0,
  plannedSessions28: 0,
  completedPlannedSessions28: 0,
}

describe('a hunter with no history', () => {
  it('has zero across the board rather than a divide-by-zero', () => {
    expect(deriveStats(idle)).toEqual(ZERO_STATS)
  })
})

describe('STR comes from the published standards', () => {
  it('is twenty points per tier, so a mid-Intermediate lifter sits near 60', () => {
    expect(deriveStats({ ...idle, standardScores: [3] }).STR).toBe(60)
  })

  it('averages across lifts', () => {
    expect(deriveStats({ ...idle, standardScores: [1, 5] }).STR).toBe(60)
  })

  it('caps at the stat maximum', () => {
    expect(deriveStats({ ...idle, standardScores: [5, 5, 5] }).STR).toBe(STAT_MAX)
  })
})

describe('VIT comes from work done and consistency', () => {
  it('rises with tonnage', () => {
    const low = deriveStats({ ...idle, tonnage28Kg: 50_000 }).VIT
    const high = deriveStats({ ...idle, tonnage28Kg: 200_000 }).VIT
    expect(high).toBeGreaterThan(low)
  })

  it('rises with a streak', () => {
    expect(deriveStats({ ...idle, currentStreak: 30 }).VIT).toBeGreaterThan(0)
  })

  it('stays inside the scale for an enormous month', () => {
    expect(deriveStats({ ...idle, tonnage28Kg: 5_000_000, currentStreak: 999 }).VIT).toBe(STAT_MAX)
  })
})

describe('AGI splits conditioning and bodyweight work evenly', () => {
  it('reaches the same place from running alone or push-ups alone', () => {
    const runner = deriveStats({ ...idle, cardioMinutes28: 400 }).AGI
    const calisthenics = deriveStats({ ...idle, bodyweightReps28: 1500 }).AGI
    expect(runner).toBe(50)
    expect(calisthenics).toBe(50)
  })
})

describe('PER rewards observing your own training, not filling in boxes', () => {
  it('pays more for RPE coverage', () => {
    const none = deriveStats({ ...idle, setsLogged28: 100, setsWithRpe28: 0, sessionsLogged28: 10 })
    const all = deriveStats({
      ...idle,
      setsLogged28: 100,
      setsWithRpe28: 100,
      distinctRpeValues28: 5,
      sessionsLogged28: 10,
    })
    expect(all.PER).toBeGreaterThan(none.PER)
  })

  it('withholds credit from a hunter who logs the same RPE on every set', () => {
    const lazy = deriveStats({
      ...idle,
      setsLogged28: 100,
      setsWithRpe28: 100,
      distinctRpeValues28: 1,
      sessionsLogged28: 10,
    })
    const honest = deriveStats({
      ...idle,
      setsLogged28: 100,
      setsWithRpe28: 100,
      distinctRpeValues28: 5,
      sessionsLogged28: 10,
    })
    expect(honest.PER).toBeGreaterThan(lazy.PER)
  })
})

describe('INT is programme adherence', () => {
  it('is the full stat for perfect adherence', () => {
    expect(deriveStats({ ...idle, plannedSessions28: 24, completedPlannedSessions28: 24 }).INT).toBe(
      STAT_MAX,
    )
  })

  it('is half for half', () => {
    expect(deriveStats({ ...idle, plannedSessions28: 24, completedPlannedSessions28: 12 }).INT).toBe(50)
  })
})

describe('activeShadowCap, which is INT as mana capacity', () => {
  it('always allows at least one shadow', () => {
    expect(activeShadowCap(0)).toBe(1)
  })

  it('grows one per twenty points of INT', () => {
    expect(activeShadowCap(20)).toBe(2)
    expect(activeShadowCap(100)).toBe(6)
  })

  it('does not go negative on a nonsense input', () => {
    expect(activeShadowCap(-50)).toBe(1)
  })
})

describe('unspentPoints', () => {
  it('is what has been earned less what has been spent', () => {
    expect(unspentPoints(30, { STR: 10, VIT: 5, AGI: 0, INT: 0, PER: 0 })).toBe(15)
  })

  it('never goes below zero even if the curve is retuned downward', () => {
    expect(unspentPoints(3, { STR: 10, VIT: 0, AGI: 0, INT: 0, PER: 0 })).toBe(0)
  })
})

describe('allocated points bias quest generation', () => {
  it('is neutral with nothing spent', () => {
    const bias = questBiasFromAllocation(ZERO_STATS)
    expect(bias.heavyLowRep).toBe(1)
    expect(bias.conditioning).toBe(1)
  })

  it('skews toward heavy low-rep work when points go into STR', () => {
    const bias = questBiasFromAllocation({ STR: 30, VIT: 0, AGI: 0, INT: 0, PER: 0 })
    expect(bias.heavyLowRep).toBeGreaterThan(1)
    expect(bias.conditioning).toBe(1)
  })

  it('skews toward conditioning when points go into AGI', () => {
    const bias = questBiasFromAllocation({ STR: 0, VIT: 0, AGI: 30, INT: 0, PER: 0 })
    expect(bias.conditioning).toBeGreaterThan(1)
    expect(bias.heavyLowRep).toBe(1)
  })

  it('is bounded, so allocation can never talk the engine into something extreme', () => {
    const bias = questBiasFromAllocation({ STR: 10_000, VIT: 0, AGI: 0, INT: 0, PER: 0 })
    expect(bias.heavyLowRep).toBeLessThanOrEqual(1.5)
  })
})
