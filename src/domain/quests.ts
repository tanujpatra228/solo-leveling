/**
 * Quest generation. Deterministic, a rules engine and not a language model.
 *
 * Progressive overload is arithmetic. A model inventing "3x8 at 60 kg" is
 * unverifiable and can injure someone, so nothing in this file is generated or
 * sampled. Given the same inputs it returns the same quest, every time.
 *
 * The Daily Quest is a small fixed baseline and is deliberately separate from
 * the gym split. It scales from the canon 100 push-ups, 100 sit-ups, 100 squats
 * and 10 km run, reaching those figures at the level the XP curve is calibrated
 * to arrive at after a consistent year.
 */
import type { DayKey, HunterClass, QuestLog, QuestType, StatBlock } from './types'
import { addDaysToKey } from './time'
import { FLAVOUR_TABLE, flavourFor } from './flavour'
import { questBiasFromAllocation, type QuestBias } from './stats'

/* ------------------------------------------------------------------ */
/* The Daily Quest                                                     */
/* ------------------------------------------------------------------ */

export type DailyItemKind = 'pushups' | 'situps' | 'squats' | 'run'

export interface DailyQuestItem {
  kind: DailyItemKind
  label: string
  /** Reps, or metres for the run. */
  target: number
  unit: 'reps' | 'metres'
}

export interface DailyQuest {
  dayKey: DayKey
  items: DailyQuestItem[]
  xpReward: number
  goldReward: number
  /** The canon line the System uses when it arrives. */
  announcement: string
}

/**
 * The persisted shape of a daily-quest row's payload: the generated quest
 * plus what the hunter has entered against each item so far. Progress is
 * entered by the hunter, never inferred from logged sets inside a gate — 40
 * sit-ups inside a gate are not the Daily Quest's sit-ups unless the hunter
 * says so, and guessing would either double-count the day's work or quietly
 * complete a quest nobody did (F2).
 */
export interface DailyQuestPayload extends DailyQuest {
  progress: Partial<Record<DailyItemKind, number>>
}

/**
 * Whether every item in a quest has met or passed its target. Takes anything
 * with an `items` list — the Daily Quest and the Penalty Quest both qualify,
 * and neither has to pretend to be the other's full shape just to share this
 * check.
 */
export function isDailyQuestComplete(
  quest: { items: DailyQuestItem[] },
  progress: Partial<Record<DailyItemKind, number>>,
): boolean {
  return quest.items.every((item) => (progress[item.kind] ?? 0) >= item.target)
}

/**
 * Merges newly entered amounts into what is already recorded, additively:
 * entering 40 pushups and later 60 more totals 100, rather than the second
 * entry overwriting the first. A missing or non-positive amount is ignored
 * rather than zeroing out recorded progress.
 */
export function mergeDailyQuestProgress(
  current: Partial<Record<DailyItemKind, number>>,
  entered: Partial<Record<DailyItemKind, number>>,
): Partial<Record<DailyItemKind, number>> {
  const next = { ...current }
  for (const kind of Object.keys(entered) as DailyItemKind[]) {
    const amount = entered[kind]
    if (amount === undefined || amount <= 0) continue
    next[kind] = (next[kind] ?? 0) + amount
  }
  return next
}

/**
 * The quest of a given type for a day that nothing else supersedes — the
 * live one. A reroll (m7b-plan F3, commit 4) adds a new row rather than
 * deleting the old one, so a plain dayKey+type lookup could return either;
 * this always returns the current one. Same pattern as `SetLog.supersedes`.
 */
export function activeQuestFor(
  quests: readonly QuestLog[],
  dayKey: DayKey,
  type: QuestType,
): QuestLog | null {
  const candidates = quests.filter((q) => q.dayKey === dayKey && q.type === type)
  const supersededIds = new Set(
    candidates.map((q) => q.supersedes).filter((id): id is string => id !== undefined),
  )
  return candidates.find((q) => !supersededIds.has(q.id)) ?? null
}

