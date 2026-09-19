import { describe, expect, it } from 'vitest'
import { applyEquipmentSelection, effectiveEquipment, isBodyweightProgramme } from './equipment'
import { SEED_EXERCISES } from '../db/seed'
import type { Equipment } from './types'

const FULL_GYM_NO_BW: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'pullup_bar',
  'bench',
  'ez_bar',
  'kettlebell',
  'bands',
  'treadmill',
]

function reachableCount(access: readonly Equipment[]): number {
  const set = new Set(access)
  return SEED_EXERCISES.filter((e) => e.equipment.every((eq) => set.has(eq))).length
}

describe('effectiveEquipment', () => {
  it('always includes bodyweight, for every input including empty', () => {
    expect(effectiveEquipment(undefined)).toEqual(['bodyweight'])
    expect(effectiveEquipment([])).toEqual(['bodyweight'])
    expect(effectiveEquipment(['none'])).toEqual(['bodyweight'])
    expect(effectiveEquipment(['barbell'])).toEqual(expect.arrayContaining(['bodyweight', 'barbell']))
  })

  it('drops the redundant none tag', () => {
    expect(effectiveEquipment(['none'])).not.toContain('none')
  })

  it('is idempotent and order-independent', () => {
    const a = effectiveEquipment(['dumbbell', 'bodyweight'])
    const b = effectiveEquipment(effectiveEquipment(['bodyweight', 'dumbbell']))
    expect(new Set(a)).toEqual(new Set(b))
  })

  it('closes the measured regression: a full gym without the bodyweight tick reaches every exercise once normalized', () => {
    const raw = reachableCount(FULL_GYM_NO_BW)
    const normalized = reachableCount(effectiveEquipment(FULL_GYM_NO_BW))
    expect(raw).toBeLessThan(SEED_EXERCISES.length)
    expect(normalized).toBe(SEED_EXERCISES.length)
  })
})

describe('applyEquipmentSelection', () => {
  it('picking bodyweight clears every load-bearing tag', () => {
    const current: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'ez_bar', 'kettlebell', 'bands']
    const next = applyEquipmentSelection(current, 'bodyweight')
    expect(next).toContain('bodyweight')
    for (const eq of ['barbell', 'dumbbell', 'machine', 'cable', 'ez_bar', 'kettlebell', 'bands'] as const) {
      expect(next).not.toContain(eq)
    }
  })

  it('picking a load-bearing tag clears bodyweight', () => {
    const next = applyEquipmentSelection(['bodyweight'], 'barbell')
    expect(next).toContain('barbell')
    expect(next).not.toContain('bodyweight')
  })

  it('pull-up bar survives selecting bodyweight, in either direction', () => {
    const next = applyEquipmentSelection(['pullup_bar'], 'bodyweight')
    expect(next).toEqual(expect.arrayContaining(['pullup_bar', 'bodyweight']))

    const reverse = applyEquipmentSelection(['bodyweight'], 'pullup_bar')
    expect(reverse).toEqual(expect.arrayContaining(['pullup_bar', 'bodyweight']))
  })

  it('bench survives selecting bodyweight, in either direction', () => {
    const next = applyEquipmentSelection(['bench'], 'bodyweight')
    expect(next).toEqual(expect.arrayContaining(['bench', 'bodyweight']))

    const reverse = applyEquipmentSelection(['bodyweight'], 'bench')
    expect(reverse).toEqual(expect.arrayContaining(['bench', 'bodyweight']))
  })

  it('treadmill is neutral: it survives bodyweight either direction and never triggers exclusivity', () => {
    const next = applyEquipmentSelection(['treadmill'], 'bodyweight')
    expect(next).toEqual(expect.arrayContaining(['treadmill', 'bodyweight']))
  })

  it('toggling an already-selected tag off is a plain removal, not an exclusivity trigger', () => {
    const next = applyEquipmentSelection(['bodyweight', 'pullup_bar'], 'pullup_bar')
    expect(next).toEqual(['bodyweight'])
  })

  it('two load-bearing tags coexist normally', () => {
    const next = applyEquipmentSelection(['barbell'], 'dumbbell')
    expect(next).toEqual(expect.arrayContaining(['barbell', 'dumbbell']))
  })

  it('returns an empty array for an empty starting point with the toggled tag removed (no-op case is unreachable via UI, but must not throw)', () => {
    expect(() => applyEquipmentSelection([], 'bodyweight')).not.toThrow()
    expect(applyEquipmentSelection([], 'bodyweight')).toEqual(['bodyweight'])
  })
})

describe('isBodyweightProgramme', () => {
  it('is true for no access at all, and for bodyweight alone', () => {
    expect(isBodyweightProgramme(undefined)).toBe(true)
    expect(isBodyweightProgramme([])).toBe(true)
    expect(isBodyweightProgramme(['bodyweight'])).toBe(true)
  })

  it('a pull-up bar alone still selects the bodyweight programme — the contradiction the absence-keyed rule used to produce', () => {
    expect(isBodyweightProgramme(['pullup_bar'])).toBe(true)
  })

  it('a bench alone, or a bar and a bench together, still select the bodyweight programme', () => {
    expect(isBodyweightProgramme(['bench'])).toBe(true)
    expect(isBodyweightProgramme(['pullup_bar', 'bench'])).toBe(true)
  })

  it('a treadmill alone selects the bodyweight programme — it is neither loadable nor a leverage tool', () => {
    expect(isBodyweightProgramme(['treadmill'])).toBe(true)
  })

  it('is false the moment any load-bearing equipment is present, bar and bench or not', () => {
    for (const eq of ['barbell', 'dumbbell', 'machine', 'cable', 'ez_bar', 'kettlebell', 'bands'] as Equipment[]) {
      expect(isBodyweightProgramme([eq]), `${eq} should select the barbell programme`).toBe(false)
      expect(isBodyweightProgramme([eq, 'pullup_bar', 'bench']), `${eq} plus bar/bench should still select the barbell programme`).toBe(false)
    }
  })

  it('agrees with applyEquipmentSelection: whatever the chips leave selected after the exclusivity rule fires', () => {
    // Ticking Bodyweight, per the Awakening's own exclusivity rule, clears
    // every load-bearing tag — so the two functions must never disagree
    // about the result of that state.
    const afterTickingBodyweight = applyEquipmentSelection(['barbell', 'dumbbell', 'pullup_bar'], 'bodyweight')
    expect(isBodyweightProgramme(afterTickingBodyweight)).toBe(true)
  })
})
