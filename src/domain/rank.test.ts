import { describe, expect, it } from 'vitest'
import {
  computeOverallRank,
  interpolateThresholds,
  rankBarbellLift,
  rankFloorFromTrainingYears,
  rankFromScore,
  rankPullupByLoad,
  rankPullupByReps,
  standardsTableFor,
  tierScore,
} from './rank'
import { BARBELL_STANDARDS } from './standards.data'

describe('the shipped standards tables', () => {
  it('carry the published male squat row for 100 kg bodyweight', () => {
    const row = BARBELL_STANDARDS.squat.male.find((r) => r.bw === 100)
    expect(row?.thresholds).toEqual([98, 128, 163, 203, 244])
  })

  it('carry the published female bench row for 60 kg bodyweight', () => {
    const row = BARBELL_STANDARDS.bench.female.find((r) => r.bw === 60)
    expect(row).toBeDefined()
    expect(row!.thresholds).toHaveLength(5)
  })

  it('are ascending across tiers for every lift, sex, and bodyweight', () => {
    for (const [lift, bySex] of Object.entries(BARBELL_STANDARDS)) {
      for (const [sex, rows] of Object.entries(bySex)) {
        for (const row of rows) {
          for (let i = 1; i < row.thresholds.length; i += 1) {
            expect(
              row.thresholds[i]! > row.thresholds[i - 1]!,
              `${lift}/${sex}/${row.bw}kg tier ${i}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('are ascending across bodyweight, since a heavier lifter is held to more', () => {
    for (const bySex of Object.values(BARBELL_STANDARDS)) {
      for (const rows of Object.values(bySex)) {
        for (let i = 1; i < rows.length; i += 1) {
          expect(rows[i]!.bw).toBeGreaterThan(rows[i - 1]!.bw)
          expect(rows[i]!.thresholds[0]!).toBeGreaterThanOrEqual(rows[i - 1]!.thresholds[0]!)
        }
      }
    }
  })
})

describe('interpolateThresholds', () => {
  const rows = [
    { bw: 50, thresholds: [10, 20, 30, 40, 50] as const },
    { bw: 60, thresholds: [20, 30, 40, 50, 60] as const },
  ]

  it('returns a row exactly when the bodyweight lands on it', () => {
    expect(interpolateThresholds(rows, 50).thresholds).toEqual([10, 20, 30, 40, 50])
  })

  it('interpolates halfway between two rows', () => {
    expect(interpolateThresholds(rows, 55).thresholds).toEqual([15, 25, 35, 45, 55])
  })

  it('clamps below the lightest published row and says so', () => {
    const result = interpolateThresholds(rows, 40)
    expect(result.thresholds).toEqual([10, 20, 30, 40, 50])
    expect(result.clamped).toBe(true)
  })

  it('clamps above the heaviest published row and says so', () => {
    const result = interpolateThresholds(rows, 200)
    expect(result.thresholds).toEqual([20, 30, 40, 50, 60])
    expect(result.clamped).toBe(true)
  })

  it('does not report clamping when the bodyweight is exactly the boundary row', () => {
    expect(interpolateThresholds(rows, 60).clamped).toBe(false)
  })
})

describe('tierScore and rankFromScore', () => {
  const thresholds = [100, 200, 300, 400, 500]

  it('scores below the first threshold proportionally', () => {
    expect(tierScore(50, thresholds)).toBeCloseTo(0.5, 6)
    expect(rankFromScore(tierScore(50, thresholds))).toBe('E')
  })

  it('puts a lifter exactly on the first threshold at rank D', () => {
    expect(tierScore(100, thresholds)).toBe(1)
    expect(rankFromScore(tierScore(100, thresholds))).toBe('D')
  })

  it('puts a lifter exactly on the Intermediate threshold at rank B, as documented', () => {
    expect(tierScore(300, thresholds)).toBe(3)
    expect(rankFromScore(tierScore(300, thresholds))).toBe('B')
  })

  it('saturates at S above the Elite threshold', () => {
    expect(tierScore(9999, thresholds)).toBe(5)
    expect(rankFromScore(tierScore(9999, thresholds))).toBe('S')
    expect(rankFromScore(99)).toBe('S')
  })

  it('interpolates within a tier so the score is continuous', () => {
    expect(tierScore(250, thresholds)).toBeCloseTo(2.5, 6)
  })
})

describe('rankBarbellLift against the real tables', () => {
  it('ranks an 80 kg male squatting 132 kg at B, the published Intermediate', () => {
    // Published male squat row at 80 kg bodyweight: 75 / 101 / 132 / 168 / 206
    const result = rankBarbellLift('squat', 'male', 80, 132)
    expect(result.rank).toBe('B')
  })

  it('ranks the same lifter at S once past the Elite threshold', () => {
    expect(rankBarbellLift('squat', 'male', 80, 210).rank).toBe('S')
  })

  it('ranks a very light lift at E', () => {
    expect(rankBarbellLift('squat', 'male', 80, 40).rank).toBe('E')
  })

  it('reports when bodyweight fell outside the published rows', () => {
    expect(rankBarbellLift('squat', 'male', 200, 200).bodyweightClamped).toBe(true)
    expect(rankBarbellLift('squat', 'male', 80, 200).bodyweightClamped).toBe(false)
  })
})

describe('pull-ups, which are published in two different units', () => {
  it('handles the negative added-load thresholds without breaking the score', () => {
    // Male 70 kg added-load row: -2 / +13 / +31 / +50 / +71
    const assisted = rankPullupByLoad('male', 70, -10)
    expect(assisted.rank).toBe('E')
    expect(Number.isFinite(assisted.score)).toBe(true)

    const bodyweightOnly = rankPullupByLoad('male', 70, 0)
    expect(bodyweightOnly.rank).toBe('D')

    const strong = rankPullupByLoad('male', 70, 55)
    expect(strong.rank).toBe('A')
  })

  it('ranks by rep count on the separate reps table', () => {
    // Male 50 kg reps row: <1 / 6 / 14 / 24 / 34
    expect(rankPullupByReps('male', 50, 14).rank).toBe('B')
    expect(rankPullupByReps('male', 50, 40).rank).toBe('S')
  })
})

describe('standardsTableFor', () => {
  it('uses the stated sex when there is one', () => {
    expect(standardsTableFor({ sex: 'male' })).toBe('male')
    expect(standardsTableFor({ sex: 'female' })).toBe('female')
  })

  it('uses the borrowed table when sex is unspecified', () => {
    expect(standardsTableFor({ sex: 'unspecified', standardsTableOverride: 'female' })).toBe('female')
  })

  it('has no table when the hunter declined both', () => {
    expect(standardsTableFor({ sex: 'unspecified' })).toBeNull()
  })
})

describe('computeOverallRank', () => {
  it('averages across lifts rather than taking the best one', () => {
    const strong = rankBarbellLift('squat', 'male', 80, 210) // S
    const weak = rankBarbellLift('bench', 'male', 80, 30) // E
    const overall = computeOverallRank([strong, weak], { table: 'male' })
    expect(overall.rank).not.toBe('S')
    expect(overall.rank).not.toBe('A')
  })

  it('falls back to a training-history floor with no lifts logged', () => {
    const overall = computeOverallRank([], { table: 'male', trainingYears: 3 })
    expect(overall.rank).toBe('D')
    expect(overall.unavailableReason).toContain('floor')
  })

  it('gives an untrained hunter the entry rank', () => {
    expect(rankFloorFromTrainingYears(0)).toBe('E')
    expect(rankFloorFromTrainingYears(0.5)).toBe('E')
    expect(rankFloorFromTrainingYears(1)).toBe('D')
  })

  it('returns no rank at all, with an explanation, when there is no table to read', () => {
    const overall = computeOverallRank([], { table: null })
    expect(overall.rank).toBeNull()
    expect(overall.unavailableReason).toBeTruthy()
  })
})
