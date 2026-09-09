/**
 * Every entity in the app, defined once as a Zod schema with the TypeScript type
 * derived from it, so the validator and the type cannot drift apart.
 *
 * These schemas run at three boundaries only: form input, reads back out of
 * IndexedDB, and the Worker HTTP surface. They are not used for internal calls.
 */
import * as z from 'zod'

/* ------------------------------------------------------------------ */
/* Enumerations                                                        */
/* ------------------------------------------------------------------ */

/**
 * Strength-standard tables are published separately for male and female bodies,
 * so rank cannot be computed without this. `unspecified` is a first-class case:
 * the person keeps every feature and loses only the rank percentile and the
 * Navy body-fat estimate, unless they pick a formula to borrow.
 */
export const SexSchema = z.enum(['male', 'female', 'unspecified'])
export type Sex = z.infer<typeof SexSchema>

export const UnitPrefSchema = z.enum(['metric', 'imperial'])
export type UnitPref = z.infer<typeof UnitPrefSchema>

/** E is the entry rank, S the ceiling. Ordered weakest to strongest. */
export const RankSchema = z.enum(['E', 'D', 'C', 'B', 'A', 'S'])
export type Rank = z.infer<typeof RankSchema>

export const RANK_ORDER: readonly Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'] as const

export const MovementPatternSchema = z.enum([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'core',
  'isolation',
  'cardio',
])
export type MovementPattern = z.infer<typeof MovementPatternSchema>

/**
 * Granular enough to drive the per-muscle volume landmarks, and no more.
 * Splitting the delts out matters because this program overloads front delts and
 * neglects rear delts, which is one of the advisories the app has to surface.
 */
export const MuscleSchema = z.enum([
  'chest',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  // The cuff is tracked separately from the rear delts on purpose. A reverse fly
  // retracts the shoulder blade; it does not externally rotate the humerus, so
  // it cannot stand in for cuff work.
  'rotator_cuff',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'grip',
  'cardio',
])
export type Muscle = z.infer<typeof MuscleSchema>

export const EquipmentSchema = z.enum([
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'pullup_bar',
  'bench',
  'ez_bar',
  'kettlebell',
  'bands',
  'treadmill',
  'none',
])
export type Equipment = z.infer<typeof EquipmentSchema>

/** What a set of this exercise is measured in. */
export const LoadUnitSchema = z.enum(['kg', 'reps', 'time', 'distance'])
export type LoadUnit = z.infer<typeof LoadUnitSchema>

/**
 * Why a hunter swapped off the planned exercise. Tracked as a reason rather
 * than just the fact of a swap because 'occupied' is a logistics signal about
 * the gym, while 'injury' should eventually raise an advisory rather than be
 * forgotten. See commit 9de7140.
 */
export const SubstitutionReasonSchema = z.enum(['occupied', 'unavailable', 'injury', 'preference'])
export type SubstitutionReason = z.infer<typeof SubstitutionReasonSchema>

export const QuestTypeSchema = z.enum([
  'daily',
  'gate',
  'penalty',
  'recovery',
  'red_gate',
  'instant_dungeon',
  'job_change',
])
export type QuestType = z.infer<typeof QuestTypeSchema>

export const QuestStatusSchema = z.enum(['issued', 'complete', 'failed', 'forgiven', 'expired'])
export type QuestStatus = z.infer<typeof QuestStatusSchema>

export const HunterClassSchema = z.enum(['none', 'fighter', 'tanker', 'assassin', 'ranger', 'shadow_monarch'])
export type HunterClass = z.infer<typeof HunterClassSchema>

export const StatKeySchema = z.enum(['STR', 'VIT', 'AGI', 'INT', 'PER'])
export type StatKey = z.infer<typeof StatKeySchema>

