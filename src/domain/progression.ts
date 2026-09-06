/**
 * Double progression. This is the part of the app that decides what the hunter
 * lifts next, and it is arithmetic rather than judgement, so it is stated here
 * once and tested against the brief.
 *
 * The rule, for an exercise with a rep range [lo, hi] and a set count:
 *
 *   - every set reached `hi` at RPE 8 or below  -> add one increment, reps back to `lo`
 *   - any set fell below `lo`                   -> drop about 7%, or repeat the session
 *   - otherwise                                 -> hold the load, add a rep to the lowest set
 *
 * Nothing here is a language model and nothing here is random. A model inventing
 * "3x8 at 60 kg" is unverifiable and can injure someone.
 */
import { roundToIncrement } from './units'
import type { Exercise, Equipment, SetLog } from './types'

/** Load is cut by this factor when a set falls below the bottom of the range. */
export const DELOAD_FACTOR = 0.93

/** The effort ceiling that still counts as clean enough to add load. */
export const PROGRESSION_RPE_CEILING = 8

/** Past this age the smaller plate step is preferred where one exists. */
export const INCREMENT_SOFTENING_AGE = 40

/** The smallest step any real gym can make, in kilograms. */
export const MIN_PLATE_STEP = 1.25

/** Added load for a bodyweight movement that has run out of reps. */
export const BODYWEIGHT_LOAD_STEP = 2.5

export type ProgressionKind =
  | 'no_history'
  | 'increase_load'
  | 'hold_add_rep'
  | 'repeat_session'
  | 'reduce_load'
  | 'add_external_load'
  | 'advance_variation'
  | 'slow_the_tempo'

export interface NextTarget {
  exerciseId: string
  kind: ProgressionKind
  /** Prescribed load in kilograms. Zero for an unloaded bodyweight set. */
  weightKg: number
  /** One rep target per set, so a partly-progressed exercise keeps its shape. */
  repTargets: number[]
  /** Plain-language reason, shown in the System window. */
  reason: string
  /** Set when the ladder moved to a different exercise. */
  nextExerciseId?: string
  /** A coaching cue attached to this specific decision, if any. */
  cue?: string
}

export interface ProgressionContext {
  /** Working sets of this exercise from the most recent session containing it. */
  lastSets: readonly SetLog[]
  /** Hunter age in years. Softens the load step past 40. */
  age?: number
  /** What the hunter can actually get their hands on. */
  equipmentAccess?: readonly Equipment[]
  /** Resolves the next rung of a bodyweight ladder. */
  resolveExercise?: (id: string) => Exercise | undefined
  /**
   * The routine block's own rep range, when it differs from the exercise's.
   * Varying rep ranges for the same movement across a week is ordinary
   * programming, and `BlockItem.repRange` already carries it — the engine was
   * simply never asked to read it. Falls back to `exercise.repRange`.
   */
  repRangeOverride?: readonly [number, number]
}

/**
 * The load step to use for this exercise and hunter. Older lifters take the
 * smaller plate step where the implement allows one, because the same absolute
 * jump is a larger relative jump the longer recovery takes.
 */
export function effectiveIncrement(exercise: Exercise, age?: number): number {
  const base = exercise.increment
  if (base <= 0) return 0
  if (age !== undefined && age >= INCREMENT_SOFTENING_AGE) {
    const softened = base / 2
    if (softened >= MIN_PLATE_STEP) return softened
  }
  return base
}

function workingSets(sets: readonly SetLog[]): SetLog[] {
  return sets.filter((s) => !s.isWarmup && s.reps > 0)
}

/**
 * RPE is optional, so an unlogged set is treated as clean. Reps are the primary
 * signal in double progression; RPE only vetoes a load increase when the hunter
 * actually told us the set was a grind.
 */
function withinEffortCeiling(sets: readonly SetLog[]): boolean {
  return sets.every((s) => s.rpe === undefined || s.rpe <= PROGRESSION_RPE_CEILING)
}

