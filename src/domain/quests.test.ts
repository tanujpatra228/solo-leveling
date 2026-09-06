import { describe, expect, it } from 'vitest'
import {
  CANON_LEVEL,
  CANON_TARGETS,
  PENALTY_SURCHARGE,
  REST_TOKENS_PER_MONTH,
  dailyScale,
  generateDailyQuest,
  generatePenaltyQuest,
  generateRecoveryQuest,
  isDailyQuestComplete,
  mergeDailyQuestProgress,
  nextStreak,
  planDay,
  resolveMissedDay,
} from './quests'
import { ZERO_STATS } from './stats'

describe('the Daily Quest scales toward canon', () => {
  it('uses the canon figures from the manhwa as its ceiling', () => {
    expect(CANON_TARGETS).toEqual({ pushups: 100, situps: 100, squats: 100, runMetres: 10_000 })
  })

  it('starts well below canon so day one is doable', () => {
    const quest = generateDailyQuest({ dayKey: '2026-03-01', level: 1, allocated: ZERO_STATS })
    const pushups = quest.items.find((i) => i.kind === 'pushups')!
    expect(pushups.target).toBeLessThan(CANON_TARGETS.pushups)
    expect(pushups.target).toBeGreaterThan(0)
  })

  it('reaches full canon at the level the XP curve is calibrated to', () => {
    expect(dailyScale(CANON_LEVEL)).toBe(1)
    const quest = generateDailyQuest({ dayKey: '2026-03-01', level: CANON_LEVEL, allocated: ZERO_STATS })
    expect(quest.items.find((i) => i.kind === 'pushups')!.target).toBe(100)
    expect(quest.items.find((i) => i.kind === 'run')!.target).toBe(10_000)
  })

  it('does not keep growing past canon', () => {
    expect(dailyScale(200)).toBe(1)
  })

  it('rises monotonically with level', () => {
    let previous = 0
    for (let level = 1; level <= CANON_LEVEL; level += 1) {
      const scale = dailyScale(level)
      expect(scale).toBeGreaterThanOrEqual(previous)
      previous = scale
    }
  })

  it('is deterministic, so the same day always produces the same quest', () => {
    const a = generateDailyQuest({ dayKey: '2026-03-01', level: 12, allocated: ZERO_STATS })
    const b = generateDailyQuest({ dayKey: '2026-03-01', level: 12, allocated: ZERO_STATS })
    expect(a).toEqual(b)
  })

  it('always issues all four canon items, whatever the allocation', () => {
    const quest = generateDailyQuest({
      dayKey: '2026-03-01',
      level: 20,
      allocated: { STR: 60, VIT: 0, AGI: 0, INT: 0, PER: 0 },
    })
    expect(quest.items.map((i) => i.kind).sort()).toEqual(['pushups', 'run', 'situps', 'squats'])
  })

  it('shifts emphasis with allocated points without removing anything', () => {
    const neutral = generateDailyQuest({ dayKey: '2026-03-01', level: 25, allocated: ZERO_STATS })
    const strengthy = generateDailyQuest({
      dayKey: '2026-03-01',
      level: 25,
      allocated: { STR: 60, VIT: 0, AGI: 0, INT: 0, PER: 0 },
    })
    const pushupsNeutral = neutral.items.find((i) => i.kind === 'pushups')!.target
    const pushupsStrong = strengthy.items.find((i) => i.kind === 'pushups')!.target
    expect(pushupsStrong).toBeGreaterThan(pushupsNeutral)
  })

  it('uses the canon announcement', () => {
    const quest = generateDailyQuest({ dayKey: '2026-03-01', level: 1, allocated: ZERO_STATS })
    expect(quest.announcement).toBe('[Daily Quest has arrived.]')
  })
})

describe('Daily Quest per-item progress (F2, docs/m5-plan.md)', () => {
  const quest = generateDailyQuest({ dayKey: '2026-03-01', level: 20, allocated: ZERO_STATS })

  it('is not complete with no progress entered at all', () => {
    expect(isDailyQuestComplete(quest, {})).toBe(false)
  })

  it('is not complete while any single item is short, even if the rest are met', () => {
    const progress: Partial<Record<(typeof quest.items)[number]['kind'], number>> = {}
    for (const item of quest.items) progress[item.kind] = item.target
    const oneShort = { ...progress, [quest.items[0]!.kind]: quest.items[0]!.target - 1 }
    expect(isDailyQuestComplete(quest, oneShort)).toBe(false)
  })

  it('is complete once every item has met or passed its target', () => {
    const progress: Partial<Record<(typeof quest.items)[number]['kind'], number>> = {}
    for (const item of quest.items) progress[item.kind] = item.target
    expect(isDailyQuestComplete(quest, progress)).toBe(true)
  })

  it('accepts an item entered past its target', () => {
    const progress: Partial<Record<(typeof quest.items)[number]['kind'], number>> = {}
    for (const item of quest.items) progress[item.kind] = item.target + 50
    expect(isDailyQuestComplete(quest, progress)).toBe(true)
  })

  it('merges entered amounts additively, so a second entry adds rather than overwrites', () => {
    const first = mergeDailyQuestProgress({}, { pushups: 40 })
    expect(first.pushups).toBe(40)
    const second = mergeDailyQuestProgress(first, { pushups: 60 })
    expect(second.pushups).toBe(100)
  })

  it('leaves other kinds untouched when merging one', () => {
    const current = { pushups: 40, situps: 20 }
    const merged = mergeDailyQuestProgress(current, { squats: 10 })
    expect(merged).toEqual({ pushups: 40, situps: 20, squats: 10 })
  })

  it('ignores a missing or non-positive entered amount rather than zeroing recorded progress', () => {
    const current = { pushups: 40 }
    expect(mergeDailyQuestProgress(current, { pushups: 0 })).toEqual({ pushups: 40 })
    expect(mergeDailyQuestProgress(current, { pushups: -5 })).toEqual({ pushups: 40 })
  })

  it('merging nothing into nothing stays empty', () => {
    expect(mergeDailyQuestProgress({}, {})).toEqual({})
  })
})

