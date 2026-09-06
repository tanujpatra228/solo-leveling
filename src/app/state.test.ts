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
import { beforeEach, describe, expect, it } from 'vitest'
import { lastSetsForExercise } from '../domain/projection'
import { dayOfWeekForKey } from '../domain/time'
import { updateProgress, wipeEverything } from '../db/repo'
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
