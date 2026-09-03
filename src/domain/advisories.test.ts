import { describe, expect, it } from 'vitest'
import { activeAdvisories, detectAdvisories } from './advisories'
import { weeklyVolumeReport, hardSetsPerMuscle } from './volume'
import { SEED_ROUTINES, seedExercise } from '../db/seed'
import type { Muscle, SetLog } from './types'

/**
 * Builds a week of sets straight from the seed routines, as though every
 * prescribed set had been performed, so the advisories are tested against the
 * hunter's actual training week rather than a synthetic one.
 */
function weekOfSetsFromRoutines(): SetLog[] {
  const sets: SetLog[] = []
  let order = 0
  for (const routine of SEED_ROUTINES) {
    for (const block of routine.blocks) {
      for (const item of block.items) {
        for (let s = 0; s < item.sets; s += 1) {
          sets.push({
            id: `set-${order}`,
            sessionId: routine.id,
            exerciseId: item.exerciseId,
            order,
            weight: 40,
            reps: item.repRange[1],
            isWarmup: false,
            completedAt: 0,
          })
          order += 1
        }
      }
    }
  }
  return sets
}

const weekSets = weekOfSetsFromRoutines()
const weeklySetsByMuscle = hardSetsPerMuscle(weekSets, seedExercise)
const input = {
  routines: SEED_ROUTINES,
  resolveExercise: seedExercise,
  weeklySetsByMuscle,
}
const found = detectAdvisories(input)
const ids = found.map((a) => a.id)

describe('the gaps the brief names are actually detected in the seed week', () => {
  it('finds no hip hinge anywhere', () => {
    expect(ids).toContain('no-hip-hinge')
  })

  it('finds no direct grip work', () => {
    expect(ids).toContain('no-grip-work')
  })

  it('finds no rotator cuff work, despite the reverse fly being in the week', () => {
    expect(ids).toContain('no-cuff-prehab')
  })

  it('finds no unilateral leg work', () => {
    expect(ids).toContain('no-unilateral-lower')
  })

  it('finds direct biceps on back-to-back days', () => {
    expect(ids).toContain('biceps-consecutive-days')
  })

  it('finds three curl variants in the Wednesday session', () => {
    expect(ids).toContain('many-variants-biceps:3')
  })

  it('finds the heavy front-delt volume', () => {
    expect(ids).toContain('front-delt-overload')
  })

  it('finds twice as many push days as leg days', () => {
    expect(ids).toContain('push-leg-day-imbalance')
  })

  it('explains every finding with a reason and a concrete suggestion', () => {
    for (const advisory of found) {
      expect(advisory.finding.length).toBeGreaterThan(20)
      expect(advisory.why.length).toBeGreaterThan(20)
      expect(advisory.suggestion.length).toBeGreaterThan(20)
    }
  })

  it('never proposes rewriting the week', () => {
    for (const advisory of found) {
      expect(advisory.suggestion.toLowerCase()).not.toContain('replace the')
    }
  })
})

describe('advisories stop firing once the gap is closed', () => {
  it('drops the hinge advisory when a hinge is added', () => {
    const withHinge = {
      ...input,
      routines: [
        ...SEED_ROUTINES,
        {
          id: 'extra',
          dayOfWeek: 0,
          name: 'Extra',
          gateRank: 'D' as const,
          blocks: [
            { type: 'single' as const, items: [{ exerciseId: 'romanian-deadlift', sets: 3, repRange: [6, 10] as [number, number], restSec: 120 }] },
          ],
        },
      ],
      resolveExercise: (id: string) =>
        id === 'romanian-deadlift'
          ? {
              id,
              name: 'Romanian Deadlift',
              aliases: [],
              pattern: 'hinge' as const,
              primaryMuscles: ['hamstrings' as Muscle],
              secondaryMuscles: ['glutes' as Muscle],
              equipment: ['barbell' as const],
              unit: 'kg' as const,
              increment: 5,
              repRange: [6, 10] as [number, number],
              usesBodyweight: false,
            }
          : seedExercise(id),
    }
    expect(detectAdvisories(withHinge).map((a) => a.id)).not.toContain('no-hip-hinge')
  })

  it('reports nothing at all for an empty programme rather than everything', () => {
    const empty = detectAdvisories({
      routines: [],
      resolveExercise: () => undefined,
      weeklySetsByMuscle: new Map(),
    })
    // With no programme there is no hinge, no grip work and no cuff work, but
    // there is also no imbalance to report, so only the absence advisories fire.
    expect(empty.map((a) => a.id)).toContain('no-hip-hinge')
    expect(empty.map((a) => a.id)).not.toContain('front-delt-overload')
    expect(empty.map((a) => a.id)).not.toContain('push-leg-day-imbalance')
  })
})

describe('dismissal', () => {
  it('filters out what the hunter has dismissed', () => {
    const remaining = activeAdvisories(found, ['no-hip-hinge'])
    expect(remaining.map((a) => a.id)).not.toContain('no-hip-hinge')
    expect(remaining.length).toBe(found.length - 1)
  })

  it('leaves everything when nothing is dismissed', () => {
    expect(activeAdvisories(found, [])).toHaveLength(found.length)
  })
})

describe('the seed week measured against volume landmarks', () => {
  const report = weeklyVolumeReport(weekSets, seedExercise)

  it('shows the hamstrings as under-served, which is what the missing hinge causes', () => {
    const hamstrings = report.find((r) => r.muscle === 'hamstrings')!
    expect(['none', 'below_mv', 'maintaining', 'below_mev']).toContain(hamstrings.verdict)
  })

  it('shows the rotator cuff getting no work at all', () => {
    expect(report.find((r) => r.muscle === 'rotator_cuff')!.verdict).toBe('none')
  })

  it('shows the front delts at or above the top of their productive range', () => {
    const frontDelts = report.find((r) => r.muscle === 'front_delts')!
    expect(['above_mav', 'over_mrv', 'optimal']).toContain(frontDelts.verdict)
  })

  it('shows the biceps well served, since three days touch them', () => {
    const biceps = report.find((r) => r.muscle === 'biceps')!
    expect(biceps.sets).toBeGreaterThan(0)
  })
})
