import { describe, expect, it } from 'vitest'
import { computeStreak } from './streak'
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
