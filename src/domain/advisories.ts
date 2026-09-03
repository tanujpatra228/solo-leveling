/**
 * Programme advisories.
 *
 * The training week in the brief has real gaps in it, and the instruction is
 * explicit: surface them as dismissible System advisories rather than silently
 * rewriting the week. So this module observes the routines and the log and
 * reports, and nothing here changes a prescription.
 *
 * Each advisory is detected from the actual data rather than hard-coded against
 * the seed routines, so it stops firing if the hunter fixes the gap and starts
 * firing again if a new one appears.
 */
import { LANDMARKS } from './volume'
import type { Exercise, Muscle, MovementPattern, Routine } from './types'

export type AdvisorySeverity = 'note' | 'gap' | 'imbalance'

export interface Advisory {
  id: string
  severity: AdvisorySeverity
  title: string
  /** What is missing or lopsided, in plain terms. */
  finding: string
  /** Why it matters for the body rather than for the programme on paper. */
  why: string
  /** A concrete, minimal change. Never a rewrite of the week. */
  suggestion: string
}

export interface AdvisoryInput {
  routines: readonly Routine[]
  resolveExercise: (id: string) => Exercise | undefined
  /** Weighted weekly hard sets per muscle, from `weeklyVolumeReport`. */
  weeklySetsByMuscle: ReadonlyMap<Muscle, number>
}

interface WeekShape {
  patterns: Set<MovementPattern>
  musclesWithDirectWork: Set<Muscle>
  /** Days on which each muscle receives direct work. */
  directWorkDays: Map<Muscle, Set<number>>
  /** Distinct exercises per muscle, per day. */
  exercisesPerMusclePerDay: Map<string, number>
  /** Days that train each pattern. */
  patternDays: Map<MovementPattern, Set<number>>
  hasUnilateralLower: boolean
  hasRotatorCuffWork: boolean
  hasDirectGripWork: boolean
}

function describeWeek(input: AdvisoryInput): WeekShape {
  const shape: WeekShape = {
    patterns: new Set(),
    musclesWithDirectWork: new Set(),
    directWorkDays: new Map(),
    exercisesPerMusclePerDay: new Map(),
    patternDays: new Map(),
    hasUnilateralLower: false,
    hasRotatorCuffWork: false,
    hasDirectGripWork: false,
  }

  for (const routine of input.routines) {
    for (const block of routine.blocks) {
      for (const item of block.items) {
        const exercise = input.resolveExercise(item.exerciseId)
        if (!exercise) continue

        shape.patterns.add(exercise.pattern)
        const patternDays = shape.patternDays.get(exercise.pattern) ?? new Set<number>()
        patternDays.add(routine.dayOfWeek)
        shape.patternDays.set(exercise.pattern, patternDays)

        for (const muscle of exercise.primaryMuscles) {
          shape.musclesWithDirectWork.add(muscle)
          const days = shape.directWorkDays.get(muscle) ?? new Set<number>()
          days.add(routine.dayOfWeek)
          shape.directWorkDays.set(muscle, days)

          const key = `${muscle}:${routine.dayOfWeek}`
          shape.exercisesPerMusclePerDay.set(key, (shape.exercisesPerMusclePerDay.get(key) ?? 0) + 1)
        }

        if (exercise.pattern === 'lunge') shape.hasUnilateralLower = true
        if (exercise.primaryMuscles.includes('grip')) shape.hasDirectGripWork = true
        // Only an exercise that actually targets the cuff counts. A reverse fly
        // trains the rear delts by retracting the shoulder blade and does not
        // externally rotate the humerus, so it is not a substitute.
        if (exercise.primaryMuscles.includes('rotator_cuff')) shape.hasRotatorCuffWork = true
      }
    }
  }

  return shape
}

/** Days of the week that contain at least one exercise for a given pattern set. */
function daysTraining(shape: WeekShape, patterns: readonly MovementPattern[]): number {
  const days = new Set<number>()
  for (const pattern of patterns) {
    for (const day of shape.patternDays.get(pattern) ?? []) days.add(day)
  }
  return days.size
}