function heaviestLoad(sets: readonly SetLog[]): number {
  return sets.reduce((max, s) => (s.weight > max ? s.weight : max), 0)
}

function canAddExternalLoad(equipment: readonly Equipment[] | undefined): boolean {
  if (!equipment) return false
  return (
    equipment.includes('dumbbell') ||
    equipment.includes('kettlebell') ||
    equipment.includes('bands') ||
    equipment.includes('cable')
  )
}

/**
 * Adds one rep to the lowest set, leaving the rest alone. This is the "otherwise"
 * branch, and it is what makes the progression gradual instead of all-or-nothing.
 */
function addRepToLowest(reps: number[], hi: number): number[] {
  const next = [...reps]
  let lowestIndex = 0
  for (let i = 1; i < next.length; i += 1) {
    if (next[i]! < next[lowestIndex]!) lowestIndex = i
  }
  if (next[lowestIndex]! < hi) next[lowestIndex] = next[lowestIndex]! + 1
  return next
}

/**
 * What to do next for one exercise, given how the last session on it went.
 *
 * `plannedSets` is the set count from the routine, used when there is no history
 * to shape the prescription from.
 */
export function computeNextTarget(
  exercise: Exercise,
  plannedSets: number,
  ctx: ProgressionContext,
): NextTarget {
  const [lo, hi] = ctx.repRangeOverride ?? exercise.repRange
  const sets = workingSets(ctx.lastSets)
  const isBodyweight = exercise.increment === 0 || exercise.unit === 'reps'

  if (sets.length === 0) {
    return {
      exerciseId: exercise.id,
      kind: 'no_history',
      weightKg: 0,
      repTargets: Array.from({ length: plannedSets }, () => lo),
      reason:
        'No record of this movement. Work up to a load you can hold for the bottom of the rep range and log it — the System calibrates from the first entry.',
      cue: exercise.cue,
    }
  }

  const load = heaviestLoad(sets)
  const reps = sets.map((s) => s.reps)
  const increment = effectiveIncrement(exercise, ctx.age)
  const allAtCeiling = reps.every((r) => r >= hi)
  const effortClean = withinEffortCeiling(sets)
  const belowFloor = reps.filter((r) => r < lo)

  /* ---- every set at the top of the range, and it was not a grind ---- */
  if (allAtCeiling && effortClean) {
    if (!isBodyweight) {
      const nextWeight = roundToIncrement(load + increment, increment)
      return {
        exerciseId: exercise.id,
        kind: 'increase_load',
        weightKg: nextWeight,
        repTargets: Array.from({ length: sets.length }, () => lo),
        reason: `Every set hit ${hi} reps cleanly. Load rises by ${increment} kg and reps reset to ${lo}.`,
        cue: exercise.cue,
      }
    }

    // A bodyweight movement out of reps climbs the ladder instead: reps first
    // (already exhausted), then added load if there is anything to hang off the
    // body, then a harder variation.
    if (load > 0 || canAddExternalLoad(ctx.equipmentAccess)) {
      const nextWeight = roundToIncrement(load + BODYWEIGHT_LOAD_STEP, MIN_PLATE_STEP)
      return {
        exerciseId: exercise.id,
        kind: 'add_external_load',
        weightKg: nextWeight,
        repTargets: Array.from({ length: sets.length }, () => lo),
        reason: `${hi} reps is no longer a challenge. Add ${BODYWEIGHT_LOAD_STEP} kg and drop back to ${lo} reps.`,
        cue: exercise.cue,
      }
    }

    const ladder = exercise.progressionLadder ?? []
    const currentRung = ladder.indexOf(exercise.id)
    const nextRung = currentRung >= 0 ? ladder[currentRung + 1] : ladder[0]
    const nextExercise = nextRung !== undefined ? ctx.resolveExercise?.(nextRung) : undefined
    // A fallback exists only to be swapped onto for one session — mastering a
    // variation must not silently rewrite the programme onto it. See commit
    // 5d33216. Falls through to hold_add_rep below, same as a ladder with
    // nothing left to advance to.
    if (nextRung !== undefined && nextRung !== exercise.id && nextExercise?.role !== 'fallback') {
      const nextName = nextExercise?.name ?? nextRung
      return {
        exerciseId: exercise.id,
        kind: 'advance_variation',
        weightKg: 0,
        repTargets: Array.from({ length: sets.length }, () => nextExercise?.repRange[0] ?? lo),
        reason: `This variation is mastered. The System unlocks ${nextName}.`,
        nextExerciseId: nextRung,
        cue: nextExercise?.cue,
      }
    }

    return {
      exerciseId: exercise.id,
      kind: 'hold_add_rep',
      weightKg: load,
      repTargets: addRepToLowest(reps, hi + 5),
      reason: `Top of the ladder with nothing to add. Keep extending reps beyond ${hi}.`,
      cue: exercise.cue,
    }
  }

  /* ---- every set at the top of the range, but it was a grind ---- */
  if (allAtCeiling && !effortClean) {
    return {
      exerciseId: exercise.id,
      kind: 'slow_the_tempo',
      weightKg: load,
      repTargets: Array.from({ length: sets.length }, () => hi),
      reason: `Reps are there but the effort is above RPE ${PROGRESSION_RPE_CEILING}. Hold this load and slow the lowering phase to three seconds before adding weight.`,
      cue: exercise.cue,
    }
  }

  /* ---- something fell out of the bottom of the range ---- */
  if (belowFloor.length > 0) {
    const worstShortfall = Math.max(...belowFloor.map((r) => lo - r))
    // One set missing by a single rep is a bad day, not an overreach. Repeating
    // the session is the cheaper correction; only a real miss cuts the load.
    if (belowFloor.length === 1 && worstShortfall <= 1) {
      return {
        exerciseId: exercise.id,
        kind: 'repeat_session',
        weightKg: load,
        repTargets: Array.from({ length: sets.length }, () => lo),
        reason: `One set came up a rep short. Repeat this load before changing anything.`,
        cue: exercise.cue,
      }
    }

    const step = increment > 0 ? increment : MIN_PLATE_STEP
    const reduced = roundToIncrement(load * DELOAD_FACTOR, step)
    // Rounding must not leave the load unchanged, or the correction does nothing.
    const nextWeight = reduced >= load ? Math.max(0, load - step) : reduced
    return {
      exerciseId: exercise.id,
      kind: 'reduce_load',
      weightKg: nextWeight,
      repTargets: Array.from({ length: sets.length }, () => lo),
      reason: `${belowFloor.length} set${belowFloor.length === 1 ? '' : 's'} fell below ${lo} reps. Load drops about 7% to ${nextWeight} kg and builds back.`,
      cue: exercise.cue,
    }
  }

  /* ---- inside the range: hold the load, add a rep to the lowest set ---- */
  return {
    exerciseId: exercise.id,
    kind: 'hold_add_rep',
    weightKg: load,
    repTargets: addRepToLowest(reps, hi),
    reason: `Inside the ${lo}-${hi} range. Same load, one more rep on the weakest set.`,
    cue: exercise.cue,
  }
}

/**
 * The prescription for a whole session: one target per exercise in the routine.
 *
 * `historyFor` hands back the working sets of the most recent session that
 * contained the exercise, which is all the decision needs.
 */
export function computeSessionTargets(
  exercises: readonly {
    exercise: Exercise
    plannedSets: number
    repRangeOverride?: readonly [number, number]
  }[],
  historyFor: (exerciseId: string) => readonly SetLog[],
  ctx: Omit<ProgressionContext, 'lastSets' | 'repRangeOverride'> = {},
): NextTarget[] {
  return exercises.map(({ exercise, plannedSets, repRangeOverride }) =>
    computeNextTarget(exercise, plannedSets, {
      ...ctx,
      lastSets: historyFor(exercise.id),
      repRangeOverride,
    }),
  )
}
