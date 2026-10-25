import { describe, expect, it } from 'vitest'
import {
  addMonthsToDayKey,
  buildTrainingLog,
  elapsedSince,
  monthBounds,
  monthGrid,
  monthKeyOf,
  shiftMonth,
  type TrainingLog,
} from './trainingCalendar'
import type { DayKey, Rank } from './types'

/** A finished session as the projection summarises it. */
function done(dayKey: DayKey, gateRank: Rank | null = 'C') {
  return { session: { dayKey }, gateRank }
}

const MON_TO_SAT = [1, 2, 3, 4, 5, 6]

function logOf(dayKeys: readonly DayKey[], today: DayKey, weekdays = MON_TO_SAT): TrainingLog {
  return buildTrainingLog({ sessions: dayKeys.map((d) => done(d)), routineWeekdays: weekdays, today })
}

describe('buildTrainingLog', () => {
  it('an empty history is all zeros with no first day and no elapsed time', () => {
    const log = buildTrainingLog({ sessions: [], routineWeekdays: MON_TO_SAT, today: '2026-10-25' })
    expect(log.daysTrained).toBe(0)
    expect(log.weeksTrained).toBe(0)
    expect(log.monthsTrained).toBe(0)
    expect(log.firstDayKey).toBeNull()
    expect(log.elapsed).toBeNull()
    expect(log.trainedDayKeys.size).toBe(0)
  })

  it('counts a day once however many gates were cleared on it', () => {
    const log = buildTrainingLog({
      sessions: [done('2026-09-07'), done('2026-09-07', 'B'), done('2026-09-08')],
      routineWeekdays: MON_TO_SAT,
      today: '2026-09-08',
    })
    expect(log.daysTrained).toBe(2)
  })

  it('does not count a session that logged nothing but warmups (gateRank null)', () => {
    const log = buildTrainingLog({
      sessions: [done('2026-09-07', null), done('2026-09-08')],
      routineWeekdays: MON_TO_SAT,
      today: '2026-09-08',
    })
    expect(log.daysTrained).toBe(1)
    expect(log.trainedDayKeys.has('2026-09-07')).toBe(false)
    expect(log.firstDayKey).toBe('2026-09-08')
  })

  it('counts a day trained on a rest day, and does not treat the week as broken by it', () => {
    // Sunday 2026-09-13 is not a scheduled day, but the hunter trained.
    const log = logOf(['2026-09-12', '2026-09-13'], '2026-09-13')
    expect(log.daysTrained).toBe(2)
    expect(log.trainedDayKeys.has('2026-09-13')).toBe(true)
  })

  it('counts distinct Monday-anchored weeks and calendar months, not days', () => {
    // Mon 7 Sep and Wed 9 Sep share a week; Mon 14 Sep is the next; Sun 27 Sep
    // belongs to the week that began Mon 21 Sep.
    const log = logOf(['2026-09-07', '2026-09-09', '2026-09-14', '2026-09-27'], '2026-09-27')
    expect(log.daysTrained).toBe(4)
    expect(log.weeksTrained).toBe(3)
    expect(log.monthsTrained).toBe(1)
  })

  it('a month with at least one cleared gate counts once, across a month boundary', () => {
    const log = logOf(['2026-09-30', '2026-10-01', '2026-10-02'], '2026-10-02')
    expect(log.monthsTrained).toBe(2)
    // Wed 30 Sep, Thu 1 Oct and Fri 2 Oct are all one week.
    expect(log.weeksTrained).toBe(1)
  })

  it('takes the first day from the earliest cleared gate whatever order the input is in', () => {
    const log = logOf(['2026-09-14', '2026-09-07', '2026-09-09'], '2026-09-14')
    expect(log.firstDayKey).toBe('2026-09-07')
  })

  it('reads the scheduled weekdays from the routines', () => {
    const log = logOf([], '2026-10-25')
    expect([...log.scheduledWeekdays].sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(log.scheduledWeekdays.has(0)).toBe(false)
  })
})

describe('elapsedSince', () => {
  it('counts the first day itself, so a hunter who started today has trained for one day', () => {
    expect(elapsedSince('2026-09-07', '2026-09-07')).toEqual({ months: 0, weeks: 0, days: 1, totalDays: 1 })
  })

  it('Monday to the following Sunday is exactly one week', () => {
    expect(elapsedSince('2026-09-07', '2026-09-13')).toEqual({ months: 0, weeks: 1, days: 0, totalDays: 7 })
  })

  it('splits twelve weeks into whole months, then weeks, then days', () => {
    // Mon 3 Aug to Sun 25 Oct inclusive is 84 days. Two whole months take it
    // to 3 Oct, leaving 23 days: 3 weeks and 2 days.
    expect(elapsedSince('2026-08-03', '2026-10-25')).toEqual({ months: 2, weeks: 3, days: 2, totalDays: 84 })
  })

  it('rolls into a month exactly when the same date comes round again', () => {
    // 15 Dec to 14 Jan inclusive is one month to the day.
    expect(elapsedSince('2025-12-15', '2026-01-14')).toEqual({ months: 1, weeks: 0, days: 0, totalDays: 31 })
  })

  it('a start on the 31st does not overshoot a shorter month', () => {
    // 31 Jan + 1 month clamps to 28 Feb; 28 Feb to 2 Mar (exclusive end) is 2 days.
    expect(elapsedSince('2026-01-31', '2026-03-01')).toEqual({ months: 1, weeks: 0, days: 2, totalDays: 30 })
  })

  it('a first day after today (a clock set back) reads as zero rather than negative', () => {
    expect(elapsedSince('2026-10-30', '2026-10-25')).toEqual({ months: 0, weeks: 0, days: 0, totalDays: 0 })
  })

  it('is attached to the log from the first cleared gate through today', () => {
    const log = logOf(['2026-08-03'], '2026-10-25')
    expect(log.elapsed).toEqual({ months: 2, weeks: 3, days: 2, totalDays: 84 })
  })
})

describe('month arithmetic', () => {
  it('names the month a day belongs to', () => {
    expect(monthKeyOf('2026-10-25')).toBe('2026-10')
  })

  it('steps forward and back across a year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-10', 0)).toBe('2026-10')
  })

  it('adds months by calendar, clamping to the end of a shorter month', () => {
    expect(addMonthsToDayKey('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDayKey('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonthsToDayKey('2026-11-30', 3)).toBe('2027-02-28')
  })

  it('bounds navigation from the month of the first gate to the current month', () => {
    const log = logOf(['2026-08-03'], '2026-10-25')
    expect(monthBounds(log, '2026-10-25')).toEqual({ earliest: '2026-08', latest: '2026-10' })
  })

  it('with no history the only month worth showing is the current one', () => {
    const log = logOf([], '2026-10-25')
    expect(monthBounds(log, '2026-10-25')).toEqual({ earliest: '2026-10', latest: '2026-10' })
  })
})

