import { describe, expect, it } from 'vitest'
import {
  DAY_ROLLOVER_HOUR,
  DUNGEON_BREAK_DAYS,
  addDaysToKey,
  ageFromBirthYear,
  dayFractionRemainingPct,
  dayKeyRange,
  dayOfWeekForKey,
  daysBetweenKeys,
  deadlineRingTone,
  isWithinDay,
  rollingWindow,
  toDayKey,
  toWeekKey,
  weekStartKey,
} from './time'

describe('the 04:00 rollover', () => {
  it('rolls over at 04:00, not midnight', () => {
    expect(DAY_ROLLOVER_HOUR).toBe(4)
  })

  it('credits a session finishing at 00:30 to the previous day', () => {
    // Saturday 7 March 2026 at 00:30 belongs to Friday 6 March.
    expect(toDayKey(new Date(2026, 2, 7, 0, 30))).toBe('2026-03-06')
  })

  it('credits 03:59 to the previous day and 04:00 to the new one', () => {
    expect(toDayKey(new Date(2026, 2, 7, 3, 59))).toBe('2026-03-06')
    expect(toDayKey(new Date(2026, 2, 7, 4, 0))).toBe('2026-03-07')
  })

  it('keeps an ordinary evening session on its own day', () => {
    expect(toDayKey(new Date(2026, 2, 6, 22, 0))).toBe('2026-03-06')
  })

  it('does not split a late session across two days', () => {
    const start = new Date(2026, 2, 6, 22, 30)
    const end = new Date(2026, 2, 7, 0, 15)
    expect(toDayKey(start)).toBe(toDayKey(end))
  })
})

describe('day arithmetic', () => {
  it('adds and subtracts days', () => {
    expect(addDaysToKey('2026-03-06', 1)).toBe('2026-03-07')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('crosses a month boundary', () => {
    expect(addDaysToKey('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('crosses a year boundary', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysToKey('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('counts days between keys, signed', () => {
    expect(daysBetweenKeys('2026-03-01', '2026-03-08')).toBe(7)
    expect(daysBetweenKeys('2026-03-08', '2026-03-01')).toBe(-7)
    expect(daysBetweenKeys('2026-03-01', '2026-03-01')).toBe(0)
  })

  it('reports the weekday', () => {
    // 6 March 2026 is a Friday.
    expect(dayOfWeekForKey('2026-03-06')).toBe(5)
  })
})

describe('windows', () => {
  it('builds an inclusive range', () => {
    expect(dayKeyRange('2026-03-01', '2026-03-03')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ])
  })

  it('returns nothing for a backwards range', () => {
    expect(dayKeyRange('2026-03-03', '2026-03-01')).toEqual([])
  })

  it('makes a 7-day rolling window include today', () => {
    const window = rollingWindow('2026-03-07', 7)
    expect(window).toHaveLength(7)
    expect(window[0]).toBe('2026-03-01')
    expect(window[6]).toBe('2026-03-07')
  })

  it('makes a 28-day window 28 days long', () => {
    expect(rollingWindow('2026-03-28', 28)).toHaveLength(28)
  })
})

describe('isWithinDay', () => {
  it('includes 04:00 on the day and excludes 04:00 the next', () => {
    expect(isWithinDay(new Date(2026, 2, 6, 4, 0).getTime(), '2026-03-06')).toBe(true)
    expect(isWithinDay(new Date(2026, 2, 7, 3, 59).getTime(), '2026-03-06')).toBe(true)
    expect(isWithinDay(new Date(2026, 2, 7, 4, 0).getTime(), '2026-03-06')).toBe(false)
  })
})

describe('weeks', () => {
  it('anchors the week on Monday', () => {
    // 6 March 2026 is a Friday; its week starts Monday 2 March.
    expect(weekStartKey('2026-03-06')).toBe('2026-03-02')
    expect(weekStartKey('2026-03-02')).toBe('2026-03-02')
  })

  it('puts Sunday in the week that began the previous Monday', () => {
    // 8 March 2026 is a Sunday.
    expect(weekStartKey('2026-03-08')).toBe('2026-03-02')
  })

  it('gives every day of one week the same week key', () => {
    const keys = dayKeyRange('2026-03-02', '2026-03-08').map(toWeekKey)
    expect(new Set(keys).size).toBe(1)
  })

  it('changes the week key across a Monday boundary', () => {
    expect(toWeekKey('2026-03-08')).not.toBe(toWeekKey('2026-03-09'))
  })
})

describe('dayFractionRemainingPct', () => {
  it('is 100 right at the rollover', () => {
    expect(dayFractionRemainingPct('2026-03-06', new Date(2026, 2, 6, 4, 0).getTime())).toBe(100)
  })

  it('is 0 right at the next rollover', () => {
    expect(dayFractionRemainingPct('2026-03-06', new Date(2026, 2, 7, 4, 0).getTime())).toBe(0)
  })

  it('is half at the midpoint', () => {
    expect(dayFractionRemainingPct('2026-03-06', new Date(2026, 2, 6, 16, 0).getTime())).toBeCloseTo(50)
  })

  it('clamps rather than going negative or over 100 outside the day', () => {
    expect(dayFractionRemainingPct('2026-03-06', new Date(2026, 2, 8, 0, 0).getTime())).toBe(0)
    expect(dayFractionRemainingPct('2026-03-06', new Date(2026, 2, 6, 0, 0).getTime())).toBe(100)
  })
})

describe('deadlineRingTone', () => {
  it('is system fresh at rollover', () => {
    expect(deadlineRingTone('2026-03-06', new Date(2026, 2, 6, 4, 0).getTime())).toBe('system')
  })

  it('turns warn exactly two hours before the rollover', () => {
    expect(deadlineRingTone('2026-03-06', new Date(2026, 2, 7, 2, 0).getTime())).toBe('warn')
  })

  it('stays system one minute outside the two-hour line', () => {
    expect(deadlineRingTone('2026-03-06', new Date(2026, 2, 7, 1, 59).getTime())).toBe('system')
  })
})

describe('canon constants', () => {
  it('uses the canon seven days for a Dungeon Break', () => {
    expect(DUNGEON_BREAK_DAYS).toBe(7)
  })
})

describe('ageFromBirthYear', () => {
  it('is the year difference', () => {
    expect(ageFromBirthYear(1990, new Date(2026, 0, 1))).toBe(36)
  })
})