/** The canon Daily Quest, reached at the level the XP curve targets for a year. */
export const CANON_TARGETS = { pushups: 100, situps: 100, squats: 100, runMetres: 10_000 } as const

/** The level at which the Daily Quest reaches full canon scale. */
export const CANON_LEVEL = 50

/** Where a brand-new hunter starts, as a fraction of the canon target. */
export const STARTING_FRACTION = 0.2

/**
 * Linear ramp from the starting fraction at level 1 to full canon at
 * `CANON_LEVEL`, then held. Linear rather than accelerating, because the point
 * of the baseline is that it stays doable every single day.
 */
export function dailyScale(level: number): number {
  if (level >= CANON_LEVEL) return 1
  const progress = (Math.max(1, level) - 1) / (CANON_LEVEL - 1)
  return STARTING_FRACTION + (1 - STARTING_FRACTION) * progress
}

/** Rounds reps to something a person would actually count to. */
function tidyReps(value: number): number {
  if (value >= 100) return Math.round(value / 10) * 10
  if (value >= 20) return Math.round(value / 5) * 5
  return Math.max(5, Math.round(value))
}

function tidyMetres(value: number): number {
  return Math.max(500, Math.round(value / 500) * 500)
}

/**
 * The Daily Quest for a given day. Allocated stat points tilt the mix: points
 * in STR shift work toward the strength movements, points in AGI toward the run.
 * The tilt is bounded, so it changes emphasis without ever removing an item.
 */
export function generateDailyQuest(input: {
  dayKey: DayKey
  level: number
  allocated: StatBlock
}): DailyQuest {
  const scale = dailyScale(input.level)
  const bias = questBiasFromAllocation(input.allocated)

  const items: DailyQuestItem[] = [
    {
      kind: 'pushups',
      label: 'Push-ups',
      target: tidyReps(CANON_TARGETS.pushups * scale * bias.heavyLowRep),
      unit: 'reps',
    },
    {
      kind: 'situps',
      label: 'Sit-ups',
      target: tidyReps(CANON_TARGETS.situps * scale * bias.volume),
      unit: 'reps',
    },
    {
      kind: 'squats',
      label: 'Bodyweight squats',
      target: tidyReps(CANON_TARGETS.squats * scale * bias.heavyLowRep),
      unit: 'reps',
    },
    {
      kind: 'run',
      label: 'Run',
      target: tidyMetres(CANON_TARGETS.runMetres * scale * bias.conditioning),
      unit: 'metres',
    },
  ]

  return {
    dayKey: input.dayKey,
    items,
    xpReward: 150,
    goldReward: 25,
    announcement: '[Daily Quest has arrived.]',
  }
}

/* ------------------------------------------------------------------ */
/* Penalty                                                             */
/* ------------------------------------------------------------------ */

/**
 * Missing the Daily Quest issues a Penalty Quest of extra work the next day.
 *
 * The canon penalty is a four-hour survival zone. Real cruelty destroys
 * adherence, and a punishing system is how an app like this dies, so the
 * penalty here only ever *adds work*. It never deletes progress, never takes XP
 * away, and never resets a level.
 */
export const PENALTY_SURCHARGE = 0.5

export interface PenaltyQuest {
  dayKey: DayKey
  /** The uncompleted work, carried forward at a surcharge. */
  items: DailyQuestItem[]
  announcement: string
  reassurance: string
}

/**
 * The persisted shape of a penalty-quest row's payload — `PenaltyQuest` plus
 * what the hunter has entered against it, same split as `DailyQuestPayload`
 * and for the same reason: a penalty item is only done when the hunter says
 * so, never inferred, and it clears on its own progress alone. Nothing else
 * — least of all finishing an unrelated fresh Daily Quest — discharges it.
 */
export interface PenaltyQuestPayload extends PenaltyQuest {
  progress: Partial<Record<DailyItemKind, number>>
}