export const BodyFatSourceSchema = z.enum([
  'dexa',
  'hydrostatic',
  'bodpod',
  'calipers',
  'navy',
  'bia',
  'other',
])
export type BodyFatSource = z.infer<typeof BodyFatSourceSchema>

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** `YYYY-MM-DD` in the hunter's local time, after the 04:00 rollover. */
export const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
export type DayKey = z.infer<typeof DayKeySchema>

/** Epoch milliseconds. */
export const TimestampSchema = z.number().int().nonnegative()

/** Inclusive `[low, high]` target rep window that drives double progression. */
export const RepRangeSchema = z
  .tuple([z.number().int().positive(), z.number().int().positive()])
  .refine(([lo, hi]) => lo <= hi, { error: 'rep range low must not exceed high' })
export type RepRange = z.infer<typeof RepRangeSchema>

/* ------------------------------------------------------------------ */
/* Exercise library                                                    */
/* ------------------------------------------------------------------ */

export const ExerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Alternative spellings so search finds the exercise as the hunter names it. */
  aliases: z.array(z.string()).default([]),
  pattern: MovementPatternSchema,
  primaryMuscles: z.array(MuscleSchema).min(1),
  secondaryMuscles: z.array(MuscleSchema).default([]),
  equipment: z.array(EquipmentSchema).min(1),
  unit: LoadUnitSchema,
  /** Smallest load step available on this implement, in kg. Zero for bodyweight. */
  increment: z.number().nonnegative(),
  repRange: RepRangeSchema,
  /** Bodyweight movements progress along this ladder before load is added. */
  progressionLadder: z.array(z.string()).optional(),
  /** Which published strength-standard table this lift maps to, if any. */
  standardLift: z
    .enum(['squat', 'bench', 'ohp', 'deadlift', 'incline_bench', 'pullup'])
    .optional(),
  /** A short coaching cue shown while logging. */
  cue: z.string().optional(),
  /** Bodyweight exercises count a fraction of the hunter's own mass toward tonnage. */
  usesBodyweight: z.boolean().default(false),
  /**
   * Fraction of bodyweight the movement actually moves — a sit-up shifts the
   * trunk, not the whole body. Meaningless when `usesBodyweight` is false.
   * Defaults to 1 (full bodyweight) so a row written before this field
   * existed reads as the old behaviour rather than as unloaded.
   */
  bodyweightFactor: z.number().min(0).max(1).default(1),
  /**
   * `prescribed` is the hunter's own programme: routines are built from these,
   * the progression engine targets them, and they rank first in any swap
   * sheet. `fallback` exists only to be swapped onto when a prescribed
   * exercise's equipment is occupied — never in a routine, never advanced onto
   * by mastering a variation. Defaults to `prescribed` so the existing library
   * needs no edit. See commit 5d33216.
   */
  role: z.enum(['prescribed', 'fallback']).default('prescribed'),
})
export type Exercise = z.infer<typeof ExerciseSchema>

/* ------------------------------------------------------------------ */
/* Routines                                                            */
/* ------------------------------------------------------------------ */

export const BlockItemSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().positive(),
  repRange: RepRangeSchema,
  restSec: z.number().int().nonnegative(),
})
export type BlockItem = z.infer<typeof BlockItemSchema>

/**
 * A superset block holds more than one item and is performed alternating, which
 * is why the block wraps the items rather than the routine listing them flat.
 */
export const BlockSchema = z.object({
  type: z.enum(['single', 'superset']),
  items: z.array(BlockItemSchema).min(1),
})
export type Block = z.infer<typeof BlockSchema>

export const RoutineSchema = z.object({
  id: z.string().min(1),
  /** 0 is Sunday, matching `Date.prototype.getDay`. */
  dayOfWeek: z.number().int().min(0).max(6),
  name: z.string().min(1),
  gateRank: RankSchema,
  blocks: z.array(BlockSchema),
})
export type Routine = z.infer<typeof RoutineSchema>

/* ------------------------------------------------------------------ */
/* The append-only log                                                 */
/* ------------------------------------------------------------------ */

