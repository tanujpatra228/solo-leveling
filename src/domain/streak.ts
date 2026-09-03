/**
 * Streaks.
 *
 * Today never breaks a streak. The day is still in progress, so an
 * uncompleted quest at 09:00 is not a failure yet — the walk backwards starts
 * at yesterday unless today is already done. Getting this wrong would show a
 * hunter a broken streak every morning, which is exactly the kind of
 * discouragement the forgiveness rules exist to avoid.
 */
import { addDaysToKey } from './time'
import type { DayKey, QuestLog } from './types'

export interface StreakState {
  current: number
  longest: number
  /** Days that were forgiven rather than completed, most recent first. */
  forgivenDays: DayKey[]
  /** True when today's quest is still outstanding but the streak is intact. */
  todayPending: boolean
}

type DayOutcome = 'complete' | 'forgiven' | 'missed' | 'unknown'

function outcomeByDay(quests: readonly QuestLog[]): Map<DayKey, DayOutcome> {
  const outcomes = new Map<DayKey, DayOutcome>()
  for (const quest of quests) {
    if (quest.type !== 'daily') continue
    const existing = outcomes.get(quest.dayKey)
    // A day with several rows resolves to the best outcome recorded for it.
    const rank: Record<DayOutcome, number> = { complete: 3, forgiven: 2, missed: 1, unknown: 0 }
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
 * rather than the System inferring.
 */
export function computeStreak(
  quests: readonly QuestLog[],
  today: DayKey,
  declaredAbsences: readonly DayKey[] = [],
): StreakState {
  const outcomes = outcomeByDay(quests)
  const declared = new Set(declaredAbsences)
  const forgivenDays: DayKey[] = []

  const resolve = (day: DayKey): DayOutcome => {
    if (declared.has(day)) return 'forgiven'
    return outcomes.get(day) ?? 'unknown'
  }

  const todayOutcome = resolve(today)
  const todayPending = todayOutcome !== 'complete' && todayOutcome !== 'missed'

  /* ---- current streak ---- */
  let current = 0
  let cursor = todayOutcome === 'complete' ? today : addDaysToKey(today, -1)

  // A day with no record at all ends the walk: it is either before the hunter
  // started or a day the System never issued a quest for, and neither should
  // count toward a streak.
  for (let guard = 0; guard < 3650; guard += 1) {
    const outcome = resolve(cursor)
    if (outcome === 'complete') {
      current += 1
    } else if (outcome === 'forgiven') {
      forgivenDays.push(cursor)
    } else {
      break
    }
    cursor = addDaysToKey(cursor, -1)
  }

  /* ---- longest streak, over every day the log knows about ---- */
  const allDays = [...new Set([...outcomes.keys(), ...declared])].sort()
  let longest = 0
  let run = 0
  let previousDay: DayKey | null = null

  for (const day of allDays) {
    const outcome = resolve(day)
    const contiguous = previousDay === null || addDaysToKey(previousDay, 1) === day

    if (!contiguous) run = 0

    if (outcome === 'complete') run += 1
    else if (outcome === 'forgiven') {
      // Forgiveness holds the run rather than extending it.
    } else run = 0

    if (run > longest) longest = run
    previousDay = day
  }

  return {
    current,
    longest: Math.max(longest, current),
    forgivenDays,
    todayPending,
  }
}
