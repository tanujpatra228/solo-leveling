import { describe, expect, it } from 'vitest'
import { substitutesFor } from './substitution'
import { SEED_EXERCISES, SEED_EXERCISE_BY_ID, SEED_ROUTINES } from '../db/seed'
import type { Equipment, Exercise } from './types'

function findExercise(id: string): Exercise {
  const exercise = SEED_EXERCISE_BY_ID.get(id)
  if (!exercise) throw new Error(`fixture bug: '${id}' is not in the seed library`)
  return exercise
}

/** Every equipment tag the real library ever asks for, so a coverage test
 *  fails only because of a blocked station, not a restricted profile. */
const ALL_EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'pullup_bar',
  'bench',
  'ez_bar',
  'kettlebell',
  'bands',
  'treadmill',
]

const cableCrunch = findExercise('cable-crunch')
const cableFly = findExercise('cable-fly')

describe('substitutesFor', () => {
  it('excludes a candidate needing blocked equipment before ranking anything', () => {
    const candidates = substitutesFor(cableCrunch, {
      exercises: SEED_EXERCISES,
      equipmentAccess: ALL_EQUIPMENT,
      blockedEquipment: ['cable'],
    })
    expect(candidates.some((c) => c.exercise.id === cableFly.id)).toBe(false)
    expect(candidates.some((c) => c.exercise.equipment.includes('cable'))).toBe(false)
  })

  it('defaults blockedEquipment to the planned exercise\'s own equipment', () => {
    const withDefault = substitutesFor(cableCrunch, { exercises: SEED_EXERCISES, equipmentAccess: ALL_EQUIPMENT })
    const withExplicit = substitutesFor(cableCrunch, {
      exercises: SEED_EXERCISES,
      equipmentAccess: ALL_EQUIPMENT,
      blockedEquipment: ['cable'],
    })
    expect(withDefault.map((c) => c.exercise.id).sort()).toEqual(withExplicit.map((c) => c.exercise.id).sort())
  })

  it('never blocks bodyweight by default, even when the planned exercise is tagged bodyweight', () => {
    // Hanging Leg Raises is tagged ['pullup_bar', 'bodyweight']. Defaulting
    // blockedEquipment to that whole list would exclude every bodyweight
    // candidate too, including its own ladder neighbour — but bodyweight is
    // never a station someone else can occupy, so it must not be inferred
    // as blocked.
    const hangingLegRaises = findExercise('hanging-leg-raises')
    const candidates = substitutesFor(hangingLegRaises, {
      exercises: SEED_EXERCISES,
      equipmentAccess: ALL_EQUIPMENT,
    })
    expect(candidates.some((c) => c.exercise.id === 'leg-raises')).toBe(true)
  })

  it('the Cable Crunch case: Machine Abs Crunch, Sit-ups and Leg Raises all answer, ranked above tier 2', () => {
    const candidates = substitutesFor(cableCrunch, {
      exercises: SEED_EXERCISES,
      equipmentAccess: ALL_EQUIPMENT,
    })
    const ids = candidates.map((c) => c.exercise.id)
    expect(ids).toContain('machine-abs-crunch')
    expect(ids).toContain('situps')
    expect(ids).toContain('leg-raises')
    // All three share Cable Crunch's own pattern (core) and muscle (abs), so
    // none of them should be relegated behind a weaker, tier-2-only match.
    for (const id of ['machine-abs-crunch', 'situps', 'leg-raises']) {
      expect(candidates.find((c) => c.exercise.id === id)!.tier).toBe(1)
    }
  })

  it('Hanging Leg Raises returns Leg Raises as a ladder neighbour, demoted for already being in today\'s routine', () => {
    const hangingLegRaises = findExercise('hanging-leg-raises')
    const routine = SEED_ROUTINES.find((r) => r.id === 'saturday-cardio-abs')!
    const candidates = substitutesFor(hangingLegRaises, {
      exercises: SEED_EXERCISES,
      equipmentAccess: ALL_EQUIPMENT,
      routine,
    })
    const legRaises = candidates.find((c) => c.exercise.id === 'leg-raises')
    expect(legRaises).toBeDefined()
    expect(legRaises!.demoted).toBe(true)
    expect(legRaises!.why).toContain('same ladder')
  })

  it('returns an empty list for an empty library', () => {
    expect(substitutesFor(cableCrunch, { exercises: [], equipmentAccess: ALL_EQUIPMENT })).toEqual([])
  })

  it('never offers Machine Abs Crunch to a hunter with no machine access', () => {
    const candidates = substitutesFor(cableCrunch, {
      exercises: SEED_EXERCISES,
      equipmentAccess: ['bodyweight', 'cable'],
    })
    expect(candidates.some((c) => c.exercise.id === 'machine-abs-crunch')).toBe(false)
  })

  describe('the coverage guarantee (the equipment-desert audit behind commit 5d33216)', () => {
    const prescribed = SEED_EXERCISES.filter((e) => e.role === 'prescribed')

    it('every prescribed exercise returns a candidate when its own equipment is blocked', () => {
      for (const exercise of prescribed) {
        const candidates = substitutesFor(exercise, { exercises: SEED_EXERCISES, equipmentAccess: ALL_EQUIPMENT })
        expect(candidates.length, `${exercise.id} has no answer when its own equipment is blocked`).toBeGreaterThan(0)
      }
    })

    const EXCEPTION_LIST = new Set([
      // The four groups where §4 says physics wins: pulling and a loaded
      // lateral or shrug both need some implement, so bodyweight-only access
      // genuinely has no answer.
      'one-arm-cable-lat-pulldown', // vertical_pull / lats
      'pull-ups', // vertical_pull / lats
      'dumbbell-row', // horizontal_pull / upper_back
      'machine-lateral-raise', // isolation / side_delts
      'cable-shrug', // isolation / traps
      // A different reason, found by running this test rather than named in
      // §4: these three are themselves the bodyweight answer for their
      // muscle (chest, triceps, front_delts respectively) — under
      // bodyweight-only access there is nothing left to swap onto that is
      // not either itself or a different muscle entirely.
      'pushups', // horizontal_push / chest
      'diamond-pushups', // horizontal_push / triceps
      'pike-pushups', // vertical_push / front_delts
      // Added with the hinge/cuff/grip fixes: cuff work and loaded carries
      // both genuinely need an implement — the bodyweight-only fallbacks for
      // each (Dumbbell External Rotation, Dead Hang) still need a dumbbell or
      // a bar, so there is no answer under bodyweight-only access either.
      'cable-external-rotation', // isolation / rotator_cuff
      'farmers-carry', // carry / grip
    ])

    it('under bodyweight-only access, every prescribed exercise either answers or is in the named exception list', () => {
      const failures: string[] = []
      for (const exercise of prescribed) {
        if (EXCEPTION_LIST.has(exercise.id)) continue
        const candidates = substitutesFor(exercise, { exercises: SEED_EXERCISES, equipmentAccess: ['bodyweight'] })
        if (candidates.length === 0) failures.push(exercise.id)
      }
      expect(failures, `unexpected bodyweight-only gaps: ${failures.join(', ')}`).toEqual([])
    })

    it('the exception list itself has no bodyweight-only answer, confirming it is not just under-tested', () => {
      for (const id of EXCEPTION_LIST) {
        const exercise = findExercise(id)
        const candidates = substitutesFor(exercise, { exercises: SEED_EXERCISES, equipmentAccess: ['bodyweight'] })
        expect(candidates, `${id} unexpectedly has a bodyweight-only answer now`).toEqual([])
      }
    })
  })
})
