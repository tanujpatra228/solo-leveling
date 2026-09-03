import { describe, expect, it } from 'vitest'
import {
  BODY_FAT_SOURCES,
  bestBodyFat,
  deriveComposition,
  ewmaTrend,
  navyBodyFat,
  recompositionSignal,
  remeasureDue,
} from './bodycomp'
import type { BodyMetric } from './types'

function series(values: number[], startDay = 1): { dayKey: string; value: number }[] {
  return values.map((value, i) => ({
    dayKey: `2026-01-${String(startDay + i).padStart(2, '0')}`,
    value,
  }))
}

describe('navyBodyFat', () => {
  it('computes the male Hodgdon-Beckett estimate', () => {
    // 495 / (1.0324 - 0.19077*log10(85-38) + 0.15456*log10(178)) - 450
    const expected =
      495 / (1.0324 - 0.19077 * Math.log10(85 - 38) + 0.15456 * Math.log10(178)) - 450
    expect(navyBodyFat({ sex: 'male', waistCm: 85, neckCm: 38, heightCm: 178 })).toBeCloseTo(
      expected,
      10,
    )
  })

  it('lands in a believable range for an ordinary set of male measurements', () => {
    const value = navyBodyFat({ sex: 'male', waistCm: 85, neckCm: 38, heightCm: 178 })!
    expect(value).toBeGreaterThan(10)
    expect(value).toBeLessThan(25)
  })

  it('computes the female estimate, which needs the hip measurement', () => {
    const expected =
      495 / (1.29579 - 0.35004 * Math.log10(75 + 95 - 32) + 0.221 * Math.log10(165)) - 450
    expect(
      navyBodyFat({ sex: 'female', waistCm: 75, neckCm: 32, heightCm: 165, hipCm: 95 }),
    ).toBeCloseTo(expected, 10)
  })

  it('refuses rather than guessing when the female hip measurement is missing', () => {
    expect(navyBodyFat({ sex: 'female', waistCm: 75, neckCm: 32, heightCm: 165 })).toBeNull()
  })

  it('refuses when the girth term would be zero or negative', () => {
    expect(navyBodyFat({ sex: 'male', waistCm: 38, neckCm: 38, heightCm: 178 })).toBeNull()
  })

  it('reports a higher percentage for a larger waist at the same height and neck', () => {
    const lean = navyBodyFat({ sex: 'male', waistCm: 80, neckCm: 38, heightCm: 178 })!
    const heavier = navyBodyFat({ sex: 'male', waistCm: 100, neckCm: 38, heightCm: 178 })!
    expect(heavier).toBeGreaterThan(lean)
  })
})

describe('ewmaTrend', () => {
  it('smooths a noisy series toward its middle rather than chasing each reading', () => {
    const trend = ewmaTrend(series([80, 82, 79, 81, 80, 79, 81]))
    expect(trend.latestSmoothed!).toBeGreaterThan(79)
    expect(trend.latestSmoothed!).toBeLessThan(82)
  })

  it('reports a rising slope for a rising series', () => {
    const trend = ewmaTrend(series([80, 80.3, 80.6, 80.9, 81.2, 81.5, 81.8]))
    expect(trend.slopePerWeek).toBeGreaterThan(0)
  })

  it('reports a falling slope for a falling series', () => {
    const trend = ewmaTrend(series([84, 83.7, 83.4, 83.1, 82.8, 82.5]))
    expect(trend.slopePerWeek).toBeLessThan(0)
  })

  it('reports no slope for a flat series', () => {
    expect(ewmaTrend(series([80, 80, 80, 80])).slopePerWeek).toBeCloseTo(0, 6)
  })

  it('handles an empty series without throwing', () => {
    const trend = ewmaTrend([])
    expect(trend.latestSmoothed).toBeNull()
    expect(trend.slopePerWeek).toBe(0)
  })
})

