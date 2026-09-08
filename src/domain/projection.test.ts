import { describe, expect, it } from 'vitest'
import {
  dropSuperseded,
  emptyProjectionInput,
  historyForExercise,
  lastSetsForExercise,
  projectPlayer,
  type ProjectionInput,
} from './projection'
import { SEED_EXERCISES, SEED_ROUTINES } from '../db/seed'
import { XP_DAILY_QUEST } from './xp'
import type { Profile, QuestLog, SessionLog, SetLog } from './types'

const profile: Profile = {
  id: 'profile',
  sex: 'male',
  birthYear: 1996,
  heightCm: 178,
  unitPref: 'metric',
  trainingYears: 3,
  equipmentAccess: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'pullup_bar', 'bench'],
  createdAt: 0,
  awakenedAt: 0,
}

const TODAY = '2026-03-06'

function baseInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    ...emptyProjectionInput(TODAY, new Date(2026, 2, 6, 12).getTime()),
    profile,
    exercises: SEED_EXERCISES,
    routines: SEED_ROUTINES,
    ...overrides,
  }
}

function session(id: string, dayKey: string, startedAt: number, routineId: string | null = 'friday-legs'): SessionLog {
  return { id, routineId, startedAt, endedAt: startedAt + 3_600_000, dayKey, bodyweightKg: 80 }
}

function set(
  sessionId: string,
  exerciseId: string,
  weight: number,
  reps: number,
  order: number,
  completedAt: number,
  extra: Partial<SetLog> = {},
): SetLog {
  return {
    id: `${sessionId}-${exerciseId}-${order}`,
    sessionId,
    exerciseId,
    order,
    weight,
    reps,
    isWarmup: false,
    completedAt,
    ...extra,
  }
}

describe('a hunter who has logged nothing', () => {
  const projection = projectPlayer(baseInput())

  it('is level one with no XP', () => {
    expect(projection.player.level).toBe(1)
    expect(projection.player.xp).toBe(0)
  })

  it('has no derived stats rather than a divide-by-zero', () => {
    expect(projection.player.derived).toEqual({ STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 })
  })

  it('gets a rank floor from stated training history, flagged as provisional', () => {
    expect(projection.rank.rank).toBe('D')
    expect(projection.rank.unavailableReason).toContain('floor')
  })

  it('reports fatigue as unreadable rather than guessing', () => {
    expect(projection.fatigue.acwr).toBeNull()
    expect(projection.player.fatigueMultiplier).toBe(1)
  })

  it('has one active shadow slot even at zero INT', () => {
    expect(projection.shadowCap).toBe(1)
  })

  it('offers no runes to misuse', () => {
    expect(projection.unlockedRunes).toEqual([])
  })

  it('points at the first tower floor', () => {
    expect(projection.nextTowerFloor?.floor).toBe(1)
  })
})

describe('a single logged session', () => {
  const sessions = [session('s1', '2026-03-06', 1000)]
  const sets = [
    set('s1', 'barbell-squat', 100, 5, 0, 1000, { rpe: 8 }),
    set('s1', 'barbell-squat', 100, 5, 1, 1100, { rpe: 8.5 }),
    set('s1', 'leg-press', 150, 12, 2, 1200, { rpe: 7 }),
  ]
  const projection = projectPlayer(baseInput({ sessions, sets }))

  it('counts the tonnage', () => {
    // 100*5 + 100*5 + 150*12 = 2800
    expect(projection.totalTonnageKg).toBe(2800)
  })

  it('earns XP and may level up', () => {
    expect(projection.player.xp).toBeGreaterThan(0)
    expect(projection.player.level).toBeGreaterThanOrEqual(1)
  })

  it('records the best estimated max per exercise', () => {
    expect(projection.bestE1rmByExercise.get('barbell-squat')).toBeCloseTo(100 * (1 + 5 / 30), 6)
  })

  it('treats the first performance of a lift as a record', () => {
    expect(projection.sessionSummaries[0]!.prExerciseIds).toContain('barbell-squat')
  })

  it('ranks the squat from the published table', () => {
    const squat = projection.rank.perLift.find((l) => l.lift === 'squat')
    expect(squat).toBeDefined()
    expect(squat!.rank).toBeTruthy()
  })

  it('assigns a gate rank from what was actually performed', () => {
    expect(projection.sessionSummaries[0]!.gateRank).toBeTruthy()
  })

  it('counts hard sets, treating a missing RPE as hard', () => {
    expect(projection.sessionSummaries[0]!.hardSets).toBe(3)
  })
})

