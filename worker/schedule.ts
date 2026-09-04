/**
 * When the daily push is due.
 *
 * Kept separate from `push.ts` so it can be tested without pulling in the
 * Cloudflare bindings or the web-push library. It is pure arithmetic over an
 * instant and a timezone offset, which is exactly the sort of thing that
 * deserves tests and exactly the sort of thing that is painful to test through
 * a network client.
 */
import { MIN_HOURS_BETWEEN_SENDS } from './limits'

/** How wide a window counts as "now" for a subscription's chosen minute. */
export const WINDOW_MINUTES = 8

/** Minutes past local midnight, given a UTC instant and an offset ahead of UTC. */
export function localMinuteOfDay(nowMs: number, tzOffsetMinutes: number): number {
  const utcMinutes = Math.floor(nowMs / 60_000)
  return (((utcMinutes + tzOffsetMinutes) % 1440) + 1440) % 1440
}

export interface DueCandidate {
  notify_minute: number
  tz_offset_min: number
  last_sent_at: number | null
}

/**
 * Whether a subscription's chosen time falls in this run's window. The distance
 * is measured the short way round the clock, so a time just after midnight is
 * not treated as twenty-three hours away from a run just before it.
 */
export function isDue(nowMs: number, row: DueCandidate): boolean {
  if (row.last_sent_at !== null) {
    const hoursSince = (nowMs - row.last_sent_at) / 3_600_000
    if (hoursSince < MIN_HOURS_BETWEEN_SENDS) return false
  }

  const local = localMinuteOfDay(nowMs, row.tz_offset_min)
  let distance = Math.abs(local - row.notify_minute)
  if (distance > 720) distance = 1440 - distance
  return distance <= WINDOW_MINUTES
}
