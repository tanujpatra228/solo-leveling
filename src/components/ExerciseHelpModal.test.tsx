// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ExerciseHelpModal } from './ExerciseHelpModal'
import type { Exercise } from '../domain/types'

const BARBELL_SQUAT: Exercise = {
  id: 'barbell-squat',
  name: 'Barbell Squats',
  aliases: [],
  pattern: 'squat',
  primaryMuscles: ['quads'],
  secondaryMuscles: ['glutes', 'lower_back', 'hamstrings'],
  equipment: ['barbell'],
  unit: 'kg',
  increment: 5,
  repRange: [5, 8],
  cue: 'Knees track over the toes. Depth first, load second.',
  usesBodyweight: false,
  bodyweightFactor: 1,
  role: 'prescribed',
}

const NO_GUIDE_EXERCISE: Exercise = {
  ...BARBELL_SQUAT,
  id: 'not-a-real-seeded-id',
  name: 'Placeholder Exercise',
}

describe('ExerciseHelpModal', () => {
  it('renders the exercise name, its cue, and its guide content', () => {
    const html = renderToStaticMarkup(<ExerciseHelpModal exercise={BARBELL_SQUAT} onClose={() => {}} />)
    expect(html).toContain('Barbell Squats')
    expect(html).toContain('Depth first, load second')
    expect(html).toContain('Bar racked across the upper back')
    expect(html).toContain('Common mistakes')
  })

  it('shows an honest placeholder rather than crashing for an exercise with no written guide', () => {
    const html = renderToStaticMarkup(<ExerciseHelpModal exercise={NO_GUIDE_EXERCISE} onClose={() => {}} />)
    expect(html).toContain('Placeholder Exercise')
    expect(html).toContain('not written yet')
  })
})
