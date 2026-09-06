/**
 * Ranks candidates to swap onto when a planned exercise's equipment is
 * occupied. Pure — no store, no React, no ambient clock. See
 * docs/substitution-plan.md §3 for the design.
 */
import type { Equipment, Exercise, Routine } from './types'

export interface SubstituteCandidate {
  exercise: Exercise
  /** 1: same pattern and a shared primary muscle. 2: same primary muscle,
   *  a different pattern — a lateral guess rather than a direct stand-in. */
  tier: 1 | 2
  /** Plain-language reason, in the System's voice. */
  why: string
  /** Already prescribed elsewhere in today's routine. Still a legitimate
   *  answer, but it repeats a block rather than adding new stimulus. */
  demoted: boolean
}

export interface SubstitutesForContext {
  exercises: readonly Exercise[]
  /** What the gym has, from the profile. */
  equipmentAccess: readonly Equipment[]
  /**
   * What is occupied right now, this session only. Defaults to the planned
   * exercise's own equipment minus `bodyweight` — tapping Swap implies the
   * *equipment* is the problem, and bodyweight is never a station someone
   * else can be occupying, so it is never inferred as blocked.
   */
  blockedEquipment?: readonly Equipment[]
  /** Today's routine, so a candidate already prescribed elsewhere in it is
   *  demoted rather than presented as a fresh answer. */
  routine?: Routine | null
}

function sharesLadder(a: Exercise, b: Exercise): boolean {
  return (a.progressionLadder?.includes(b.id) ?? false) || (b.progressionLadder?.includes(a.id) ?? false)
}

/** Length of the overlapping rep window, 0 when the ranges do not meet. */
function repRangeOverlap(a: Exercise, b: Exercise): number {
  const lo = Math.max(a.repRange[0], b.repRange[0])
  const hi = Math.min(a.repRange[1], b.repRange[1])
  return Math.max(0, hi - lo)
}

function isPrescribedInRoutine(exerciseId: string, routine: Routine | null | undefined): boolean {
  if (!routine) return false
  return routine.blocks.some((block) => block.items.some((item) => item.exerciseId === exerciseId))
}

export function substitutesFor(planned: Exercise, ctx: SubstitutesForContext): SubstituteCandidate[] {
  const blocked = new Set(ctx.blockedEquipment ?? planned.equipment.filter((eq) => eq !== 'bodyweight'))
  const accessible = new Set(ctx.equipmentAccess)

  const candidates: SubstituteCandidate[] = []

  for (const exercise of ctx.exercises) {
    if (exercise.id === planned.id) continue
    // The gym does not have it at all, or it is what is occupied right now.
    // Two different questions — see the module doc — and this is the one
    // exclusion rule that actually makes the feature useful.
    if (!exercise.equipment.every((eq) => accessible.has(eq))) continue
    if (exercise.equipment.some((eq) => blocked.has(eq))) continue

    const samePattern = exercise.pattern === planned.pattern
    const sharedPrimary = exercise.primaryMuscles.some((m) => planned.primaryMuscles.includes(m))
    let tier: 1 | 2
    if (samePattern && sharedPrimary) tier = 1
    else if (sharedPrimary) tier = 2
    else continue

    const ladderAdjacent = sharesLadder(planned, exercise)
    const demoted = isPrescribedInRoutine(exercise.id, ctx.routine)

    let why: string
    if (ladderAdjacent) {
      why = `A rung on the same ladder as ${planned.name} — a known step, not a lateral guess.`
    } else if (tier === 1) {
      why = `Same movement pattern and primary muscle as ${planned.name} — a direct stand-in.`
    } else {
      why = `A different pattern, but trains the same primary muscle as ${planned.name}.`
    }
    if (demoted) why += ' Already prescribed today, so this repeats a block rather than adding new stimulus.'

    candidates.push({ exercise, tier, why, demoted })
  }

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    const roleRank = (c: SubstituteCandidate) => (c.exercise.role === 'prescribed' ? 0 : 1)
    if (roleRank(a) !== roleRank(b)) return roleRank(a) - roleRank(b)
    const ladderRank = (c: SubstituteCandidate) => (sharesLadder(planned, c.exercise) ? 0 : 1)
    if (ladderRank(a) !== ladderRank(b)) return ladderRank(a) - ladderRank(b)
    const overlapA = repRangeOverlap(planned, a.exercise)
    const overlapB = repRangeOverlap(planned, b.exercise)
    if (overlapA !== overlapB) return overlapB - overlapA
    if (a.demoted !== b.demoted) return a.demoted ? 1 : -1
    return a.exercise.id.localeCompare(b.exercise.id)
  })

  return candidates
}
