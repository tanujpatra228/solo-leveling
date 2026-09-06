/**
 * Fatigue, from the acute-to-chronic workload ratio.
 *
 *   ACWR = 7-day tonnage / (28-day tonnage / 4)
 *
 * The denominator is the average week across the last four, so the ratio asks
 * "is this week heavier than I have been training?" rather than comparing
 * against an absolute. The 0.8 to 1.3 band is the one associated with lower
 * injury risk in the workload-monitoring literature; above 1.5 is the spike
 * that gets people hurt.
 *
 * High fatigue does two things in this app: it cuts the XP multiplier, so
 * grinding yourself into the ground is not the fastest way to level, and it
 * makes the System issue a Recovery Quest.
 */
import { tonnage } from './e1rm'
import type { DayKey, SetLog } from './types'
import { daysBetweenKeys, rollingWindow } from './time'

export const ACWR_SAFE_LOW = 0.8
export const ACWR_SAFE_HIGH = 1.3
/** Above this the System intervenes rather than merely warning. */
export const ACWR_DANGER = 1.5

export const ACUTE_WINDOW_DAYS = 7
export const CHRONIC_WINDOW_DAYS = 28

export type FatigueBand = 'insufficient_data' | 'detraining' | 'undertrained' | 'optimal' | 'elevated' | 'danger'

export interface FatigueState {
  /** Null until there is enough history for the ratio to mean anything. */
  acwr: number | null
  acuteTonnage: number
  chronicWeeklyTonnage: number
  band: FatigueBand
  /** Multiplies earned XP. Never above 1, so fatigue can only cost. */
  xpMultiplier: number
  /** 0 to 100, for the status window gauge. */
  gauge: number
  needsRecoveryQuest: boolean
  message: string
}

export interface TonnageByDay {
  /** Tonnage credited to each training day. Days with no work may be absent. */
  get(dayKey: DayKey): number | undefined
}

/**
 * Sums tonnage into a day-keyed map once, so the acute and chronic windows do
 * not each re-walk the whole set log.
 */
export function tonnagePerDay(
  sessions: readonly { id: string; dayKey: DayKey; bodyweightKg?: number }[],
  setsBySession: (sessionId: string) => readonly SetLog[],
  bodyweightFactor: (exerciseId: string) => number,
): Map<DayKey, number> {
  const totals = new Map<DayKey, number>()
  for (const session of sessions) {
    const sets = setsBySession(session.id)
    const total = tonnage(sets, { bodyweightKg: session.bodyweightKg, bodyweightFactor })
    totals.set(session.dayKey, (totals.get(session.dayKey) ?? 0) + total)
  }
  return totals
}

function sumWindow(totals: Map<DayKey, number>, days: readonly DayKey[]): number {
  let sum = 0
  for (const day of days) sum += totals.get(day) ?? 0
  return sum
}

function bandFor(acwr: number | null): FatigueBand {
  if (acwr === null) return 'insufficient_data'
  if (acwr > ACWR_DANGER) return 'danger'
  if (acwr > ACWR_SAFE_HIGH) return 'elevated'
  if (acwr >= ACWR_SAFE_LOW) return 'optimal'
  if (acwr > 0) return 'undertrained'
  return 'detraining'
}

/**
 * Fatigue only ever reduces XP. Rewarding a low ratio would pay people for
 * training less, which is the opposite of the point.
 */
export function xpMultiplierFor(band: FatigueBand, acwr: number | null): number {
  switch (band) {
    case 'danger':
      return acwr !== null && acwr > 2 ? 0.6 : 0.75
    case 'elevated':
      return 0.9
    default:
      return 1
  }
}

function gaugeFor(acwr: number | null): number {
  if (acwr === null) return 0
  // 0 maps to an empty gauge, the top of the safe band to 65, and 2.0 upward to full.
  const scaled = (acwr / 2) * 100
  return Math.max(0, Math.min(100, Math.round(scaled)))
}

function messageFor(band: FatigueBand, acwr: number | null): string {
  const value = acwr === null ? '' : acwr.toFixed(2)
  switch (band) {
    case 'insufficient_data':
      return 'Not enough history to read your workload. The System needs about four weeks.'
    case 'detraining':
      return 'No recent work logged. Conditioning is decaying.'
    case 'undertrained':
      return `Workload ratio ${value}. Below your recent average — there is room to add work.`
    case 'optimal':
      return `Workload ratio ${value}. Inside the safe band.`
    case 'elevated':
      return `Workload ratio ${value}. Climbing faster than you have adapted to. Hold volume steady.`
    case 'danger':
      return `Workload ratio ${value}. This is a spike. The System is issuing a Recovery Quest.`
  }
}

/**
 * The fatigue reading as of `today`. `today` is passed in rather than read from
 * the clock so this stays a pure function.
 *
 * `trainingStartDayKey` gates the ratio on actual history, not just a
 * non-zero denominator: in week one, the 28-day chronic window contains only
 * week one, so chronic ≈ acute / 4 and the ratio sits near 4.0 — past the
 * danger threshold for a perfectly normal first week. `null`, or fewer than
 * four weeks between it and `today`, holds the reading at `insufficient_data`
 * instead (F3).
 */
export function computeFatigue(
  tonnageByDay: Map<DayKey, number>,
  today: DayKey,
  trainingStartDayKey: DayKey | null,
): FatigueState {
  const acute = sumWindow(tonnageByDay, rollingWindow(today, ACUTE_WINDOW_DAYS))
  const chronicTotal = sumWindow(tonnageByDay, rollingWindow(today, CHRONIC_WINDOW_DAYS))
  const chronicWeekly = chronicTotal / 4

  const chronicWindowComplete =
    trainingStartDayKey !== null && daysBetweenKeys(trainingStartDayKey, today) >= CHRONIC_WINDOW_DAYS - 1

  // With no chronic load, or with less than four weeks of training behind
  // today, the ratio is either undefined or not yet meaningful.
  const acwr = chronicWeekly > 0 && chronicWindowComplete ? acute / chronicWeekly : null
  const band = bandFor(acwr)

  return {
    acwr,
    acuteTonnage: acute,
    chronicWeeklyTonnage: chronicWeekly,
    band,
    xpMultiplier: xpMultiplierFor(band, acwr),
    gauge: gaugeFor(acwr),
    needsRecoveryQuest: band === 'danger',
    message: messageFor(band, acwr),
  }
}
