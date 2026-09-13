// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MuscleMap } from './MuscleMap'
import { MUSCLE_MAPPINGS } from './muscleMapRegions'
import { MuscleSchema } from '../domain/types'
import type { Muscle } from '../domain/types'

function parse(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc
}

describe('MuscleMap', () => {
  it('marks a primary muscle region distinctly from a secondary one', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['chest']} secondaryMuscles={['triceps']} />)
    const doc = parse(html)

    const chestRegion = doc.querySelector('[data-muscle="chest"]')
    const tricepsRegion = doc.querySelector('[data-muscle="triceps"]')
    expect(chestRegion?.getAttribute('data-tone')).toBe('primary')
    expect(tricepsRegion?.getAttribute('data-tone')).toBe('secondary')
  })

  it('leaves an untouched muscle unrendered rather than drawing an empty highlight', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['chest']} secondaryMuscles={[]} />)
    const doc = parse(html)
    expect(doc.querySelector('[data-muscle="quads"]')).toBeNull()
  })

  it('renders side_delts on both the front and back view, since it is visible from both', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['side_delts']} secondaryMuscles={[]} />)
    const doc = parse(html)
    expect(doc.querySelectorAll('[data-muscle="side_delts"]').length).toBe(4) // 2 rects x 2 views
  })

  it('renders a non-silhouette muscle (rotator_cuff) as a labelled badge, not a missing region', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['rotator_cuff']} secondaryMuscles={[]} />)
    expect(html).toContain('Rotator cuff')
  })

  it('every Muscle enum value is covered by a silhouette region or a badge', () => {
    for (const muscle of MuscleSchema.options as Muscle[]) {
      expect(MUSCLE_MAPPINGS[muscle], `'${muscle}' has no mapping in MUSCLE_MAPPINGS`).toBeDefined()
      const mapping = MUSCLE_MAPPINGS[muscle]
      if (mapping.kind === 'silhouette') {
        expect(mapping.front || mapping.back, `'${muscle}' is a silhouette mapping with neither a front nor a back region`).toBeTruthy()
      } else {
        expect(mapping.label.length, `'${muscle}' badge has no label`).toBeGreaterThan(0)
      }
    }
  })

  it('renders nothing highlighted, and no badges, for an exercise touching no muscles', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={[]} secondaryMuscles={[]} />)
    const doc = parse(html)
    expect(doc.querySelectorAll('[data-muscle]').length).toBe(0)
  })
})
