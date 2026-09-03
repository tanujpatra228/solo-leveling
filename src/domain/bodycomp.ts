/**
 * Body composition, with no BMI anywhere.
 *
 * BMI is absent as a stored field, as a displayed number, and as an input to
 * anything. It cannot separate muscle from fat, so it calls a lean lifter
 * overweight, which makes it worse than useless here: it would actively mislead
 * the person it describes.
 *
 * What replaces it, in order of how much it is worth:
 *
 *   1. Bodyweight *trend* rather than bodyweight. A daily reading swings a kilo
 *      or two on water, food, and glycogen. The raw number is noise; the slope
 *      is the signal.
 *   2. Waist circumference, which needs no formula at all.
 *   3. The recomposition signal, which is the thing BMI can never show: weight
 *      flat or rising while the waist is flat or shrinking means muscle gained
 *      and fat lost.
 *   4. Body fat percentage, optional and never load-bearing.
 */
import type { BodyFatSource, BodyMetric, Sex } from './types'
import { daysBetweenKeys } from './time'

/* ------------------------------------------------------------------ */
/* Trend                                                               */
/* ------------------------------------------------------------------ */

/**
 * Smoothing factor for a 7-day exponentially weighted moving average,
 * `2 / (N + 1)` with N of 7. Recent readings dominate without a single heavy
 * meal moving the line.
 */
export const EWMA_ALPHA = 2 / 8

export interface TrendPoint {
  dayKey: string
  /** The raw reading. */
  value: number
  /** The smoothed value, which is what gets displayed. */
  smoothed: number
}

export interface Trend {
  points: TrendPoint[]
  /** Change in the smoothed value per week. Positive means rising. */
  slopePerWeek: number
  latestSmoothed: number | null
}

/**
 * Exponentially weighted moving average over readings that are already sorted
 * oldest first. Gaps are left as gaps rather than interpolated, because a week
 * of not weighing yourself is not evidence of anything.
 */
export function ewmaTrend(
  readings: readonly { dayKey: string; value: number }[],
  alpha = EWMA_ALPHA,
): Trend {
  if (readings.length === 0) return { points: [], slopePerWeek: 0, latestSmoothed: null }

  const points: TrendPoint[] = []
  let smoothed = readings[0]!.value

  for (const reading of readings) {
    smoothed = alpha * reading.value + (1 - alpha) * smoothed
    points.push({ dayKey: reading.dayKey, value: reading.value, smoothed })
  }

  return {
    points,
    slopePerWeek: smoothedSlopePerWeek(points),
    latestSmoothed: points[points.length - 1]!.smoothed,
  }
}

/**
 * Least-squares slope of the smoothed series against elapsed days, scaled to a
 * week. A regression rather than an endpoint difference, so one odd final
 * reading cannot flip the reported direction.
 */
export function smoothedSlopePerWeek(points: readonly TrendPoint[]): number {
  if (points.length < 2) return 0

  const originKey = points[0]!.dayKey
  const xs = points.map((p) => daysBetweenKeys(originKey, p.dayKey))
  const ys = points.map((p) => p.smoothed)
  const n = points.length

  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX
    numerator += dx * (ys[i]! - meanY)
    denominator += dx * dx
  }

  if (denominator === 0) return 0
  return (numerator / denominator) * 7
}

/* ------------------------------------------------------------------ */
/* The recomposition signal                                           */
/* ------------------------------------------------------------------ */

/** Below this weekly change the weight trend counts as flat, in kg per week. */
export const WEIGHT_FLAT_THRESHOLD = 0.15
/** Below this weekly change the waist trend counts as flat, in cm per week. */
export const WAIST_FLAT_THRESHOLD = 0.25

export type Direction = 'up' | 'flat' | 'down'

export type RecompVerdict =
  | 'recomposition'
  | 'lean_gain'
  | 'bulk'
  | 'cut'
  | 'lean_mass_warning'
  | 'maintenance'
  | 'insufficient_data'

export interface RecompSignal {
  verdict: RecompVerdict
  weightDirection: Direction
  waistDirection: Direction
  weightSlopePerWeek: number
  waistSlopePerWeek: number
  headline: string
  detail: string
}

function direction(slope: number, threshold: number): Direction {
  if (slope > threshold) return 'up'
  if (slope < -threshold) return 'down'
  return 'flat'
}

