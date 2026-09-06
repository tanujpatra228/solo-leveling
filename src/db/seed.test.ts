import { describe, expect, it } from 'vitest'
import { SEED_EXERCISES, SEED_EXERCISE_BY_ID, SEED_ROUTINES } from './seed'

describe('progression ladders', () => {
  // Regression for the pushup-ladder bug (substitution-plan.md §4): three
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
