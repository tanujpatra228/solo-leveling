/**
 * Gates. One gym session is one Gate: Monday is the CST Gate, Friday the Legs
 * Gate. A gate carries a rank from E to S computed from the work it asks for,
 * the top set is its Boss, and a personal record is a boss kill.
 *
 * The canon Dungeon Break happens seven days after a gate opens if the boss is
 * not slain, and that is the number used here rather than an invented one.
 */
import { epley } from './e1rm'
import { DUNGEON_BREAK_DAYS, addDaysToKey, daysBetweenKeys } from './time'
import { RANK_ORDER, type DayKey, type Equipment, type Exercise, type Rank, type SetLog } from './types'

/* ------------------------------------------------------------------ */
/* Gate difficulty                                                     */
/* ------------------------------------------------------------------ */

export interface PlannedWork {
  exerciseId: string
  sets: number
  reps: number
  weightKg: number
  /** Best known estimated max for this exercise, for the intensity term. */
  e1rmKg: number
}

export interface GateDifficulty {
  rank: Rank
  plannedTonnageKg: number
  /** Mean fraction of estimated max the working sets sit at, 0 to 1. */
  meanIntensity: number
  /** The combined score the rank is read from. */
  score: number
}

/**
 * Difficulty thresholds, in score units. Tonnage alone would call a long easy
 * session harder than a short brutal one, and intensity alone would call a
 * single heavy triple harder than a full session, so the score multiplies the
 * two and the thresholds are set against that product.
 */
export const GATE_SCORE_THRESHOLDS: Record<Exclude<Rank, 'E'>, number> = {
  D: 2_000,
  C: 4_500,
  B: 7_500,
  A: 11_000,
  S: 15_000,
}

/**
 * Intensity is expressed relative to estimated max. Where no max is known yet
 * the set is treated as moderate rather than being dropped, because dropping it
 * would make a hunter's first week look like an easy week.
 */
export const ASSUMED_INTENSITY_WITHOUT_HISTORY = 0.7

export function gateDifficulty(plan: readonly PlannedWork[]): GateDifficulty {
  let tonnage = 0
  let intensitySum = 0
  let intensityCount = 0

  for (const item of plan) {
    tonnage += item.weightKg * item.reps * item.sets

    if (item.e1rmKg > 0 && item.weightKg > 0) {
      intensitySum += Math.min(1.2, item.weightKg / item.e1rmKg)
      intensityCount += 1
    } else {
      intensitySum += ASSUMED_INTENSITY_WITHOUT_HISTORY
      intensityCount += 1
    }
  }

  const meanIntensity = intensityCount > 0 ? intensitySum / intensityCount : 0
  // Squaring the intensity term makes heavy work count for more than the linear
  // tonnage already gives it, which is what separates a Red Gate from a pump
  // session of the same total volume.
  const score = tonnage * meanIntensity ** 2

  let rank: Rank = 'E'
  for (const candidate of ['D', 'C', 'B', 'A', 'S'] as const) {
    if (score >= GATE_SCORE_THRESHOLDS[candidate]) rank = candidate
  }

  return { rank, plannedTonnageKg: tonnage, meanIntensity, score }
}

/* ------------------------------------------------------------------ */
/* Boss kills                                                          */
/* ------------------------------------------------------------------ */

export interface BossResult {
  exerciseId: string
  /** The top set of the session for this exercise. */
  weightKg: number
  reps: number
  e1rmKg: number
  /** True when this beat the previous best. */
  killed: boolean
  previousBestE1rmKg: number
}

/** A record has to beat the old one by this much to count, in kilograms of
 * estimated max. Rounding and day-to-day noise would otherwise produce a
 * "personal record" every session, which would make the word meaningless. */
export const PR_MARGIN_KG = 0.5

/**
 * Whether the session killed the boss for each exercise it touched. Warmups are
 * excluded and rep counts above the reliable range are ignored, so a long set
 * of light work cannot register as a strength record.
 */
export function resolveBosses(
  sets: readonly SetLog[],
  previousBestE1rm: (exerciseId: string) => number,
): BossResult[] {
  const bestBySets = new Map<string, { weightKg: number; reps: number; e1rmKg: number }>()

  for (const set of sets) {
    if (set.isWarmup || set.reps <= 0 || set.reps > 12) continue
    const e1rmKg = epley(set.weight, set.reps)
    const current = bestBySets.get(set.exerciseId)
    if (!current || e1rmKg > current.e1rmKg) {
      bestBySets.set(set.exerciseId, { weightKg: set.weight, reps: set.reps, e1rmKg })
    }
  }

  const results: BossResult[] = []
  for (const [exerciseId, best] of bestBySets) {
    const previous = previousBestE1rm(exerciseId)
    results.push({
      exerciseId,
      weightKg: best.weightKg,
      reps: best.reps,
      e1rmKg: best.e1rmKg,
      previousBestE1rmKg: previous,
      killed: best.e1rmKg > previous + PR_MARGIN_KG,
    })
  }

  return results
}

/* ------------------------------------------------------------------ */
/* Dungeon Break                                                       */
/* ------------------------------------------------------------------ */

export type GateState = 'open' | 'cleared' | 'broken'

export interface OpenGate {
  routineId: string
  openedDayKey: DayKey
  rank: Rank
}

export interface DungeonBreak {
  routineId: string
  openedDayKey: DayKey
  brokeOnDayKey: DayKey
  rank: Rank
  /** Extra work owed, as a fraction of the missed session. */
  backlogSurcharge: number
  announcement: string
  detail: string
}