/**
 * One logged set. Written once, never updated or deleted. A correction is a new
 * row that supersedes this one via `supersedes`.
 */
export const SetLogSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  /** Position within the session, so ordering survives out-of-order sync. */
  order: z.number().int().nonnegative(),
  /** Kilograms. Zero for an unloaded bodyweight set. */
  weight: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  /** Seconds, for time-based work such as a plank or a treadmill interval. */
  seconds: z.number().nonnegative().optional(),
  /** Metres, for distance work. */
  metres: z.number().nonnegative().optional(),
  /** Rate of perceived exertion, 1 to 10 in halves. Optional but feeds PER. */
  rpe: z.number().min(1).max(10).optional(),
  isWarmup: z.boolean().default(false),
  completedAt: TimestampSchema,
  /** Set to the id of an earlier set this one corrects. */
  supersedes: z.string().optional(),
  /**
   * The planned exercise's id, when this set stood in for something else —
   * a logged fact, not a routine edit (standards rule 4). Absent on every
   * row written before substitution existed, which this optional field
   * tolerates (rule 3). See commit 9de7140.
   */
  substitutedFor: z.string().optional(),
  /** Why the swap happened. 'injury' is recorded separately from the others
   *  because it is meant to eventually raise an advisory, not be forgotten. */
  substitutionReason: SubstitutionReasonSchema.optional(),
})
export type SetLog = z.infer<typeof SetLogSchema>

export const SessionLogSchema = z.object({
  id: z.string().min(1),
  routineId: z.string().nullable(),
  /** Which quest or gate this session was logged against, if any. */
  questId: z.string().optional(),
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
  /** The 04:00-rollover day this session is credited to. */
  dayKey: DayKeySchema,
  /** Bodyweight at the time of the session, kilograms. */
  bodyweightKg: z.number().positive().optional(),
  notes: z.string().optional(),
})
export type SessionLog = z.infer<typeof SessionLogSchema>

/* ------------------------------------------------------------------ */
/* Profile and body metrics                                            */
/* ------------------------------------------------------------------ */

export const ProfileSchema = z.object({
  id: z.literal('profile'),
  /**
   * User-entered at the Awakening Test, never pre-filled from a device or
   * account name. Absent means declined — `hunterDisplayName` (domain/hunterName.ts)
   * is where a missing name gets a fallback, never here.
   */
  hunterName: z.string().trim().min(1).max(40).optional(),
  sex: SexSchema,
  birthYear: z.number().int().min(1900).max(2100),
  heightCm: z.number().positive(),
  unitPref: UnitPrefSchema,
  trainingYears: z.number().nonnegative(),
  equipmentAccess: z.array(EquipmentSchema),
  /**
   * Which strength-standard table to borrow when sex is `unspecified`. Absent
   * means the hunter declined, and rank falls back to unranked.
   */
  standardsTableOverride: z.enum(['male', 'female']).optional(),
  createdAt: TimestampSchema,
  awakenedAt: TimestampSchema.nullable(),
})
export type Profile = z.infer<typeof ProfileSchema>

/**
 * All measurements in centimetres and kilograms. Body fat percentage is stored
 * with its source, because a DEXA number and a smart-scale number are not the
 * same kind of fact and must not be displayed as though they were.
 */
export const BodyMetricSchema = z.object({
  id: z.string().min(1),
  dayKey: DayKeySchema,
  recordedAt: TimestampSchema,
  weightKg: z.number().positive(),
  waistCm: z.number().positive().optional(),
  neckCm: z.number().positive().optional(),
  hipCm: z.number().positive().optional(),
  bodyFatPct: z.number().min(1).max(70).optional(),
  bodyFatSource: BodyFatSourceSchema.optional(),
})
export type BodyMetric = z.infer<typeof BodyMetricSchema>

/* ------------------------------------------------------------------ */
/* Derived player state                                               */
/* ------------------------------------------------------------------ */

