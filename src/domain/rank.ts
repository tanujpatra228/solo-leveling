/**
 * Hunter rank, derived from published strength standards rather than invented.
 * This is the thing that ties the fantasy to something true, so it is a lookup
 * against real tables and never a curve we made up.
 *
 * The published tables have five tiers (Beginner, Novice, Intermediate,
 * Advanced, Elite) and the app has six ranks. Five thresholds partition the
 * number line into exactly six bands, which is the only way to get six ranks
 * without fabricating a sixth threshold:
 *
 *   E  below Beginner
 *   D  at or above Beginner
 *   C  at or above Novice
 *   B  at or above Intermediate
 *   A  at or above Advanced
 *   S  at or above Elite
 *
 * Note this is a proposal rather than something the publisher endorses, and it
 * shifts the label semantics by one step: a lifter exactly on the published
 * Intermediate threshold lands at B, not C.
 */
import {
  BARBELL_STANDARDS,
  PULLUP_ADDED_LOAD_STANDARDS,
  PULLUP_REP_STANDARDS,
  type StandardLift,
  type StandardRow,
  type StandardsSex,
} from './standards.data'
import { RANK_ORDER, type Profile, type Rank, type Sex } from './types'

export interface LiftRank {
  lift: StandardLift
  rank: Rank
  /**
   * Continuous position on the tier ladder, 0 through 5, where 3 means exactly
   * at the Intermediate threshold. Used for shadow ranks and for averaging
   * across lifts without losing resolution to rounding.
   */
  score: number
  /** The five interpolated thresholds in kg for this bodyweight. */
  thresholds: readonly number[]
  e1rmKg: number
  /** True when bodyweight fell outside the published rows and was clamped. */
  bodyweightClamped: boolean
}

/**
 * Which published table to read for a hunter. Someone who declined to state a
 * sex may pick a table to borrow; if they declined that too, they have no
 * table and rank is simply unavailable rather than guessed.
 */
export function standardsTableFor(profile: Pick<Profile, 'sex' | 'standardsTableOverride'>): StandardsSex | null {
  if (profile.sex === 'male' || profile.sex === 'female') return profile.sex
  return profile.standardsTableOverride ?? null
}

/**
 * Linear interpolation between the two bodyweight rows either side of the
 * hunter. The tables are published on a 5 kg grid and a real bodyweight almost
 * never lands on it, so stepping to the nearest row would move a threshold by
 * several kilograms.
 */
export function interpolateThresholds(
  rows: readonly StandardRow[],
  bodyweightKg: number,
): { thresholds: number[]; clamped: boolean } {
  if (rows.length === 0) return { thresholds: [], clamped: false }

  const first = rows[0]!
  const last = rows[rows.length - 1]!

  if (bodyweightKg <= first.bw) return { thresholds: [...first.thresholds], clamped: bodyweightKg < first.bw }
  if (bodyweightKg >= last.bw) return { thresholds: [...last.thresholds], clamped: bodyweightKg > last.bw }

  for (let i = 0; i < rows.length - 1; i += 1) {
    const lower = rows[i]!
    const upper = rows[i + 1]!
    if (bodyweightKg >= lower.bw && bodyweightKg <= upper.bw) {
      const span = upper.bw - lower.bw
      const t = span === 0 ? 0 : (bodyweightKg - lower.bw) / span
      const thresholds = lower.thresholds.map(
        (low, idx) => low + (upper.thresholds[idx]! - low) * t,
      )
      return { thresholds, clamped: false }
    }
  }

  return { thresholds: [...last.thresholds], clamped: true }
}

/**
 * Position on the tier ladder as a continuous number from 0 to 5. Below the
 * first threshold it scales from 0 upward; above the last it saturates at 5.
 */
export function tierScore(value: number, thresholds: readonly number[]): number {
  if (thresholds.length === 0) return 0
  const first = thresholds[0]!
  const last = thresholds[thresholds.length - 1]!

  if (value < first) {
    // Below the entry threshold, scale toward it so an absolute beginner is not
    // indistinguishable from someone one kilo short of the Beginner standard.
    return first > 0 ? Math.max(0, value / first) : 0
  }
  if (value >= last) return thresholds.length

  for (let i = 0; i < thresholds.length - 1; i += 1) {
    const low = thresholds[i]!
    const high = thresholds[i + 1]!
    if (value >= low && value < high) {
      const span = high - low
      return i + 1 + (span === 0 ? 0 : (value - low) / span)
    }
  }
  return thresholds.length
}

/** Maps a 0-to-5 tier score onto the six ranks. */
export function rankFromScore(score: number): Rank {
  const index = Math.min(RANK_ORDER.length - 1, Math.max(0, Math.floor(score)))
  return RANK_ORDER[index]!
}

