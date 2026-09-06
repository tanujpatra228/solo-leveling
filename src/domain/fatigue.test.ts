import { describe, expect, it } from 'vitest'
import {
  ACWR_DANGER,
  ACWR_SAFE_HIGH,
  ACWR_SAFE_LOW,
  computeFatigue,
  tonnagePerDay,
  xpMultiplierFor,
} from './fatigue'
import { rollingWindow } from './time'
import type { DayKey, SetLog } from './types'

/** Builds a tonnage-per-day map with the same figure on every day in a window. */
function flatLoad(endKey: DayKey, days: number, perDay: number): Map<DayKey, number> {
  const map = new Map<DayKey, number>()
  for (const day of rollingWindow(endKey, days)) map.set(day, perDay)
  return map
}

describe('the safe band comes from the brief', () => {
  it('is 0.8 to 1.3, with 1.5 as the danger threshold', () => {
    expect(ACWR_SAFE_LOW).toBe(0.8)
    expect(ACWR_SAFE_HIGH).toBe(1.3)
    expect(ACWR_DANGER).toBe(1.5)
  })
})

describe('computeFatigue', () => {
  const today: DayKey = '2026-03-28'

  it('gives an ACWR of 1 for a perfectly steady four weeks', () => {
    const state = computeFatigue(flatLoad(today, 28, 1000), today)
    expect(state.acwr).toBeCloseTo(1, 10)
    expect(state.band).toBe('optimal')
    expect(state.xpMultiplier).toBe(1)
  })

  it('computes the ratio as 7-day tonnage over a quarter of the 28-day tonnage', () => {
    // Acute week doubled: 7 days at 2000, the previous 21 at 1000.
    const map = flatLoad(today, 28, 1000)
    for (const day of rollingWindow(today, 7)) map.set(day, 2000)
    const state = computeFatigue(map, today)
    // acute 14000, chronic total 35000, chronic weekly 8750 -> 1.6
    expect(state.acuteTonnage).toBe(14_000)
    expect(state.chronicWeeklyTonnage).toBe(8750)
    expect(state.acwr).toBeCloseTo(1.6, 10)
  })

  it('issues a Recovery Quest above 1.5 and cuts the multiplier', () => {
    const map = flatLoad(today, 28, 1000)
    for (const day of rollingWindow(today, 7)) map.set(day, 3000)
    const state = computeFatigue(map, today)
    expect(state.acwr!).toBeGreaterThan(ACWR_DANGER)
    expect(state.needsRecoveryQuest).toBe(true)
    expect(state.xpMultiplier).toBeLessThan(1)
  })

  it('does not issue a Recovery Quest inside the safe band', () => {
    const state = computeFatigue(flatLoad(today, 28, 1000), today)
    expect(state.needsRecoveryQuest).toBe(false)
  })

  it('reports no ratio at all with no chronic load, rather than infinity', () => {
    const map = new Map<DayKey, number>()
    map.set(today, 5000)
    // Only one day of history, so the chronic window is that same single day.
    const state = computeFatigue(new Map(), today)
    expect(state.acwr).toBeNull()
    expect(state.band).toBe('insufficient_data')
    expect(state.xpMultiplier).toBe(1)
    expect(map.size).toBe(1)
  })

  it('calls a light week undertrained rather than punishing it', () => {
    const map = flatLoad(today, 28, 1000)
    for (const day of rollingWindow(today, 7)) map.set(day, 200)
    const state = computeFatigue(map, today)
    expect(state.band).toBe('undertrained')
    // Fatigue may only ever cost XP, never pay it.
    expect(state.xpMultiplier).toBe(1)
  })

  it('keeps the gauge inside 0 to 100', () => {
    const map = flatLoad(today, 28, 1000)
    for (const day of rollingWindow(today, 7)) map.set(day, 100_000)
    const state = computeFatigue(map, today)
    expect(state.gauge).toBeLessThanOrEqual(100)
    expect(state.gauge).toBeGreaterThanOrEqual(0)
  })
})

describe('xpMultiplierFor', () => {
  it('never rewards low fatigue with bonus XP', () => {
    expect(xpMultiplierFor('undertrained', 0.4)).toBe(1)
    expect(xpMultiplierFor('optimal', 1)).toBe(1)
  })

  it('steps down as the ratio climbs', () => {
    expect(xpMultiplierFor('elevated', 1.4)).toBe(0.9)
    expect(xpMultiplierFor('danger', 1.8)).toBe(0.75)
    expect(xpMultiplierFor('danger', 2.5)).toBe(0.6)
  })
})

describe('tonnagePerDay', () => {
  function set(sessionId: string, weight: number, reps: number, exerciseId = 'squat'): SetLog {
    return {
      id: `${sessionId}-${weight}-${reps}`,
      sessionId,
      exerciseId,
      order: 0,
      weight,
      reps,
      isWarmup: false,
      completedAt: 0,
    }
  }

  it('sums tonnage into the day each session was credited to', () => {
    const sessions = [
      { id: 's1', dayKey: '2026-03-01' },
      { id: 's2', dayKey: '2026-03-02' },
    ]
    const setsBySession = (id: string) =>
      id === 's1' ? [set('s1', 100, 5)] : [set('s2', 50, 10)]
    const totals = tonnagePerDay(sessions, setsBySession, () => 0)
    expect(totals.get('2026-03-01')).toBe(500)
    expect(totals.get('2026-03-02')).toBe(500)
  })

  it('adds two sessions on the same day together', () => {
    const sessions = [
      { id: 's1', dayKey: '2026-03-01' },
      { id: 's2', dayKey: '2026-03-01' },
    ]
    const totals = tonnagePerDay(sessions, () => [set('s', 100, 5)], () => 0)
    expect(totals.get('2026-03-01')).toBe(1000)
  })

  it('counts bodyweight movements using the session bodyweight and its factor', () => {
    const sessions = [{ id: 's1', dayKey: '2026-03-01', bodyweightKg: 80 }]
    const totals = tonnagePerDay(
      sessions,
      () => [set('s1', 0, 10, 'pullup')],
      (id) => (id === 'pullup' ? 1 : 0),
    )
    expect(totals.get('2026-03-01')).toBe(800)
  })
})