/** A broken gate owes this much extra work on top of the session itself. */
export const BACKLOG_SURCHARGE = 0.25

export function gateStateFor(gate: OpenGate, today: DayKey, cleared: boolean): GateState {
  if (cleared) return 'cleared'
  return daysBetweenKeys(gate.openedDayKey, today) >= DUNGEON_BREAK_DAYS ? 'broken' : 'open'
}

export function daysUntilBreak(gate: OpenGate, today: DayKey): number {
  return DUNGEON_BREAK_DAYS - daysBetweenKeys(gate.openedDayKey, today)
}

/**
 * A gate left unslain past the canon seven days breaks. Like every other
 * penalty in this app it adds work rather than removing anything already
 * earned.
 */
export function resolveDungeonBreaks(
  openGates: readonly OpenGate[],
  today: DayKey,
): DungeonBreak[] {
  return openGates
    .filter((gate) => daysBetweenKeys(gate.openedDayKey, today) >= DUNGEON_BREAK_DAYS)
    .map((gate) => ({
      routineId: gate.routineId,
      openedDayKey: gate.openedDayKey,
      brokeOnDayKey: addDaysToKey(gate.openedDayKey, DUNGEON_BREAK_DAYS),
      rank: gate.rank,
      backlogSurcharge: BACKLOG_SURCHARGE,
      announcement: '[Dungeon Break. A gate has been left open too long.]',
      detail: `This gate opened on ${gate.openedDayKey} and was never cleared. Nothing has been taken away — the session is added to your backlog with a ${Math.round(BACKLOG_SURCHARGE * 100)}% surcharge.`,
    }))
}

/* ------------------------------------------------------------------ */
/* Red Gate                                                            */
/* ------------------------------------------------------------------ */

/** Canon: a Red Gate is at minimum B-rank and closes behind you. */
export const RED_GATE_MIN_RANK: Rank = 'B'

export interface RedGate {
  routineId: string | null
  rank: Rank
  kind: 'pr_attempt' | 'amrap_finisher'
  description: string
  warning: string
}

export function canEnterRedGate(hunterRank: Rank | null): boolean {
  if (hunterRank === null) return false
  return RANK_ORDER.indexOf(hunterRank) >= RANK_ORDER.indexOf(RED_GATE_MIN_RANK)
}

/**
 * A voluntary brutal session. Once entered there is no partial credit, which is
 * the whole point: in canon a Red Gate closes behind you.
 */
export function buildRedGate(input: {
  kind: 'pr_attempt' | 'amrap_finisher'
  exerciseName: string
  targetWeightKg?: number
  rank: Rank
  routineId: string | null
}): RedGate {
  const description =
    input.kind === 'pr_attempt'
      ? `Single repetition on ${input.exerciseName}${input.targetWeightKg ? ` at ${input.targetWeightKg} kg` : ''}. Beat your record or the gate is not cleared.`
      : `As many repetitions as possible on ${input.exerciseName} in one unbroken set. Stop and the set is over.`

  return {
    routineId: input.routineId,
    rank: input.rank,
    kind: input.kind,
    description,
    warning:
      'A Red Gate closes behind you. There is no partial credit — the objective is met or the gate is failed. Failing costs nothing you have already earned, but it pays nothing either.',
  }
}

/* ------------------------------------------------------------------ */
/* Instant Dungeon Key                                                 */
/* ------------------------------------------------------------------ */

export interface InstantDungeon {
  name: string
  blocks: { exerciseId: string; sets: number; reps: number; restSec: number }[]
  detail: string
}

/**
 * Travel or home mode. Builds a session out of whatever the hunter actually has
 * to hand, which for most people away from a gym is their own bodyweight and a
 * floor.
 *
 * Deliberately picks from the existing exercise library rather than inventing
 * movements, so the work still feeds the same progression and volume tracking.
 */
export function buildInstantDungeon(input: {
  available: readonly Equipment[]
  library: readonly Exercise[]
  /** How many exercises to include. */
  size?: number
}): InstantDungeon {
  const availableSet = new Set<Equipment>(input.available.length > 0 ? input.available : ['bodyweight'])
  const size = input.size ?? 5

  const usable = input.library.filter(
    (exercise) =>
      exercise.pattern !== 'cardio' && exercise.equipment.every((eq) => availableSet.has(eq)),
  )

  // Spread across movement patterns so the session is not five chest exercises.
  const byPattern = new Map<string, Exercise[]>()
  for (const exercise of usable) {
    const list = byPattern.get(exercise.pattern) ?? []
    list.push(exercise)
    byPattern.set(exercise.pattern, list)
  }

  const chosen: Exercise[] = []
  const patterns = [...byPattern.keys()].sort()
  let round = 0
  while (chosen.length < size && round < 10) {
    let addedThisRound = false
    for (const pattern of patterns) {
      if (chosen.length >= size) break
      const candidate = byPattern.get(pattern)?.[round]
      if (candidate) {
        chosen.push(candidate)
        addedThisRound = true
      }
    }
    if (!addedThisRound) break
    round += 1
  }

  return {
    name: 'Instant Dungeon',
    blocks: chosen.map((exercise) => ({
      exerciseId: exercise.id,
      sets: 3,
      reps: exercise.repRange[1],
      restSec: 60,
    })),
    detail:
      chosen.length > 0
        ? 'Built from the equipment you said you have. It counts toward volume and progression like any other gate.'
        : 'Nothing in the library matches the equipment available. Add bodyweight access in settings.',
  }
}