export function generatePenaltyQuest(input: {
  missed: DailyQuest
  /** Work actually completed against each item, by kind. */
  completed: Partial<Record<DailyItemKind, number>>
}): PenaltyQuest | null {
  const outstanding: DailyQuestItem[] = []

  for (const item of input.missed.items) {
    const done = input.completed[item.kind] ?? 0
    const remaining = item.target - done
    if (remaining <= 0) continue
    outstanding.push({
      ...item,
      target:
        item.unit === 'metres'
          ? tidyMetres(remaining * (1 + PENALTY_SURCHARGE))
          : tidyReps(remaining * (1 + PENALTY_SURCHARGE)),
    })
  }

  if (outstanding.length === 0) return null

  return {
    dayKey: addDaysToKey(input.missed.dayKey, 1),
    items: outstanding,
    announcement: flavourFor(
      FLAVOUR_TABLE,
      'penalty_issued',
      input.missed.dayKey,
      '[You have failed to complete the Daily Quest. A Penalty Quest has been issued.]',
    ),
    reassurance:
      'Nothing has been taken away. Your level, your stats, and your logged work are untouched. This is the outstanding work carried forward with a surcharge.',
  }
}

/* ------------------------------------------------------------------ */
/* Recovery                                                            */
/* ------------------------------------------------------------------ */

export interface RecoveryQuest {
  dayKey: DayKey
  items: string[]
  announcement: string
  detail: string
}

/**
 * Issued when the workload ratio spikes. The only quest in the app whose
 * completion condition is doing less.
 */
export function generateRecoveryQuest(dayKey: DayKey, acwr: number): RecoveryQuest {
  return {
    dayKey,
    items: [
      'No lifting today.',
      'Twenty to thirty minutes of easy walking, conversational pace.',
      'Ten minutes of mobility work on whatever feels tight.',
      'Log your bodyweight.',
    ],
    announcement: '[A Recovery Quest has been issued.]',
    detail: `Your workload ratio is ${acwr.toFixed(2)}, past the point where more work stops producing more progress. Clearing this quest restores the full experience multiplier.`,
  }
}

/* ------------------------------------------------------------------ */
/* Forgiveness                                                         */
/* ------------------------------------------------------------------ */

/** Two rest tokens a month, replenished on the first of the month. */
export const REST_TOKENS_PER_MONTH = 2

export type AbsenceReason = 'rest_token' | 'illness' | 'travel' | 'streak_freeze'

export interface ForgivenessState {
  restTokensRemaining: number
  /** Days currently declared as illness or travel. */
  declaredDays: readonly DayKey[]
  streakFrozen: boolean
}

/**
 * Whether a missed day is forgiven, and by what. Order matters: an explicit
 * declaration is used before a token is spent, so the hunter does not burn a
 * token on a day they already accounted for.
 */
export function resolveMissedDay(
  dayKey: DayKey,
  state: ForgivenessState,
): { forgiven: boolean; via: AbsenceReason | null; tokensRemaining: number } {
  if (state.declaredDays.includes(dayKey)) {
    return { forgiven: true, via: 'illness', tokensRemaining: state.restTokensRemaining }
  }
  if (state.streakFrozen) {
    return { forgiven: true, via: 'streak_freeze', tokensRemaining: state.restTokensRemaining }
  }
  if (state.restTokensRemaining > 0) {
    return { forgiven: true, via: 'rest_token', tokensRemaining: state.restTokensRemaining - 1 }
  }
  return { forgiven: false, via: null, tokensRemaining: 0 }
}

/**
 * The streak after a day resolves. A forgiven day holds the streak rather than
 * extending it, which is the honest middle ground between punishing illness and
 * pretending work happened.
 */
export function nextStreak(
  currentStreak: number,
  outcome: 'completed' | 'forgiven' | 'missed',
): number {
  switch (outcome) {
    case 'completed':
      return currentStreak + 1
    case 'forgiven':
      return currentStreak
    case 'missed':
      return 0
  }
}

