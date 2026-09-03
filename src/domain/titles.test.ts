import { describe, expect, it } from 'vitest'
import { TITLES, evaluateTitles, titleById } from './titles'
import type { TitleContext } from './titles'

const nothing: TitleContext = {
  longestUnbrokenPushups: 0,
  bodyweightKg: 80,
  bestE1rm: {},
  bestPullupReps: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalSessions: 0,
  totalTonnageKg: 0,
  level: 1,
  distinctShadows: 0,
  gatesCleared: 0,
  redGatesCleared: 0,
  dailyQuestsCompleted: 0,
  towerFloor: 0,
  musclesAtMev: 0,
}

describe('the catalogue', () => {
  it('has unique ids', () => {
    const ids = TITLES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('states a real requirement for every title', () => {
    for (const title of TITLES) {
      expect(title.description.length).toBeGreaterThan(10)
      expect(title.name.length).toBeGreaterThan(0)
    }
  })

  it('awards nothing to a hunter who has done nothing', () => {
    expect(evaluateTitles(nothing, [])).toEqual([])
  })

  it('is findable by id', () => {
    expect(titleById('wolf-assassin')?.name).toBe('Wolf Assassin')
    expect(titleById('nope')).toBeUndefined()
  })
})

describe('the three titles the brief names', () => {
  it('awards Wolf Assassin at one hundred unbroken push-ups and not at ninety-nine', () => {
    expect(evaluateTitles({ ...nothing, longestUnbrokenPushups: 99 }, []).map((t) => t.id)).not.toContain(
      'wolf-assassin',
    )
    expect(evaluateTitles({ ...nothing, longestUnbrokenPushups: 100 }, []).map((t) => t.id)).toContain(
      'wolf-assassin',
    )
  })

  it('awards the double-bodyweight squat at exactly 2x and not at 1.99x', () => {
    const almost = { ...nothing, bodyweightKg: 80, bestE1rm: { 'barbell-squat': 159 } }
    const exactly = { ...nothing, bodyweightKg: 80, bestE1rm: { 'barbell-squat': 160 } }
    expect(evaluateTitles(almost, []).map((t) => t.id)).not.toContain('monarch-of-iron')
    expect(evaluateTitles(exactly, []).map((t) => t.id)).toContain('monarch-of-iron')
  })

  it('awards the streak title at thirty days and not at twenty-nine', () => {
    expect(evaluateTitles({ ...nothing, longestStreak: 29 }, []).map((t) => t.id)).not.toContain('unbroken')
    expect(evaluateTitles({ ...nothing, longestStreak: 30 }, []).map((t) => t.id)).toContain('unbroken')
  })
})

describe('evaluateTitles', () => {
  it('never re-awards a title already held', () => {
    const ctx = { ...nothing, longestUnbrokenPushups: 150 }
    const first = evaluateTitles(ctx, [])
    expect(first.map((t) => t.id)).toContain('wolf-assassin')
    const second = evaluateTitles(ctx, first.map((t) => t.id))
    expect(second.map((t) => t.id)).not.toContain('wolf-assassin')
  })

  it('can award several at once', () => {
    const strong: TitleContext = {
      ...nothing,
      level: 50,
      totalSessions: 100,
      longestStreak: 90,
      bestPullupReps: 10,
    }
    expect(evaluateTitles(strong, []).length).toBeGreaterThan(3)
  })

  it('does not divide by zero for a hunter with no bodyweight recorded', () => {
    expect(() => evaluateTitles({ ...nothing, bodyweightKg: 0 }, [])).not.toThrow()
  })

  it('is a pure function of its inputs', () => {
    const ctx = { ...nothing, level: 25 }
    expect(evaluateTitles(ctx, [])).toEqual(evaluateTitles(ctx, []))
  })
})
