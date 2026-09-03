/**
 * The training day rolls over at 04:00 local, not midnight, so a session that
 * starts at 22:00 and finishes at 00:30 is one session on one day rather than
 * two half-sessions that both look like failures.
 *
 * Nothing here reads the ambient clock. Callers pass the instant in.
 */
import type { DayKey } from './types'

export const DAY_ROLLOVER_HOUR = 4
export const MS_PER_DAY = 86_400_000

/** Canon: a gate left unslain for seven days suffers a Dungeon Break. */
export const DUNGEON_BREAK_DAYS = 7

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * The training day an instant belongs to. Anything before 04:00 counts as the
 * previous calendar day.
 */
export function toDayKey(at: Date | number): DayKey {
  const date = typeof at === 'number' ? new Date(at) : new Date(at.getTime())
  if (date.getHours() < DAY_ROLLOVER_HOUR) {
    date.setDate(date.getDate() - 1)
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The instant a training day begins, in local time. */
export function dayKeyStart(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, DAY_ROLLOVER_HOUR, 0, 0, 0)
}

export function dayKeyEnd(key: DayKey): Date {
  const start = dayKeyStart(key)
  return new Date(start.getTime() + MS_PER_DAY)
}

export function addDaysToKey(key: DayKey, days: number): DayKey {
  const start = dayKeyStart(key)
  start.setDate(start.getDate() + days)
  return toDayKey(start)
}

/** Whole training days from `from` to `to`. Negative if `to` is earlier. */
export function daysBetweenKeys(from: DayKey, to: DayKey): number {
  const diff = dayKeyStart(to).getTime() - dayKeyStart(from).getTime()
  return Math.round(diff / MS_PER_DAY)
}

/** `dayOfWeek` matching `Date.prototype.getDay`, where 0 is Sunday. */
export function dayOfWeekForKey(key: DayKey): number {
  return dayKeyStart(key).getDay()
}

/**
 * Every training day from `startKey` to `endKey` inclusive, oldest first.
 * Used to walk a rolling window without touching the clock.
 */
export function dayKeyRange(startKey: DayKey, endKey: DayKey): DayKey[] {
  const span = daysBetweenKeys(startKey, endKey)
  if (span < 0) return []
  const keys: DayKey[] = []
  for (let i = 0; i <= span; i += 1) {
    keys.push(addDaysToKey(startKey, i))
  }
  return keys
}

/**
 * The last `days` training days ending at `endKey` inclusive. A 7-day window
 * ending today includes today.
 */
export function rollingWindow(endKey: DayKey, days: number): DayKey[] {
  return dayKeyRange(addDaysToKey(endKey, -(days - 1)), endKey)
}

/** True if `at` falls inside the training day `key`. */
export function isWithinDay(at: number, key: DayKey): boolean {
  return at >= dayKeyStart(key).getTime() && at < dayKeyEnd(key).getTime()
}

/**
 * Monday-anchored ISO-style week key, `YYYY-Www`, for weekly volume landmarks.
 * Weeks are the unit volume is prescribed in, so they need a stable label.
 */
export function toWeekKey(key: DayKey): string {
  const date = dayKeyStart(key)
  // Shift so Monday is day 0, then step back to that Monday.
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  const monday = date

  const thursday = new Date(monday.getTime())
  thursday.setDate(thursday.getDate() + 3)
  const isoYear = thursday.getFullYear()

  const jan1 = new Date(isoYear, 0, 1)
  const jan1Offset = (jan1.getDay() + 6) % 7
  const firstMonday = new Date(isoYear, 0, 1 - jan1Offset)
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * MS_PER_DAY)) + 1

  return `${isoYear}-W${pad(week)}`
}

/** The Monday of the training week containing `key`. */
export function weekStartKey(key: DayKey): DayKey {
  const date = dayKeyStart(key)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return toDayKey(date)
}

/** Age in whole years, used for heart-rate zones and increment softening. */
export function ageFromBirthYear(birthYear: number, at: Date | number): number {
  const date = typeof at === 'number' ? new Date(at) : at
  return date.getFullYear() - birthYear
}