/* ------------------------------------------------------------------ */
/* Job Change                                                          */
/* ------------------------------------------------------------------ */

/** The level at which the Job Change Quest becomes available (m7b-plan F1). */
export const JOB_CHANGE_LEVEL = 20

/**
 * Whether the Job Change Quest should be offered. Completion is a fact in the
 * log (m7b-plan F6), so once true this never needs to become false again —
 * `alreadyCompleted` just stops it from being offered a second time.
 */
export function isJobChangeDue(level: number, alreadyCompleted: boolean): boolean {
  return level >= JOB_CHANGE_LEVEL && !alreadyCompleted
}

type CombatClass = Exclude<HunterClass, 'none' | 'shadow_monarch'>

/**
 * Which of the four combat stats maps to which class. INT is excluded on
 * purpose — it already has a role (mana capacity for the shadow roster,
 * `activeShadowCap`) and is not one of the four archetypes the brief names.
 */
const CLASS_BY_STAT: Record<'STR' | 'VIT' | 'AGI' | 'PER', CombatClass> = {
  STR: 'fighter',
  VIT: 'tanker',
  AGI: 'assassin',
  PER: 'ranger',
}

/**
 * Priority order for a tie. Rule 2: a function returning an enum states what
 * an ambiguous input returns explicitly, rather than falling through to
 * whichever key an object happened to iterate first.
 */
const TIE_PRIORITY: readonly ('STR' | 'VIT' | 'AGI' | 'PER')[] = ['STR', 'VIT', 'AGI', 'PER']

/**
 * Fighter, Tanker, Assassin or Ranger, from whichever of STR/VIT/AGI/PER is
 * highest. An all-equal distribution (a fresh hunter with `ZERO_STATS`, or
 * any exact tie) explicitly resolves to Fighter via `TIE_PRIORITY`, never to
 * an arbitrary object-iteration order.
 */
export function classFromStats(total: StatBlock): CombatClass {
  let winner: 'STR' | 'VIT' | 'AGI' | 'PER' = TIE_PRIORITY[0]!
  for (const key of TIE_PRIORITY) {
    if (total[key] > total[winner]) winner = key
  }
  return CLASS_BY_STAT[winner]
}

/** The completion payload: the read stats plus the class they picked, kept together so the pick stays auditable. */
export interface JobChangeResult {
  statsRead: StatBlock
  class: CombatClass
}

export function resolveJobChange(total: StatBlock): JobChangeResult {
  return { statsRead: total, class: classFromStats(total) }
}

/* ------------------------------------------------------------------ */
/* Quest selection for a day                                           */
/* ------------------------------------------------------------------ */

export interface DayPlan {
  dayKey: DayKey
  /** Quests the System issues for this day, in the order they should be shown. */
  quests: QuestType[]
  /** Set when a gate is scheduled for this day. */
  routineId: string | null
  bias: QuestBias
}

/**
 * What the System issues for a day: always a Daily Quest, plus a gate if the
 * split calls for one, plus a penalty or a recovery quest if either is owed.
 */
export function planDay(input: {
  dayKey: DayKey
  routineIdForDay: string | null
  penaltyOwed: boolean
  recoveryOwed: boolean
  allocated: StatBlock
}): DayPlan {
  const quests: QuestType[] = ['daily']
  if (input.recoveryOwed) {
    // A recovery day suppresses the gate. Issuing both would be incoherent.
    quests.push('recovery')
    return {
      dayKey: input.dayKey,
      quests,
      routineId: null,
      bias: questBiasFromAllocation(input.allocated),
    }
  }
  if (input.penaltyOwed) quests.push('penalty')
  if (input.routineIdForDay) quests.push('gate')

  return {
    dayKey: input.dayKey,
    quests,
    routineId: input.routineIdForDay,
    bias: questBiasFromAllocation(input.allocated),
  }
}
