import { describe, expect, it } from 'vitest'
import { ProfileSchema } from '../domain/types'
import { isComplete, stepsFor, toProfileInput, validateStep, type AwakeningAnswers } from './awakening'

const FILLED: AwakeningAnswers = {
  hunterName: 'Jinwoo',
  unitPref: 'metric',
  sex: 'male',
  birthYear: 1995,
  heightCm: 180,
  bodyweightKg: 82,
  trainingYears: 3,
  equipmentAccess: ['barbell', 'dumbbell', 'bench'],
}

describe('stepsFor', () => {
  it('is fixed and starts with the name, then units, then sex', () => {
    const steps = stepsFor({})
    expect(steps[0]).toBe('name')
    expect(steps[1]).toBe('units')
    expect(steps[2]).toBe('sex')
  })

  it('omits standardsTable unless sex is unspecified', () => {
    expect(stepsFor({ sex: 'male' })).not.toContain('standardsTable')
    expect(stepsFor({})).not.toContain('standardsTable')
    expect(stepsFor({ sex: 'unspecified' })).toContain('standardsTable')
  })

  it('always ends with equipment then physique', () => {
    const steps = stepsFor({ sex: 'unspecified' })
    expect(steps.slice(-2)).toEqual(['equipment', 'physique'])
  })
})

describe('validateStep', () => {
  it('requires a name — a blank or missing answer is rejected', () => {
    expect(validateStep('name', {})).not.toBeNull()
    expect(validateStep('name', { hunterName: '' })).not.toBeNull()
    expect(validateStep('name', { hunterName: '   ' })).not.toBeNull()
    expect(validateStep('name', { hunterName: 'Jinwoo' })).toBeNull()
  })

  it('rejects a name over the schema length bound', () => {
    expect(validateStep('name', { hunterName: 'x'.repeat(41) })).not.toBeNull()
    expect(validateStep('name', { hunterName: 'x'.repeat(40) })).toBeNull()
  })

  it('rejects a missing or invalid unit preference', () => {
    expect(validateStep('units', {})).not.toBeNull()
    expect(validateStep('units', { unitPref: 'metric' })).toBeNull()
  })

  it('rejects a missing sex', () => {
    expect(validateStep('sex', {})).not.toBeNull()
    expect(validateStep('sex', { sex: 'unspecified' })).toBeNull()
  })

  it('never rejects the standards-table step, declined or chosen', () => {
    expect(validateStep('standardsTable', {})).toBeNull()
    expect(validateStep('standardsTable', { standardsTableOverride: 'female' })).toBeNull()
  })

  it('rejects a birth year in the future', () => {
    const nextYear = new Date().getFullYear() + 1
    expect(validateStep('age', { birthYear: nextYear })).not.toBeNull()
    expect(validateStep('age', { birthYear: 1990 })).toBeNull()
    expect(validateStep('age', {})).not.toBeNull()
  })

  it('rejects a non-positive height', () => {
    expect(validateStep('height', { heightCm: 0 })).not.toBeNull()
    expect(validateStep('height', { heightCm: -5 })).not.toBeNull()
    expect(validateStep('height', { heightCm: 175 })).toBeNull()
  })

  it('rejects a negative bodyweight', () => {
    expect(validateStep('bodyweight', { bodyweightKg: -10 })).not.toBeNull()
    expect(validateStep('bodyweight', { bodyweightKg: 70 })).toBeNull()
  })

  it('accepts zero training years but rejects a missing value', () => {
    expect(validateStep('trainingYears', { trainingYears: 0 })).toBeNull()
    expect(validateStep('trainingYears', {})).not.toBeNull()
  })

  it('rejects an empty equipment list', () => {
    expect(validateStep('equipment', { equipmentAccess: [] })).not.toBeNull()
    expect(validateStep('equipment', { equipmentAccess: ['bodyweight'] })).toBeNull()
  })

  it('never rejects the physique step, since it is skippable', () => {
    expect(validateStep('physique', {})).toBeNull()
  })
})

describe('isComplete', () => {
  it('is true with physique untouched and no standards-table override', () => {
    expect(isComplete(FILLED)).toBe(true)
  })

  it('is true when sex is unspecified and the standards table is declined', () => {
    expect(isComplete({ ...FILLED, sex: 'unspecified', standardsTableOverride: undefined })).toBe(true)
  })

  it('is false while a required step is unanswered', () => {
    const { heightCm: _heightCm, ...withoutHeight } = FILLED
    expect(isComplete(withoutHeight)).toBe(false)
  })

  it('is false with no hunter name, or a blank one', () => {
    const { hunterName: _hunterName, ...withoutName } = FILLED
    expect(isComplete(withoutName)).toBe(false)
    expect(isComplete({ ...FILLED, hunterName: '   ' })).toBe(false)
  })
})

describe('toProfileInput', () => {
  it('produces a profile input that ProfileSchema accepts, from a fully blank-optionals answer set', () => {
    const input = toProfileInput(FILLED)
    expect(() =>
      ProfileSchema.parse({ ...input.profile, id: 'profile', createdAt: 0, awakenedAt: null }),
    ).not.toThrow()
    expect(input.bodyweightKg).toBe(82)
    expect(input.optional).toBeUndefined()
  })

  it('carries the optional physique fields through when they were answered', () => {
    const input = toProfileInput({ ...FILLED, waistCm: 85, bodyFatPct: 18, bodyFatSource: 'navy' })
    expect(input.optional).toEqual({
      waistCm: 85,
      neckCm: undefined,
      hipCm: undefined,
      bodyFatPct: 18,
      bodyFatSource: 'navy',
    })
  })

  it('carries a trimmed hunter name through', () => {
    const input = toProfileInput({ ...FILLED, hunterName: '  Jinwoo  ' })
    expect(input.profile.hunterName).toBe('Jinwoo')
  })
})