export const StatBlockSchema = z.object({
  STR: z.number(),
  VIT: z.number(),
  AGI: z.number(),
  INT: z.number(),
  PER: z.number(),
})
export type StatBlock = z.infer<typeof StatBlockSchema>

/**
 * Never synced and never authoritative. Recomputed from the log on each device,
 * because the log is truth and the status window is a projection of it.
 */
export const PlayerStateSchema = z.object({
  level: z.number().int().positive(),
  xp: z.number().nonnegative(),
  xpIntoLevel: z.number().nonnegative(),
  xpToNext: z.number().positive(),
  /** The half of the stats earned by training, on a 28-day rolling window. */
  derived: StatBlockSchema,
  /** The half the hunter assigns by hand, three points per level. */
  allocated: StatBlockSchema,
  /** Derived plus allocated. What the status window shows. */
  total: StatBlockSchema,
  unspentStatPoints: z.number().int().nonnegative(),
  fatigue: z.number().nonnegative(),
  fatigueMultiplier: z.number().positive(),
  rank: RankSchema.nullable(),
  hunterClass: HunterClassSchema,
  gold: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  restTokens: z.number().int().nonnegative(),
})
export type PlayerState = z.infer<typeof PlayerStateSchema>

/* ------------------------------------------------------------------ */
/* Game entities                                                       */
/* ------------------------------------------------------------------ */

export const ShadowSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  name: z.string().min(1),
  rank: RankSchema,
  extractedAt: TimestampSchema,
  /** Human-readable description of the passive effect. */
  buff: z.string().min(1),
  buffKind: z.enum(['xp_bonus', 'rest_reduction', 'volume_tolerance', 'streak_shield']),
  buffMagnitude: z.number(),
  /** Marshal shadows are the strongest lifts and are named in canon. */
  isMarshal: z.boolean().default(false),
  /** Only active shadows apply their buff, and the roster is capped by INT. */
  active: z.boolean().default(true),
})
export type Shadow = z.infer<typeof ShadowSchema>

export const QuestLogSchema = z.object({
  id: z.string().min(1),
  dayKey: DayKeySchema,
  type: QuestTypeSchema,
  status: QuestStatusSchema,
  issuedAt: TimestampSchema,
  /** After this instant a gate has been open too long and breaks. */
  expiresAt: TimestampSchema.nullable(),
  payload: z.unknown(),
  /** Set to the id of an earlier quest this one replaces — a reroll (m7b-plan F3), same pattern as SetLog.supersedes. */
  supersedes: z.string().optional(),
})
export type QuestLog = z.infer<typeof QuestLogSchema>

export const TitleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  earnedAt: TimestampSchema,
})
export type Title = z.infer<typeof TitleSchema>

/** A stored personal record, used for PR detection and the Monarchs screen. */
export const PersonalRecordSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  /** Estimated one-rep max in kg at the time of the record. */
  e1rmKg: z.number().nonnegative(),
  weightKg: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  achievedAt: TimestampSchema,
  dayKey: DayKeySchema,
})
export type PersonalRecord = z.infer<typeof PersonalRecordSchema>

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** Last-write-wins on sync, unlike the append-only log. */
export const SettingsSchema = z.object({
  id: z.literal('settings'),
  updatedAt: TimestampSchema,
  soundEnabled: z.boolean().default(true),
  hapticsEnabled: z.boolean().default(true),
  keepScreenAwake: z.boolean().default(true),
  pushEnabled: z.boolean().default(false),
  syncEnabled: z.boolean().default(false),
  /** Advisory ids the hunter has dismissed. */
  dismissedAdvisories: z.array(z.string()).default([]),
  /** Whether the one-time "how the summon windows work" notification has fired (m10-plan commit 3). */
  systemIntroSeen: z.boolean().default(false),
})
export type Settings = z.infer<typeof SettingsSchema>
