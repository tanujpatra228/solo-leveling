/**
 * The five canon stats, computed as a hybrid.
 *
 * Half of each stat is *derived* from a 28-day rolling window, so it cannot be
 * gamed: it moves only when the training moves. The other half is *allocated*
 * by hand, three points per level as in the manhwa, and spending those points
 * biases the next mesocycle's quest generation rather than inflating anything.
 *
 * That split is the point. The derived half is honest and the allocated half is
 * where intent gets expressed, so the hunter has agency without being able to
 * lie to themselves about how strong they are.
 *
 * The brief names the *sources* of each derived stat but not the arithmetic, so
 * the constants below are ours. They are chosen so that a consistent
 * six-day-a-week trainee sits in the 50 to 70 range on most stats, which leaves
 * headroom without making the numbers feel unreachable.
 */
import type { StatBlock, StatKey } from './types'

export interface DerivedStatsInput {
  /** Tier scores, 0 to 5, for whichever major lifts have data. From `rank.ts`. */
  standardScores: readonly number[]

  /** Total tonnage over the 28-day window, in kilograms. */
  tonnage28Kg: number
  /** Current unbroken daily-quest streak, in days. */
  currentStreak: number

  /** Minutes of logged cardio over the window. */
  cardioMinutes28: number
  /** Total reps of bodyweight movements over the window. */
  bodyweightReps28: number

  /** Working sets logged over the window. */
  setsLogged28: number
  /** How many of those carried an RPE. */
  setsWithRpe28: number
  /** Distinct RPE values used, which is how we detect a hunter logging 8 for everything. */
  distinctRpeValues28: number
  /** Sessions logged over the window. */
  sessionsLogged28: number
  /** How many of those recorded a bodyweight. */
  sessionsWithBodyweight28: number

  /** Sessions the routine called for over the window. */
  plannedSessions28: number
  /** How many of those actually happened. */
  completedPlannedSessions28: number
}

/** Every derived stat is on this scale. */
export const STAT_MAX = 100

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * Strength, straight off the published standards. Using the tier score rather
 * than raw kilograms means STR is already normalised for bodyweight and sex,
 * and it means STR and hunter rank can never disagree with each other.
 */
export function deriveStr(input: DerivedStatsInput): number {
  if (input.standardScores.length === 0) return 0
  const mean = input.standardScores.reduce((a, b) => a + b, 0) / input.standardScores.length
  // Tier scores run 0 to 5, so twenty points per tier fills the scale.
  return Math.round(clamp(mean * 20, 0, STAT_MAX))
}

/**
 * Vitality, from work done and consistency. Tonnage is the bulk of it because
 * total work is what builds work capacity; the streak term rewards turning up.
 */
export function deriveVit(input: DerivedStatsInput): number {
  const fromTonnage = clamp(input.tonnage28Kg / 5000, 0, 60)
  const fromStreak = clamp(input.currentStreak * 0.8, 0, 40)
  return Math.round(clamp(fromTonnage + fromStreak, 0, STAT_MAX))
}

/**
 * Agility, from conditioning and bodyweight rep density. Split evenly, so a
 * hunter who only runs and one who only does push-ups land in the same place.
 */
export function deriveAgi(input: DerivedStatsInput): number {
  const fromCardio = clamp(input.cardioMinutes28 / 8, 0, 50)
  const fromBodyweight = clamp(input.bodyweightReps28 / 30, 0, 50)
  return Math.round(clamp(fromCardio + fromBodyweight, 0, STAT_MAX))
}

/**
 * Perception, from how well the hunter observes their own training.
 *
 * Coverage alone would be gameable by logging the same RPE on every set, which
 * is not perception, it is filling in a box. So a share of the stat depends on
 * actually discriminating between efforts.
 */