describe('gateDifficulty reads the bodyweight-adjusted weight, not the raw set weight', () => {
  it('scores a bodyweight-only session above E, since it is not free work', () => {
    // situps: bodyweightFactor 0.45. Six sets of 20 at a 80 kg session
    // bodyweight score 36 kg per set once adjusted — enough volume to clear
    // the D threshold. Reading s.weight raw (always 0 for an unloaded
    // bodyweight set) would score 0 tonnage and never leave 'E' regardless
    // of how much work was actually done.
    const sessions = [session('s1', TODAY, 1000)]
    const sets = Array.from({ length: 6 }, (_, i) => set('s1', 'situps', 0, 20, i, 1000 + i, { rpe: 8 }))
    const projection = projectPlayer(baseInput({ sessions, sets }))
    expect(projection.sessionSummaries[0]!.gateRank).toBe('D')
  })
})

describe('a routineless session still earns a real gate rank (M7 finding, commit 2)', () => {
  it('scores identically to the same work logged against a routine', () => {
    // An Instant Dungeon Key or a Red Gate carries routineId: null — real
    // work with no matching Routine used to read as gateRank: null, which
    // silently withheld the GATE_CLEAR_BONUS XP term for a session that did
    // exactly the same work as a scheduled one.
    const sets = Array.from({ length: 6 }, (_, i) => set('s1', 'situps', 0, 20, i, 1000 + i, { rpe: 8 }))
    const withRoutine = projectPlayer(baseInput({ sessions: [session('s1', TODAY, 1000)], sets }))
    const withoutRoutine = projectPlayer(baseInput({ sessions: [session('s1', TODAY, 1000, null)], sets }))

    expect(withoutRoutine.sessionSummaries[0]!.gateRank).toBe('D')
    expect(withoutRoutine.sessionSummaries[0]!.gateRank).toBe(withRoutine.sessionSummaries[0]!.gateRank)
    expect(withoutRoutine.sessionSummaries[0]!.xp).toBeCloseTo(withRoutine.sessionSummaries[0]!.xp, 6)
  })

  it('still reads null with no real work logged, same as a routine-based session', () => {
    const projection = projectPlayer(baseInput({ sessions: [session('s1', TODAY, 1000, null)], sets: [] }))
    expect(projection.sessionSummaries[0]!.gateRank).toBeNull()
  })
})

describe('time-based work pays XP through the per-minute term', () => {
  // Before commit 27c12f0, `isHardSet` rejected `reps <= 0` outright, so a
  // treadmill interval earned zero XP and zero gate credit. `routineId: null`
  // here used to also mean "no gate-clear bonus, regardless of the work
  // actually done" — a side effect of the old routine-gated rank computation,
  // fixed by M7 commit 2 for Instant Dungeon Key and Red Gate, both of which
  // are real routineless sessions. 20 minutes at this pace scores a D-rank
  // gate (bonus 300), on top of the 20 min * 20 XP/min per-minute term.
  it('a treadmill interval with no reps earns XP, not the historical zero', () => {
    const sessions = [session('s1', TODAY, 1000, null)]
    const sets = [set('s1', 'treadmill-intervals', 0, 0, 0, 1000, { seconds: 1200, rpe: 8 })]
    const projection = projectPlayer(baseInput({ sessions, sets }))
    expect(projection.sessionSummaries[0]!.xp).toBeCloseTo(20 * 20 + 300, 6)
  })

  it('counts the interval as a hard set for display, without also charging it the flat hard-set rate', () => {
    const sessions = [session('s1', TODAY, 1000, null)]
    const sets = [set('s1', 'treadmill-intervals', 0, 0, 0, 1000, { seconds: 1200, rpe: 8 })]
    const projection = projectPlayer(baseInput({ sessions, sets }))
    expect(projection.sessionSummaries[0]!.hardSets).toBe(1)
    expect(projection.sessionSummaries[0]!.xp).toBeCloseTo(700, 6)
  })
})

