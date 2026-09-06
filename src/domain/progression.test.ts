import { describe, expect, it } from 'vitest'
import {
  DELOAD_FACTOR,
  computeNextTarget,
  computeSessionTargets,
  effectiveIncrement,
} from './progression'
import type { Exercise, SetLog } from './types'

const squat: Exercise = {
  id: 'barbell-squat',
  name: 'Barbell Squat',
  aliases: [],
  pattern: 'squat',
  primaryMuscles: ['quads'],
  secondaryMuscles: ['glutes'],
  equipment: ['barbell'],
  unit: 'kg',
  increment: 5,
  repRange: [5, 8],
  usesBodyweight: false,
  bodyweightFactor: 1,
}

const curl: Exercise = {
  ...squat,
  id: 'cable-curl',
  name: 'Cable Bicep Curl',
  pattern: 'isolation',
  primaryMuscles: ['biceps'],
  equipment: ['cable'],
  increment: 2.5,
  repRange: [8, 12],
}

const pushup: Exercise = {
  id: 'incline-pushup',
  name: 'Incline Pushup',
  aliases: [],
  pattern: 'horizontal_push',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  equipment: ['bodyweight'],
  unit: 'reps',
  increment: 0,
  repRange: [10, 20],
  progressionLadder: ['incline-pushup', 'pushup', 'diamond-pushup'],
  usesBodyweight: true,
  bodyweightFactor: 0.64,
}

const diamond: Exercise = {
  ...pushup,
  id: 'diamond-pushup',
  name: 'Diamond Pushup',
  repRange: [6, 15],
}

function sets(spec: { weight: number; reps: number; rpe?: number }[]): SetLog[] {
  return spec.map((s, i) => ({
    id: `set-${i}`,
    sessionId: 'session-1',
    exerciseId: 'barbell-squat',
    order: i,
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe,
    isWarmup: false,
    completedAt: 1000 + i,
  }))
}

describe('computeNextTarget with no history', () => {
  it('asks the hunter to calibrate rather than inventing a load', () => {
    const target = computeNextTarget(squat, 3, { lastSets: [] })
    expect(target.kind).toBe('no_history')
    expect(target.weightKg).toBe(0)
    expect(target.repTargets).toEqual([5, 5, 5])
  })

  it('ignores warmup-only history', () => {
    const warmupOnly = sets([{ weight: 40, reps: 5 }]).map((s) => ({ ...s, isWarmup: true }))
    expect(computeNextTarget(squat, 3, { lastSets: warmupOnly }).kind).toBe('no_history')
  })
})

describe('every set at the top of the range', () => {
  it('adds one increment and resets reps to the bottom', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 8 },
        { weight: 100, reps: 8 },
        { weight: 100, reps: 8 },
      ]),
    })
    expect(target.kind).toBe('increase_load')
    expect(target.weightKg).toBe(105)
    expect(target.repTargets).toEqual([5, 5, 5])
  })

  it('still progresses when RPE is exactly 8', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 8, rpe: 8 },
        { weight: 100, reps: 8, rpe: 8 },
      ]),
    })
    expect(target.kind).toBe('increase_load')
    expect(target.weightKg).toBe(105)
  })

  it('refuses to add load when a set was above RPE 8, and prescribes tempo instead', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 8, rpe: 8 },
        { weight: 100, reps: 8, rpe: 9.5 },
      ]),
    })
    expect(target.kind).toBe('slow_the_tempo')
    expect(target.weightKg).toBe(100)
  })

  it('uses the exercise increment, so an isolation lift moves in 2.5 kg', () => {
    const target = computeNextTarget(curl, 3, {
      lastSets: sets([
        { weight: 20, reps: 12 },
        { weight: 20, reps: 12 },
      ]),
    })
    expect(target.kind).toBe('increase_load')
    expect(target.weightKg).toBe(22.5)
  })
})

describe('a set below the bottom of the range', () => {
  it('cuts load by about 7% when the miss is real', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 5 },
        { weight: 100, reps: 3 },
        { weight: 100, reps: 2 },
      ]),
    })
    expect(target.kind).toBe('reduce_load')
    // 100 * 0.93 = 93, rounded to the nearest 5 kg step = 95
    expect(target.weightKg).toBe(95)
    expect(target.weightKg).toBeLessThan(100)
  })

  it('repeats the session when one set missed by a single rep', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 6 },
        { weight: 100, reps: 5 },
        { weight: 100, reps: 4 },
      ]),
    })
    expect(target.kind).toBe('repeat_session')
    expect(target.weightKg).toBe(100)
  })

  it('always actually reduces the load even when rounding would not', () => {
    const light: Exercise = { ...squat, increment: 20, repRange: [5, 8] }
    const target = computeNextTarget(light, 3, {
      lastSets: sets([
        { weight: 20, reps: 1 },
        { weight: 20, reps: 1 },
      ]),
    })
    expect(target.kind).toBe('reduce_load')
    expect(target.weightKg).toBeLessThan(20)
  })

  it('states the deload factor the brief specifies', () => {
    expect(DELOAD_FACTOR).toBe(0.93)
  })
})

