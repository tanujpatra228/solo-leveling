import { describe, expect, it } from 'vitest'
import {
  BACKLOG_SURCHARGE,
  PR_MARGIN_KG,
  RED_GATE_MIN_RANK,
  buildInstantDungeon,
  buildRedGate,
  canEnterRedGate,
  daysUntilBreak,
  gateDifficulty,
  gateStateFor,
  resolveBosses,
  resolveDungeonBreaks,
} from './gates'
import type { Exercise, SetLog } from './types'

describe('gate difficulty', () => {
  it('ranks a tiny session at E', () => {
    const result = gateDifficulty([
      { exerciseId: 'curl', sets: 2, reps: 10, weightKg: 10, e1rmKg: 30 },
    ])
    expect(result.rank).toBe('E')
  })

  it('ranks a heavy full session higher than a light one of the same tonnage', () => {
    const heavy = gateDifficulty([
      { exerciseId: 'squat', sets: 5, reps: 3, weightKg: 160, e1rmKg: 180 },
    ])
    const light = gateDifficulty([
      { exerciseId: 'squat', sets: 5, reps: 24, weightKg: 20, e1rmKg: 180 },
    ])
    expect(heavy.plannedTonnageKg).toBe(light.plannedTonnageKg)
    expect(heavy.score).toBeGreaterThan(light.score)
  })

  it('climbs through the ranks as the work climbs', () => {
    const ranks = [1, 3, 6, 10, 16].map(
      (multiplier) =>
        gateDifficulty([
          { exerciseId: 'squat', sets: 4 * multiplier, reps: 6, weightKg: 100, e1rmKg: 120 },
        ]).rank,
    )
    // Monotonic non-decreasing.
    const order = ['E', 'D', 'C', 'B', 'A', 'S']
    for (let i = 1; i < ranks.length; i += 1) {
      expect(order.indexOf(ranks[i]!)).toBeGreaterThanOrEqual(order.indexOf(ranks[i - 1]!))
    }
  })

  it('treats an unknown lift as moderate rather than dropping it', () => {
    const result = gateDifficulty([
      { exerciseId: 'new', sets: 3, reps: 10, weightKg: 50, e1rmKg: 0 },
    ])
    expect(result.meanIntensity).toBeGreaterThan(0)
  })

  it('scores a cardio block by its minutes, since reps and weight are both zero for time-based work', () => {
    // Before commit 2, a treadmill block with reps: 0, weightKg: 0 scored zero
    // tonnage and read as a free session — see substitution-plan.md §0.
    const zeroMinutes = gateDifficulty([
      { exerciseId: 'treadmill-intervals', sets: 1, reps: 0, weightKg: 0, e1rmKg: 0, workMinutes: 0 },
    ])
    const twentyMinutes = gateDifficulty([
      { exerciseId: 'treadmill-intervals', sets: 1, reps: 0, weightKg: 0, e1rmKg: 0, workMinutes: 20 },
    ])
    expect(zeroMinutes.score).toBe(0)
    expect(twentyMinutes.score).toBeGreaterThan(0)
  })

  it('treats an omitted workMinutes as zero, so every pre-existing plan item is unaffected', () => {
    const result = gateDifficulty([{ exerciseId: 'curl', sets: 2, reps: 10, weightKg: 10, e1rmKg: 30 }])
    expect(Number.isNaN(result.score)).toBe(false)
  })

  it('reports zero for an empty plan without dividing by zero, and gives it no rank', () => {
    // No planned work is not an E-rank session — it is no session at all.
    // computeSessionXp only pays a gate-clear bonus when a rank comes back,
    // so a null rank here is what stops an open-but-empty session from
    // banking XP before a single set is logged.
    const result = gateDifficulty([])
    expect(result.rank).toBeNull()
    expect(result.meanIntensity).toBe(0)
    expect(Number.isNaN(result.score)).toBe(false)
  })
})

describe('boss kills', () => {
  function set(exerciseId: string, weight: number, reps: number, isWarmup = false): SetLog {
    return {
      id: `${exerciseId}-${weight}-${reps}`,
      sessionId: 's',
      exerciseId,
      order: 0,
      weight,
      reps,
      isWarmup,
      completedAt: 0,
    }
  }

  it('registers a kill when the top set beats the old record', () => {
    const results = resolveBosses([set('squat', 120, 3)], () => 100)
    expect(results[0]!.killed).toBe(true)
  })

  it('does not register a kill for matching the old record', () => {
    const results = resolveBosses([set('squat', 100, 1)], () => 100)
    expect(results[0]!.killed).toBe(false)
  })

  it('requires a real margin, so rounding noise is not a record', () => {
    expect(PR_MARGIN_KG).toBe(0.5)
    const results = resolveBosses([set('squat', 100.2, 1)], () => 100)
    expect(results[0]!.killed).toBe(false)
  })

  it('ignores warmups', () => {
    const results = resolveBosses([set('squat', 200, 1, true), set('squat', 90, 1)], () => 100)
    expect(results[0]!.weightKg).toBe(90)
    expect(results[0]!.killed).toBe(false)
  })

  it('ignores a long light set, so conditioning cannot register as a strength record', () => {
    const results = resolveBosses([set('pushup', 0, 40)], () => 0)
    expect(results).toHaveLength(0)
  })

  it('reports one result per exercise touched', () => {
    const results = resolveBosses([set('squat', 100, 5), set('bench', 80, 5)], () => 0)
    expect(results).toHaveLength(2)
  })
})

