/**
 * The training calendar: which days a gate was cleared, and the running totals
 * a streak cannot give. The streak counts daily quests and resets when one is
 * missed; this only ever counts what happened, so nothing in it goes down.
 *
 * "Cleared" is the same test the rest of the app applies, read from the
 * projection's per-session summaries: a finished session whose gate rank is not
 * null, meaning at least one working set was logged. A session still in
 * progress is not in those summaries at all (standards rule 15), and neither is
 * one that logged only warmups. An Instant Dungeon or a Red Gate counts, since
 * they carry a rank too.
 *
 * Nothing here reads the clock; `today` is passed in.
 */
import { daysBetweenKeys, dayOfWeekForKey, addDaysToKey, weekStartKey } from './time'
import type { DayKey, Rank } from './types'

export interface Elapsed {
  months: number
  weeks: number
  days: number
  /** Whole days from the first cleared gate through today, both ends counted. */
  totalDays: number
}

export interface TrainingLog {
  /** Days with at least one cleared gate. A day with two gates appears once. */
  trainedDayKeys: ReadonlySet<DayKey>
  /** Weekdays that have a routine, 0 being Sunday. Empty when no routines exist yet. */
  scheduledWeekdays: ReadonlySet<number>
  firstDayKey: DayKey | null
  daysTrained: number
  /** Monday-anchored weeks containing at least one cleared gate. */
  weeksTrained: number
  /** Calendar months containing at least one cleared gate. */
  monthsTrained: number
  /** Null until the first gate is cleared. */
  elapsed: Elapsed | null
}

export const EMPTY_TRAINING_LOG: TrainingLog = {
  trainedDayKeys: new Set(),
  scheduledWeekdays: new Set(),
  firstDayKey: null,
  daysTrained: 0,
  weeksTrained: 0,
  monthsTrained: 0,
  elapsed: null,
}

export interface TrainingLogInput {
  /** One entry per finished session, as `projection.sessionSummaries` holds them. */
  sessions: readonly { session: { dayKey: DayKey }; gateRank: Rank | null }[]
  /** `dayOfWeek` of every routine in the programme. */
  routineWeekdays: readonly number[]
  today: DayKey
}

export function buildTrainingLog(input: TrainingLogInput): TrainingLog {
  const trainedDayKeys = new Set<DayKey>()
  for (const summary of input.sessions) {
    if (summary.gateRank !== null) trainedDayKeys.add(summary.session.dayKey)
  }

  const scheduledWeekdays = new Set(input.routineWeekdays)
  if (trainedDayKeys.size === 0) return { ...EMPTY_TRAINING_LOG, scheduledWeekdays }

  // DayKeys are zero-padded YYYY-MM-DD, so plain string order is date order.
  const firstDayKey = [...trainedDayKeys].sort()[0]!
  const weeks = new Set<DayKey>()
  const months = new Set<string>()
  for (const dayKey of trainedDayKeys) {
    weeks.add(weekStartKey(dayKey))
    months.add(monthKeyOf(dayKey))
  }

  return {
    trainedDayKeys,
    scheduledWeekdays,
    firstDayKey,
    daysTrained: trainedDayKeys.size,
    weeksTrained: weeks.size,
    monthsTrained: months.size,
    elapsed: elapsedSince(firstDayKey, input.today),
  }
}

/* ------------------------------------------------------------------ */
/* Elapsed time                                                        */
/* ------------------------------------------------------------------ */

/**
 * How long since the first cleared gate, as whole months, then weeks, then
 * days. The first day counts, so a hunter who started today has trained for one
 * day and Monday through the following Sunday is exactly one week.
 */
export function elapsedSince(firstDayKey: DayKey, today: DayKey): Elapsed {
  const endExclusive = addDaysToKey(today, 1)
  const totalDays = daysBetweenKeys(firstDayKey, endExclusive)
  // A first day after today means the device clock moved backwards. Zero is a
  // wrong answer too, but it is not a negative one on screen.
  if (totalDays <= 0) return { months: 0, weeks: 0, days: 0, totalDays: 0 }

  const [fy, fm] = parseDayKey(firstDayKey)
  const [ty, tm] = parseDayKey(endExclusive)
  let months = (ty - fy) * 12 + (tm - fm)
  while (months > 0 && addMonthsToDayKey(firstDayKey, months) > endExclusive) months -= 1

  const remainder = daysBetweenKeys(addMonthsToDayKey(firstDayKey, months), endExclusive)
  return { months, weeks: Math.floor(remainder / 7), days: remainder % 7, totalDays }
}

/* ------------------------------------------------------------------ */
/* Month arithmetic                                                    */
/* ------------------------------------------------------------------ */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseDayKey(key: DayKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return [y, m, d]
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one. UTC so a
  // daylight-saving shift cannot move it.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** `YYYY-MM` of the month a day belongs to. */
export function monthKeyOf(dayKey: DayKey): string {
  return dayKey.slice(0, 7)
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number) as [number, number]
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

/** Adds calendar months, clamping to the last day of a shorter month: 31 Jan plus one month is 28 Feb. */
export function addMonthsToDayKey(dayKey: DayKey, months: number): DayKey {
  const [y, m, d] = parseDayKey(dayKey)
  const target = shiftMonth(`${y}-${pad(m)}`, months)
  const [ty, tm] = target.split('-').map(Number) as [number, number]
  return `${target}-${pad(Math.min(d, daysInMonth(ty, tm)))}`
}

/** The months the calendar may show: from the first gate's month to the current one. */
export function monthBounds(log: TrainingLog, today: DayKey): { earliest: string; latest: string } {
  const latest = monthKeyOf(today)
  return { earliest: log.firstDayKey ? monthKeyOf(log.firstDayKey) : latest, latest }
}

/* ------------------------------------------------------------------ */
/* The month grid                                                      */
/* ------------------------------------------------------------------ */

export interface CalendarCell {
  /** Null for the padding that squares a month off into whole weeks. */
  dayKey: DayKey | null
  trained: boolean
  /** A gate is normally on this weekday. False is a rest day. */
  scheduled: boolean
  isToday: boolean
  isFuture: boolean
  /** Earlier than the first cleared gate, so nothing could have been missed. */
  beforeStart: boolean
}

const PADDING: CalendarCell = {
  dayKey: null,
  trained: false,
  scheduled: false,
  isToday: false,
  isFuture: false,
  beforeStart: false,
}

/**
 * One month as rows of seven, Monday first, to match the Monday-anchored week
 * the rest of the app uses. A day trained on a rest day is still trained.
 */
export function monthGrid(log: TrainingLog, monthKey: string, today: DayKey): CalendarCell[][] {
  const [year, month] = monthKey.split('-').map(Number) as [number, number]
  const leading = (dayOfWeekForKey(`${monthKey}-01`) + 6) % 7
  // With no routines known there is no schedule to be off, matching isRestDay.
  const knowsSchedule = log.scheduledWeekdays.size > 0

  const cells: CalendarCell[] = Array.from({ length: leading }, () => PADDING)
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const dayKey = `${monthKey}-${pad(day)}`
    cells.push({
      dayKey,
      trained: log.trainedDayKeys.has(dayKey),
      scheduled: !knowsSchedule || log.scheduledWeekdays.has(dayOfWeekForKey(dayKey)),
      isToday: dayKey === today,
      isFuture: dayKey > today,
      beforeStart: log.firstDayKey === null || dayKey < log.firstDayKey,
    })
  }
  while (cells.length % 7 !== 0) cells.push(PADDING)

  const rows: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}
