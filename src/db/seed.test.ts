import { describe, expect, it } from 'vitest'
import { SEED_EXERCISES, SEED_EXERCISE_BY_ID, SEED_ROUTINES } from './seed'

describe('progression ladders', () => {
  // Regression for the pushup-ladder bug (fixed in commit 66d39f5): three
  // exercises carried ['incline-pushups', 'pike-pushups', 'diamond-pushups']
  // while Pushups carried a different array, so mastering Incline Pushups
  // advanced onto Pike Pushups — a pattern and muscle change dressed as a
  // progression — and full Pushups were unreachable by progression at all.
  for (const exercise of SEED_EXERCISES) {
    const ladder = exercise.progressionLadder
    if (!ladder || ladder.length === 0) continue

    it(`${exercise.id}'s ladder resolves to exercises that all share its pattern`, () => {
      for (const rungId of ladder) {
        const rung = SEED_EXERCISE_BY_ID.get(rungId)
        expect(rung, `ladder rung '${rungId}' referenced by '${exercise.id}' does not exist`).toBeDefined()
        expect(
          rung!.pattern,
          `'${rungId}' is pattern '${rung!.pattern}', but its ladder-mate '${exercise.id}' is '${exercise.pattern}'`,
        ).toBe(exercise.pattern)
      }
    })

    it(`${exercise.id}'s ladder agrees with every exercise named in it, not just itself`, () => {
      for (const rungId of ladder) {
        const rung = SEED_EXERCISE_BY_ID.get(rungId)
        if (!rung) continue
        expect(
          rung.progressionLadder,
          `'${rungId}' names a different ladder than '${exercise.id}' does, even though both are on it`,
        ).toEqual(ladder)
      }
    })
  }
})

describe('the library', () => {
  it('has no duplicate exercise ids', () => {
    const ids = SEED_EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every routine block references an exercise that exists', () => {
    for (const routine of SEED_ROUTINES) {
      for (const block of routine.blocks) {
        for (const item of block.items) {
          expect(SEED_EXERCISE_BY_ID.get(item.exerciseId), `${routine.id} references unknown exercise '${item.exerciseId}'`).toBeDefined()
        }
      }
    }
  })
})

describe('the fallback library (commit 5d33216)', () => {
  it('a routine may only reference a prescribed exercise', () => {
    // A fallback in a routine is a seed bug (commit 5d33216) — it would be a
    // default the hunter never chose, not a stand-in for the evening a
    // station is taken.
    for (const routine of SEED_ROUTINES) {
      for (const block of routine.blocks) {
        for (const item of block.items) {
          const exercise = SEED_EXERCISE_BY_ID.get(item.exerciseId)
          expect(
            exercise?.role,
            `${routine.id} references '${item.exerciseId}', which is role '${exercise?.role}'`,
          ).toBe('prescribed')
        }
      }
    }
  })

  // The (pattern, primary muscle) groups the equipment-desert audit (commit
  // 5d33216) found. A fallback whose primary muscle names none of these
  // fills no gap the audit found, which is exactly the case this test exists
  // to catch.
  const GROUPS_FROM_AUDIT = new Set([
    'chest',
    'triceps',
    'front_delts',
    'abs',
    'quads',
    'lats',
    'biceps',
    'upper_back',
    'side_delts',
    'rear_delts',
    'traps',
    'hamstrings',
    'calves',
    'cardio',
  ])

  const fallbacks = SEED_EXERCISES.filter((e) => e.role === 'fallback')

  it('seeded at least one fallback', () => {
    // A guard against the whole block silently no-op'ing — every assertion
    // below about "every fallback" is vacuously true for an empty list.
    expect(fallbacks.length).toBeGreaterThan(0)
  })

  for (const exercise of fallbacks) {
    it(`${exercise.id} names at least one group from the audit (commit 5d33216)`, () => {
      const matches = exercise.primaryMuscles.some((m) => GROUPS_FROM_AUDIT.has(m))
      expect(matches, `${exercise.id}'s primary muscles (${exercise.primaryMuscles.join(', ')}) name no audited gap`).toBe(true)
    })
  }

  it('no fallback carries a progressionLadder — it is never mastered onto the next thing', () => {
    for (const exercise of fallbacks) {
      expect(exercise.progressionLadder ?? [], `${exercise.id} has a progressionLadder but is a fallback`).toHaveLength(0)
    }
  })
})
