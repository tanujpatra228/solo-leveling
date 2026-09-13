import { describe, expect, it } from 'vitest'
import { EXERCISE_GUIDES } from './exerciseGuides'
import { SEED_EXERCISES, SEED_EXERCISE_BY_ID } from '../db/seed'

describe('exercise guide coverage', () => {
  const prescribed = SEED_EXERCISES.filter((e) => e.role === 'prescribed')

  it('seeded at least one prescribed exercise', () => {
    // Guards every "every prescribed exercise" assertion below from being
    // vacuously true against an empty list.
    expect(prescribed.length).toBeGreaterThan(0)
  })

  for (const exercise of prescribed) {
    it(`${exercise.id} has a guide`, () => {
      expect(EXERCISE_GUIDES[exercise.id], `${exercise.id} is prescribed but has no guide`).toBeDefined()
    })
  }

  for (const id of Object.keys(EXERCISE_GUIDES)) {
    it(`guide '${id}' names a real exercise`, () => {
      expect(SEED_EXERCISE_BY_ID.get(id), `guide '${id}' does not match any seeded exercise`).toBeDefined()
    })
  }

  for (const [id, guide] of Object.entries(EXERCISE_GUIDES)) {
    it(`${id}'s guide has real content, not empty placeholders`, () => {
      expect(guide.setup.length).toBeGreaterThan(10)
      expect(guide.steps.length).toBeGreaterThan(0)
      expect(guide.commonMistakes.length).toBeGreaterThan(0)
      for (const step of guide.steps) expect(step.length).toBeGreaterThan(10)
      for (const mistake of guide.commonMistakes) expect(mistake.length).toBeGreaterThan(10)
    })
  }
})
