import { describe, expect, it } from 'vitest'
import { isDue, localMinuteOfDay } from './schedule'

/** 2026-03-06T06:00:00Z */
const SIX_AM_UTC = Date.UTC(2026, 2, 6, 6, 0, 0)

describe('localMinuteOfDay', () => {
  it('is the UTC minute when there is no offset', () => {
    expect(localMinuteOfDay(SIX_AM_UTC, 0)).toBe(6 * 60)
  })

  it('applies a positive offset, such as India at UTC+5:30', () => {
    expect(localMinuteOfDay(SIX_AM_UTC, 330)).toBe(11 * 60 + 30)
  })

  it('applies a negative offset', () => {
    expect(localMinuteOfDay(SIX_AM_UTC, -300)).toBe(60)
  })

  it('wraps around midnight rather than going negative', () => {
    const oneAmUtc = Date.UTC(2026, 2, 6, 1, 0, 0)
    expect(localMinuteOfDay(oneAmUtc, -300)).toBe(20 * 60)
  })
})

describe('isDue', () => {
  const base = { notify_minute: 8 * 60, tz_offset_min: 330, last_sent_at: null }

  it('fires when the local time matches the chosen minute', () => {
    // 02:30 UTC is 08:00 in UTC+5:30.
    expect(isDue(Date.UTC(2026, 2, 6, 2, 30), base)).toBe(true)
  })

  it('fires within the window either side', () => {
    expect(isDue(Date.UTC(2026, 2, 6, 2, 25), base)).toBe(true)
    expect(isDue(Date.UTC(2026, 2, 6, 2, 35), base)).toBe(true)
  })

  it('does not fire outside the window', () => {
    expect(isDue(Date.UTC(2026, 2, 6, 3, 30), base)).toBe(false)
    expect(isDue(Date.UTC(2026, 2, 6, 14, 0), base)).toBe(false)
  })

  it('does not fire twice in one day', () => {
    const justSent = { ...base, last_sent_at: Date.UTC(2026, 2, 6, 2, 30) }
    expect(isDue(Date.UTC(2026, 2, 6, 2, 32), justSent)).toBe(false)
  })

  it('fires again the next day', () => {
    const sentYesterday = { ...base, last_sent_at: Date.UTC(2026, 2, 5, 2, 30) }
    expect(isDue(Date.UTC(2026, 2, 6, 2, 30), sentYesterday)).toBe(true)
  })

  it('handles a chosen time near midnight without the window breaking', () => {
    const nearMidnight = { notify_minute: 5, tz_offset_min: 0, last_sent_at: null }
    expect(isDue(Date.UTC(2026, 2, 6, 0, 3), nearMidnight)).toBe(true)
    // 23:59 the previous day is six minutes before 00:05, so still inside it.
    expect(isDue(Date.UTC(2026, 2, 5, 23, 59), nearMidnight)).toBe(true)
    expect(isDue(Date.UTC(2026, 2, 6, 12, 0), nearMidnight)).toBe(false)
  })
})
