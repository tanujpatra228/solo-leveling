import { describe, expect, it } from 'vitest'
import { LANDMARKS, SECONDARY_SET_CREDIT, classifyVolume, hardSetsPerMuscle, weeklyVolumeReport } from './volume'
import type { Exercise, Muscle, SetLog } from './types'

const bench: Exercise = {
  id: 'bench',
  name: 'Bench Press',
  aliases: [],
  pattern: 'horizontal_push',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps', 'front_delts'],
  equipment: ['barbell'],
  unit: 'kg',
  increment: 2.5,
  repRange: [5, 8],
  usesBodyweight: false,
  bodyweightFactor: 1,
  role: 'prescribed',
}

const curl: Exercise = {
  ...bench,
  id: 'curl',
  name: 'Curl',
  pattern: 'isolation',
  primaryMuscles: ['biceps'],
  secondaryMuscles: [],
}

const library: Record<string, Exercise> = { bench, curl }
const resolve = (id: string) => library[id]

function sets(spec: { exerciseId: string; rpe?: number; isWarmup?: boolean }[]): SetLog[] {
  return spec.map((s, i) => ({
    id: `s${i}`,
    sessionId: 'session',
    exerciseId: s.exerciseId,
    order: i,
    weight: 60,
    reps: 8,
    rpe: s.rpe,
    isWarmup: s.isWarmup ?? false,
    completedAt: 0,
  }))
}

describe('the landmarks sit in the ranges the brief describes', () => {
  it('puts most MEV values around 8 to 10 and most MRV values around 20 to 25', () => {
    const muscles = (Object.keys(LANDMARKS) as Muscle[]).filter((m) => m !== 'cardio')
    for (const muscle of muscles) {
      const l = LANDMARKS[muscle]
      expect(l.mv).toBeLessThanOrEqual(l.mev)
      expect(l.mev).toBeLessThanOrEqual(l.mav[0])
      expect(l.mav[0]).toBeLessThanOrEqual(l.mav[1])
      expect(l.mav[1]).toBeLessThanOrEqual(l.mrv)
    }
  })

  it('gives the front delts a low direct-work ceiling, since pressing already loads them', () => {
    expect(LANDMARKS.front_delts.mrv).toBeLessThan(LANDMARKS.side_delts.mrv)
  })
})

describe('hardSetsPerMuscle', () => {
  it('gives a primary muscle a full set and a secondary a half', () => {
    const totals = hardSetsPerMuscle(sets([{ exerciseId: 'bench' }]), resolve)
    expect(totals.get('chest')).toBe(1)
    expect(totals.get('triceps')).toBe(SECONDARY_SET_CREDIT)
    expect(totals.get('front_delts')).toBe(0.5)
  })

  it('ignores warmups', () => {
    const totals = hardSetsPerMuscle(sets([{ exerciseId: 'bench', isWarmup: true }]), resolve)
    expect(totals.get('chest')).toBeUndefined()
  })

  it('ignores sets logged as easy', () => {
    const totals = hardSetsPerMuscle(sets([{ exerciseId: 'bench', rpe: 5 }]), resolve)
    expect(totals.get('chest')).toBeUndefined()
  })

  it('accumulates across sets', () => {
    const totals = hardSetsPerMuscle(
      sets([{ exerciseId: 'bench' }, { exerciseId: 'bench' }, { exerciseId: 'curl' }]),
      resolve,
    )
    expect(totals.get('chest')).toBe(2)
    expect(totals.get('biceps')).toBe(1)
  })

  it('skips an exercise that is not in the library rather than throwing', () => {
    const totals = hardSetsPerMuscle(sets([{ exerciseId: 'unknown' }]), resolve)
    expect(totals.size).toBe(0)
  })
})

describe('classifyVolume', () => {
  const chest = LANDMARKS.chest // mv 4, mev 10, mav [12, 20], mrv 22

  it('calls no work none', () => {
    expect(classifyVolume(0, chest)).toBe('none')
  })

  it('calls work below maintenance starving', () => {
    expect(classifyVolume(2, chest)).toBe('below_mv')
  })

  it('calls maintenance-level work maintaining', () => {
    expect(classifyVolume(5, chest)).toBe('maintaining')
  })

  it('calls work over the growth floor but under the productive range below_mev', () => {
    expect(classifyVolume(11, chest)).toBe('below_mev')
  })

  it('calls the productive range optimal', () => {
    expect(classifyVolume(12, chest)).toBe('optimal')
    expect(classifyVolume(20, chest)).toBe('optimal')
  })

  it('calls work past the productive range above_mav', () => {
    expect(classifyVolume(21, chest)).toBe('above_mav')
  })

  it('calls work past what can be recovered from over_mrv', () => {
    expect(classifyVolume(23, chest)).toBe('over_mrv')
  })
})

describe('weeklyVolumeReport', () => {
  it('covers every muscle except cardio', () => {
    const report = weeklyVolumeReport([], resolve)
    const muscles = report.map((r) => r.muscle)
    expect(muscles).not.toContain('cardio')
    expect(muscles).toHaveLength(Object.keys(LANDMARKS).length - 1)
  })

  it('sorts the worst problems first, with over-MRV ahead of untrained', () => {
    const many = Array.from({ length: 30 }, () => ({ exerciseId: 'curl' }))
    const report = weeklyVolumeReport(sets(many), resolve)
    expect(report[0]!.muscle).toBe('biceps')
    expect(report[0]!.verdict).toBe('over_mrv')
  })

  it('puts optimal muscles last', () => {
    const report = weeklyVolumeReport(sets(Array.from({ length: 14 }, () => ({ exerciseId: 'curl' }))), resolve)
    expect(report[report.length - 1]!.verdict).toBe('optimal')
  })

  it('describes a starving muscle group in words', () => {
    const report = weeklyVolumeReport([], resolve)
    const hamstrings = report.find((r) => r.muscle === 'hamstrings')!
    expect(hamstrings.message).toContain('No work logged')
  })

  it('keeps the mana bar fill between 0 and 1', () => {
    const report = weeklyVolumeReport(sets(Array.from({ length: 60 }, () => ({ exerciseId: 'curl' }))), resolve)
    for (const row of report) {
      expect(row.fill).toBeGreaterThanOrEqual(0)
      expect(row.fill).toBeLessThanOrEqual(1)
    }
  })
})