describe('inside the range', () => {
  it('holds the load and adds a rep to the lowest set only', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 7 },
        { weight: 100, reps: 6 },
        { weight: 100, reps: 6 },
      ]),
    })
    expect(target.kind).toBe('hold_add_rep')
    expect(target.weightKg).toBe(100)
    // Only the first of the two joint-lowest sets gains the rep.
    expect(target.repTargets).toEqual([7, 7, 6])
  })

  it('does not push a rep target past the top of the range', () => {
    const target = computeNextTarget(squat, 3, {
      lastSets: sets([
        { weight: 100, reps: 8 },
        { weight: 100, reps: 7 },
      ]),
    })
    expect(target.repTargets).toEqual([8, 8])
  })
})

describe('increment softening past 40', () => {
  it('halves a 5 kg step for an older lifter', () => {
    expect(effectiveIncrement(squat, 45)).toBe(2.5)
  })

  it('leaves the step alone for a younger lifter', () => {
    expect(effectiveIncrement(squat, 30)).toBe(5)
  })

  it('does not soften below the smallest plate a gym has', () => {
    const tiny: Exercise = { ...curl, increment: 1.25 }
    expect(effectiveIncrement(tiny, 55)).toBe(1.25)
  })

  it('applies the softened step to the actual prescription', () => {
    const target = computeNextTarget(squat, 3, {
      age: 45,
      lastSets: sets([
        { weight: 100, reps: 8 },
        { weight: 100, reps: 8 },
      ]),
    })
    expect(target.weightKg).toBe(102.5)
  })
})

describe('bodyweight ladder', () => {
  it('adds external load when the hunter has something to hang off themselves', () => {
    const target = computeNextTarget(pushup, 3, {
      equipmentAccess: ['bodyweight', 'dumbbell'],
      lastSets: sets([
        { weight: 0, reps: 20 },
        { weight: 0, reps: 20 },
      ]),
    })
    expect(target.kind).toBe('add_external_load')
    expect(target.weightKg).toBe(2.5)
  })

  it('advances to a harder variation when there is no load available', () => {
    const target = computeNextTarget(pushup, 3, {
      equipmentAccess: ['bodyweight'],
      resolveExercise: (id) => (id === 'pushup' ? { ...pushup, id: 'pushup', name: 'Pushup' } : undefined),
      lastSets: sets([
        { weight: 0, reps: 20 },
        { weight: 0, reps: 20 },
      ]),
    })
    expect(target.kind).toBe('advance_variation')
    expect(target.nextExerciseId).toBe('pushup')
  })

  it('keeps extending reps at the top of the ladder', () => {
    const target = computeNextTarget(diamond, 3, {
      equipmentAccess: ['bodyweight'],
      lastSets: sets([
        { weight: 0, reps: 15 },
        { weight: 0, reps: 15 },
      ]),
    })
    expect(target.kind).toBe('hold_add_rep')
    expect(target.repTargets[0]).toBeGreaterThan(15)
  })

  it('adds reps normally while still inside the range', () => {
    const target = computeNextTarget(pushup, 3, {
      equipmentAccess: ['bodyweight'],
      lastSets: sets([
        { weight: 0, reps: 14 },
        { weight: 0, reps: 12 },
      ]),
    })
    expect(target.kind).toBe('hold_add_rep')
    expect(target.repTargets).toEqual([14, 13])
  })
})

describe('computeSessionTargets', () => {
  it('produces one target per exercise in the routine', () => {
    const targets = computeSessionTargets(
      [
        { exercise: squat, plannedSets: 3 },
        { exercise: curl, plannedSets: 3 },
      ],
      (id) => (id === 'barbell-squat' ? sets([{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }]) : []),
    )
    expect(targets).toHaveLength(2)
    expect(targets[0]!.kind).toBe('increase_load')
    expect(targets[1]!.kind).toBe('no_history')
  })
})

describe('block rep-range override (G2)', () => {
  it('uses the override range instead of the exercise default when supplied', () => {
    // Squat's own range is [5, 8]; the block asks for a 10-15 rep block instead.
    const target = computeNextTarget(squat, 3, {
      repRangeOverride: [10, 15],
      lastSets: sets([{ weight: 100, reps: 8 }]),
    })
    // 8 reps is below the overridden floor of 10, so it reads as a real miss —
    // proof the override, not the exercise's [5, 8], drove the decision.
    expect(target.kind).toBe('reduce_load')
  })

  it('falls back to the exercise range when no override is given', () => {
    const target = computeNextTarget(squat, 3, { lastSets: sets([{ weight: 100, reps: 8 }]) })
    expect(target.kind).toBe('increase_load')
  })

  it('threads the override through computeSessionTargets per exercise', () => {
    const targets = computeSessionTargets(
      [
        { exercise: squat, plannedSets: 3, repRangeOverride: [10, 15] },
        { exercise: curl, plannedSets: 3 },
      ],
      (id) =>
        id === 'barbell-squat' ? sets([{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }]) : [],
    )
    expect(targets[0]!.kind).toBe('reduce_load')
    expect(targets[1]!.kind).toBe('no_history')
  })
})
