/**
 * Store-level tests for the M3 corrections (G1, G3, G4, G5), plus two bugs
 * found afterward on a real device: /gate crashing with React #185 the
 * instant a session opened, and opening a gate paying a full gate-clear
 * bonus before any set was logged. Each one is a defect that was silent in
 * production — a fallback default, a dropped patch field, a slightly-off
 * count, an unstable selector reference, a phantom rank — so the assertions
 * are written against the wrong-vs-right numbers (or references) themselves,
 * not just "it doesn't throw".
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRedGate } from '../domain/gates'
import { lastSetsForExercise } from '../domain/projection'
import { addDaysToKey, dayOfWeekForKey } from '../domain/time'
import { addShadow, putQuest, updateProgress, wipeEverything } from '../db/repo'
import { generateDailyQuest, type DailyQuestPayload } from '../domain/quests'
import { QUEST_REROLL_PRICE_GOLD, REST_TOKEN_PRICE_GOLD } from '../domain/shop'
import { encodeLicenseKey, generateHunterSecret, pairingPayload } from '../sync/identity'
import { useApp } from './state'

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
})

describe('targetFor resolves the routine from the active session (G1)', () => {
  // Driven through the real startGate/logSet actions rather than useApp.setState:
  // targetFor now reads a map built once in recompute() (see the crash fix
  // below), so an injected `sessions`/`activeSessionId` with no recompute()
  // in between would just read stale (likely empty) targets.
  it('uses the started routine, not the day-of-week lookup for "today"', async () => {
    // Friday Legs' squat block is 4 sets. Whatever routine today's actual
    // weekday would have matched instead is irrelevant — the session's own
    // routineId must win regardless of what day it happens to be run on.
    await useApp.getState().startGate('friday-legs')

    const target = useApp.getState().targetFor('barbell-squat')
    expect(target).not.toBeNull()
    expect(target!.repTargets).toHaveLength(4)
  })

  it('falls back to the day-of-week routine when the session has no routineId (Instant Dungeon Key)', async () => {
    await useApp.getState().startGate(null)

    const state = useApp.getState()
    const routine = state.routines.find((r) => r.dayOfWeek === dayOfWeekForKey(state.today))
    const blockItem = routine?.blocks
      .flatMap((b) => b.items)
      .find((item) => item.exerciseId === 'barbell-squat')

    // Cross-checked against the same seed data the store reads, rather than a
    // day hardcoded into the test, since this needs to pass on any real date.
    const target = state.targetFor('barbell-squat')
    expect(target).not.toBeNull()
    expect(target!.repTargets).toHaveLength(blockItem?.sets ?? 3)
  })
})

describe('targetFor is Object.is-stable across renders (React #185 regression)', () => {
  // targetFor used to call computeNextTarget fresh on every invocation, which
  // returns a new object each time. `useApp((s) => s.targetFor(id))` is a
  // Zustand v5 selector backed by useSyncExternalStore: if the selected value
  // is never Object.is-equal to the previous one, React treats every commit
  // as a fresh update and re-renders forever (dev warns "getSnapshot should
  // be cached", prod minifies it to error #185). Reading from a map built
  // once in recompute() is what fixes it — this asserts that property
  // directly, since it is exactly what a DOM re-render loop depended on and
  // no component test exists to catch it (see F6 in TODO.md).
  it('returns the same reference on repeated calls with no state change in between', async () => {
    await useApp.getState().startGate('friday-legs')

    const first = useApp.getState().targetFor('barbell-squat')
    const second = useApp.getState().targetFor('barbell-squat')
    expect(first).not.toBeNull()
    expect(first).toBe(second)
  })

  it('gives a fresh reference only once state actually changes', async () => {
    await useApp.getState().startGate('friday-legs')
    const before = useApp.getState().targetFor('barbell-squat')

    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })

    const after = useApp.getState().targetFor('barbell-squat')
    expect(after).not.toBe(before)
  })
})

describe('startGate defaults bodyweight from the latest body metric (G3)', () => {
  it('carries the last-known weight onto the session when none is passed explicitly', async () => {
    await useApp.getState().addBodyMetric({ weightKg: 82 })

    const sessionId = await useApp.getState().startGate(null)
    const session = useApp.getState().sessions.find((s) => s.id === sessionId)

    expect(session?.bodyweightKg).toBe(82)
  })

  it('an explicit bodyweight still wins over the stored default', async () => {
    await useApp.getState().addBodyMetric({ weightKg: 82 })

    const sessionId = await useApp.getState().startGate(null, 79)
    const session = useApp.getState().sessions.find((s) => s.id === sessionId)

    expect(session?.bodyweightKg).toBe(79)
  })
})

describe('correctSet can patch isWarmup (G4)', () => {
  it('a working set wrongly logged, then corrected to a warmup, drops out of the next target', async () => {
    const sessionId = await useApp.getState().startGate(null)
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })

    const logged = useApp.getState().sets.find((s) => s.sessionId === sessionId)!
    expect(
      lastSetsForExercise('barbell-squat', useApp.getState().sessions, useApp.getState().sets),
    ).toHaveLength(1)

    await useApp.getState().correctSet(logged.id, { isWarmup: true })

    expect(
      lastSetsForExercise('barbell-squat', useApp.getState().sessions, useApp.getState().sets),
    ).toHaveLength(0)
  })
})

describe('logSet orders by the highest live row, not the row count (G5)', () => {
  it('does not skip an order number after a correction', async () => {
    await useApp.getState().startGate(null)
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 6 })

    const middle = useApp.getState().sets.find((s) => s.order === 1)!
    await useApp.getState().correctSet(middle.id, { reps: 7 })

    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })

    const orders = useApp
      .getState()
      .sets.filter((s) => s.exerciseId === 'barbell-squat')
      .map((s) => s.order)
      .sort((a, b) => a - b)
    // Two rows share order 1 (the superseded original and its replacement).
    // The fourth logged set must be order 3, not order 4 — 3 is the count of
    // live rows, and skipping straight to 4 is exactly the G5 bug.
    expect(orders).toEqual([0, 1, 1, 2, 3])
  })
})

describe('opening a gate pays nothing until a set is logged and Finish Gate is called', () => {
  it('Start Gate alone earns no XP, level, or gate-clear bonus', async () => {
    await useApp.getState().startGate('friday-legs')

    const projection = useApp.getState().projection!
    expect(projection.player.xp).toBe(0)
    expect(projection.player.level).toBe(1)
    expect(projection.sessionSummaries).toHaveLength(0)
  })

  it('logging one set still pays nothing until Finish Gate ends the session', async () => {
    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 5, rpe: 8 })

    expect(useApp.getState().projection!.player.xp).toBe(0)

    await useApp.getState().finishGate()

    expect(useApp.getState().projection!.player.xp).toBeGreaterThan(0)
  })
})

describe('Instant Dungeon Key (m7-plan commit 2)', () => {
  it('starts a routineless session and pays the ordinary gate-clear bonus once finished', async () => {
    const sessionId = await useApp.getState().startInstantDungeon(['bodyweight'])
    const dungeon = useApp.getState().activeInstantDungeon
    expect(dungeon).not.toBeNull()
    expect(useApp.getState().sessions.find((s) => s.id === sessionId)?.routineId).toBeNull()

    const goldBefore = useApp.getState().progress.gold
    const gatesBefore = useApp.getState().progress.gatesCleared
    await useApp.getState().logSet({ exerciseId: dungeon!.blocks[0]!.exerciseId, weight: 0, reps: 15 })
    await useApp.getState().finishGate()

    expect(useApp.getState().progress.gatesCleared).toBe(gatesBefore + 1)
    expect(useApp.getState().progress.gold).toBe(goldBefore + 25)
    expect(useApp.getState().activeInstantDungeon).toBeNull()
  })

  it('abandoning clears the dungeon and pays nothing', async () => {
    await useApp.getState().startInstantDungeon(['bodyweight'])
    const gatesBefore = useApp.getState().progress.gatesCleared

    await useApp.getState().abandonGate()

    expect(useApp.getState().activeInstantDungeon).toBeNull()
    expect(useApp.getState().progress.gatesCleared).toBe(gatesBefore)
  })
})

describe('Red Gate (m7-plan commit 2)', () => {
  const redGate = (targetWeightKg: number) =>
    buildRedGate({ kind: 'pr_attempt', exerciseName: 'Barbell Squat', targetWeightKg, rank: 'B', routineId: null })

  it('a PR attempt at or above target weight clears and pays redGatesCleared', async () => {
    await useApp.getState().enterRedGate(redGate(100), 'barbell-squat', { targetWeightKg: 100 })
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 1, rpe: 10 })

    await useApp.getState().resolveRedGate()

    expect(useApp.getState().progress.redGatesCleared).toBe(1)
    expect(useApp.getState().activeRedGate).toBeNull()
    // Title text varies now (m9-plan flavour), so assert on what does not:
    // tone and the fixed body.
    const last = useApp.getState().messages.at(-1)
    expect(last?.tone).toBe('good')
    expect(last?.body).toContain('record stands')
  })

  it('a PR attempt below target weight fails and pays nothing', async () => {
    await useApp.getState().enterRedGate(redGate(150), 'barbell-squat', { targetWeightKg: 150 })
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 1, rpe: 10 })

    await useApp.getState().resolveRedGate()

    expect(useApp.getState().progress.redGatesCleared).toBe(0)
    const last = useApp.getState().messages.at(-1)
    expect(last?.tone).toBe('warn')
    expect(last?.body).toContain('pays out nothing')
  })

  it('an AMRAP finisher clears on any completed set, with no numeric target', async () => {
    const amrap = buildRedGate({ kind: 'amrap_finisher', exerciseName: 'Pushups', rank: 'B', routineId: null })
    await useApp.getState().enterRedGate(amrap, 'pushups')
    await useApp.getState().logSet({ exerciseId: 'pushups', weight: 0, reps: 20 })

    await useApp.getState().resolveRedGate()

    expect(useApp.getState().progress.redGatesCleared).toBe(1)
  })

  it('resolving with nothing logged fails rather than clearing', async () => {
    await useApp.getState().enterRedGate(redGate(100), 'barbell-squat', { targetWeightKg: 100 })

    await useApp.getState().resolveRedGate()

    expect(useApp.getState().progress.redGatesCleared).toBe(0)
  })

  it('is a no-op with no Red Gate open', async () => {
    await expect(useApp.getState().resolveRedGate()).resolves.toBeUndefined()
  })
})

describe('setShadowActive lets the hunter choose who stays when the cap is full (m7-plan commit 5, F2)', () => {
  it('promotes a benched shadow once an active one is benched, rather than picking for the hunter', async () => {
    await addShadow({
      id: 's-a',
      exerciseId: 'ex-a',
      name: 'A',
      rank: 'C',
      extractedAt: 1,
      buff: 'buff',
      buffKind: 'xp_bonus',
      buffMagnitude: 0.02,
      isMarshal: false,
      active: true,
    })
    await addShadow({
      id: 's-b',
      exerciseId: 'ex-b',
      name: 'B',
      rank: 'C',
      extractedAt: 2,
      buff: 'buff',
      buffKind: 'xp_bonus',
      buffMagnitude: 0.02,
      isMarshal: false,
      active: true,
    })
    await useApp.getState().refresh()

    const before = useApp.getState().projection!.roster
    // Fresh profile, no allocation: INT sits low enough that the cap holds
    // only one, which is the scenario this behavior exists for.
    expect(before.cap).toBe(1)
    expect(before.overCap).toBe(true)
    const activeId = before.active[0]!.id
    const dormantId = before.benched.find((s) => s.active)!.id

    await useApp.getState().setShadowActive(activeId, false)

    const after = useApp.getState().projection!.roster
    expect(after.active.map((s) => s.id)).toEqual([dormantId])
    expect(after.active.map((s) => s.id)).not.toContain(activeId)
  })
})

describe('the Job Change Quest is issued at level 20 and completes on demand (m7b-plan commit 3)', () => {
  it('issues once the level threshold is crossed, and completion reads the stats at that moment', async () => {
    // Push level to 20+ with completed daily quests — the XP source does
    // not matter here, only that a real projection reaches the threshold.
    for (let i = 0; i < 700; i += 1) {
      await putQuest({
        id: `d${i}`,
        dayKey: '2020-01-01',
        type: 'daily',
        status: 'complete',
        issuedAt: 0,
        expiresAt: null,
        payload: null,
      })
    }
    await useApp.getState().refresh()
    expect(useApp.getState().projection!.player.level).toBeGreaterThanOrEqual(20)

    // Lean the allocation toward AGI so the class the test picks is
    // unambiguous against a fresh profile's otherwise-flat derived stats.
    for (let i = 0; i < 10; i += 1) await useApp.getState().allocatePoint('AGI')

    await useApp.getState().ensureQuestsForToday()
    await useApp.getState().refresh()
    expect(useApp.getState().activeJobChangeQuest()).not.toBeNull()
    expect(useApp.getState().projection!.jobChangeDue).toBe(true)

    await useApp.getState().completeJobChangeQuest()

    expect(useApp.getState().activeJobChangeQuest()).toBeNull()
    expect(useApp.getState().projection!.jobChangeDue).toBe(false)
    expect(useApp.getState().projection!.player.hunterClass).toBe('assassin')
  })

  it('is a no-op with nothing issued', async () => {
    await expect(useApp.getState().completeJobChangeQuest()).resolves.toBeUndefined()
  })
})

describe('abandonGate discards an open session instead of finishing it', () => {
  it('deletes the session and its sets, and clears activeSessionId', async () => {
    const sessionId = await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 5 })
    expect(useApp.getState().sets.some((s) => s.sessionId === sessionId)).toBe(true)

    await useApp.getState().abandonGate()

    expect(useApp.getState().activeSessionId).toBeNull()
    expect(useApp.getState().sessions.some((s) => s.id === sessionId)).toBe(false)
    expect(useApp.getState().sets.some((s) => s.sessionId === sessionId)).toBe(false)
  })

  it('is a no-op with no open session', async () => {
    await expect(useApp.getState().abandonGate()).resolves.toBeUndefined()
  })
})

describe('a full Friday Legs session, then next week\'s targets (M3-D5)', () => {
  it('logs all 17 working sets and every exercise progresses to increase_load', async () => {
    const routine = useApp.getState().routines.find((r) => r.id === 'friday-legs')!
    const items = routine.blocks.flatMap((b) => b.items)
    expect(items.reduce((total, item) => total + item.sets, 0)).toBe(17)

    // A baseline weight per exercise, arbitrary but distinct, so the
    // post-session assertions can check each exercise moved by its own
    // increment rather than all landing on the same number by coincidence.
    const baseline: Record<string, number> = {
      'barbell-squat': 100,
      'leg-press': 120,
      'hamstring-curl': 40,
      'leg-extension': 35,
      'barbell-calf-raise': 60,
    }

    await useApp.getState().startGate('friday-legs')

    for (const item of items) {
      for (let i = 0; i < item.sets; i += 1) {
        await useApp.getState().logSet({
          exerciseId: item.exerciseId,
          weight: baseline[item.exerciseId]!,
          reps: item.repRange[1], // the top of the range, every set
          rpe: 8, // PROGRESSION_RPE_CEILING — clean enough to progress
        })
      }
    }

    const loggedCount = useApp
      .getState()
      .sets.filter((s) => s.sessionId === useApp.getState().activeSessionId).length
    expect(loggedCount).toBe(17)

    await useApp.getState().finishGate()

    // Every loaded lift returns increase_load at +increment, rounded — the
    // exact rule stated in M3-D5. hamstring-curl and leg-extension step by
    // the 2.5 kg pin increment; squat, leg press and calf raise by 5 kg.
    const increments: Record<string, number> = {
      'barbell-squat': 5,
      'leg-press': 5,
      'hamstring-curl': 2.5,
      'leg-extension': 2.5,
      'barbell-calf-raise': 5,
    }

    for (const exerciseId of Object.keys(baseline)) {
      const target = useApp.getState().targetFor(exerciseId)!
      expect(target.kind).toBe('increase_load')
      expect(target.weightKg).toBe(baseline[exerciseId]! + increments[exerciseId]!)
    }
  })
})

describe('announceBodyweightFactorRegradeIfNeeded', () => {
  it('marks itself seen silently on a fresh install with no profile yet, and stays a no-op after', async () => {
    // beforeEach's load() already ran this with no profile — there is
    // nothing to regrade, so it should already be marked seen.
    expect(useApp.getState().progress.bodyweightFactorAnnouncedAt).not.toBeNull()

    const before = useApp.getState().messages.length
    await useApp.getState().announceBodyweightFactorRegradeIfNeeded()
    expect(useApp.getState().messages).toHaveLength(before)
  })

  it('announces the corrected level exactly once for a hunter with bodyweight history', async () => {
    await useApp.getState().completeAwakening({
      profile: {
        sex: 'male',
        birthYear: 1996,
        heightCm: 178,
        unitPref: 'metric',
        trainingYears: 3,
        equipmentAccess: ['bodyweight'],
      },
      bodyweightKg: 72,
    })

    await useApp.getState().startGate(null)
    // situps: bodyweightFactor 0.45. Enough volume that the corrected (lower)
    // tonnage still produces real XP, so the before/after comparison has
    // something to actually differ over.
    for (let i = 0; i < 6; i += 1) {
      await useApp.getState().logSet({ exerciseId: 'situps', weight: 0, reps: 20, rpe: 8 })
    }
    await useApp.getState().finishGate()

    // The flag was already set by the initial load() in beforeEach, before a
    // profile existed. Clearing it simulates an existing hunter who already
    // had this history when the bodyweightFactor fix shipped.
    await updateProgress({ bodyweightFactorAnnouncedAt: null })
    await useApp.getState().refresh()
    const messagesBefore = useApp.getState().messages.length

    await useApp.getState().announceBodyweightFactorRegradeIfNeeded()

    expect(useApp.getState().progress.bodyweightFactorAnnouncedAt).not.toBeNull()
    const messagesAfter = useApp.getState().messages
    expect(messagesAfter).toHaveLength(messagesBefore + 1)
    const announcement = messagesAfter[messagesAfter.length - 1]!
    expect(announcement.title).toContain('corrected a measurement')
    // Either the level moved (stated as "X is now level Y") or it held
    // ("holds at Y") — which one depends on whether the tonnage difference
    // crossed a level boundary. Both are legitimate; silence is not.
    expect(announcement.body).toMatch(/is now level \d+|holds at \d+/)

    await useApp.getState().announceBodyweightFactorRegradeIfNeeded()
    expect(useApp.getState().messages).toHaveLength(messagesBefore + 1)
  })
})

describe('substituteExercise records the choice for the open session (commit 9de7140)', () => {
  it('is readable from activeSubstitutions once recorded', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')

    expect(useApp.getState().activeSubstitutions['hanging-leg-raises']).toEqual({
      substituteId: 'leg-raises',
      reason: 'occupied',
    })
  })

  it('logSet stamps substitutedFor and the reason onto the row when given', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    await useApp.getState().logSet({
      exerciseId: 'leg-raises',
      weight: 0,
      reps: 15,
      substitutedFor: 'hanging-leg-raises',
      substitutionReason: 'occupied',
    })

    const logged = useApp.getState().sets.find((s) => s.exerciseId === 'leg-raises')!
    expect(logged.substitutedFor).toBe('hanging-leg-raises')
    expect(logged.substitutionReason).toBe('occupied')
  })

  it('logSet leaves both fields undefined for an ordinary set, so every pre-existing call site is unaffected', async () => {
    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })

    const logged = useApp.getState().sets.find((s) => s.exerciseId === 'barbell-squat')!
    expect(logged.substitutedFor).toBeUndefined()
    expect(logged.substitutionReason).toBeUndefined()
  })

  it('a substitution neither advances nor resets the planned exercise, and the substitute reads no_history the first time', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')

    // Before logging anything, both read no_history.
    expect(useApp.getState().targetFor('hanging-leg-raises')?.kind).toBe('no_history')
    expect(useApp.getState().targetFor('leg-raises')?.kind).toBe('no_history')

    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')
    await useApp.getState().logSet({
      exerciseId: 'leg-raises',
      weight: 0,
      reps: 15,
      substitutedFor: 'hanging-leg-raises',
      substitutionReason: 'occupied',
    })

    // The substitute now has history of its own...
    expect(useApp.getState().targetFor('leg-raises')?.kind).not.toBe('no_history')
    // ...but the planned exercise's own progression is untouched — no set
    // was ever logged under its id, so it still reads exactly as it did
    // before the swap, not advanced and not reset.
    expect(useApp.getState().targetFor('hanging-leg-raises')?.kind).toBe('no_history')
  })

  it('clears once the gate finishes, since the choice was for that session only', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')
    await useApp.getState().logSet({ exerciseId: 'leg-raises', weight: 0, reps: 15 })

    await useApp.getState().finishGate()

    expect(useApp.getState().activeSubstitutions).toEqual({})
  })

  it('clears when the gate is abandoned', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')

    await useApp.getState().abandonGate()

    expect(useApp.getState().activeSubstitutions).toEqual({})
  })

  it('starts empty for a freshly opened gate, even if a previous session recorded one', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')
    await useApp.getState().abandonGate()

    await useApp.getState().startGate('saturday-cardio-abs')

    expect(useApp.getState().activeSubstitutions).toEqual({})
  })

  it('clearSubstitution removes just that one planned exercise\'s choice', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')
    useApp.getState().substituteExercise('cable-crunch', 'situps', 'occupied')

    useApp.getState().clearSubstitution('hanging-leg-raises')

    expect(useApp.getState().activeSubstitutions['hanging-leg-raises']).toBeUndefined()
    expect(useApp.getState().activeSubstitutions['cable-crunch']).toEqual({
      substituteId: 'situps',
      reason: 'occupied',
    })
  })
})

describe('finishGate summarizes substitutions (commit 4d6f484)', () => {
  it('names the swap and its reason in the gate-cleared message', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    useApp.getState().substituteExercise('hanging-leg-raises', 'leg-raises', 'occupied')
    await useApp.getState().logSet({
      exerciseId: 'leg-raises',
      weight: 0,
      reps: 15,
      substitutedFor: 'hanging-leg-raises',
      substitutionReason: 'occupied',
    })

    await useApp.getState().finishGate()

    // .at(-1) rather than .find: messages persist across tests in this file,
    // so an earlier test's own "Gate cleared" message would otherwise win.
    const summary = useApp.getState().messages.filter((m) => m.title.includes('Gate cleared')).at(-1)
    expect(summary).toBeDefined()
    // saturday-cardio-abs has 4 blocks; one was substituted.
    expect(summary!.body).toContain('3 of 4 blocks as prescribed')
    expect(summary!.body).toContain('Hanging Leg Raises → Leg Raises, station occupied.')
  })

  it('says nothing extra when nothing was substituted, so an ordinary gate reads exactly as before', async () => {
    await useApp.getState().startGate('saturday-cardio-abs')
    await useApp.getState().logSet({ exerciseId: 'leg-raises', weight: 0, reps: 15 })

    await useApp.getState().finishGate()

    const summary = useApp.getState().messages.filter((m) => m.title.includes('Gate cleared')).at(-1)
    expect(summary).toBeDefined()
    expect(summary!.body).not.toContain('blocks as prescribed')
  })
})

describe('substitutesByExerciseId (commit 7)', () => {
  async function awaken(): Promise<void> {
    await useApp.getState().completeAwakening({
      profile: {
        sex: 'male',
        birthYear: 1998,
        heightCm: 178,
        unitPref: 'metric',
        trainingYears: 2,
        equipmentAccess: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'pullup_bar', 'bench'],
      },
      bodyweightKg: 72,
    })
  }

  it('ranks candidates for every prescribed exercise in today\'s routine, using its own equipment as the default block', async () => {
    await awaken()
    await useApp.getState().startGate('saturday-cardio-abs')

    const candidates = useApp.getState().substitutesByExerciseId['cable-crunch'] ?? []
    const ids = candidates.map((c) => c.exercise.id)
    expect(ids).toContain('machine-abs-crunch')
    expect(ids).toContain('situps')
    expect(ids).toContain('leg-raises')
    expect(ids).not.toContain('cable-fly')
    expect(ids).not.toContain('cable-crunch')
  })

  it('demotes Leg Raises for Hanging Leg Raises, since both are already in today\'s routine', async () => {
    await awaken()
    await useApp.getState().startGate('saturday-cardio-abs')

    const candidates = useApp.getState().substitutesByExerciseId['hanging-leg-raises'] ?? []
    const legRaises = candidates.find((c) => c.exercise.id === 'leg-raises')
    expect(legRaises?.demoted).toBe(true)
  })
})

describe('Daily Quest per-item progress (F2)', () => {
  // Seeded directly rather than through ensureQuestsForToday, which skips a
  // rest day — `today` is real wall-clock (recompute() derives it from
  // Date.now() on every refresh, so overriding it does not stick), and
  // whether today happens to be a rest day is not what these tests are
  // about.
  async function seedTodaysQuest(): Promise<void> {
    const today = useApp.getState().today
    const quest = generateDailyQuest({ dayKey: today, level: 1, allocated: useApp.getState().allocated })
    await putQuest({
      id: `daily-${today}`,
      dayKey: today,
      type: 'daily',
      status: 'issued',
      issuedAt: Date.now(),
      expiresAt: null,
      payload: { ...quest, progress: {} },
    })
    await useApp.getState().refresh()
  }

  it('records partial progress without completing, and it survives a refresh from Dexie', async () => {
    await seedTodaysQuest()
    const quest = useApp.getState().todaysDailyQuest()!
    const partial = Math.floor(quest.items.find((i) => i.kind === 'pushups')!.target * 0.4)

    await useApp.getState().completeDailyQuest({ pushups: partial })
    await useApp.getState().refresh()

    const after = useApp.getState().todaysDailyQuest()!
    expect(after.progress.pushups).toBe(partial)
    const row = useApp.getState().quests.find((q) => q.type === 'daily')!
    expect(row.status).toBe('issued')
  })

  it('completes once every item meets its target, and pays out exactly once', async () => {
    await seedTodaysQuest()
    const quest = useApp.getState().todaysDailyQuest()!
    const full: Partial<Record<string, number>> = {}
    for (const item of quest.items) full[item.kind] = item.target

    const goldBefore = useApp.getState().progress.gold
    await useApp.getState().completeDailyQuest(full)

    const row = useApp.getState().quests.find((q) => q.type === 'daily')!
    expect(row.status).toBe('complete')
    expect(useApp.getState().progress.gold).toBe(goldBefore + 25)

    // A second call must not pay out again — the row is already complete.
    await useApp.getState().completeDailyQuest(full)
    expect(useApp.getState().progress.gold).toBe(goldBefore + 25)
  })

  it('completes across two partial entries that together reach every target', async () => {
    await seedTodaysQuest()
    const quest = useApp.getState().todaysDailyQuest()!
    const firstHalf: Partial<Record<string, number>> = {}
    const secondHalf: Partial<Record<string, number>> = {}
    for (const item of quest.items) {
      const done = Math.floor(item.target * 0.4)
      firstHalf[item.kind] = done
      secondHalf[item.kind] = item.target - done
    }

    await useApp.getState().completeDailyQuest(firstHalf)
    expect(useApp.getState().quests.find((q) => q.type === 'daily')!.status).toBe('issued')

    await useApp.getState().completeDailyQuest(secondHalf)
    expect(useApp.getState().quests.find((q) => q.type === 'daily')!.status).toBe('complete')
  })

  it('logging a set inside a gate never advances Daily Quest progress on its own', async () => {
    await seedTodaysQuest()
    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 5, isWarmup: false })

    const quest = useApp.getState().todaysDailyQuest()!
    expect(Object.keys(quest.progress)).toHaveLength(0)
  })

  describe('rerollDailyQuest supersedes rather than replaces (m7b-plan commit 4, F3)', () => {
    it('leaves the old row in place, pointed to by the new one', async () => {
      await seedTodaysQuest()
      const original = useApp.getState().quests.find((q) => q.type === 'daily')!

      await useApp.getState().rerollDailyQuest()

      const rows = useApp.getState().quests.filter((q) => q.type === 'daily')
      expect(rows).toHaveLength(2)
      const reroll = rows.find((q) => q.id !== original.id)!
      expect(reroll.supersedes).toBe(original.id)
      expect(useApp.getState().quests.find((q) => q.id === original.id)).toBeDefined()
    })

    it('makes the reroll the active quest for progress and completion', async () => {
      await seedTodaysQuest()
      await useApp.getState().rerollDailyQuest()

      const active = useApp.getState().todaysDailyQuest()!
      const reroll = useApp.getState().quests.find((q) => q.type === 'daily' && q.supersedes)!
      expect(active).toEqual(reroll.payload)
    })

    it('completing the reroll counts, even though the superseded original sits forever unfinished', async () => {
      const today = useApp.getState().today
      await seedTodaysQuest()
      await useApp.getState().rerollDailyQuest()

      const reroll = useApp.getState().quests.find((q) => q.type === 'daily' && q.supersedes)!
      const payload = reroll.payload as DailyQuestPayload
      const full: Partial<Record<string, number>> = {}
      for (const item of payload.items) full[item.kind] = item.target
      await useApp.getState().completeDailyQuest(full)
      expect(useApp.getState().quests.find((q) => q.id === reroll.id)!.status).toBe('complete')

      // The superseded original never left 'issued' — a naive dayKey+type
      // lookup would find *it* instead of the completed reroll and wrongly
      // generate a penalty for work that was, in fact, done (F3).
      const tomorrow = addDaysToKey(today, 1)
      useApp.setState({ today: tomorrow })
      await useApp.getState().ensureQuestsForToday()

      expect(useApp.getState().quests.some((q) => q.type === 'penalty')).toBe(false)
    })

    it('is a no-op once the quest is already complete', async () => {
      await seedTodaysQuest()
      const quest = useApp.getState().todaysDailyQuest()!
      const full: Partial<Record<string, number>> = {}
      for (const item of quest.items) full[item.kind] = item.target
      await useApp.getState().completeDailyQuest(full)

      await useApp.getState().rerollDailyQuest()
      expect(useApp.getState().quests.filter((q) => q.type === 'daily')).toHaveLength(1)
    })
  })
})

describe('purchaseShopItem (m7b-plan commit 6)', () => {
  it('buys a Rest Token: deducts gold, grants the token', async () => {
    await updateProgress({ gold: REST_TOKEN_PRICE_GOLD, restTokens: 2 })
    await useApp.getState().refresh()

    await useApp.getState().purchaseShopItem('rest_token')

    expect(useApp.getState().progress.gold).toBe(0)
    expect(useApp.getState().progress.restTokens).toBe(3)
    expect(useApp.getState().messages.at(-1)?.title).toContain('purchased')
  })

  it('refuses short of the price, and changes nothing', async () => {
    await updateProgress({ gold: REST_TOKEN_PRICE_GOLD - 1 })
    await useApp.getState().refresh()

    await useApp.getState().purchaseShopItem('rest_token')

    expect(useApp.getState().progress.gold).toBe(REST_TOKEN_PRICE_GOLD - 1)
    expect(useApp.getState().messages.at(-1)?.title).toContain('Not enough gold')
  })

  it('buys a Quest Reroll: deducts gold and supersedes the open Daily Quest', async () => {
    const today = useApp.getState().today
    const quest = generateDailyQuest({ dayKey: today, level: 1, allocated: useApp.getState().allocated })
    await putQuest({
      id: `daily-${today}`,
      dayKey: today,
      type: 'daily',
      status: 'issued',
      issuedAt: Date.now(),
      expiresAt: null,
      payload: { ...quest, progress: {} },
    })
    await updateProgress({ gold: QUEST_REROLL_PRICE_GOLD })
    await useApp.getState().refresh()

    await useApp.getState().purchaseShopItem('quest_reroll')

    expect(useApp.getState().progress.gold).toBe(0)
    expect(useApp.getState().quests.filter((q) => q.type === 'daily')).toHaveLength(2)
  })

  it('refuses a Quest Reroll with nothing open, and never charges for it', async () => {
    await updateProgress({ gold: QUEST_REROLL_PRICE_GOLD })
    await useApp.getState().refresh()

    await useApp.getState().purchaseShopItem('quest_reroll')

    expect(useApp.getState().progress.gold).toBe(QUEST_REROLL_PRICE_GOLD)
    expect(useApp.getState().messages.at(-1)?.title).toContain('Nothing to reroll')
  })
})

describe('completeReawakeningTest (m7b-plan commit 7)', () => {
  it('records the new metric and announces the change since the last one', async () => {
    await useApp.getState().addBodyMetric({ weightKg: 80, waistCm: 85 })
    const before = useApp.getState().messages.length

    await useApp.getState().completeReawakeningTest({ weightKg: 82, waistCm: 83 })

    expect(useApp.getState().projection!.latestBodyMetric!.weightKg).toBe(82)
    const message = useApp.getState().messages.at(-1)!
    expect(message.title).toBe('[Reawakening Test complete.]')
    expect(message.body).toContain('+2.0 kg')
    expect(message.body).toContain('-2.0 cm')
    expect(useApp.getState().messages.length).toBe(before + 1)
  })

  it('has nothing to compare against on the very first measurement', async () => {
    await useApp.getState().completeReawakeningTest({ weightKg: 80 })

    const message = useApp.getState().messages.at(-1)!
    expect(message.body).toContain('Nothing to compare')
  })
})

describe('a level change announces itself as a window notification', () => {
  // `messages` is ephemeral UI state, not persisted to Dexie, so nothing
  // clears it between tests in this file, and other, unrelated tests
  // legitimately cross a level and leave their own "[Level up." message
  // sitting in the shared store. Every test here resets it locally first,
  // so an assertion never depends on what ran before it.

  it('does not mistake the store having no projection yet for "leveled up from zero"', async () => {
    // Get a hunter to a real level above 1 first.
    const today = useApp.getState().today
    const quest = generateDailyQuest({ dayKey: today, level: 1, allocated: useApp.getState().allocated })
    await putQuest({
      id: `daily-${today}`,
      dayKey: today,
      type: 'daily',
      status: 'issued',
      issuedAt: Date.now(),
      expiresAt: null,
      payload: { ...quest, progress: {} },
    })
    await useApp.getState().refresh()
    const full: Partial<Record<string, number>> = {}
    for (const item of quest.items) full[item.kind] = item.target
    await useApp.getState().completeDailyQuest(full)
    const level = useApp.getState().projection!.player.level
    expect(level).toBeGreaterThan(1)

    // Simulate the store's actual boot condition — `projection: null`, the
    // module's initial value before the very first `recompute()` ever runs —
    // even though the underlying data already reflects a real level. If the
    // guard read "no projection yet" as "was level 0", this would announce
    // a level-up on every cold start for any hunter above level 1.
    useApp.setState({ projection: null, messages: [] })
    useApp.getState().recompute()

    expect(useApp.getState().projection!.player.level).toBe(level)
    const levelUp = useApp.getState().messages.find((m) => m.title.startsWith('[Level up.'))
    expect(levelUp).toBeUndefined()
  })

  it('does not announce anything when an action leaves the level unchanged', async () => {
    useApp.setState({ messages: [] })
    await useApp.getState().dismissAdvisory('does-not-exist')
    const levelUp = useApp.getState().messages.find((m) => m.title.startsWith('[Level up.'))
    expect(levelUp).toBeUndefined()
  })

  it('fires once total XP crosses a level threshold, via any XP-granting action', async () => {
    // xpToNext(1) is 100 (LEVEL_CURVE_BASE * 1^1.5); the Daily Quest alone
    // pays 150, so a fresh level-1 hunter completing it crosses straight
    // past the threshold with no gate involved at all.
    const today = useApp.getState().today
    const quest = generateDailyQuest({ dayKey: today, level: 1, allocated: useApp.getState().allocated })
    await putQuest({
      id: `daily-${today}`,
      dayKey: today,
      type: 'daily',
      status: 'issued',
      issuedAt: Date.now(),
      expiresAt: null,
      payload: { ...quest, progress: {} },
    })
    await useApp.getState().refresh()
    expect(useApp.getState().projection?.player.level).toBe(1)

    const full: Partial<Record<string, number>> = {}
    for (const item of quest.items) full[item.kind] = item.target
    await useApp.getState().completeDailyQuest(full)

    expect(useApp.getState().projection!.player.level).toBeGreaterThan(1)
    const levelUp = useApp.getState().messages.find((m) => m.title.startsWith('[Level up.'))
    expect(levelUp).toBeDefined()
    expect(levelUp!.kind).toBe('window')
    expect(levelUp!.tone).toBe('good')
  })
})

describe('announceSystemIntroIfNeeded (m10-plan commit 3)', () => {
  it('pushes the one-time window notification and marks it seen', async () => {
    useApp.setState((s) => ({ messages: [], settings: { ...s.settings, systemIntroSeen: false } }))

    await useApp.getState().announceSystemIntroIfNeeded()

    expect(useApp.getState().settings.systemIntroSeen).toBe(true)
    const intro = useApp.getState().messages.find((m) => m.title.startsWith('[The System is designed'))
    expect(intro).toBeDefined()
    expect(intro!.kind).toBe('window')
  })

  it('never fires twice, even called back to back before the first call settles', async () => {
    useApp.setState((s) => ({ messages: [], settings: { ...s.settings, systemIntroSeen: false } }))

    await Promise.all([useApp.getState().announceSystemIntroIfNeeded(), useApp.getState().announceSystemIntroIfNeeded()])

    const intros = useApp.getState().messages.filter((m) => m.title.startsWith('[The System is designed'))
    expect(intros).toHaveLength(1)
  })

  it('does nothing on a later visit, once already seen', async () => {
    useApp.setState((s) => ({ messages: [], settings: { ...s.settings, systemIntroSeen: true } }))

    await useApp.getState().announceSystemIntroIfNeeded()

    expect(useApp.getState().messages).toHaveLength(0)
  })
})

describe('syncNow — coalescing and backoff (M6 commit 1, F3)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('logSet performs no network request, on the set-entry path or anywhere near it (F3)', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('coalesces two triggers fired together into one request rather than two', async () => {
    await useApp.getState().updateSettings({ syncEnabled: true })
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ seq: 1, received: 0, hasMore: false, rows: { sessions: [], sets: [], bodyMetrics: [] } }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    useApp.getState().syncNow()
    useApp.getState().syncNow()

    await vi.waitFor(() => expect(useApp.getState().syncStatus).toBe('ok'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('finishGate triggers a sync attempt once sync is enabled (m6-plan commit 2)', async () => {
    await useApp.getState().updateSettings({ syncEnabled: true })
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ seq: 1, received: 0, hasMore: false, rows: { sessions: [], sets: [], bodyMetrics: [] } }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })
    await useApp.getState().finishGate()

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('finishGate contacts nothing while sync is disabled, which is the default', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })
    await useApp.getState().finishGate()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('backs off exponentially on repeated failures and gives up rather than retrying forever', async () => {
    await useApp.getState().updateSettings({ syncEnabled: true })
    vi.stubGlobal('navigator', { onLine: true })
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    // Fake-indexeddb resolves its own requests through chained zero-delay
    // timers, so the first attempt needs more than one 0ms tick to reach the
    // network call — a generous flush here, well short of the first 2s
    // backoff delay, is what lets that settle before the assertion.
    useApp.getState().syncNow()
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(useApp.getState().syncStatus).toBe('failed')

    // Delays double each time: 2s, 4s, 8s, 16s, 32s — five more attempts, six
    // failures total (2+4+8+16+32 = 62s), then the controller stops
    // scheduling its own retry. Advanced in one generous step rather than
    // per-delay, so Dexie's own tick overhead can't push a firing across a
    // step boundary and be missed.
    await vi.advanceTimersByTimeAsync(100_000)
    expect(fetchMock).toHaveBeenCalledTimes(6)

    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('a manual trigger after the controller gave up gets a fresh run, not an inherited streak', async () => {
    await useApp.getState().updateSettings({ syncEnabled: true })
    vi.stubGlobal('navigator', { onLine: true })
    let shouldFail = true
    const fetchMock = vi.fn(async () => {
      if (shouldFail) throw new Error('network down')
      return new Response(
        JSON.stringify({ seq: 1, received: 0, hasMore: false, rows: { sessions: [], sets: [], bodyMetrics: [] } }),
        { headers: { 'content-type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    useApp.getState().syncNow()
    await vi.advanceTimersByTimeAsync(100_000)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(useApp.getState().syncStatus).toBe('failed')

    shouldFail = false
    useApp.getState().syncNow()
    await vi.advanceTimersByTimeAsync(500)

    expect(useApp.getState().syncStatus).toBe('ok')
  })
})

describe('forgetMirror (m6-plan commit 4, F4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resets sync status and lastSyncedAt once the server confirms', async () => {
    useApp.setState({ syncStatus: 'ok', lastSyncedAt: Date.now() })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))

    const ok = await useApp.getState().forgetMirror()

    expect(ok).toBe(true)
    expect(useApp.getState().syncStatus).toBe('idle')
    expect(useApp.getState().lastSyncedAt).toBeNull()
  })

  it('leaves sync state untouched when the server refuses', async () => {
    const syncedAt = Date.now()
    useApp.setState({ syncStatus: 'ok', lastSyncedAt: syncedAt })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))

    const ok = await useApp.getState().forgetMirror()

    expect(ok).toBe(false)
    expect(useApp.getState().syncStatus).toBe('ok')
    expect(useApp.getState().lastSyncedAt).toBe(syncedAt)
  })
})

describe('pairWithScannedKey (m6-plan commit 5)', () => {
  it('rejects a QR payload that is not a Hunter License Key at all', async () => {
    const before = useApp.getState().identity
    const result = await useApp.getState().pairWithScannedKey('https://example.com/not-a-key')

    expect(result.ok).toBe(false)
    expect(useApp.getState().identity).toBe(before)
  })

  it('rejects a well-formed payload whose key does not decode', async () => {
    const result = await useApp.getState().pairWithScannedKey('hunter-license:not-valid-base32-at-all')
    expect(result.ok).toBe(false)
  })

  it('adopts a validly scanned key, replacing identity and resetting the sync cursor', async () => {
    useApp.setState({ syncStatus: 'ok', lastSyncedAt: Date.now() })
    const scannedSecret = generateHunterSecret()
    const scannedKey = encodeLicenseKey(scannedSecret)

    const result = await useApp.getState().pairWithScannedKey(pairingPayload(scannedKey))

    expect(result.ok).toBe(true)
    expect(useApp.getState().identity?.licenseKey).toBe(scannedKey)
    expect(useApp.getState().syncStatus).toBe('idle')
    expect(useApp.getState().lastSyncedAt).toBeNull()

    const syncState = await (await import('../db/repo')).getSyncState()
    expect(syncState.lastServerSeq).toBe(0)
  })

  it('does not touch the training log already on this device', async () => {
    await useApp.getState().startGate('friday-legs')
    await useApp.getState().logSet({ exerciseId: 'barbell-squat', weight: 100, reps: 8 })
    const setsBefore = useApp.getState().sets.length

    const scannedKey = encodeLicenseKey(generateHunterSecret())
    await useApp.getState().pairWithScannedKey(pairingPayload(scannedKey))

    expect(useApp.getState().sets.length).toBe(setsBefore)
  })
})
