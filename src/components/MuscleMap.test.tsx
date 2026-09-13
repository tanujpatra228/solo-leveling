// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MuscleMap } from './MuscleMap'
import { MUSCLE_MAPPINGS, idsFor } from './muscleMapRegions'
import anteriorSvg from './anatomy/anterior-outer-muscles.svg?raw'
import posteriorSvg from './anatomy/posterior-outer-muscles.svg?raw'
import { MuscleSchema } from '../domain/types'
import type { Muscle } from '../domain/types'

describe('MuscleMap', () => {
  it('marks a primary muscle region distinctly from a secondary one', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['chest']} secondaryMuscles={['triceps']} />)
    // pectoralis-major (chest, primary) gets the bright fill, triceps-brachii (secondary) the dim one.
    expect(html).toMatch(/#pectoralis-major[^{]*\{[^}]*var\(--color-system\)/)
    expect(html).toMatch(/#triceps-brachii[^{]*\{[^}]*var\(--color-system-dim\)/)
  })

  it('leaves an untouched muscle uncoloured rather than injecting an empty rule', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['chest']} secondaryMuscles={[]} />)
    expect(html).not.toContain('#vastus-lateralis') // part of quads, untouched here
  })

  it('renders a non-silhouette muscle (cardio) as a labelled badge, not a missing region', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['cardio']} secondaryMuscles={[]} />)
    expect(html).toContain('Cardiovascular')
  })

  it('renders rotator_cuff as a real region now, not a badge — this atlas has the region the earlier one lacked', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['rotator_cuff']} secondaryMuscles={[]} />)
    expect(html).toContain('#rotator-cuff-infraspinatus-teres-region')
    expect(html).not.toContain('Rotator cuff')
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

  it('still themes the base body (fill + outline) but highlights nothing for an exercise touching no muscles', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={[]} secondaryMuscles={[]} />)
    // The base rule (every `path`, unconditional) is always present — that's
    // what keeps the diagram out of the source SVG's native grey/white and
    // gives the anterior view an outline it doesn't otherwise have.
    expect(html).toMatch(/path \{[^}]*var\(--color-panel-edge\)/)
    // But no muscle earns its own per-id override, and no badge shows.
    expect(html).not.toContain('#pectoralis-major')
    expect(html).not.toContain('rounded-full border')
  })

  describe('every id this app references actually exists in the SVG it targets', () => {
    // The strongest guard against a typo in muscleMapRegions.ts: BodyMap's CSS
    // rule silently no-ops for an id that doesn't exist, so a mistyped id here
    // would fail closed (nothing highlighted) rather than crash — exactly the
    // kind of bug a coverage test is for.
    const SVG_SOURCE = { front: anteriorSvg, back: posteriorSvg } as const

    for (const muscle of MuscleSchema.options as Muscle[]) {
      for (const view of ['front', 'back'] as const) {
        const ids = idsFor(muscle, view)
        for (const id of ids) {
          it(`'${id}' (${muscle}, ${view}) exists in the ${view} SVG`, () => {
            expect(SVG_SOURCE[view], `'${id}' referenced for ${muscle}/${view} is not in that view's SVG`).toContain(`id="${id}"`)
          })
        }
      }
    }
  })
})