describe('monthGrid', () => {
  it('lays October 2026 out Monday-first: it opens on a Thursday and ends on a Saturday', () => {
    const log = logOf([], '2026-10-25')
    const grid = monthGrid(log, '2026-10', '2026-10-25')

    expect(grid).toHaveLength(5)
    for (const row of grid) expect(row).toHaveLength(7)

    expect(grid[0]!.map((c) => c.dayKey)).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    // Sat 31 Oct is the sixth column of the last row; Sunday 1 Nov is padding.
    expect(grid[4]![5]!.dayKey).toBe('2026-10-31')
    expect(grid[4]![6]!.dayKey).toBeNull()
    expect(grid.flat().filter((c) => c.dayKey !== null)).toHaveLength(31)
  })

  it('a month that opens on a Sunday puts its first day in the last column', () => {
    const log = logOf([], '2026-02-10')
    const grid = monthGrid(log, '2026-02', '2026-02-10')
    expect(grid[0]!.map((c) => c.dayKey)).toEqual([null, null, null, null, null, null, '2026-02-01'])
    expect(grid).toHaveLength(5)
  })

  it('needs a sixth row when a 31-day month opens on a Sunday', () => {
    const log = logOf([], '2026-03-10')
    expect(monthGrid(log, '2026-03', '2026-03-10')).toHaveLength(6)
  })

  it('marks Sunday as a rest day and Monday to Saturday as scheduled', () => {
    const log = logOf([], '2026-10-25')
    const cells = new Map(
      monthGrid(log, '2026-10', '2026-10-25')
        .flat()
        .filter((c) => c.dayKey !== null)
        .map((c) => [c.dayKey, c]),
    )
    expect(cells.get('2026-10-04')!.scheduled).toBe(false) // Sunday
    expect(cells.get('2026-10-05')!.scheduled).toBe(true) // Monday
    expect(cells.get('2026-10-10')!.scheduled).toBe(true) // Saturday
    expect(cells.get('2026-10-11')!.scheduled).toBe(false) // Sunday
  })

  it('with no routines known, no day is called a rest day', () => {
    const log = logOf([], '2026-10-25', [])
    const sunday = monthGrid(log, '2026-10', '2026-10-25')
      .flat()
      .find((c) => c.dayKey === '2026-10-04')!
    expect(sunday.scheduled).toBe(true)
  })

  it('flags trained, missed-in-effect, rest, today, future and before-start days', () => {
    // First gate Mon 5 Oct. Trained Mon 5, Wed 7 and Sun 11 (a rest day). Today Wed 14.
    const log = logOf(['2026-10-05', '2026-10-07', '2026-10-11'], '2026-10-14')
    const cells = new Map(
      monthGrid(log, '2026-10', '2026-10-14')
        .flat()
        .filter((c) => c.dayKey !== null)
        .map((c) => [c.dayKey, c]),
    )

    // Before the first gate nothing could have been missed.
    expect(cells.get('2026-10-02')!.beforeStart).toBe(true)
    expect(cells.get('2026-10-05')!.beforeStart).toBe(false)

    expect(cells.get('2026-10-05')!.trained).toBe(true)
    // Tue 6 Oct: scheduled, in the past, after the start, not trained.
    const tue = cells.get('2026-10-06')!
    expect([tue.trained, tue.scheduled, tue.isFuture, tue.beforeStart]).toEqual([false, true, false, false])

    // Trained on a Sunday: marked trained although it is a rest day.
    const sun = cells.get('2026-10-11')!
    expect([sun.trained, sun.scheduled]).toEqual([true, false])

    expect(cells.get('2026-10-14')!.isToday).toBe(true)
    expect(cells.get('2026-10-13')!.isToday).toBe(false)

    expect(cells.get('2026-10-15')!.isFuture).toBe(true)
    // A future rest day is both.
    const futureSun = cells.get('2026-10-18')!
    expect([futureSun.isFuture, futureSun.scheduled]).toEqual([true, false])
  })

  it('with no history every day is before the start, so nothing reads as missed', () => {
    const log = logOf([], '2026-10-25')
    const cells = monthGrid(log, '2026-10', '2026-10-25')
      .flat()
      .filter((c) => c.dayKey !== null)
    expect(cells.every((c) => c.beforeStart && !c.trained)).toBe(true)
  })

  it('shows a past month from the same log', () => {
    const log = logOf(['2026-09-07', '2026-10-05'], '2026-10-14')
    const sep = monthGrid(log, '2026-09', '2026-10-14')
      .flat()
      .filter((c) => c.dayKey !== null)
    expect(sep.filter((c) => c.trained).map((c) => c.dayKey)).toEqual(['2026-09-07'])
    expect(sep.every((c) => !c.isFuture)).toBe(true)
  })
})
