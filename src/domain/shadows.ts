/**
 * ARISE. Shadow extraction.
 *
 * Clearing a milestone on an exercise extracts a shadow, named and ranked from
 * the hunter's percentile in that lift. Each grants a small passive buff, and
 * the number that can be kept active is capped by INT, which in canon is mana
 * capacity. That cap is what makes the roster a real choice rather than a list
 * that only ever grows.
 */
import { activeShadowCap } from './stats'
import { RANK_ORDER, type Rank, type Shadow } from './types'
import { rankFromScore } from './rank'

/* ------------------------------------------------------------------ */
/* Milestones that trigger an extraction                               */
/* ------------------------------------------------------------------ */

/**
 * A shadow is extracted when a lift first crosses a tier boundary on the
 * published standards. Tying extraction to the standards rather than to a round
 * number of kilograms means a shadow always represents a real jump in ability.
 */
export interface ExtractionTrigger {
  exerciseId: string
  exerciseName: string
  /** Tier score at the moment of extraction, 0 to 5. */
  score: number
  rank: Rank
}

/**
 * True when a lift has crossed into a new tier that has not been extracted from
 * before. Compares floors rather than raw scores so drifting up and down within
 * one tier does not produce a shadow every session.
 */
export function shouldExtract(
  currentScore: number,
  highestExtractedScore: number,
): boolean {
  return Math.floor(currentScore) > Math.floor(highestExtractedScore)
}

/* ------------------------------------------------------------------ */
/* Naming                                                              */
/* ------------------------------------------------------------------ */

/**
 * Canon-flavoured names, banded by rank so an E-rank shadow does not arrive
 * called Beru. The list is fixed and indexed deterministically, because a
 * shadow that renames itself on reload is not a shadow the hunter can get
 * attached to.
 */
const SHADOW_NAMES: Record<Rank, readonly string[]> = {
  E: ['Kaisel', 'Jima', 'Tusk', 'Nokt', 'Grim'],
  D: ['Iron', 'Fang', 'Vurn', 'Karr', 'Sable'],
  C: ['Greed', 'Tank', 'Rakan', 'Vex', 'Onyx'],
  B: ['Igrit', 'Baruka', 'Kargalgan', 'Metus', 'Vulcan'],
  A: ['Iron Body', 'Bellion', 'Esil', 'Thomas', 'Ashborn'],
  S: ['Igris', 'Beru', 'Bellion', 'Baran', 'Antares'],
}

/**
 * The marshal shadows are reserved for the hunter's strongest lifts, which is
 * how canon treats Igris, Beru, and Tank.
 */
export const MARSHAL_NAMES = ['Igris', 'Beru', 'Tank'] as const

/**
 * Deterministic pick from the band. Hashing the exercise id means the same lift
 * always yields the same name at the same rank, without storing a counter.
 */
function pickName(rank: Rank, exerciseId: string, isMarshal: boolean, marshalIndex: number): string {
  if (isMarshal) {
    return MARSHAL_NAMES[marshalIndex % MARSHAL_NAMES.length]!
  }
  const pool = SHADOW_NAMES[rank]
  let hash = 0
  for (let i = 0; i < exerciseId.length; i += 1) {
    hash = (hash * 31 + exerciseId.charCodeAt(i)) % 100_000
  }
  return pool[hash % pool.length]!
}

/* ------------------------------------------------------------------ */
/* Buffs                                                               */
/* ------------------------------------------------------------------ */

export type BuffKind = Shadow['buffKind']

interface BuffDef {
  kind: BuffKind
  magnitude: number
  describe: (magnitude: number) => string
}

/**
 * Buffs are small on purpose. A shadow army that meaningfully changes the
 * numbers would make the honest half of the stats dishonest, so these affect
 * pacing and forgiveness rather than strength.
 */