/**
 * Rank for one barbell lift. `e1rmKg` must include the bar, because the
 * published values do.
 */
export function rankBarbellLift(
  lift: Exclude<StandardLift, 'pullup'>,
  table: StandardsSex,
  bodyweightKg: number,
  e1rmKg: number,
): LiftRank {
  const rows = BARBELL_STANDARDS[lift][table]
  const { thresholds, clamped } = interpolateThresholds(rows, bodyweightKg)
  const score = tierScore(e1rmKg, thresholds)
  return {
    lift,
    rank: rankFromScore(score),
    score,
    thresholds,
    e1rmKg,
    bodyweightClamped: clamped,
  }
}

/**
 * Rank for pull-ups from added external load. The published table is added load
 * only, where a negative value means assistance was needed, so a bodyweight-only
 * set is an added load of zero.
 */
export function rankPullupByLoad(
  table: StandardsSex,
  bodyweightKg: number,
  addedLoadKg: number,
): LiftRank {
  const { thresholds, clamped } = interpolateThresholds(PULLUP_ADDED_LOAD_STANDARDS[table], bodyweightKg)
  // Thresholds here can be negative, which breaks the ratio used below the first
  // threshold, so shift both onto a non-negative axis before scoring.
  const offset = Math.min(0, ...thresholds)
  const shifted = thresholds.map((t) => t - offset)
  const score = tierScore(addedLoadKg - offset, shifted)
  return {
    lift: 'pullup',
    rank: rankFromScore(score),
    score,
    thresholds,
    e1rmKg: addedLoadKg,
    bodyweightClamped: clamped,
  }
}

/** Rank for pull-ups from a bodyweight-only rep count. */
export function rankPullupByReps(table: StandardsSex, bodyweightKg: number, reps: number): LiftRank {
  const { thresholds, clamped } = interpolateThresholds(PULLUP_REP_STANDARDS[table], bodyweightKg)
  const score = tierScore(reps, thresholds)
  return {
    lift: 'pullup',
    rank: rankFromScore(score),
    score,
    thresholds,
    e1rmKg: 0,
    bodyweightClamped: clamped,
  }
}

/**
 * Until any lift has been logged there is nothing to rank, so training history
 * sets a floor. Deliberately conservative: experience is not evidence of a
 * particular number, and inflating someone to C before they have lifted
 * anything would make the whole rank meaningless.
 */
export function rankFloorFromTrainingYears(trainingYears: number): Rank {
  return trainingYears >= 1 ? 'D' : 'E'
}

export interface OverallRank {
  rank: Rank | null
  /** Mean tier score across the lifts that had data. */
  score: number
  perLift: LiftRank[]
  /** Why rank is unavailable, when it is. */
  unavailableReason?: string
}

/**
 * Overall hunter rank: the mean tier score across whichever major lifts have
 * been logged. A mean rather than a maximum, because a hunter with one strong
 * lift and four weak ones is not an A-rank.
 *
 * Bodyweight is total bodyweight, never lean mass. The published tables are
 * indexed on total bodyweight and switching to lean mass would break the
 * mapping, however much more physiologically appealing it sounds.
 */
export function computeOverallRank(
  perLift: readonly LiftRank[],
  opts: { trainingYears?: number; table: StandardsSex | null },
): OverallRank {
  if (opts.table === null) {
    return {
      rank: null,
      score: 0,
      perLift: [...perLift],
      unavailableReason:
        'Rank comes from strength standards that are published separately for male and female bodies. Choose a table in the Physique panel to see a rank, or leave it — everything else works without it.',
    }
  }

  if (perLift.length === 0) {
    const floor = rankFloorFromTrainingYears(opts.trainingYears ?? 0)
    return {
      rank: floor,
      score: RANK_ORDER.indexOf(floor),
      perLift: [],
      unavailableReason:
        'No major lift logged yet. This rank is a floor from your stated training history and will be replaced by measured strength.',
    }
  }

  const meanScore = perLift.reduce((sum, l) => sum + l.score, 0) / perLift.length
  return { rank: rankFromScore(meanScore), score: meanScore, perLift: [...perLift] }
}

/** Human-readable label for the tier a score sits in. */
export function tierNameForScore(score: number): string {
  const names = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']
  const index = Math.min(names.length - 1, Math.max(0, Math.floor(score)))
  return names[index]!
}

/** Convenience for callers that hold a `Sex` rather than a whole profile. */
export function tableForSex(sex: Sex, override?: StandardsSex): StandardsSex | null {
  if (sex === 'male' || sex === 'female') return sex
  return override ?? null
}
