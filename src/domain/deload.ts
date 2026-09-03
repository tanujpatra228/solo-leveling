/**
 * Deload detection.
 *
 * Three independent triggers, from the brief: every fifth week, whenever ACWR
 * exceeds 1.5, or after two sessions of estimated-max regression. Any one of
 * them is enough, because they catch different things — the calendar one catches
 * accumulated fatigue you have not noticed, the ratio one catches a spike, and
 * the regression one catches the case where you are already going backwards.
 */
import { ACWR_DANGER } from './fatigue'
import type { DayKey } from './types'
import { daysBetweenKeys } from './time'

/** A deload week every fifth week of training. */
export const DELOAD_WEEK_INTERVAL = 5

/** Two consecutive sessions going backwards is a trend, one is a bad day. */
export const REGRESSION_SESSIONS = 2

export type DeloadTrigger = 'scheduled' | 'workload_spike' | 'e1rm_regression'

export interface DeloadVerdict {
  due: boolean
  triggers: DeloadTrigger[]
  /** Weeks of training since the last deload, or since training started. */
  weeksSinceDeload: number
  headline: string
  detail: string
  /** What the deload week should look like. */
  prescription: string
}

export interface DeloadInput {
  today: DayKey
  /** Last completed deload, or null if there has never been one. */
  lastDeloadDayKey: DayKey | null
  /** When training started, used when there has never been a deload. */
  trainingStartDayKey: DayKey | null
  /** Current acute-to-chronic workload ratio, or null with too little history. */
  acwr: number | null
  /**
   * Best estimated max per session for one exercise, oldest first. A regression
   * is counted when the most recent entries each fall below the one before.
   */
  recentE1rmBySession: readonly number[]
}

/**
 * True when the last `REGRESSION_SESSIONS` sessions each came in below the one
 * before them. Requires one extra data point to compare against, so three
 * sessions are needed to detect two steps down.
 */
export function hasE1rmRegression(series: readonly number[]): boolean {
  if (series.length < REGRESSION_SESSIONS + 1) return false
  const tail = series.slice(-(REGRESSION_SESSIONS + 1))
  for (let i = 1; i < tail.length; i += 1) {
    if (tail[i]! >= tail[i - 1]!) return false
  }
  return true
}

export function checkDeload(input: DeloadInput): DeloadVerdict {
  const anchor = input.lastDeloadDayKey ?? input.trainingStartDayKey
  const weeksSince = anchor ? Math.floor(daysBetweenKeys(anchor, input.today) / 7) : 0

  const triggers: DeloadTrigger[] = []
  if (anchor !== null && weeksSince >= DELOAD_WEEK_INTERVAL) triggers.push('scheduled')
  if (input.acwr !== null && input.acwr > ACWR_DANGER) triggers.push('workload_spike')
  if (hasE1rmRegression(input.recentE1rmBySession)) triggers.push('e1rm_regression')

  const detailParts: string[] = []
  if (triggers.includes('scheduled')) {
    detailParts.push(`${weeksSince} weeks since the last deload.`)
  }
  if (triggers.includes('workload_spike')) {
    detailParts.push(`Workload ratio is ${input.acwr!.toFixed(2)}, past the ${ACWR_DANGER} spike threshold.`)
  }
  if (triggers.includes('e1rm_regression')) {
    detailParts.push('Estimated max has fallen two sessions running.')
  }

  return {
    due: triggers.length > 0,
    triggers,
    weeksSinceDeload: weeksSince,
    headline: triggers.length > 0 ? 'A deload is due' : 'No deload needed',
    detail:
      detailParts.length > 0
        ? detailParts.join(' ')
        : 'Workload, progress, and the calendar all look fine. Keep going.',
    prescription:
      'Keep every exercise and every set count. Cut the load to about 60% of what you have been using and stop each set well short of failure. The point is to keep the movement pattern while letting fatigue drain.',
  }
}