const BUFFS_BY_RANK: Record<Rank, BuffDef> = {
  E: {
    kind: 'xp_bonus',
    magnitude: 0.01,
    describe: (m) => `Experience from this lift increased by ${Math.round(m * 100)}%.`,
  },
  D: {
    kind: 'xp_bonus',
    magnitude: 0.02,
    describe: (m) => `Experience from this lift increased by ${Math.round(m * 100)}%.`,
  },
  C: {
    kind: 'rest_reduction',
    magnitude: 5,
    describe: (m) => `Suggested rest on this lift shortened by ${m} seconds.`,
  },
  B: {
    kind: 'volume_tolerance',
    magnitude: 1,
    describe: (m) => `Recoverable volume for this muscle group raised by ${m} set.`,
  },
  A: {
    kind: 'xp_bonus',
    magnitude: 0.05,
    describe: (m) => `Experience from this lift increased by ${Math.round(m * 100)}%.`,
  },
  S: {
    kind: 'streak_shield',
    magnitude: 1,
    describe: (m) => `Absorbs ${m} missed day before the streak breaks.`,
  },
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

export function extractShadow(input: {
  trigger: ExtractionTrigger
  extractedAt: number
  /** True when this lift is one of the hunter's strongest. */
  isMarshal: boolean
  /** Position among the marshals, for name assignment. */
  marshalIndex?: number
}): Shadow {
  const { trigger } = input
  const buff = BUFFS_BY_RANK[trigger.rank]
  const name = pickName(trigger.rank, trigger.exerciseId, input.isMarshal, input.marshalIndex ?? 0)

  return {
    id: `shadow-${trigger.exerciseId}-${trigger.rank}`,
    exerciseId: trigger.exerciseId,
    name,
    rank: trigger.rank,
    extractedAt: input.extractedAt,
    buff: buff.describe(buff.magnitude),
    buffKind: buff.kind,
    buffMagnitude: buff.magnitude,
    isMarshal: input.isMarshal,
    active: true,
  }
}

/** The canon line, for the extraction animation. */
export const ARISE_ANNOUNCEMENT = 'ARISE.'

export function extractionAnnouncement(shadow: Shadow, exerciseName: string): string {
  return `[You have obtained a new shadow. ${shadow.name}, ${shadow.rank}-rank, extracted from ${exerciseName}.]`
}

/* ------------------------------------------------------------------ */
/* The roster                                                          */
/* ------------------------------------------------------------------ */

export interface RosterState {
  cap: number
  activeCount: number
  /** Shadows currently applying their buff. */
  active: Shadow[]
  /** Extracted but benched, because the cap is full. */
  benched: Shadow[]
  overCap: boolean
  message: string
}

/**
 * Resolves the roster against the INT cap. Shadows the hunter has explicitly
 * activated are honoured in order until the cap is reached, and the rest are
 * benched rather than silently dropped.
 */
export function resolveRoster(shadows: readonly Shadow[], totalInt: number): RosterState {
  const cap = activeShadowCap(totalInt)
  const requested = shadows.filter((s) => s.active)
  // Marshals first, then by rank, then by how long they have been held. A
  // stable order matters because otherwise which buffs apply would change on
  // every reload.
  const ordered = [...requested].sort((a, b) => {
    if (a.isMarshal !== b.isMarshal) return a.isMarshal ? -1 : 1
    const rankDiff = RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank)
    if (rankDiff !== 0) return rankDiff
    return a.extractedAt - b.extractedAt
  })

  const active = ordered.slice(0, cap)
  const benchedFromRequest = ordered.slice(cap)
  const inactive = shadows.filter((s) => !s.active)

  return {
    cap,
    activeCount: active.length,
    active,
    benched: [...benchedFromRequest, ...inactive],
    overCap: benchedFromRequest.length > 0,
    message:
      benchedFromRequest.length > 0
        ? `Mana capacity supports ${cap} active shadows. ${benchedFromRequest.length} are dormant until INT rises or you deactivate another.`
        : `${active.length} of ${cap} shadows active.`,
  }
}

/** Total XP multiplier contributed by the active roster for a given exercise. */
export function shadowXpBonus(active: readonly Shadow[], exerciseId: string): number {
  let bonus = 0
  for (const shadow of active) {
    if (shadow.buffKind !== 'xp_bonus') continue
    // A shadow buffs the lift it came from, since that is what it was extracted
    // from and what it should make the hunter want to keep training.
    if (shadow.exerciseId === exerciseId) bonus += shadow.buffMagnitude
  }
  return bonus
}

/** How many missed days the active roster can absorb before the streak breaks. */
export function streakShieldDays(active: readonly Shadow[]): number {
  return active
    .filter((s) => s.buffKind === 'streak_shield')
    .reduce((sum, s) => sum + s.buffMagnitude, 0)
}

/**
 * Which lifts count as marshals: the strongest by tier score, capped at the
 * three canon marshal names.
 */
export function selectMarshals(
  scoresByExercise: ReadonlyMap<string, number>,
): { exerciseId: string; score: number; rank: Rank }[] {
  return [...scoresByExercise.entries()]
    .map(([exerciseId, score]) => ({ exerciseId, score, rank: rankFromScore(score) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MARSHAL_NAMES.length)
}