describe('an open session pays nothing until it is finished', () => {
  // Regression for the bug where opening a gate paid a full E-rank
  // gate-clear bonus (200 XP) before a single set was logged: an empty plan
  // gave gateDifficulty a phantom 'E' rank, and the projection walk counted
  // the session at all despite endedAt being null. Fixed at both spots —
  // fixing only one still lets the other pay the bonus early.
  const openEmpty: SessionLog = { ...session('s1', TODAY, 1000), endedAt: null }

  it('an open session with no sets logged yet earns no XP, tonnage, or gate rank', () => {
    const projection = projectPlayer(baseInput({ sessions: [openEmpty], sets: [] }))
    expect(projection.player.xp).toBe(0)
    expect(projection.totalTonnageKg).toBe(0)
    expect(projection.sessionSummaries).toHaveLength(0)
  })

  it('an open session with real sets already logged still pays nothing until Finish Gate', () => {
    const sets = [set('s1', 'barbell-squat', 100, 5, 0, 1000, { rpe: 8 })]
    const projection = projectPlayer(baseInput({ sessions: [openEmpty], sets }))
    expect(projection.player.xp).toBe(0)
    expect(projection.totalTonnageKg).toBe(0)
    expect(projection.sessionSummaries).toHaveLength(0)
    // The set is real work, but crediting it as a record or a best e1RM
    // before the session ends would let a still-open session's progress
    // leak into rank and shadow-extraction eligibility early.
    expect(projection.bestE1rmByExercise.has('barbell-squat')).toBe(false)
  })

  it('the same session pays out normally once ended', () => {
    const sets = [set('s1', 'barbell-squat', 100, 5, 0, 1000, { rpe: 8 })]
    const ended: SessionLog = { ...openEmpty, endedAt: 2000 }
    const projection = projectPlayer(baseInput({ sessions: [ended], sets }))
    expect(projection.player.xp).toBeGreaterThan(0)
    expect(projection.totalTonnageKg).toBe(500)
    expect(projection.sessionSummaries).toHaveLength(1)
  })

  it('does not inflate the 28-day adherence window that feeds derived stats', () => {
    // sessionsLogged28 / completedPlannedSessions28 (stats.ts) must not count
    // a session that only exists because Start Gate was clicked.
    const withOpen = projectPlayer(baseInput({ sessions: [openEmpty], sets: [] }))
    const withNone = projectPlayer(baseInput({ sessions: [], sets: [] }))
    expect(withOpen.player.derived).toEqual(withNone.player.derived)
  })
})

describe('records are credited on the day they were set', () => {
  const sessions = [
    session('s1', '2026-03-01', 1000),
    session('s2', '2026-03-04', 2000),
    session('s3', '2026-03-06', 3000),
  ]
  const sets = [
    set('s1', 'barbell-squat', 100, 5, 0, 1000),
    // Heavier: a record.
    set('s2', 'barbell-squat', 110, 5, 0, 2000),
    // Lighter than the previous best: not a record.
    set('s3', 'barbell-squat', 105, 5, 0, 3000),
  ]
  const projection = projectPlayer(baseInput({ sessions, sets }))

  it('credits the record to the middle session, not the last', () => {
    const byId = new Map(projection.sessionSummaries.map((s) => [s.session.id, s]))
    expect(byId.get('s1')!.prExerciseIds).toContain('barbell-squat')
    expect(byId.get('s2')!.prExerciseIds).toContain('barbell-squat')
    expect(byId.get('s3')!.prExerciseIds).not.toContain('barbell-squat')
  })

  it('keeps the all-time best, not the most recent', () => {
    expect(projection.bestE1rmByExercise.get('barbell-squat')).toBeCloseTo(110 * (1 + 5 / 30), 6)
  })
})

