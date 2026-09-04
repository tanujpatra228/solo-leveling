/**
 * Streaks.
 *
 * Today never breaks a streak. The day is still in progress, so an
 * uncompleted quest at 09:00 is not a failure yet — the walk backwards starts
 * at yesterday unless today is already done. Getting this wrong would show a
 * hunter a broken streak every morning, which is exactly the kind of
 * discouragement the forgiveness rules exist to avoid.
 *
 * Rest days are the same idea applied to the calendar. A day the programme
 * never scheduled is not a day the hunter failed, so it neither extends a
 * streak nor breaks one — the walk steps straight over it. Without this a
 * six-day training week could never show a streak above six, because the
 * seventh day would always be a hole.
 */
import { addDaysToKey, daysBetweenKeys } from './time'
import type { DayKey, QuestLog } from './types'

export interface StreakState {
  current: number
  longest: number
  /** Days that were forgiven rather than completed, most recent first. */
  forgivenDays: DayKey[]
  /** True when today's quest is still outstanding but the streak is intact. */
  todayPending: boolean
  /** True when the programme schedules nothing today. */
  todayIsRest: boolean
}

type DayOutcome = 'complete' | 'forgiven' | 'rest' | 'missed' | 'unknown'

/** Answers whether the programme schedules anything on a given day. */
export type IsRestDay = (day: DayKey) => boolean

/** How many days the backward walk will look at before giving up. */
const WALK_GUARD_DAYS = 3650

function outcomeByDay(quests: readonly QuestLog[]): Map<DayKey, DayOutcome> {
  const outcomes = new Map<DayKey, DayOutcome>()
  for (const quest of quests) {
    if (quest.type !== 'daily') continue
    const existing = outcomes.get(quest.dayKey)
    // A day with several rows resolves to the best outcome recorded for it.
    const rank: Record<DayOutcome, number> = {
      complete: 4,
      forgiven: 3,
      rest: 2,
      missed: 1,
      unknown: 0,
    }
    const candidate: DayOutcome =
      quest.status === 'complete'
        ? 'complete'
        : quest.status === 'forgiven'
          ? 'forgiven'
          : quest.status === 'failed' || quest.status === 'expired'
            ? 'missed'
            : 'unknown'
    if (!existing || rank[candidate] > rank[existing]) outcomes.set(quest.dayKey, candidate)
  }
  return outcomes
}

/**
 * The current and longest streaks, derived from the quest log rather than
 * stored, so a corrected day re-derives the history behind it.
 *
 * `declaredAbsences` covers illness and travel, which the hunter declares
 * rather than the System inferring. `isRestDay` reports days the programme
 * schedules nothing for — Sunday, in the training week this was built for.
 */
export function computeStreak(
  quests: readonly QuestLog[],
  today: DayKey,
  declaredAbsences: readonly DayKey[] = [],
  isRestDay: IsRestDay = () => false,
): StreakState {
  const outcomes = outcomeByDay(quests)
  const declared = new Set(declaredAbsences)
  const forgivenDays: DayKey[] = []

  // A completed quest wins over a rest day: if the hunter trained on a day the
  // programme left empty, that is not a day to skip over.
  const resolve = (day: DayKey): DayOutcome => {
    const recorded = outcomes.get(day)
    if (recorded === 'complete') return 'complete'
    if (declared.has(day)) return 'forgiven'
    if (isRestDay(day)) return 'rest'
    return recorded ?? 'unknown'
  }

  const todayOutcome = resolve(today)
  const todayIsRest = todayOutcome === 'rest'
  const todayPending = !todayIsRest && todayOutcome !== 'complete' && todayOutcome !== 'missed'

  /* ---- current streak ---- */
  let current = 0
  let cursor = todayOutcome === 'complete' ? today : addDaysToKey(today, -1)

  // A day with no record at all ends the walk: it is either before the hunter
  // started or a day the System never issued a quest for, and neither should
  // count toward a streak. A rest day is different — it is stepped over.
  for (let guard = 0; guard < WALK_GUARD_DAYS; guard += 1) {
    const outcome = resolve(cursor)
    if (outcome === 'complete') {
      current += 1
    } else if (outcome === 'forgiven') {
      forgivenDays.push(cursor)
    } else if (outcome === 'rest') {
      // Neither extends nor breaks.
    } else {
      break
    }
    cursor = addDaysToKey(cursor, -1)
  }

  /* ---- longest streak ---- */
  //
  // Walked day by day across the whole known span rather than over the days
  // that happen to have quest rows. Rest days have no row, so iterating the
  // rows alone would see a gap every Sunday and reset the run there.
  const known = [...new Set([...outcomes.keys(), ...declared])].sort()
  let longest = 0

  const first = known[0]
  const last = known[known.length - 1]

  if (first !== undefined && last !== undefined) {
    const span = Math.min(daysBetweenKeys(first, last), WALK_GUARD_DAYS)
    let run = 0

    for (let offset = 0; offset <= span; offset += 1) {
      const day = addDaysToKey(first, offset)
      const outcome = resolve(day)

      if (outcome === 'complete') run += 1
      else if (outcome === 'forgiven' || outcome === 'rest') {
        // Both hold the run rather than extending it.
      } else run = 0

      if (run > longest) longest = run
    }
  }

  return {
    current,
    longest: Math.max(longest, current),
    forgivenDays,
    todayPending,
    todayIsRest,
  }
}
