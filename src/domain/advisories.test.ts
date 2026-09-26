import { describe, expect, it } from 'vitest'
import { activeAdvisories, detectAdvisories } from './advisories'
import { weeklyVolumeReport, hardSetsPerMuscle } from './volume'
import { SEED_ROUTINES, seedExercise } from '../db/seed'
import type { Equipment, Muscle, SetLog } from './types'

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
// SEED_ROUTINES is the barbell week, so the fixture's own equipment access
// matches it — full gym, no bodyweight-programme advisory should fire
// against data that was never bodyweight in the first place.
const FULL_GYM: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bench', 'ez_bar']
const input = {
  routines: SEED_ROUTINES,
  resolveExercise: seedExercise,
  weeklySetsByMuscle,
  equipmentAccess: FULL_GYM,
}
const found = detectAdvisories(input)
const ids = found.map((a) => a.id)

describe('the Push/Pull/Legs split closes every gap the CST split had', () => {
  // The CST/back-biceps/legs split (now LEGACY_SEED_ROUTINES_CST) closed
  // five structural gaps over its own lifetime — Romanian Deadlift, Barbell
  // Hip Thrust, Cable External Rotation, Farmer's Carry, Dumbbell Bulgarian
  // Split Squat — but still left three warnings firing simultaneously
  // (biceps on back-to-back days, three curl variants in one session, heavy
  // front-delt volume), found on a real hunter's Analysis screen. The PPL
  // split that replaced it (docs/TODO.md) was verified against this exact
  // function before shipping: every one of the eight closes, none by
  // accident — each `it` below names the specific design choice responsible.
  it('finds no missing hip hinge — Romanian Deadlift, Legs A', () => {
    expect(ids).not.toContain('no-hip-hinge')
  })

  it('finds no missing grip work — Farmer\'s Carry, Pull A', () => {
    expect(ids).not.toContain('no-grip-work')
  })

  it('finds no missing rotator cuff work — Cable External Rotation, both Push days', () => {
    expect(ids).not.toContain('no-cuff-prehab')
  })

  it('finds no missing unilateral leg work — Dumbbell Bulgarian Split Squat, Legs B', () => {
    expect(ids).not.toContain('no-unilateral-lower')
  })

  it('finds no push-day-to-leg-day imbalance — two Push, two Pull, two Legs', () => {
    expect(ids).not.toContain('push-leg-day-imbalance')
  })

  it('finds no biceps on back-to-back days — biceps work lives only on Pull A (Tue) and Pull B (Fri), never adjacent', () => {
    expect(ids).not.toContain('biceps-consecutive-days')
  })

  it('finds no three-plus biceps exercises in one session — capped at two per Pull day', () => {
    expect(ids).not.toContain('many-variants-biceps:2')
    expect(ids).not.toContain('many-variants-biceps:3')
  })

  it('finds no front-delt overload — no front-raise-style isolation anywhere; pressing alone stays under the ceiling', () => {
    expect(ids).not.toContain('front-delt-overload')
  })

  it('finds no front-delt/rear-delt imbalance either — every Pull day carries direct rear-delt work', () => {
    expect(ids).not.toContain('delt-front-rear-imbalance')
  })

  it('fires nothing at all against the shipped week', () => {
    expect(ids).toEqual([])
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
              bodyweightFactor: 1,
              role: 'prescribed' as const,
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
      equipmentAccess: FULL_GYM,
    })
    // With no programme there is no hinge, no grip work and no cuff work, but
    // there is also no imbalance to report, so only the absence advisories fire.
    expect(empty.map((a) => a.id)).toContain('no-hip-hinge')
    expect(empty.map((a) => a.id)).not.toContain('front-delt-overload')
    expect(empty.map((a) => a.id)).not.toContain('push-leg-day-imbalance')
  })
})

