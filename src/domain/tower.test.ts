import { describe, expect, it } from 'vitest'
import {
  TOWER_FLOORS,
  describeRequirement,
  floorAt,
  highestClearedFloor,
  isFloorCleared,
  nextUnclearedFloor,
} from './tower'
import type { TowerContext } from './tower'

const beginner: TowerContext = {
  bodyweightKg: 80,
  bestE1rm: {},
  bestReps: {},
  longestStreak: 0,
  bestWeeklySessions: 0,
  consecutiveFullWeeks: 0,
  totalTonnageKg: 0,
  level: 1,
}

const elite: TowerContext = {
  bodyweightKg: 80,
  bestE1rm: {
    'barbell-squat': 80 * 3,
    'incline-barbell-press': 80 * 2,
    'leg-press': 80 * 5,
  },
  bestReps: { 'diamond-pushups': 100, 'pull-ups': 40 },
  longestStreak: 400,
  bestWeeklySessions: 6,
  consecutiveFullWeeks: 60,
  totalTonnageKg: 5_000_000,
  level: 99,
}

describe('the tower has exactly one hundred floors', () => {
  it('is a hundred entries numbered 1 to 100', () => {
    expect(TOWER_FLOORS).toHaveLength(100)
    expect(TOWER_FLOORS[0]!.floor).toBe(1)
    expect(TOWER_FLOORS[99]!.floor).toBe(100)
    TOWER_FLOORS.forEach((floor, i) => expect(floor.floor).toBe(i + 1))
  })

  it('is deterministic, so floor 47 is always the same benchmark', () => {
    expect(floorAt(47)).toEqual(TOWER_FLOORS[46])
    expect(floorAt(47)!.requirement).toEqual(floorAt(47)!.requirement)
  })

  it('has no floor outside the range', () => {
    expect(floorAt(0)).toBeUndefined()
    expect(floorAt(101)).toBeUndefined()
  })

  it('names every floor', () => {
    for (const floor of TOWER_FLOORS) expect(floor.name.length).toBeGreaterThan(0)
  })

  it('marks every tenth floor as a boss and names the last one from canon', () => {
    const bosses = TOWER_FLOORS.filter((f) => f.isBoss)
    expect(bosses).toHaveLength(10)
    expect(TOWER_FLOORS[99]!.isBoss).toBe(true)
    expect(TOWER_FLOORS[99]!.name).toContain('Baran')
  })
})

describe('difficulty and reward rise with depth', () => {
  it('pays more for deeper floors', () => {
    for (let i = 1; i < TOWER_FLOORS.length; i += 1) {
      expect(TOWER_FLOORS[i]!.rewardXp).toBeGreaterThan(0)
    }
    expect(TOWER_FLOORS[99]!.rewardGold).toBeGreaterThan(TOWER_FLOORS[0]!.rewardGold)
    expect(TOWER_FLOORS[99]!.rewardXp).toBeGreaterThan(TOWER_FLOORS[0]!.rewardXp)
  })

  it('pays a boss floor more than the floor before it', () => {
    expect(TOWER_FLOORS[9]!.rewardGold).toBeGreaterThan(TOWER_FLOORS[8]!.rewardGold)
  })

  it('raises each requirement kind monotonically across its own floors', () => {
    const seen = new Map<string, number>()
    for (const floor of TOWER_FLOORS) {
      const req = floor.requirement
      const key =
        req.kind === 'e1rm_bodyweight_ratio' || req.kind === 'reps'
          ? `${req.kind}:${req.exerciseId}`
          : req.kind
      const value =
        req.kind === 'e1rm_bodyweight_ratio'
          ? req.ratio
          : req.kind === 'reps'
            ? req.reps
            : req.kind === 'streak'
              ? req.days
              : req.kind === 'total_tonnage'
                ? req.kg
                : req.kind === 'level'
                  ? req.level
                  : req.sessions * 100 + req.weeks

      const previous = seen.get(key)
      if (previous !== undefined) {
        expect(value, `${key} on floor ${floor.floor}`).toBeGreaterThanOrEqual(previous)
      }
      seen.set(key, value)
    }
  })

  it('makes floor 1 clearable by a beginner in the first week', () => {
    const firstWeek: TowerContext = {
      ...beginner,
      bestE1rm: { 'barbell-squat': 60 },
      level: 2,
    }
    expect(isFloorCleared(TOWER_FLOORS[0]!, firstWeek)).toBe(true)
  })

  it('makes floor 100 elite territory, out of reach of a beginner', () => {
    expect(isFloorCleared(TOWER_FLOORS[99]!, beginner)).toBe(false)
  })
})

describe('clearing floors', () => {
  it('clears nothing for a hunter with no history', () => {
    expect(highestClearedFloor(beginner)).toBe(0)
    expect(nextUnclearedFloor(beginner)!.floor).toBe(1)
  })

  it('clears the whole tower for an elite hunter', () => {
    expect(highestClearedFloor(elite)).toBe(100)
    expect(nextUnclearedFloor(elite)).toBeNull()
  })

  it('does not divide by zero when no bodyweight is recorded', () => {
    const noWeight = { ...elite, bodyweightKg: 0 }
    expect(() => highestClearedFloor(noWeight)).not.toThrow()
  })

  it('requires both the session count and the run of weeks', () => {
    const weekly = TOWER_FLOORS.find((f) => f.requirement.kind === 'weekly_sessions')!
    const req = weekly.requirement
    if (req.kind !== 'weekly_sessions') throw new Error('wrong requirement kind')
    const halfWay: TowerContext = {
      ...beginner,
      bestWeeklySessions: req.sessions,
      consecutiveFullWeeks: 0,
    }
    expect(isFloorCleared(weekly, halfWay)).toBe(false)
  })
})

describe('describeRequirement', () => {
  it('states a strength requirement in kilograms as well as a ratio', () => {
    const text = describeRequirement(
      { kind: 'e1rm_bodyweight_ratio', exerciseId: 'barbell-squat', exerciseName: 'Barbell Squat', ratio: 2 },
      80,
    )
    expect(text).toContain('2x bodyweight')
    expect(text).toContain('160 kg')
  })

  it('describes every requirement kind in the tower without leaving a blank', () => {
    for (const floor of TOWER_FLOORS) {
      expect(describeRequirement(floor.requirement, 80).length).toBeGreaterThan(5)
    }
  })
})
