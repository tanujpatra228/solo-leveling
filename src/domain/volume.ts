/**
 * Weekly hard-set volume per muscle, measured against training landmarks.
 *
 * The landmarks are the Renaissance Periodization set: MV is the volume that
 * maintains what you have, MEV the minimum that grows anything, MAV the range
 * where most growth happens, and MRV the point past which you accumulate more
 * fatigue than you can recover from. They are published per muscle group rather
 * than as one global number, which matters here because this program buries the
 * front delts and starves the hamstrings, and a single average would hide both.
 *
 * Rendered as per-muscle mana bars. Below MEV reads as a starving muscle group.
 */
import { isHardSet } from './e1rm'
import type { Exercise, Muscle, SetLog } from './types'

export interface Landmark {
  /** Maintenance volume: enough to hold ground, not to grow. */
  mv: number
  /** Minimum effective volume: the floor for growth. */
  mev: number
  /** Maximum adaptive volume, as a range. Most work should land here. */
  mav: [number, number]
  /** Maximum recoverable volume. Past this, fatigue outruns recovery. */
  mrv: number
}

/**
 * Hard sets per muscle per week. A secondary muscle earns a half set, because
 * a triceps involved in a bench press is doing real but not primary work.
 */
export const SECONDARY_SET_CREDIT = 0.5

export const LANDMARKS: Record<Muscle, Landmark> = {
  chest: { mv: 4, mev: 10, mav: [12, 20], mrv: 22 },
  lats: { mv: 6, mev: 10, mav: [14, 22], mrv: 25 },
  upper_back: { mv: 6, mev: 10, mav: [14, 22], mrv: 25 },
  traps: { mv: 0, mev: 8, mav: [12, 20], mrv: 26 },
  lower_back: { mv: 0, mev: 2, mav: [6, 10], mrv: 14 },
  // Front delts are the standout: pressing already supplies most of what they
  // need, so their direct-work ceiling is low and easy to blow past.
  front_delts: { mv: 0, mev: 6, mav: [6, 12], mrv: 16 },
  side_delts: { mv: 6, mev: 8, mav: [16, 22], mrv: 26 },
  rear_delts: { mv: 0, mev: 6, mav: [12, 20], mrv: 24 },
  // Small stabilisers, trained light. The numbers are low because the goal is
  // keeping the joint healthy under two pressing days, not growth.
  rotator_cuff: { mv: 0, mev: 2, mav: [4, 8], mrv: 12 },
  biceps: { mv: 4, mev: 8, mav: [14, 20], mrv: 26 },
  triceps: { mv: 4, mev: 6, mav: [10, 14], mrv: 18 },
  forearms: { mv: 2, mev: 4, mav: [8, 15], mrv: 20 },
  abs: { mv: 0, mev: 6, mav: [16, 20], mrv: 25 },
  obliques: { mv: 0, mev: 4, mav: [8, 16], mrv: 20 },
  quads: { mv: 6, mev: 8, mav: [12, 18], mrv: 20 },
  hamstrings: { mv: 3, mev: 4, mav: [10, 16], mrv: 20 },
  glutes: { mv: 0, mev: 4, mav: [4, 12], mrv: 16 },
  calves: { mv: 6, mev: 8, mav: [12, 16], mrv: 20 },
  grip: { mv: 0, mev: 2, mav: [4, 8], mrv: 12 },
  cardio: { mv: 0, mev: 0, mav: [0, 0], mrv: 0 },
}

export type VolumeVerdict = 'none' | 'below_mv' | 'maintaining' | 'below_mev' | 'optimal' | 'above_mav' | 'over_mrv'

export interface MuscleVolume {
  muscle: Muscle
  /** Weighted hard sets: 1 per primary set, 0.5 per secondary. */
  sets: number
  landmark: Landmark
  verdict: VolumeVerdict
  /** 0 to 1 against the top of MAV, for the mana bar fill. */
  fill: number
  message: string
}

/**
 * Weighted hard sets per muscle for a group of sets, which the caller has
 * already narrowed to one week.
 */
export function hardSetsPerMuscle(
  sets: readonly SetLog[],
  resolveExercise: (id: string) => Exercise | undefined,
): Map<Muscle, number> {
  const totals = new Map<Muscle, number>()
  const add = (muscle: Muscle, credit: number) => {
    totals.set(muscle, (totals.get(muscle) ?? 0) + credit)
  }

  for (const set of sets) {
    if (!isHardSet(set)) continue
    const exercise = resolveExercise(set.exerciseId)
    if (!exercise) continue
    for (const muscle of exercise.primaryMuscles) add(muscle, 1)
    for (const muscle of exercise.secondaryMuscles) add(muscle, SECONDARY_SET_CREDIT)
  }

  return totals
}

export function classifyVolume(sets: number, landmark: Landmark): VolumeVerdict {
  if (sets <= 0) return 'none'
  if (sets > landmark.mrv) return 'over_mrv'
  if (sets > landmark.mav[1]) return 'above_mav'
  if (sets >= landmark.mav[0]) return 'optimal'
  if (sets >= landmark.mev) return 'below_mev'
  if (sets >= landmark.mv && landmark.mv > 0) return 'maintaining'
  return 'below_mv'
}

function verdictMessage(muscle: Muscle, sets: number, landmark: Landmark, verdict: VolumeVerdict): string {
  const name = muscle.replace(/_/g, ' ')
  switch (verdict) {
    case 'none':
      return `No work logged for ${name} this week.`
    case 'below_mv':
      return `${name} is starving at ${sets} sets. It needs ${landmark.mev} to grow.`
    case 'maintaining':
      return `${name} is holding ground at ${sets} sets but not growing. Growth starts at ${landmark.mev}.`
    case 'below_mev':
      return `${name} is at ${sets} sets, over the growth floor but under the productive range of ${landmark.mav[0]} to ${landmark.mav[1]}.`
    case 'optimal':
      return `${name} is in the productive range at ${sets} sets.`
    case 'above_mav':
      return `${name} is at ${sets} sets, above the productive range. Still recoverable, but the extra work is buying little.`
    case 'over_mrv':
      return `${name} is at ${sets} sets, past what can be recovered from. Cut it back.`
  }
}

/** The full per-muscle readout for one week, ordered worst deficit first. */
export function weeklyVolumeReport(
  sets: readonly SetLog[],
  resolveExercise: (id: string) => Exercise | undefined,
): MuscleVolume[] {
  const totals = hardSetsPerMuscle(sets, resolveExercise)
  const report: MuscleVolume[] = []

  for (const muscle of Object.keys(LANDMARKS) as Muscle[]) {
    if (muscle === 'cardio') continue
    const landmark = LANDMARKS[muscle]
    const count = totals.get(muscle) ?? 0
    const verdict = classifyVolume(count, landmark)
    report.push({
      muscle,
      sets: count,
      landmark,
      verdict,
      fill: landmark.mav[1] > 0 ? Math.min(1, count / landmark.mav[1]) : 0,
      message: verdictMessage(muscle, count, landmark, verdict),
    })
  }

  const severity: Record<VolumeVerdict, number> = {
    over_mrv: 0,
    none: 1,
    below_mv: 2,
    maintaining: 3,
    below_mev: 4,
    above_mav: 5,
    optimal: 6,
  }
  report.sort((a, b) => severity[a.verdict] - severity[b.verdict] || a.muscle.localeCompare(b.muscle))
  return report
}