/**
 * Reads weight and waist trends together. This needs nothing but a scale and a
 * tape measure, so it works for everyone, and it answers the question a lifter
 * actually has, which BMI cannot touch.
 */
export function recompositionSignal(weightTrend: Trend, waistTrend: Trend): RecompSignal {
  const weightSlope = weightTrend.slopePerWeek
  const waistSlope = waistTrend.slopePerWeek

  if (weightTrend.points.length < 2 || waistTrend.points.length < 2) {
    return {
      verdict: 'insufficient_data',
      weightDirection: direction(weightSlope, WEIGHT_FLAT_THRESHOLD),
      waistDirection: direction(waistSlope, WAIST_FLAT_THRESHOLD),
      weightSlopePerWeek: weightSlope,
      waistSlopePerWeek: waistSlope,
      headline: 'Not enough readings yet',
      detail:
        'Log bodyweight and waist at the same site weekly. Two readings of each is the minimum for a direction, and about four weeks makes it trustworthy.',
    }
  }

  const weightDir = direction(weightSlope, WEIGHT_FLAT_THRESHOLD)
  const waistDir = direction(waistSlope, WAIST_FLAT_THRESHOLD)

  let verdict: RecompVerdict
  let headline: string
  let detail: string

  if (waistDir === 'down' && weightDir !== 'down') {
    verdict = 'recomposition'
    headline = 'Recomposition'
    detail =
      'Weight is holding or rising while the waist shrinks. That is muscle gained and fat lost at the same time, and it is the outcome no scale reading alone can show you.'
  } else if (weightDir === 'up' && waistDir === 'flat') {
    verdict = 'lean_gain'
    headline = 'Lean gain'
    detail = 'Weight is rising with no change at the waist. The added mass is going the right places.'
  } else if (weightDir === 'up' && waistDir === 'up') {
    verdict = 'bulk'
    headline = 'Bulking'
    detail =
      'Weight and waist are both rising. That is a surplus doing what a surplus does. Fine if it is deliberate.'
  } else if (weightDir === 'down' && waistDir === 'down') {
    verdict = 'cut'
    headline = 'Cutting'
    detail = 'Weight and waist are both falling. Fat is coming off. Keep protein and hard sets high to hold muscle.'
  } else if (weightDir === 'down' && waistDir === 'flat') {
    verdict = 'lean_mass_warning'
    headline = 'Warning: weight down, waist unchanged'
    detail =
      'Losing weight with no change at the waist suggests lean mass going out the door rather than fat. Check protein intake and whether training volume has dropped.'
  } else {
    verdict = 'maintenance'
    headline = 'Holding steady'
    detail = 'Neither weight nor waist is moving. Whether that is good depends on what you are trying to do.'
  }

  return {
    verdict,
    weightDirection: weightDir,
    waistDirection: waistDir,
    weightSlopePerWeek: weightSlope,
    waistSlopePerWeek: waistSlope,
    headline,
    detail,
  }
}

/* ------------------------------------------------------------------ */
/* Body fat percentage — optional, tiered, never load-bearing         */
/* ------------------------------------------------------------------ */

/**
 * The Navy estimate, Hodgdon-Beckett 1984. Correlates around r = 0.90 with
 * hydrostatic weighing, with a standard error of roughly 3 to 4 points against
 * DEXA. All measurements in centimetres, which is what we store anyway.
 *
 * Note the waist site genuinely differs by sex: navel level for men, the
 * narrowest part of the abdomen for women. An inconsistent site makes the trend
 * worthless even when each individual reading is fine.
 */
export function navyBodyFat(input: {
  sex: 'male' | 'female'
  waistCm: number
  neckCm: number
  heightCm: number
  hipCm?: number
}): number | null {
  const { sex, waistCm, neckCm, heightCm, hipCm } = input

  if (sex === 'male') {
    const girth = waistCm - neckCm
    if (girth <= 0 || heightCm <= 0) return null
    const value =
      495 / (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) - 450
    return Number.isFinite(value) ? value : null
  }

  if (hipCm === undefined) return null
  const girth = waistCm + hipCm - neckCm
  if (girth <= 0 || heightCm <= 0) return null
  const value =
    495 / (1.29579 - 0.35004 * Math.log10(girth) + 0.22100 * Math.log10(heightCm)) - 450
  return Number.isFinite(value) ? value : null
}

/** How much a body-fat number from a given source can be relied on. */
export type SourceTrust = 'absolute' | 'absolute_with_caveat' | 'trend_only'