export function deriveP(input: DerivedStatsInput): number {
  const rpeCoverage = input.setsLogged28 > 0 ? input.setsWithRpe28 / input.setsLogged28 : 0
  // Five or more distinct values across a month is real discrimination.
  const discrimination = clamp(input.distinctRpeValues28 / 5, 0, 1)
  const bodyweightRate =
    input.sessionsLogged28 > 0 ? input.sessionsWithBodyweight28 / input.sessionsLogged28 : 0
  const volumeOfLogging = clamp(input.setsLogged28 / 10, 0, 20)

  return Math.round(
    clamp(35 * rpeCoverage + 25 * discrimination + 20 * bodyweightRate + volumeOfLogging, 0, STAT_MAX),
  )
}

/**
 * Intelligence, from programme adherence. In canon INT is mana capacity, and
 * here it caps how many shadows can be kept active, so following the plan is
 * what buys roster space.
 */
export function deriveInt(input: DerivedStatsInput): number {
  if (input.plannedSessions28 <= 0) return 0
  const adherence = input.completedPlannedSessions28 / input.plannedSessions28
  return Math.round(clamp(adherence * STAT_MAX, 0, STAT_MAX))
}

export function deriveStats(input: DerivedStatsInput): StatBlock {
  return {
    STR: deriveStr(input),
    VIT: deriveVit(input),
    AGI: deriveAgi(input),
    INT: deriveInt(input),
    PER: deriveP(input),
  }
}

export const ZERO_STATS: StatBlock = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 }

export function addStats(a: StatBlock, b: StatBlock): StatBlock {
  return {
    STR: a.STR + b.STR,
    VIT: a.VIT + b.VIT,
    AGI: a.AGI + b.AGI,
    INT: a.INT + b.INT,
    PER: a.PER + b.PER,
  }
}

export function totalAllocated(allocated: StatBlock): number {
  return allocated.STR + allocated.VIT + allocated.AGI + allocated.INT + allocated.PER
}

/**
 * Points still to spend. Derived rather than stored, so a change to the level
 * curve or to the points-per-level constant re-derives correctly instead of
 * leaving a stale balance behind.
 */
export function unspentPoints(statPointsEarned: number, allocated: StatBlock): number {
  return Math.max(0, statPointsEarned - totalAllocated(allocated))
}

/**
 * Mana capacity. In canon the shadow army is limited by the Shadow Monarch's
 * mana, and INT is the mana stat, so INT is what makes the roster a real choice
 * instead of a list that only grows.
 */
export function activeShadowCap(totalInt: number): number {
  return 1 + Math.floor(Math.max(0, totalInt) / 20)
}

/* ------------------------------------------------------------------ */
/* Allocated points bias the next mesocycle                           */
/* ------------------------------------------------------------------ */

export interface QuestBias {
  /** Above 1 skews toward heavy low-rep work. */
  heavyLowRep: number
  /** Above 1 skews toward higher volume and tonnage. */
  volume: number
  /** Above 1 skews toward conditioning and bodyweight density. */
  conditioning: number
  /** Above 1 skews toward strict adherence to the written plan. */
  adherence: number
  /** Above 1 skews toward accessory and technique work. */
  technique: number
}

export const NEUTRAL_BIAS: QuestBias = {
  heavyLowRep: 1,
  volume: 1,
  conditioning: 1,
  adherence: 1,
  technique: 1,
}

/**
 * Turns allocated points into generation weights. Points into STR skew the
 * engine toward heavy low-rep work, points into AGI toward conditioning, and so
 * on. The scaling is deliberately gentle: allocation expresses a preference,
 * and it must not be able to talk the engine into something unsafe.
 */
export function questBiasFromAllocation(allocated: StatBlock): QuestBias {
  const total = totalAllocated(allocated)
  if (total === 0) return { ...NEUTRAL_BIAS }

  const share = (key: StatKey) => allocated[key] / total
  // A stat holding every point shifts its axis by half again, no more.
  const weight = (key: StatKey) => 1 + share(key) * 0.5

  return {
    heavyLowRep: weight('STR'),
    volume: weight('VIT'),
    conditioning: weight('AGI'),
    adherence: weight('INT'),
    technique: weight('PER'),
  }
}