describe('the recomposition signal', () => {
  const rising = ewmaTrend(series([80, 80.4, 80.8, 81.2, 81.6, 82]))
  const falling = ewmaTrend(series([84, 83.5, 83, 82.5, 82, 81.5]))
  const flatWeight = ewmaTrend(series([80, 80, 80, 80, 80, 80]))
  const waistShrinking = ewmaTrend(series([88, 87.5, 87, 86.5, 86, 85.5]))
  const waistFlat = ewmaTrend(series([88, 88, 88, 88, 88, 88]))
  const waistGrowing = ewmaTrend(series([85, 85.5, 86, 86.5, 87, 87.5]))

  it('calls weight flat with waist shrinking a recomposition', () => {
    const signal = recompositionSignal(flatWeight, waistShrinking)
    expect(signal.verdict).toBe('recomposition')
  })

  it('calls weight up with waist shrinking a recomposition too', () => {
    expect(recompositionSignal(rising, waistShrinking).verdict).toBe('recomposition')
  })

  it('calls weight up with waist flat a lean gain', () => {
    expect(recompositionSignal(rising, waistFlat).verdict).toBe('lean_gain')
  })

  it('calls weight up with waist up a bulk', () => {
    expect(recompositionSignal(rising, waistGrowing).verdict).toBe('bulk')
  })

  it('calls weight down with waist down a cut', () => {
    expect(recompositionSignal(falling, waistShrinking).verdict).toBe('cut')
  })

  it('warns when weight falls but the waist does not, since that suggests lean mass loss', () => {
    const signal = recompositionSignal(falling, waistFlat)
    expect(signal.verdict).toBe('lean_mass_warning')
    expect(signal.detail).toContain('lean mass')
  })

  it('says so plainly when there are not enough readings', () => {
    expect(recompositionSignal(ewmaTrend(series([80])), waistFlat).verdict).toBe('insufficient_data')
  })
})

describe('body fat sources are not treated as equivalent', () => {
  it('trusts a DEXA number as an absolute', () => {
    expect(BODY_FAT_SOURCES.dexa.trust).toBe('absolute')
    expect(deriveComposition(80, 15, 'dexa').trendOnly).toBe(false)
  })

  it('treats a smart scale as trend only, never as an absolute', () => {
    expect(BODY_FAT_SOURCES.bia.trust).toBe('trend_only')
    const derived = deriveComposition(80, 15, 'bia')
    expect(derived.trendOnly).toBe(true)
    expect(derived.caveat).toBeTruthy()
  })

  it('treats an unknown source as trend only', () => {
    expect(deriveComposition(80, 15, 'other').trendOnly).toBe(true)
  })

  it('shows the caveat on a tape estimate but still treats it as a number', () => {
    expect(BODY_FAT_SOURCES.navy.trust).toBe('absolute_with_caveat')
  })
})

describe('deriveComposition', () => {
  it('splits bodyweight into fat and lean mass', () => {
    const derived = deriveComposition(80, 20, 'dexa')
    expect(derived.fatMassKg).toBeCloseTo(16, 10)
    expect(derived.leanMassKg).toBeCloseTo(64, 10)
  })
})

describe('bestBodyFat', () => {
  const base: BodyMetric = {
    id: 'm1',
    dayKey: '2026-01-01',
    recordedAt: 0,
    weightKg: 80,
  }

  it('prefers a stated value over the tape estimate', () => {
    const result = bestBodyFat(
      { ...base, bodyFatPct: 14, bodyFatSource: 'dexa', waistCm: 85, neckCm: 38 },
      { sex: 'male', heightCm: 178 },
    )
    expect(result?.bodyFatPct).toBe(14)
    expect(result?.source).toBe('dexa')
  })

  it('falls back to the Navy estimate from tape measurements', () => {
    const result = bestBodyFat(
      { ...base, waistCm: 85, neckCm: 38 },
      { sex: 'male', heightCm: 178 },
    )
    expect(result?.source).toBe('navy')
    expect(result?.bodyFatPct).toBeGreaterThan(0)
  })

  it('returns nothing when there is neither a number nor a full set of measurements', () => {
    expect(bestBodyFat(base, { sex: 'male', heightCm: 178 })).toBeNull()
  })

  it('returns nothing for a hunter with no formula sex, rather than picking one', () => {
    expect(
      bestBodyFat({ ...base, waistCm: 85, neckCm: 38 }, { sex: 'unspecified', heightCm: 178 }),
    ).toBeNull()
  })

  it('uses the borrowed formula when the hunter chose one', () => {
    const result = bestBodyFat(
      { ...base, waistCm: 85, neckCm: 38 },
      { sex: 'unspecified', heightCm: 178, standardsTableOverride: 'male' },
    )
    expect(result?.source).toBe('navy')
  })
})

describe('remeasureDue', () => {
  it('is due immediately when nothing has ever been measured', () => {
    expect(remeasureDue(null, '2026-01-01')).toBe(true)
  })

  it('is not due a month after the last measurement', () => {
    expect(remeasureDue('2026-01-01', '2026-02-01')).toBe(false)
  })

  it('is due after eight weeks', () => {
    expect(remeasureDue('2026-01-01', '2026-03-01')).toBe(true)
  })
})