export function detectAdvisories(input: AdvisoryInput): Advisory[] {
  const shape = describeWeek(input)
  const advisories: Advisory[] = []

  /* ---- no hip hinge anywhere ---- */
  if (!shape.patterns.has('hinge')) {
    advisories.push({
      id: 'no-hip-hinge',
      severity: 'gap',
      title: 'No hip hinge in the week',
      finding:
        'There is no deadlift, Romanian deadlift, or good morning anywhere in the routine, so the hamstrings only ever get the curl machine.',
      why:
        'The hamstrings have two jobs: bending the knee and extending the hip. A leg curl trains the first and nothing trains the second, which leaves the hip-extension half of the muscle largely untrained and the posterior chain weak relative to the quads.',
      suggestion:
        'Add one hinge on the Legs day, three sets of six to ten. A Romanian deadlift is the easiest to learn and the least fatiguing option.',
    })
  }

  /* ---- hamstrings under-served ---- */
  const hamstringSets = input.weeklySetsByMuscle.get('hamstrings') ?? 0
  if (hamstringSets > 0 && hamstringSets < LANDMARKS.hamstrings.mev) {
    advisories.push({
      id: 'hamstrings-below-mev',
      severity: 'gap',
      title: 'Hamstrings below the growth floor',
      finding: `The hamstrings are getting about ${hamstringSets} hard sets a week against a minimum of ${LANDMARKS.hamstrings.mev}.`,
      why:
        'Below the minimum effective volume a muscle holds what it has at best. It also widens the strength gap with the quadriceps, which is one of the more reliable predictors of a hamstring strain.',
      suggestion: 'Two more hamstring sets a week is enough to clear the floor.',
    })
  }

  /* ---- direct biceps on consecutive days ---- */
  const bicepDays = shape.directWorkDays.get('biceps')
  if (bicepDays && bicepDays.size >= 2) {
    const sorted = [...bicepDays].sort((a, b) => a - b)
    const consecutive = sorted.some((day, i) => i > 0 && day - sorted[i - 1]! === 1)
    if (consecutive) {
      advisories.push({
        id: 'biceps-consecutive-days',
        severity: 'note',
        title: 'Direct biceps work on back-to-back days',
        finding: 'Curls land on two consecutive days, so the biceps never get a full day between direct sessions.',
        why:
          'The biceps are a small muscle that recovers quickly, so this is a note rather than a problem. It only becomes one if elbow discomfort shows up or the second day is consistently weaker than the first.',
        suggestion:
          'If the second day feels flat, move one curl variant to a non-adjacent day. Otherwise leave it.',
      })
    }
  }

  /* ---- too many variants of one muscle in one day ---- */
  for (const [key, count] of shape.exercisesPerMusclePerDay) {
    if (count < 3) continue
    const [muscle] = key.split(':') as [Muscle]
    if (muscle !== 'biceps' && muscle !== 'triceps' && muscle !== 'front_delts') continue
    advisories.push({
      id: `many-variants-${key}`,
      severity: 'note',
      title: `Three or more ${muscle.replace(/_/g, ' ')} exercises in one session`,
      finding: `That session runs ${count} separate ${muscle.replace(/_/g, ' ')} movements.`,
      why:
        'Past the second or third exercise for a small muscle in one session, the extra sets are performed under enough local fatigue that they add more recovery cost than stimulus. Spreading them across the week produces more total quality work for the same effort.',
      suggestion: 'Keep two variants in the session and move the third to another day.',
    })
  }

  /* ---- front delts overloaded relative to their landmark ---- */
  const frontDeltSets = input.weeklySetsByMuscle.get('front_delts') ?? 0
  if (frontDeltSets > LANDMARKS.front_delts.mav[1]) {
    advisories.push({
      id: 'front-delt-overload',
      severity: 'imbalance',
      title: 'Heavy front-delt volume',
      finding: `The front delts are receiving about ${frontDeltSets} weighted sets a week, above the ${LANDMARKS.front_delts.mav[1]} where extra work stops paying.`,
      why:
        'Every pressing movement already trains the front delts hard, so direct raises stack on top of an already-large dose. Chronically overdeveloped front delts relative to the rear pull the shoulder forward and are a common source of impingement.',
      suggestion:
        'Drop the front raises first, since incline pressing and shoulder pressing already cover that head. Put the sets into rear delts instead.',
    })
  }

  /* ---- rear delt versus front delt balance ---- */
  const rearDeltSets = input.weeklySetsByMuscle.get('rear_delts') ?? 0
  if (frontDeltSets > 0 && rearDeltSets < frontDeltSets / 2) {
    advisories.push({
      id: 'delt-front-rear-imbalance',
      severity: 'imbalance',
      title: 'Front delts outweigh rear delts',
      finding: `About ${frontDeltSets} front-delt sets a week against ${rearDeltSets} for the rear delts.`,
      why:
        'The rear delts pull the shoulder blade back and externally rotate the arm, which is what keeps the joint centred under a press. When the front outweighs the rear by more than about two to one, posture and shoulder health tend to follow.',
      suggestion: 'Two or three more rear-delt sets a week, on any day, closes the gap.',
    })
  }

  /* ---- push days versus leg days ---- */
  const pushDays = daysTraining(shape, ['horizontal_push', 'vertical_push'])
  const legDays = daysTraining(shape, ['squat', 'hinge', 'lunge'])
  if (legDays > 0 && pushDays >= legDays * 2) {
    advisories.push({
      id: 'push-leg-day-imbalance',
      severity: 'note',
      title: 'Twice as many push days as leg days',
      finding: `${pushDays} days train pressing and ${legDays} trains the legs.`,
      why:
        'The legs are the largest muscle mass in the body and respond to frequency the same way everything else does. One day a week is enough to make progress, but it is the first thing to sacrifice when the week gets disrupted, and it puts all the leg volume into one session that has to be survived rather than trained.',
      suggestion:
        'Adding two or three leg sets to one of the other days is enough to raise frequency without adding a session.',
    })
  }

  /* ---- no unilateral lower body work ---- */
  if (!shape.hasUnilateralLower) {
    advisories.push({
      id: 'no-unilateral-lower',
      severity: 'gap',
      title: 'No single-leg work',
      finding: 'Every lower-body movement in the week is performed on both legs at once.',
      why:
        'Bilateral lifts let the stronger side quietly carry the weaker one, so a side-to-side difference can grow for years without showing up in the numbers. Single-leg work exposes it and also trains frontal-plane hip stability, which nothing else here does.',
      suggestion:
        'One single-leg movement on the Legs day, two or three sets of eight to twelve per side. A split squat or a step-up is enough.',
    })
  }

  /* ---- no direct grip work ---- */
  if (!shape.hasDirectGripWork) {
    advisories.push({
      id: 'no-grip-work',
      severity: 'gap',
      title: 'No direct grip work',
      finding: 'Nothing in the week trains grip as its own target.',
      why:
        'Grip is the limiting factor on rows, pull-ups, and shrugs long before the back is, so a weak grip quietly caps the loading on everything that involves holding something. It is also one of the few trainable qualities that correlates with long-term health outcomes.',
      suggestion:
        'A loaded carry or a timed hang at the end of the back day, two or three sets, costs almost nothing in recovery.',
    })
  }

  /* ---- no rotator cuff or external rotation work ---- */
  if (!shape.hasRotatorCuffWork) {
    advisories.push({
      id: 'no-cuff-prehab',
      severity: 'gap',
      title: 'No rotator cuff work',
      finding: 'There is no external rotation or rear-delt isolation anywhere in the week.',
      why:
        'The cuff muscles hold the head of the humerus in the socket while the big pressing muscles move the arm. With two pressing days and no cuff work, the stabilisers become the weak link in a joint that is being loaded hard twice a week.',
      suggestion:
        'Two sets of cable or band external rotations after either pressing day. Light load, slow, high reps.',
    })
  }

  return advisories
}

/** Filters out advisories the hunter has already dismissed. */
export function activeAdvisories(all: readonly Advisory[], dismissed: readonly string[]): Advisory[] {
  const dismissedSet = new Set(dismissed)
  return all.filter((a) => !dismissedSet.has(a.id))
}