describe('a bodyweight rep record pays a PR bonus too (F4)', () => {
  // Diamond Pushups: usesBodyweight, weight always 0. resolveBosses alone can
  // never credit this — epley(0, reps) is always 0 — so before the fix, a
  // programme of pushups, pull-ups and abs work set no records ever.
  const sessions = [session('s1', '2026-03-01', 1000), session('s2', '2026-03-04', 2000)]
  const sets = [
    set('s1', 'diamond-pushups', 0, 10, 0, 1000),
    // More reps, same zero weight: a record.
    set('s2', 'diamond-pushups', 0, 15, 0, 2000),
  ]
  const projection = projectPlayer(baseInput({ sessions, sets }))

  it('credits both the first performance and the later rep record', () => {
    const byId = new Map(projection.sessionSummaries.map((s) => [s.session.id, s]))
    expect(byId.get('s1')!.prExerciseIds).toContain('diamond-pushups')
    expect(byId.get('s2')!.prExerciseIds).toContain('diamond-pushups')
  })

  it('pays XP for the session carrying the rep record, same as any other', () => {
    // computeSessionXp's own PR-bonus arithmetic (XP_PER_PR * exercisePRs) is
    // covered in xp.test.ts; what matters here is that a bodyweight rep
    // record reaches `prExerciseIds` at all, which is the F4 bug itself.
    const byId = new Map(projection.sessionSummaries.map((s) => [s.session.id, s]))
    expect(byId.get('s2')!.xp).toBeGreaterThan(0)
  })

  it('keeps the all-time best rep count, not the most recent', () => {
    expect(projection.bestRepsByExercise.get('diamond-pushups')).toBe(15)
  })
})

describe('superseded sets are excluded', () => {
  const sessions = [session('s1', '2026-03-06', 1000)]
  const original = set('s1', 'barbell-squat', 200, 5, 0, 1000)
  const correction: SetLog = {
    ...set('s1', 'barbell-squat', 100, 5, 1, 1100),
    id: 'correction',
    supersedes: original.id,
  }

  it('uses the correction and ignores what it replaced', () => {
    const projection = projectPlayer(baseInput({ sessions, sets: [original, correction] }))
    expect(projection.totalTonnageKg).toBe(500)
    expect(projection.bestE1rmByExercise.get('barbell-squat')).toBeCloseTo(100 * (1 + 5 / 30), 6)
  })

  it('drops the same row whichever order the two arrive in (M6 commit 6)', () => {
    // A synced pull can hand back a superseding row before the row it
    // supersedes — nothing about the wire protocol or `applyRemoteRows`'s
    // bulkPut guarantees insertion order survives a round trip through a
    // second device. dropSuperseded must not depend on it: it first
    // collects every `supersedes` reference from the whole array, then
    // filters, so which element it meets first never matters.
    const inOriginalOrder = dropSuperseded([original, correction])
    const inReverseOrder = dropSuperseded([correction, original])

    expect(inOriginalOrder.map((s) => s.id)).toEqual(['correction'])
    expect(inReverseOrder.map((s) => s.id)).toEqual(['correction'])
  })
})

describe('completed daily quests pay XP', () => {
  it('adds the daily quest reward to the total', () => {
    const withQuests = projectPlayer(
      baseInput({
        quests: [
          { id: 'q1', dayKey: '2026-03-05', type: 'daily', status: 'complete', issuedAt: 0, expiresAt: null, payload: null },
          { id: 'q2', dayKey: '2026-03-06', type: 'daily', status: 'complete', issuedAt: 0, expiresAt: null, payload: null },
          { id: 'q3', dayKey: '2026-03-04', type: 'daily', status: 'failed', issuedAt: 0, expiresAt: null, payload: null },
        ],
      }),
    )
    expect(withQuests.player.xp).toBe(2 * XP_DAILY_QUEST)
  })
})

describe('hunterClass is derived from the completed Job Change Quest (m7b-plan commit 2)', () => {
  it('stays none with no completed Job Change Quest', () => {
    expect(projectPlayer(baseInput()).player.hunterClass).toBe('none')
  })

  it('takes the class from the completed quest\'s payload', () => {
    const result = projectPlayer(
      baseInput({
        quests: [
          {
            id: 'jc1',
            dayKey: '2026-03-01',
            type: 'job_change',
            status: 'complete',
            issuedAt: 0,
            expiresAt: null,
            payload: { statsRead: { STR: 0, VIT: 0, AGI: 20, INT: 0, PER: 0 }, class: 'assassin' },
          },
        ],
      }),
    )
    expect(result.player.hunterClass).toBe('assassin')
  })

  it('ignores an issued-but-not-completed Job Change Quest', () => {
    const result = projectPlayer(
      baseInput({
        quests: [
          {
            id: 'jc1',
            dayKey: '2026-03-01',
            type: 'job_change',
            status: 'issued',
            issuedAt: 0,
            expiresAt: null,
            payload: { statsRead: { STR: 0, VIT: 0, AGI: 20, INT: 0, PER: 0 }, class: 'assassin' },
          },
        ],
      }),
    )
    expect(result.player.hunterClass).toBe('none')
  })
})