describe('Dungeon Break', () => {
  const gate = { routineId: 'friday-legs', openedDayKey: '2026-03-01', rank: 'B' as const }

  it('stays open for six days', () => {
    expect(gateStateFor(gate, '2026-03-07', false)).toBe('open')
    expect(daysUntilBreak(gate, '2026-03-07')).toBe(1)
  })

  it('breaks on the seventh day, using the canon number', () => {
    expect(gateStateFor(gate, '2026-03-08', false)).toBe('broken')
  })

  it('never breaks once cleared', () => {
    expect(gateStateFor(gate, '2026-04-01', true)).toBe('cleared')
  })

  it('adds work rather than removing progress', () => {
    const breaks = resolveDungeonBreaks([gate], '2026-03-10')
    expect(breaks).toHaveLength(1)
    expect(breaks[0]!.backlogSurcharge).toBe(BACKLOG_SURCHARGE)
    expect(breaks[0]!.detail).toContain('Nothing has been taken away')
  })

  it('reports the day the gate actually broke, not today', () => {
    const breaks = resolveDungeonBreaks([gate], '2026-03-20')
    expect(breaks[0]!.brokeOnDayKey).toBe('2026-03-08')
  })

  it('leaves gates still inside the window alone', () => {
    expect(resolveDungeonBreaks([gate], '2026-03-05')).toEqual([])
  })
})

describe('Red Gate', () => {
  it('requires at least B rank, as in canon', () => {
    expect(RED_GATE_MIN_RANK).toBe('B')
    expect(canEnterRedGate('C')).toBe(false)
    expect(canEnterRedGate('B')).toBe(true)
    expect(canEnterRedGate('S')).toBe(true)
  })

  it('is closed to an unranked hunter', () => {
    expect(canEnterRedGate(null)).toBe(false)
  })

  it('warns that there is no partial credit', () => {
    const gate = buildRedGate({
      kind: 'pr_attempt',
      exerciseName: 'Barbell Squat',
      targetWeightKg: 150,
      rank: 'B',
      routineId: null,
    })
    expect(gate.warning).toContain('no partial credit')
    expect(gate.description).toContain('150 kg')
  })
})

describe('Instant Dungeon Key', () => {
  const library: Exercise[] = [
    {
      id: 'pushup',
      name: 'Pushup',
      aliases: [],
      pattern: 'horizontal_push',
      primaryMuscles: ['chest'],
      secondaryMuscles: [],
      equipment: ['bodyweight'],
      unit: 'reps',
      increment: 0,
      repRange: [10, 20],
      usesBodyweight: true,
      bodyweightFactor: 1,
      role: 'prescribed',
    },
    {
      id: 'squat-bw',
      name: 'Bodyweight Squat',
      aliases: [],
      pattern: 'squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      equipment: ['bodyweight'],
      unit: 'reps',
      increment: 0,
      repRange: [15, 30],
      usesBodyweight: true,
      bodyweightFactor: 1,
      role: 'prescribed',
    },
    {
      id: 'barbell-squat',
      name: 'Barbell Squat',
      aliases: [],
      pattern: 'squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      equipment: ['barbell'],
      unit: 'kg',
      increment: 5,
      repRange: [5, 8],
      usesBodyweight: false,
      bodyweightFactor: 1,
      role: 'prescribed',
    },
  ]

  it('uses only what the hunter actually has', () => {
    const dungeon = buildInstantDungeon({ available: ['bodyweight'], library })
    const ids = dungeon.blocks.map((b) => b.exerciseId)
    expect(ids).not.toContain('barbell-squat')
    expect(ids).toContain('pushup')
  })

  it('spreads across movement patterns rather than picking five chest exercises', () => {
    const dungeon = buildInstantDungeon({ available: ['bodyweight'], library, size: 2 })
    expect(new Set(dungeon.blocks.map((b) => b.exerciseId)).size).toBe(2)
  })

  it('says so plainly when nothing matches', () => {
    const dungeon = buildInstantDungeon({ available: ['treadmill'], library })
    expect(dungeon.blocks).toHaveLength(0)
    expect(dungeon.detail).toContain('Nothing in the library')
  })

  it('defaults to bodyweight when no equipment was stated', () => {
    const dungeon = buildInstantDungeon({ available: [], library })
    expect(dungeon.blocks.length).toBeGreaterThan(0)
  })
})
