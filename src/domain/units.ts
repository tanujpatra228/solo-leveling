/**
 * Kilograms and centimetres are the only units that exist in storage, in the
 * domain layer, and in the sync payload. Everything here is the render-layer
 * edge where they turn into pounds and inches, and a number that has been
 * converted for display never flows back into a calculation.
 */
import type { UnitPref } from './types'

export const KG_PER_LB = 0.45359237
export const CM_PER_INCH = 2.54

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function cmToInch(cm: number): number {
  return cm / CM_PER_INCH
}

export function inchToCm(inch: number): number {
  return inch * CM_PER_INCH
}

/**
 * Rounds to the nearest achievable load. Gyms have discrete plates, so a
 * computed target of 62.3 kg is not a thing anyone can put on a bar.
 */
export function roundToIncrement(kg: number, increment: number): number {
  if (increment <= 0) return kg
  return Math.round(kg / increment) * increment
}

/** Trims floating-point dust without pretending to more precision than exists. */
function tidy(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function formatWeight(kg: number, pref: UnitPref, decimals = 1): string {
  if (pref === 'imperial') {
    return `${tidy(kgToLb(kg), decimals)} lb`
  }
  return `${tidy(kg, decimals)} kg`
}

export function formatLength(cm: number, pref: UnitPref, decimals = 1): string {
  if (pref === 'imperial') {
    return `${tidy(cmToInch(cm), decimals)} in`
  }
  return `${tidy(cm, decimals)} cm`
}

/** Height reads more naturally as feet and inches than as a decimal. */
export function formatHeight(cm: number, pref: UnitPref): string {
  if (pref === 'imperial') {
    const totalInches = Math.round(cmToInch(cm))
    const feet = Math.floor(totalInches / 12)
    const inches = totalInches % 12
    return `${feet}' ${inches}"`
  }
  return `${Math.round(cm)} cm`
}

export function formatDistance(metres: number, pref: UnitPref): string {
  if (pref === 'imperial') {
    const miles = metres / 1609.344
    return miles >= 0.1 ? `${tidy(miles, 2)} mi` : `${Math.round(cmToInch(metres * 100))} in`
  }
  return metres >= 1000 ? `${tidy(metres / 1000, 2)} km` : `${Math.round(metres)} m`
}

/** `MM:SS`, or `H:MM:SS` once an hour is passed. */
export function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = secs % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Parses a weight the hunter typed, interpreting a bare number in whichever unit
 * they are currently displaying. Returns kilograms, or null if it is not a
 * number at all.
 */
export function parseWeightToKg(input: string, pref: UnitPref): number | null {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === '') return null

  const explicitLb = /(lb|lbs|pound|pounds)$/.test(trimmed)
  const explicitKg = /(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(trimmed)
  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.,-]/g, '').replace(',', '.'))
  if (!Number.isFinite(numeric)) return null

  if (explicitLb) return lbToKg(numeric)
  if (explicitKg) return numeric
  return pref === 'imperial' ? lbToKg(numeric) : numeric
}
