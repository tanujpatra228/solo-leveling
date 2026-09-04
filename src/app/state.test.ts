/**
 * Store-level tests for the M3 corrections (G1, G3, G4, G5). Each one is a
 * defect that was silent in production — a fallback default, a dropped patch
 * field, a slightly-off count — so the assertions are written against the
 * wrong-vs-right numbers themselves, not just "it doesn't throw".
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { lastSetsForExercise } from '../domain/projection'
import { wipeEverything } from '../db/repo'
import { useApp } from './state'

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
})

describe('targetFor resolves the routine from the active session (G1)', () => {
  it('uses the started routine, not the day-of-week lookup for "today"', () => {
    // Monday's routine has no squat in it at all, so if targetFor fell back to
    // day-of-week it could not find `barbell-squat` in any block and would
    // default to 3 planned sets. The session was started against Friday Legs,
    // where squat is a 4-set block — that is the number that must win.
    useApp.setState({
      today: '2026-09-07', // a Monday
      activeSessionId: 's1',
      sessions: [
        {
          id: 's1',
          routineId: 'friday-legs',
          questId: undefined,
          startedAt: Date.now(),
          endedAt: null,
          dayKey: '2026-09-07',
          bodyweightKg: undefined,
        },
      ],
    })

    const target = useApp.getState().targetFor('barbell-squat')
    expect(target).not.toBeNull()
    expect(target!.repTargets).toHaveLength(4)
  })

  it('falls back to the day-of-week routine when the session has no routineId (Instant Dungeon Key)', () => {
    useApp.setState({
      today: '2026-09-04', // a Friday
      activeSessionId: 's1',
      sessions: [
        {
          id: 's1',
          routineId: null,
          questId: undefined,
          startedAt: Date.now(),
          endedAt: null,
          dayKey: '2026-09-04',
          bodyweightKg: undefined,
        },
      ],
    })

    const target = useApp.getState().targetFor('barbell-squat')
    expect(target!.repTargets).toHaveLength(4)
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
