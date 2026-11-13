/**
 * The latest value of each body measurement the hunter has logged, so the app
 * can answer "what did I last record, and when".
 *
 * A measurement is read on its own rather than from the newest entry as a
 * whole, because the Reawakening Test lets waist, neck and hip be skipped. If a
 * later entry leaves the neck blank, the last neck reading is still the older
 * one, and it keeps its own date.
 */
import type { BodyFatSource, BodyMetric, DayKey } from './types'

export type MeasurementKey = 'weightKg' | 'waistCm' | 'neckCm' | 'hipCm' | 'bodyFatPct'

export const MEASUREMENT_KEYS: readonly MeasurementKey[] = ['weightKg', 'waistCm', 'neckCm', 'hipCm', 'bodyFatPct']

export interface MeasurementReading {
  value: number
  dayKey: DayKey
  /** The reading of the same measurement just before this one, if there was one. */
  previous: { value: number; dayKey: DayKey } | null
  /** Where a body-fat number came from. Only set for `bodyFatPct`. */
  source?: BodyFatSource
}

export type LatestMeasurements = Record<MeasurementKey, MeasurementReading | null>

export function latestMeasurements(metrics: readonly BodyMetric[]): LatestMeasurements {
  // Newest first. The id breaks a tie so the answer never depends on input order.
  const newestFirst = [...metrics].sort((a, b) => b.recordedAt - a.recordedAt || b.id.localeCompare(a.id))

  const result = {} as LatestMeasurements
  for (const key of MEASUREMENT_KEYS) {
    const rows = newestFirst.filter((row) => row[key] !== undefined)
    const latest = rows[0]
    if (!latest) {
      result[key] = null
      continue
    }
    const before = rows[1]
    result[key] = {
      value: latest[key]!,
      dayKey: latest.dayKey,
      previous: before ? { value: before[key]!, dayKey: before.dayKey } : null,
      ...(key === 'bodyFatPct' && latest.bodyFatSource ? { source: latest.bodyFatSource } : {}),
    }
  }
  return result
}