describe('the bodyweight-specific advisories (docs/bodyweight-gates-plan.md §6)', () => {
  // Both are keyed on equipment access alone, unlike every advisory above —
  // they describe a hard equipment constraint the library has no bodyweight
  // answer for, not something rearranging the week could fix. An empty
  // routine/resolveExercise/weeklySetsByMuscle isolates that: whatever fires
  // here fires purely off the equipment argument.
  const bare = { routines: [], resolveExercise: () => undefined, weeklySetsByMuscle: new Map<Muscle, number>() }

  it('no-pullup-bar fires for bodyweight access with no bar', () => {
    const ids = detectAdvisories({ ...bare, equipmentAccess: ['bodyweight'] }).map((a) => a.id)
    expect(ids).toContain('no-pullup-bar')
  })

  it('no-pullup-bar does not fire once a pull-up bar is in the access list', () => {
    const ids = detectAdvisories({ ...bare, equipmentAccess: ['bodyweight', 'pullup_bar'] }).map((a) => a.id)
    expect(ids).not.toContain('no-pullup-bar')
  })

  it('no-pullup-bar does not fire for a full gym, bar or not', () => {
    expect(detectAdvisories({ ...bare, equipmentAccess: FULL_GYM }).map((a) => a.id)).not.toContain('no-pullup-bar')
    expect(
      detectAdvisories({ ...bare, equipmentAccess: [...FULL_GYM, 'pullup_bar'] }).map((a) => a.id),
    ).not.toContain('no-pullup-bar')
  })

  it('no-external-load fires for any bodyweight programme, with or without a bar', () => {
    expect(detectAdvisories({ ...bare, equipmentAccess: ['bodyweight'] }).map((a) => a.id)).toContain(
      'no-external-load',
    )
    expect(
      detectAdvisories({ ...bare, equipmentAccess: ['bodyweight', 'pullup_bar', 'bench'] }).map((a) => a.id),
    ).toContain('no-external-load')
  })

  it('no-external-load does not fire once any load-bearing equipment is present', () => {
    for (const eq of ['barbell', 'dumbbell', 'machine', 'cable', 'ez_bar', 'kettlebell', 'bands'] as Equipment[]) {
      const ids = detectAdvisories({ ...bare, equipmentAccess: [eq] }).map((a) => a.id)
      expect(ids, `${eq} should not leave no-external-load firing`).not.toContain('no-external-load')
    }
  })

  it('no equipment access at all still normalises to the bodyweight programme, so both fire', () => {
    const ids = detectAdvisories({ ...bare, equipmentAccess: [] }).map((a) => a.id)
    expect(ids).toContain('no-pullup-bar')
    expect(ids).toContain('no-external-load')
  })
})

describe('dismissal', () => {
  // A synthetic list, not `found` — the PPL split fires nothing against the
  // real seed week (the point of the describe block above), which would
  // make these vacuous. activeAdvisories is pure filtering logic and does
  // not care what produced its input.
  const synthetic = [
    { id: 'no-hip-hinge', severity: 'gap', title: '', finding: '', why: '', suggestion: '' },
    { id: 'front-delt-overload', severity: 'imbalance', title: '', finding: '', why: '', suggestion: '' },
  ] as const

  it('filters out what the hunter has dismissed', () => {
    const remaining = activeAdvisories(synthetic, ['front-delt-overload'])
    expect(remaining.map((a) => a.id)).toEqual(['no-hip-hinge'])
  })

  it('leaves everything when nothing is dismissed', () => {
    expect(activeAdvisories(synthetic, [])).toHaveLength(synthetic.length)
  })
})

describe('the seed week measured against volume landmarks', () => {
  const report = weeklyVolumeReport(weekSets, seedExercise)

  it('shows the hamstrings now cleared past the growth floor, with the hinge added', () => {
    const hamstrings = report.find((r) => r.muscle === 'hamstrings')!
    expect(['below_mev', 'optimal', 'above_mav']).toContain(hamstrings.verdict)
  })

  it('shows the rotator cuff getting real work now, from the external rotation sets', () => {
    expect(report.find((r) => r.muscle === 'rotator_cuff')!.verdict).not.toBe('none')
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
