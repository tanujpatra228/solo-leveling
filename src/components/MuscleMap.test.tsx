// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MuscleMap } from './MuscleMap'
import { ABS_EMPHASIS_BY_EXERCISE, MUSCLE_MAPPINGS, absSegmentSplit, idsFor } from './muscleMapRegions'
import anteriorSvg from './anatomy/anterior-outer-muscles.svg?raw'
import posteriorSvg from './anatomy/posterior-outer-muscles.svg?raw'
import { MuscleSchema } from '../domain/types'
import type { Muscle } from '../domain/types'
import { SEED_EXERCISES } from '../db/seed'

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

  it('fills the linea-alba aponeurosis strips along with the six-pack segments for a plain abs exercise', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['abs']} secondaryMuscles={[]} />)
    expect(html).toMatch(/#rectus-abdominis-top-segment[^{]*\{[^}]*var\(--color-system\)/)
    expect(html).toMatch(/#lower-abdominal-aponeurosis[^{]*\{[^}]*var\(--color-system\)/)
  })

  it('narrows an abs exercise with a known emphasis to its third of the six-pack, dimming the rest rather than dropping it', () => {
    const html = renderToStaticMarkup(
      <MuscleMap primaryMuscles={['abs']} secondaryMuscles={['obliques']} exerciseId="leg-raises" />,
    )
    // leg-raises emphasises the lower third: primary tone there.
    expect(html).toMatch(/#rectus-abdominis-lower-segment[^{]*\{[^}]*var\(--color-system\)/)
    expect(html).toMatch(/#lower-abdominal-aponeurosis[^{]*\{[^}]*var\(--color-system\)/)
    // the other two thirds still train, just dimmer than the emphasised one.
    expect(html).toMatch(/#rectus-abdominis-top-segment[^{]*\{[^}]*var\(--color-system-dim\)/)
    expect(html).toMatch(/#thoracic-aponeurosis[^{]*\{[^}]*var\(--color-system-dim\)/)
    expect(html).toMatch(/#rectus-abdominis-middle-segment[^{]*\{[^}]*var\(--color-system-dim\)/)
  })

  it('gives cable-crunch its own mid-abs emphasis, distinct from leg-raises and from a pure upper-abs one', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['abs']} secondaryMuscles={['obliques']} exerciseId="cable-crunch" />)
    // mid third gets the primary tone...
    expect(html).toMatch(/#rectus-abdominis-middle-segment[^{]*\{[^}]*var\(--color-system\)/)
    expect(html).toMatch(/#upper-abdominal-aponeurosis[^{]*\{[^}]*var\(--color-system\)/)
    // ...while both the top and the bottom are dimmed, not just one of them.
    expect(html).toMatch(/#rectus-abdominis-top-segment[^{]*\{[^}]*var\(--color-system-dim\)/)
    expect(html).toMatch(/#rectus-abdominis-lower-segment[^{]*\{[^}]*var\(--color-system-dim\)/)
  })

  it('colours the two un-id\'d overlay paths this app named, not just the aponeurosis groups underneath them', () => {
    // anterior-outer-muscles.svg draws mid-abdominal-aponeurosis-overlay-left/right-01
    // on top of upper-abdominal-aponeurosis + middle-abdominal-aponeurosis with no id
    // of their own in the source file. Colouring only the groups underneath left the
    // mid third looking like a dark hole, since the overlay painted over them.
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['abs']} secondaryMuscles={[]} />)
    expect(html).toMatch(/#mid-abdominal-aponeurosis-overlay-left-01[^{]*\{[^}]*var\(--color-system\)/)
    expect(html).toMatch(/#mid-abdominal-aponeurosis-overlay-right-01[^{]*\{[^}]*var\(--color-system\)/)
  })

  it('renders abs uniformly for an exercise id with no emphasis entry', () => {
    const html = renderToStaticMarkup(<MuscleMap primaryMuscles={['abs']} secondaryMuscles={[]} exerciseId="side-plank" />)
    expect(html).toMatch(/#rectus-abdominis-top-segment[^{]*\{[^}]*var\(--color-system\)/)
    expect(html).toMatch(/#rectus-abdominis-lower-segment[^{]*\{[^}]*var\(--color-system\)/)
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

  describe('ABS_EMPHASIS_BY_EXERCISE stays in sync with the seeded exercises', () => {
    const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]))

    for (const [exerciseId, emphasis] of Object.entries(ABS_EMPHASIS_BY_EXERCISE)) {
      it(`'${exerciseId}' is a seeded exercise that actually trains abs`, () => {
        const exercise = byId.get(exerciseId)
        expect(exercise, `'${exerciseId}' in ABS_EMPHASIS_BY_EXERCISE is not a seeded exercise id`).toBeDefined()
        expect(exercise!.primaryMuscles.includes('abs') || exercise!.secondaryMuscles.includes('abs')).toBe(true)
      })

      it(`'${exerciseId}'s '${emphasis}' emphasis ids are all real abs ids`, () => {
        const { emphasised, rest } = absSegmentSplit(emphasis)
        const absIds = idsFor('abs', 'front')
        for (const id of [...emphasised, ...rest]) {
          expect(absIds, `'${id}' is not one of abs's front ids`).toContain(id)
        }
      })
    }
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