export interface SourceProfile {
  trust: SourceTrust
  label: string
  typicalError: string
  caveat?: string
}

export const BODY_FAT_SOURCES: Record<BodyFatSource, SourceProfile> = {
  dexa: { trust: 'absolute', label: 'DEXA scan', typicalError: '±1–2%' },
  hydrostatic: { trust: 'absolute', label: 'Hydrostatic weighing', typicalError: '±2–3%' },
  bodpod: { trust: 'absolute', label: 'BodPod', typicalError: '±2–3%' },
  calipers: {
    trust: 'absolute_with_caveat',
    label: 'Skinfold calipers',
    typicalError: '±3–5%',
    caveat: 'Caliper readings depend heavily on who took them. Keep the same person and the same sites.',
  },
  navy: {
    trust: 'absolute_with_caveat',
    label: 'Navy tape estimate',
    typicalError: '±3–4%',
    caveat: 'A tape estimate, not a measurement. Useful for tracking change, not for a precise number.',
  },
  bia: {
    trust: 'trend_only',
    label: 'BIA or smart scale',
    typicalError: '±5–8%',
    caveat:
      'These move with hydration and can shift three to five points day to day on water alone. Shown as a trend, never as an absolute.',
  },
  other: {
    trust: 'trend_only',
    label: 'Other or unknown',
    typicalError: 'unknown',
    caveat: 'Source unknown, so this is shown as a trend only.',
  },
}

export interface DerivedComposition {
  bodyFatPct: number
  /** Kilograms of fat. Derived, never stored. */
  fatMassKg: number
  /** Kilograms of everything else. Derived, never stored. */
  leanMassKg: number
  source: BodyFatSource
  trust: SourceTrust
  /** True when the value must be presented as a direction, not a number. */
  trendOnly: boolean
  caveat?: string
}

/**
 * Lean and fat mass are recomputed from the log rather than stored, so that
 * correcting a measurement re-derives the history behind it.
 *
 * Nothing in the engine may call this on a required path. Rank, stats, XP, and
 * quest generation all run on total bodyweight and keep running for someone who
 * never enters a body fat number at all.
 */
export function deriveComposition(
  weightKg: number,
  bodyFatPct: number,
  source: BodyFatSource,
): DerivedComposition {
  const profile = BODY_FAT_SOURCES[source]
  const fatMassKg = weightKg * (bodyFatPct / 100)

  return {
    bodyFatPct,
    fatMassKg,
    leanMassKg: weightKg - fatMassKg,
    source,
    trust: profile.trust,
    trendOnly: profile.trust === 'trend_only',
    caveat: profile.caveat,
  }
}

/**
 * The best available body fat reading for a metric row: a stated value if there
 * is one, otherwise the Navy estimate from tape measurements, otherwise nothing.
 *
 * The Navy path needs a sex-specific formula. A hunter who declined to state one
 * and declined to borrow a table gets no estimate, and falls back to weight
 * trend plus waist trend — which is a fully functional path, not a degraded one.
 */
export function bestBodyFat(
  metric: BodyMetric,
  profile: { sex: Sex; heightCm: number; standardsTableOverride?: 'male' | 'female' },
): DerivedComposition | null {
  if (metric.bodyFatPct !== undefined) {
    return deriveComposition(metric.weightKg, metric.bodyFatPct, metric.bodyFatSource ?? 'other')
  }

  const formulaSex =
    profile.sex === 'male' || profile.sex === 'female' ? profile.sex : profile.standardsTableOverride
  if (!formulaSex) return null
  if (metric.waistCm === undefined || metric.neckCm === undefined) return null
  if (formulaSex === 'female' && metric.hipCm === undefined) return null

  const estimate = navyBodyFat({
    sex: formulaSex,
    waistCm: metric.waistCm,
    neckCm: metric.neckCm,
    heightCm: profile.heightCm,
    hipCm: metric.hipCm,
  })
  if (estimate === null) return null

  return deriveComposition(metric.weightKg, estimate, 'navy')
}

/** Every 8 to 12 weeks, matching the Reawakening Test cadence. */
export const REMEASURE_MIN_DAYS = 56
export const REMEASURE_MAX_DAYS = 84

export function remeasureDue(lastMeasuredDayKey: string | null, today: string): boolean {
  if (lastMeasuredDayKey === null) return true
  return daysBetweenKeys(lastMeasuredDayKey, today) >= REMEASURE_MIN_DAYS
}
