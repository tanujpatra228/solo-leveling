import { describe, expect, it } from 'vitest'
import { latestMeasurements } from './measurements'
import type { BodyMetric, DayKey } from './types'

let nextId = 0
function metric(dayKey: DayKey, fields: Partial<BodyMetric> & { weightKg: number }): BodyMetric {
  nextId += 1
  return { id: `m${nextId}`, dayKey, recordedAt: Date.parse(`${dayKey}T12:00:00`), ...fields }
}

// The Awakening Test, then a later re-measure that left neck, hip and body fat blank.
const awakening = metric('2026-08-03', {
  weightKg: 82,
  waistCm: 90,
  neckCm: 38,
  bodyFatPct: 20,
  bodyFatSource: 'calipers',
})
const reawakening = metric('2026-10-12', { weightKg: 79.5, waistCm: 86 })

describe('latestMeasurements', () => {
  it('with nothing logged, every measurement is null', () => {
    expect(latestMeasurements([])).toEqual({
      weightKg: null,
      waistCm: null,
      neckCm: null,
      hipCm: null,
      bodyFatPct: null,
    })
  })

  it('a single entry gives its own values and no previous reading', () => {
    const result = latestMeasurements([metric('2026-08-03', { weightKg: 82 })])
    expect(result.weightKg).toEqual({ value: 82, dayKey: '2026-08-03', previous: null })
    expect(result.waistCm).toBeNull()
  })

  it('takes the newest value of each measurement and the reading before it', () => {
    const result = latestMeasurements([awakening, reawakening])
    expect(result.weightKg).toEqual({
      value: 79.5,
      dayKey: '2026-10-12',
      previous: { value: 82, dayKey: '2026-08-03' },
    })
    expect(result.waistCm).toEqual({
      value: 86,
      dayKey: '2026-10-12',
      previous: { value: 90, dayKey: '2026-08-03' },
    })
  })

  it('a measurement skipped in a later entry keeps its own, older date', () => {
    const result = latestMeasurements([awakening, reawakening])
    expect(result.neckCm).toEqual({ value: 38, dayKey: '2026-08-03', previous: null })
    expect(result.bodyFatPct).toEqual({
      value: 20,
      dayKey: '2026-08-03',
      previous: null,
      source: 'calipers',
    })
  })

  it('a measurement never logged stays null', () => {
    expect(latestMeasurements([awakening, reawakening]).hipCm).toBeNull()
  })

  it('does not depend on the order the entries arrive in', () => {
    expect(latestMeasurements([reawakening, awakening])).toEqual(latestMeasurements([awakening, reawakening]))
  })

  it('with three readings, the previous one is the one just before the latest, not the first', () => {
    const middle = metric('2026-09-07', { weightKg: 81 })
    const result = latestMeasurements([awakening, middle, reawakening])
    expect(result.weightKg!.previous).toEqual({ value: 81, dayKey: '2026-09-07' })
  })

  it('carries the body-fat source of the reading it belongs to', () => {
    const later = metric('2026-10-12', { weightKg: 79.5, bodyFatPct: 18, bodyFatSource: 'navy' })
    const result = latestMeasurements([awakening, later])
    expect(result.bodyFatPct).toEqual({
      value: 18,
      dayKey: '2026-10-12',
      previous: { value: 20, dayKey: '2026-08-03' },
      source: 'navy',
    })
  })

  it('two entries on the same day resolve by when they were recorded', () => {
    const morning = { ...metric('2026-10-12', { weightKg: 80 }), recordedAt: Date.parse('2026-10-12T08:00:00') }
    const evening = { ...metric('2026-10-12', { weightKg: 79 }), recordedAt: Date.parse('2026-10-12T20:00:00') }
    expect(latestMeasurements([evening, morning]).weightKg!.value).toBe(79)
  })
})
