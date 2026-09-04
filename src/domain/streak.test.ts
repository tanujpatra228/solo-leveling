import { describe, expect, it } from 'vitest'
import { computeStreak } from './streak'
import { addDaysToKey, dayOfWeekForKey } from './time'
import type { QuestLog, QuestStatus } from './types'

function daily(dayKey: string, status: QuestStatus): QuestLog {
  return {
    id: `q-${dayKey}`,
    dayKey,
    type: 'daily',
    status,
    issuedAt: 0,
    expiresAt: null,
    payload: null,
  }
}

describe('today never breaks the streak', () => {
  it('keeps a streak intact while today is still outstanding', () => {
    const quests = [
      daily('2026-03-03', 'complete'),
      daily('2026-03-04', 'complete'),
      daily('2026-03-05', 'complete'),
      daily('2026-03-06', 'issued'),
    ]
    const streak = computeStreak(quests, '2026-03-06')
    expect(streak.current).toBe(3)
    expect(streak.todayPending).toBe(true)
  })

  it('counts today once it is completed', () => {
    const quests = [daily('2026-03-05', 'complete'), daily('2026-03-06', 'complete')]
    const streak = computeStreak(quests, '2026-03-06')
    expect(streak.current).toBe(2)
    expect(streak.todayPending).toBe(false)
  })

  it('breaks only once a day has actually been failed', () => {
    const quests = [
      daily('2026-03-04', 'complete'),
      daily('2026-03-05', 'failed'),
      daily('2026-03-06', 'issued'),
    ]
    expect(computeStreak(quests, '2026-03-06').current).toBe(0)
  })
})

describe('forgiveness holds a streak rather than extending it', () => {
  it('bridges a forgiven day', () => {
    const quests = [
      daily('2026-03-03', 'complete'),
      daily('2026-03-04', 'forgiven'),
      daily('2026-03-05', 'complete'),
      daily('2026-03-06', 'complete'),
    ]
    const streak = computeStreak(quests, '2026-03-06')
    // Two completed days after the forgiven one, plus the one before it.
    expect(streak.current).toBe(3)
    expect(streak.forgivenDays).toContain('2026-03-04')
  })

  it('treats a declared absence as forgiven even with no quest row', () => {
    const quests = [daily('2026-03-03', 'complete'), daily('2026-03-05', 'complete')]
    const streak = computeStreak(quests, '2026-03-05', ['2026-03-04'])
    expect(streak.current).toBe(2)
  })

  it('does not let forgiveness alone build a streak', () => {
    const quests = [daily('2026-03-04', 'forgiven'), daily('2026-03-05', 'forgiven')]
    expect(computeStreak(quests, '2026-03-05').current).toBe(0)
  })
})

describe('the longest streak', () => {
  it('remembers a run that has since been broken', () => {
    const quests = [
      daily('2026-03-01', 'complete'),
      daily('2026-03-02', 'complete'),
      daily('2026-03-03', 'complete'),
      daily('2026-03-04', 'failed'),
      daily('2026-03-05', 'complete'),
    ]
    const streak = computeStreak(quests, '2026-03-05')
    expect(streak.current).toBe(1)
    expect(streak.longest).toBe(3)
  })

  it('is never less than the current streak', () => {
    const quests = [daily('2026-03-05', 'complete'), daily('2026-03-06', 'complete')]
    const streak = computeStreak(quests, '2026-03-06')
    expect(streak.longest).toBeGreaterThanOrEqual(streak.current)
  })

  it('does not join two runs separated by a gap with no records', () => {
    const quests = [
      daily('2026-01-01', 'complete'),
      daily('2026-01-02', 'complete'),
      daily('2026-03-01', 'complete'),
    ]
    expect(computeStreak(quests, '2026-03-01').longest).toBe(2)
  })
})

describe('an empty log', () => {
  it('reports no streak without throwing', () => {
    const streak = computeStreak([], '2026-03-06')
    expect(streak.current).toBe(0)
    expect(streak.longest).toBe(0)
    expect(streak.todayPending).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Rest days                                                           */
/* ------------------------------------------------------------------ */

/** The real training week: Monday to Saturday, nothing on Sunday. */
const sundayIsRest = (day: string) => dayOfWeekForKey(day) === 0

describe('rest days neither extend nor break a streak', () => {
  it('steps over Sunday instead of ending the walk', () => {
    // Mon 2026-08-31 to Sat 2026-09-05, all complete. Sunday 2026-09-06 has no
    // quest at all, because the programme schedules nothing.
    const quests = [
      daily('2026-08-31', 'complete'),
      daily('2026-09-01', 'complete'),
      daily('2026-09-02', 'complete'),
      daily('2026-09-03', 'complete'),
      daily('2026-09-04', 'complete'),
      daily('2026-09-05', 'complete'),
    ]

    // Standing on the rest day itself, the six training days behind it hold.
    const onSunday = computeStreak(quests, '2026-09-06', [], sundayIsRest)
    expect(onSunday.current).toBe(6)
    expect(onSunday.todayIsRest).toBe(true)
    expect(onSunday.todayPending).toBe(false)
  })

  it('carries the streak across a rest day into the next week', () => {
    const quests = [
      daily('2026-09-03', 'complete'),
      daily('2026-09-04', 'complete'),
      daily('2026-09-05', 'complete'),
      // 2026-09-06 is Sunday. No row.
      daily('2026-09-07', 'complete'),
    ]
    const state = computeStreak(quests, '2026-09-07', [], sundayIsRest)
    expect(state.current).toBe(4)
  })

  it('would break without the rest-day predicate, which is the bug it fixes', () => {
    const quests = [
      daily('2026-09-03', 'complete'),
      daily('2026-09-04', 'complete'),
      daily('2026-09-05', 'complete'),
      daily('2026-09-07', 'complete'),
    ]
    // No predicate: the Sunday hole ends the walk at one day.
    expect(computeStreak(quests, '2026-09-07').current).toBe(1)
  })

  it('does not cap the longest streak at the length of the training week', () => {
    // Three full weeks, Monday to Saturday, with every Sunday empty.
    const quests: QuestLog[] = []
    for (let offset = 0; offset < 21; offset += 1) {
      const day = addDaysToKey('2026-08-31', offset)
      if (dayOfWeekForKey(day) === 0) continue
      quests.push(daily(day, 'complete'))
    }

    const state = computeStreak(quests, '2026-09-20', [], sundayIsRest)
    // 18 training days across 21 calendar days, unbroken.
    expect(state.longest).toBe(18)
    // Without the predicate the Sunday holes cap it at one week's worth.
    expect(computeStreak(quests, '2026-09-20').longest).toBe(6)
  })

  it('counts a day the hunter trained anyway, even though it was a rest day', () => {
    const quests = [
      daily('2026-09-05', 'complete'),
      // Trained on Sunday regardless. A completed quest outranks a rest day.
      daily('2026-09-06', 'complete'),
      daily('2026-09-07', 'complete'),
    ]
    const state = computeStreak(quests, '2026-09-07', [], sundayIsRest)
    expect(state.current).toBe(3)
  })

  it('still breaks on a missed training day', () => {
    const quests = [
      daily('2026-09-03', 'complete'),
      daily('2026-09-04', 'failed'),
      daily('2026-09-05', 'complete'),
    ]
    const state = computeStreak(quests, '2026-09-05', [], sundayIsRest)
    expect(state.current).toBe(1)
  })

  it('reports a training day as pending rather than rest', () => {
    const state = computeStreak([], '2026-09-05', [], sundayIsRest)
    expect(state.todayIsRest).toBe(false)
    expect(state.todayPending).toBe(true)
  })
})
