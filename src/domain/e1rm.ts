/**
 * Estimated one-rep max. This one number drives hunter rank, PR detection, and
 * shadow ranks, so the formula is fixed and stated plainly rather than tuned.
 *
 * Epley: weight * (1 + reps / 30).
 */
import type { SetLog } from './types'

/**
 * Epley loses accuracy as reps climb, because a 20-rep set is limited by
 * conditioning rather than maximal strength. Above this the estimate is still
 * computed but callers should not treat it as a strength measurement.
 */
export const E1RM_REP_CEILING = 12

export function epley(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/** True when the set is in the rep range where Epley means something. */
export function isE1rmReliable(reps: number): boolean {
  return reps >= 1 && reps <= E1RM_REP_CEILING
}

/**
 * The load that should produce `targetReps` at the same effort as the given
 * one-rep max. The inverse of Epley, used to prescribe a working weight from a
 * known maximum.
 */
export function loadForReps(e1rmKg: number, targetReps: number): number {
  if (targetReps <= 0) return 0
  return e1rmKg / (1 + targetReps / 30)
}

/**
 * The best estimated max in a group of sets. Warmups are excluded because a
 * light single early in a session is not a maximal effort, and unreliable
 * high-rep sets are excluded so a 30-rep push-up set cannot inflate a max.
 */
export function bestE1rm(sets: readonly SetLog[]): number {
  let best = 0
  for (const set of sets) {
    if (set.isWarmup) continue
    if (!isE1rmReliable(set.reps)) continue
    const estimate = epley(set.weight, set.reps)
    if (estimate > best) best = estimate
  }
  return best
}

/**
 * The single hardest set in a group, by estimated max. Returned rather than
 * just its value because the boss-kill display names the actual set.
 */
export function topSet(sets: readonly SetLog[]): SetLog | null {
  let best: SetLog | null = null
  let bestValue = 0
  for (const set of sets) {
    if (set.isWarmup) continue
    if (!isE1rmReliable(set.reps)) continue
    const estimate = epley(set.weight, set.reps)
    if (estimate > bestValue) {
      bestValue = estimate
      best = set
    }
  }
  return best
}

/**
 * Total load moved, in kilograms. A bodyweight movement adds a fraction of the
 * hunter's mass to each rep — `bodyweightFactor` — rather than the whole mass,
 * because a sit-up moves the trunk and not the whole body. `bodyweightFactor`
 * returns 0 for an exercise that does not use bodyweight at all.
 */
export function tonnage(
  sets: readonly SetLog[],
  opts: { bodyweightKg?: number; bodyweightFactor?: (exerciseId: string) => number } = {},
): number {
  let total = 0
  for (const set of sets) {
    if (set.isWarmup) continue
    const factor = opts.bodyweightFactor?.(set.exerciseId) ?? 0
    const bodyweightContribution =
      opts.bodyweightKg !== undefined && factor > 0 ? opts.bodyweightKg * factor : 0
    total += (set.weight + bodyweightContribution) * set.reps
  }
  return total
}

/**
 * A hard set is a working set taken near enough to failure to drive adaptation.
 * With no RPE logged we assume the set was hard, because the alternative is
 * silently under-counting the volume of someone who does not log RPE.
 */
export const HARD_SET_MIN_RPE = 7

export function isHardSet(set: SetLog): boolean {
  if (set.isWarmup) return false
  if (set.reps <= 0) return false
  return set.rpe === undefined || set.rpe >= HARD_SET_MIN_RPE
}

export function countHardSets(sets: readonly SetLog[]): number {
  return sets.reduce((count, set) => (isHardSet(set) ? count + 1 : count), 0)
}
