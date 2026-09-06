import { describe, expect, it } from 'vitest'
import {
  bestE1rm,
  countHardSets,
  epley,
  isE1rmReliable,
  isHardSet,
  loadForReps,
  tonnage,
  topSet,
} from './e1rm'
import type { SetLog } from './types'

function set(partial: Partial<SetLog> & { weight: number; reps: number }): SetLog {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sessionId: 's1',
    exerciseId: partial.exerciseId ?? 'squat',
    order: partial.order ?? 0,
    weight: partial.weight,
    reps: partial.reps,
    rpe: partial.rpe,
    isWarmup: partial.isWarmup ?? false,
    completedAt: partial.completedAt ?? 0,
  }
}

describe('epley', () => {
  it('returns the weight itself for a single', () => {
    expect(epley(100, 1)).toBe(100)
  })

  it('matches the stated formula weight * (1 + reps / 30)', () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(epley(100, 5)).toBeCloseTo(116.6667, 4)
    // 60 * (1 + 10/30) = 80
    expect(epley(60, 10)).toBeCloseTo(80, 6)
  })

  it('is zero for a set that did not happen', () => {
    expect(epley(100, 0)).toBe(0)
    expect(epley(0, 5)).toBe(0)
  })
})

describe('loadForReps', () => {
  it('inverts epley', () => {
    const oneRepMax = epley(100, 5)
    expect(loadForReps(oneRepMax, 5)).toBeCloseTo(100, 6)
  })
})

describe('isE1rmReliable', () => {
  it('accepts 1 to 12 reps and rejects beyond', () => {
    expect(isE1rmReliable(1)).toBe(true)
    expect(isE1rmReliable(12)).toBe(true)
    expect(isE1rmReliable(13)).toBe(false)
    expect(isE1rmReliable(0)).toBe(false)
  })
})

describe('bestE1rm', () => {
  it('picks the hardest working set', () => {
    const sets = [set({ weight: 80, reps: 8 }), set({ weight: 100, reps: 3 })]
    // 80*(1+8/30)=101.33, 100*(1+3/30)=110
    expect(bestE1rm(sets)).toBeCloseTo(110, 6)
  })

  it('ignores warmups', () => {
    const sets = [set({ weight: 200, reps: 1, isWarmup: true }), set({ weight: 100, reps: 1 })]
    expect(bestE1rm(sets)).toBe(100)
  })

  it('ignores rep counts too high for the formula to mean anything', () => {
    const sets = [set({ weight: 20, reps: 40 }), set({ weight: 50, reps: 5 })]
    expect(bestE1rm(sets)).toBeCloseTo(epley(50, 5), 6)
  })
})

describe('topSet', () => {
  it('returns the set object, not just its value', () => {
    const heavy = set({ id: 'heavy', weight: 120, reps: 2 })
    const light = set({ id: 'light', weight: 60, reps: 10 })
    expect(topSet([light, heavy])?.id).toBe('heavy')
  })

  it('is null when nothing qualifies', () => {
    expect(topSet([set({ weight: 100, reps: 1, isWarmup: true })])).toBeNull()
  })
})

describe('tonnage', () => {
  it('sums weight times reps across working sets', () => {
    const sets = [set({ weight: 100, reps: 5 }), set({ weight: 90, reps: 5 })]
    expect(tonnage(sets)).toBe(950)
  })

  it('excludes warmups', () => {
    const sets = [set({ weight: 100, reps: 5 }), set({ weight: 40, reps: 10, isWarmup: true })]
    expect(tonnage(sets)).toBe(500)
  })

  it('adds full bodyweight for a movement with factor 1, so a pull-up is not zero work', () => {
    const sets = [set({ exerciseId: 'pullup', weight: 0, reps: 10 })]
    const total = tonnage(sets, { bodyweightKg: 75, bodyweightFactor: (id) => (id === 'pullup' ? 1 : 0) })
    expect(total).toBe(750)
  })

  it('adds only the moved fraction for a partial-bodyweight movement, not the whole mass', () => {
    // The substitution-plan finding: a sit-up does not move the full body, it
    // moves the trunk. 3 sets of 20 sit-ups at a 72 kg bodyweight and a 0.45
    // factor score 1,944 kg, not 4,320 — see docs/substitution-plan.md §8.
    const sets = [
      set({ exerciseId: 'situps', weight: 0, reps: 20 }),
      set({ exerciseId: 'situps', weight: 0, reps: 20 }),
      set({ exerciseId: 'situps', weight: 0, reps: 20 }),
    ]
    const total = tonnage(sets, { bodyweightKg: 72, bodyweightFactor: (id) => (id === 'situps' ? 0.45 : 0) })
    expect(total).toBe(1944)
  })

  it('does not add bodyweight to a loaded machine movement', () => {
    const sets = [set({ exerciseId: 'legpress', weight: 100, reps: 10 })]
    const total = tonnage(sets, { bodyweightKg: 75, bodyweightFactor: (id) => (id === 'pullup' ? 1 : 0) })
    expect(total).toBe(1000)
  })

  it('adds nothing when bodyweightKg is not supplied, even for a factor-bearing exercise', () => {
    const sets = [set({ exerciseId: 'pullup', weight: 0, reps: 10 })]
    expect(tonnage(sets, { bodyweightFactor: () => 1 })).toBe(0)
  })

  it('is zero for an empty set list', () => {
    expect(tonnage([])).toBe(0)
  })
})

describe('hard sets', () => {
  it('counts an unlogged RPE as hard rather than under-counting volume', () => {
    expect(isHardSet(set({ weight: 100, reps: 5 }))).toBe(true)
  })

  it('excludes a set logged as easy', () => {
    expect(isHardSet(set({ weight: 100, reps: 5, rpe: 5 }))).toBe(false)
  })

  it('includes RPE 7 as the boundary', () => {
    expect(isHardSet(set({ weight: 100, reps: 5, rpe: 7 }))).toBe(true)
  })

  it('excludes warmups', () => {
    expect(isHardSet(set({ weight: 100, reps: 5, rpe: 10, isWarmup: true }))).toBe(false)
  })

  it('counts across a list', () => {
    const sets = [
      set({ weight: 100, reps: 5 }),
      set({ weight: 100, reps: 5, rpe: 4 }),
      set({ weight: 100, reps: 5, rpe: 9 }),
    ]
    expect(countHardSets(sets)).toBe(2)
  })
})
