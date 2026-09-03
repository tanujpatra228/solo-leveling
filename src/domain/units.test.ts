import { describe, expect, it } from 'vitest'
import {
  CM_PER_INCH,
  KG_PER_LB,
  cmToInch,
  formatDistance,
  formatDuration,
  formatHeight,
  formatLength,
  formatWeight,
  inchToCm,
  kgToLb,
  lbToKg,
  parseWeightToKg,
  roundToIncrement,
} from './units'

describe('conversion constants', () => {
  it('uses the exact international definitions', () => {
    expect(KG_PER_LB).toBe(0.45359237)
    expect(CM_PER_INCH).toBe(2.54)
  })

  it('round-trips without drift', () => {
    expect(lbToKg(kgToLb(100))).toBeCloseTo(100, 10)
    expect(inchToCm(cmToInch(180))).toBeCloseTo(180, 10)
  })

  it('converts a known pair', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3)
    expect(cmToInch(180)).toBeCloseTo(70.866, 3)
  })
})

describe('roundToIncrement', () => {
  it('snaps to a load the gym can actually make', () => {
    expect(roundToIncrement(62.3, 2.5)).toBe(62.5)
    expect(roundToIncrement(103, 5)).toBe(105)
  })

  it('leaves the value alone when there is no increment', () => {
    expect(roundToIncrement(62.3, 0)).toBe(62.3)
  })
})

describe('formatting', () => {
  it('shows kilograms in metric and pounds in imperial', () => {
    expect(formatWeight(100, 'metric')).toBe('100 kg')
    expect(formatWeight(100, 'imperial')).toBe('220.5 lb')
  })

  it('shows centimetres in metric and inches in imperial', () => {
    expect(formatLength(90, 'metric')).toBe('90 cm')
    expect(formatLength(90, 'imperial')).toBe('35.4 in')
  })

  it('shows height as feet and inches in imperial', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm')
    expect(formatHeight(180, 'imperial')).toBe("5' 11\"")
  })

  it('shows distance in kilometres or miles', () => {
    expect(formatDistance(10_000, 'metric')).toBe('10 km')
    expect(formatDistance(500, 'metric')).toBe('500 m')
    expect(formatDistance(10_000, 'imperial')).toBe('6.21 mi')
  })

  it('formats a rest timer as minutes and seconds', () => {
    expect(formatDuration(90)).toBe('01:30')
    expect(formatDuration(59)).toBe('00:59')
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(-5)).toBe('00:00')
  })
})

describe('parseWeightToKg', () => {
  it('reads a bare number in the displayed unit', () => {
    expect(parseWeightToKg('100', 'metric')).toBe(100)
    expect(parseWeightToKg('100', 'imperial')).toBeCloseTo(45.359, 3)
  })

  it('honours an explicit unit whatever the preference', () => {
    expect(parseWeightToKg('100kg', 'imperial')).toBe(100)
    expect(parseWeightToKg('100 lb', 'metric')).toBeCloseTo(45.359, 3)
  })

  it('accepts a comma as a decimal separator', () => {
    expect(parseWeightToKg('62,5', 'metric')).toBe(62.5)
  })

  it('returns null for something that is not a number', () => {
    expect(parseWeightToKg('', 'metric')).toBeNull()
    expect(parseWeightToKg('heavy', 'metric')).toBeNull()
  })
})