describe('jobChangeDue (m7b-plan commit 1/2)', () => {
  // 700 completed daily quests is comfortably more XP than level 20 needs
  // under the real curve (LEVEL_CURVE_BASE/EXPONENT) — the point is being
  // well past the threshold, not landing on it exactly.
  const dailies: QuestLog[] = Array.from({ length: 700 }, (_, i) => ({
    id: `d${i}`,
    dayKey: '2026-02-01',
    type: 'daily',
    status: 'complete',
    issuedAt: 0,
    expiresAt: null,
    payload: null,
  }))

  it('is not due before level 20', () => {
    expect(projectPlayer(baseInput()).jobChangeDue).toBe(false)
  })

  it('is due at level 20 or above with no completed quest yet', () => {
    const result = projectPlayer(baseInput({ quests: dailies }))
    expect(result.player.level).toBeGreaterThanOrEqual(20)
    expect(result.jobChangeDue).toBe(true)
  })

  it('is not due again once already completed, even at a high level', () => {
    const result = projectPlayer(
      baseInput({
        quests: dailies.concat([
          {
            id: 'jc1',
            dayKey: '2026-03-01',
            type: 'job_change',
            status: 'complete',
            issuedAt: 0,
            expiresAt: null,
            payload: { statsRead: { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 }, class: 'fighter' },
          },
        ]),
      }),
    )
    expect(result.jobChangeDue).toBe(false)
    expect(result.player.hunterClass).toBe('fighter')
  })
})

describe('the projection is a pure function of the log', () => {
  const sessions = [session('s1', '2026-03-06', 1000)]
  const sets = [set('s1', 'barbell-squat', 100, 5, 0, 1000)]

  it('produces the same result twice', () => {
    const a = projectPlayer(baseInput({ sessions, sets }))
    const b = projectPlayer(baseInput({ sessions, sets }))
    expect(a.player).toEqual(b.player)
    expect(a.totalTonnageKg).toBe(b.totalTonnageKg)
  })

  it('does not depend on the order the rows arrive in', () => {
    const forwards = projectPlayer(baseInput({ sessions, sets }))
    const backwards = projectPlayer(baseInput({ sessions: [...sessions].reverse(), sets: [...sets].reverse() }))
    expect(forwards.player).toEqual(backwards.player)
  })
})

describe('lastSetsForExercise', () => {
  const sessions = [session('s1', '2026-03-01', 1000), session('s2', '2026-03-04', 2000)]
  const sets = [
    set('s1', 'barbell-squat', 100, 5, 0, 1000),
    set('s2', 'barbell-squat', 110, 6, 0, 2000),
    set('s2', 'barbell-squat', 110, 5, 1, 2100),
  ]

  it('returns the sets from the most recent session containing the exercise', () => {
    const last = lastSetsForExercise('barbell-squat', sessions, sets)
    expect(last).toHaveLength(2)
    expect(last.every((s) => s.sessionId === 's2')).toBe(true)
  })

  it('returns nothing for an exercise never performed', () => {
    expect(lastSetsForExercise('pull-ups', sessions, sets)).toEqual([])
  })

  it('excludes warmups, so a warmup does not become the progression basis', () => {
    const withWarmup = [...sets, set('s2', 'pull-ups', 0, 3, 2, 2200, { isWarmup: true })]
    expect(lastSetsForExercise('pull-ups', sessions, withWarmup)).toEqual([])
  })
})

describe('historyForExercise', () => {
  it('returns the estimated max for each hard set, oldest first', () => {
    const sets = [
      set('s2', 'barbell-squat', 110, 5, 0, 2000),
      set('s1', 'barbell-squat', 100, 5, 0, 1000),
    ]
    const history = historyForExercise('barbell-squat', sets)
    expect(history).toHaveLength(2)
    expect(history[0]!.set.completedAt).toBe(1000)
    expect(history[1]!.e1rmKg).toBeGreaterThan(history[0]!.e1rmKg)
  })
})