describe('the Penalty Quest adds work and never removes progress', () => {
  const missed = generateDailyQuest({ dayKey: '2026-03-01', level: 10, allocated: ZERO_STATS })

  it('carries the outstanding work forward at a surcharge', () => {
    const penalty = generatePenaltyQuest({ missed, completed: {} })!
    expect(penalty.dayKey).toBe('2026-03-02')
    const pushups = penalty.items.find((i) => i.kind === 'pushups')!
    const original = missed.items.find((i) => i.kind === 'pushups')!
    expect(pushups.target).toBeGreaterThan(original.target)
  })

  it('surcharges by the stated fraction', () => {
    expect(PENALTY_SURCHARGE).toBe(0.5)
  })

  it('only carries forward what was actually left undone', () => {
    const original = missed.items.find((i) => i.kind === 'pushups')!
    const penalty = generatePenaltyQuest({
      missed,
      completed: { pushups: original.target },
    })!
    expect(penalty.items.some((i) => i.kind === 'pushups')).toBe(false)
  })

  it('issues nothing at all when the quest was completed', () => {
    const completed = Object.fromEntries(missed.items.map((i) => [i.kind, i.target]))
    expect(generatePenaltyQuest({ missed, completed })).toBeNull()
  })

  it('says explicitly that nothing was taken away', () => {
    const penalty = generatePenaltyQuest({ missed, completed: {} })!
    expect(penalty.reassurance).toContain('Nothing has been taken away')
  })
})

describe('the Recovery Quest', () => {
  it('asks the hunter to do less, and says why', () => {
    const quest = generateRecoveryQuest('2026-03-01', 1.7)
    expect(quest.items[0]).toContain('No lifting')
    expect(quest.detail).toContain('1.70')
  })
})

describe('forgiveness', () => {
  it('offers two rest tokens a month', () => {
    expect(REST_TOKENS_PER_MONTH).toBe(2)
  })

  it('uses an explicit declaration before spending a token', () => {
    const result = resolveMissedDay('2026-03-01', {
      restTokensRemaining: 2,
      declaredDays: ['2026-03-01'],
      streakFrozen: false,
    })
    expect(result.forgiven).toBe(true)
    expect(result.via).toBe('illness')
    expect(result.tokensRemaining).toBe(2)
  })

  it('spends a token when there is nothing else to cover the day', () => {
    const result = resolveMissedDay('2026-03-01', {
      restTokensRemaining: 2,
      declaredDays: [],
      streakFrozen: false,
    })
    expect(result.via).toBe('rest_token')
    expect(result.tokensRemaining).toBe(1)
  })

  it('does not forgive once the tokens are gone', () => {
    const result = resolveMissedDay('2026-03-01', {
      restTokensRemaining: 0,
      declaredDays: [],
      streakFrozen: false,
    })
    expect(result.forgiven).toBe(false)
    expect(result.via).toBeNull()
  })

  it('holds the streak on a forgiven day rather than extending it', () => {
    expect(nextStreak(10, 'completed')).toBe(11)
    expect(nextStreak(10, 'forgiven')).toBe(10)
    expect(nextStreak(10, 'missed')).toBe(0)
  })
})

describe('planDay', () => {
  it('always issues a Daily Quest', () => {
    const plan = planDay({
      dayKey: '2026-03-01',
      routineIdForDay: null,
      penaltyOwed: false,
      recoveryOwed: false,
      allocated: ZERO_STATS,
    })
    expect(plan.quests).toEqual(['daily'])
  })

  it('adds a gate when the split calls for one', () => {
    const plan = planDay({
      dayKey: '2026-03-02',
      routineIdForDay: 'monday-cst',
      penaltyOwed: false,
      recoveryOwed: false,
      allocated: ZERO_STATS,
    })
    expect(plan.quests).toContain('gate')
    expect(plan.routineId).toBe('monday-cst')
  })

  it('suppresses the gate on a recovery day, since issuing both is incoherent', () => {
    const plan = planDay({
      dayKey: '2026-03-02',
      routineIdForDay: 'monday-cst',
      penaltyOwed: true,
      recoveryOwed: true,
      allocated: ZERO_STATS,
    })
    expect(plan.quests).toContain('recovery')
    expect(plan.quests).not.toContain('gate')
    expect(plan.routineId).toBeNull()
  })

  it('adds a penalty when one is owed', () => {
    const plan = planDay({
      dayKey: '2026-03-02',
      routineIdForDay: null,
      penaltyOwed: true,
      recoveryOwed: false,
      allocated: ZERO_STATS,
    })
    expect(plan.quests).toContain('penalty')
  })
})
