/**
 * Experience and levels.
 *
 * The brief fixes the shape of both: XP is
 *
 *   tonnage/K + hardSetValue * hardSets + workMinuteValue * workMinutes
 *     + prValue * exercisePRs + gateClearBonus
 *
 * multiplied by the fatigue multiplier, and the level curve is
 *
 *   xpToNext = 100 * level^1.5
 *
 * The curve is taken as given. The constants in the earning formula are the
 * calibration knobs, tuned so that a consistent year of six-day-a-week training
 * lands somewhere near level 50. See the calibration test, which encodes that
 * target as an assertion rather than a comment.
 */
import type { Rank } from './types'

/** Tonnage is divided by this. Lower means tonnage counts for more. */
export const XP_TONNAGE_DIVISOR = 12

export const XP_PER_HARD_SET = 20

/**
 * Decided rate (commit 27c12f0): a minute of
 * work-interval effort — a treadmill or rowing block with no reps — is priced
 * like one hard set, since both are roughly a unit of hard effort. Defined
 * from `XP_PER_HARD_SET` rather than as its own literal so the two move
 * together if the hard-set rate is ever retuned.
 */
export const XP_PER_MINUTE_OF_WORK = XP_PER_HARD_SET

/** A personal record on one exercise. A boss kill. */
export const XP_PER_PR = 50

/** Completing the daily quest, which is separate from any gym session. */
export const XP_DAILY_QUEST = 150

/** Clearing a gate pays by its difficulty, so a Legs Gate is worth more. */
export const GATE_CLEAR_BONUS: Record<Rank, number> = {
  E: 200,
  D: 300,
  C: 450,
  B: 650,
  A: 900,
  S: 1300,
}

export const LEVEL_CURVE_BASE = 100
export const LEVEL_CURVE_EXPONENT = 1.5

/**
 * Tolerance when comparing accumulated XP against a level threshold. Scaled to
 * the size of the numbers involved: by level 50 the thresholds are in the tens
 * of thousands, where double precision is worth roughly 1e-11 of relative
 * error, and summing fifty of them compounds that.
 */
export const LEVEL_THRESHOLD_EPSILON = 1e-6

export interface XpBreakdown {
  fromTonnage: number
  fromHardSets: number
  fromWorkMinutes: number
  fromPRs: number
  fromGateClear: number
  /** Before the fatigue multiplier is applied. */
  subtotal: number
  fatigueMultiplier: number
  total: number
}

export interface XpInput {
  tonnageKg: number
  hardSets: number
  /** Minutes of work-interval sets — time/distance exercises with no reps.
   *  Defaults to 0 so every pre-existing caller is unaffected. */
  workMinutes?: number
  /** Number of distinct exercises that set a new record this session. */
  exercisePRs: number
  /** Rank of the gate cleared, or null if this was not a full gate clear. */
  gateRank: Rank | null
  fatigueMultiplier: number
}

export function computeSessionXp(input: XpInput): XpBreakdown {
  const fromTonnage = input.tonnageKg / XP_TONNAGE_DIVISOR
  const fromHardSets = XP_PER_HARD_SET * input.hardSets
  const fromWorkMinutes = XP_PER_MINUTE_OF_WORK * (input.workMinutes ?? 0)
  const fromPRs = XP_PER_PR * input.exercisePRs
  const fromGateClear = input.gateRank ? GATE_CLEAR_BONUS[input.gateRank] : 0
  const subtotal = fromTonnage + fromHardSets + fromWorkMinutes + fromPRs + fromGateClear

  return {
    fromTonnage,
    fromHardSets,
    fromWorkMinutes,
    fromPRs,
    fromGateClear,
    subtotal,
    fatigueMultiplier: input.fatigueMultiplier,
    total: subtotal * input.fatigueMultiplier,
  }
}

/** XP required to move from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return LEVEL_CURVE_BASE * level ** LEVEL_CURVE_EXPONENT
}

/** Total XP required to reach `level` from level 1. */
export function cumulativeXpForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l += 1) total += xpToNext(l)
  return total
}

export interface LevelState {
  level: number
  /** XP accumulated inside the current level. */
  xpIntoLevel: number
  /** XP needed to finish the current level. */
  xpToNext: number
  /** 0 to 1 progress through the current level, for the bar. */
  progress: number
  /** Three points per level, as in the manhwa. */
  statPointsEarned: number
}

export const STAT_POINTS_PER_LEVEL = 3

/**
 * Walks the curve to find the level a total XP figure lands on. Iterative
 * rather than a closed form because the curve has no clean inverse, and the
 * loop is bounded by the level cap so it cannot run away.
 */
export function levelFromTotalXp(totalXp: number, maxLevel = 1000): LevelState {
  let level = 1
  let remaining = Math.max(0, totalXp)

  while (level < maxLevel) {
    const needed = xpToNext(level)
    // The curve produces irrational thresholds, so repeatedly subtracting them
    // accumulates float error. Without this tolerance a hunter holding exactly
    // the XP for the next level would be left one XP short of it forever.
    if (remaining + LEVEL_THRESHOLD_EPSILON < needed) break
    remaining -= needed
    level += 1
  }

  if (remaining < 0) remaining = 0

  const needed = xpToNext(level)
  return {
    level,
    xpIntoLevel: remaining,
    xpToNext: needed,
    progress: needed > 0 ? Math.min(1, remaining / needed) : 0,
    // Level 1 grants nothing; the first three points arrive at level 2.
    statPointsEarned: (level - 1) * STAT_POINTS_PER_LEVEL,
  }
}
