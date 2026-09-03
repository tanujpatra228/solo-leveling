import { describe, expect, it } from 'vitest'
import { DELOAD_WEEK_INTERVAL, checkDeload, hasE1rmRegression } from './deload'

const base = {
  today: '2026-03-28',
  lastDeloadDayKey: '2026-03-21',
  trainingStartDayKey: '2026-01-01',
  acwr: 1,
  recentE1rmBySession: [100, 101, 102],
}

describe('the three triggers from the brief', () => {
  it('fires on the fifth week', () => {
    expect(DELOAD_WEEK_INTERVAL).toBe(5)
    const verdict = checkDeload({ ...base, lastDeloadDayKey: '2026-02-21' })
    expect(verdict.due).toBe(true)
    expect(verdict.triggers).toContain('scheduled')
  })

  it('does not fire in the fourth week', () => {
    // 28 days is exactly four weeks.
    const verdict = checkDeload({ ...base, lastDeloadDayKey: '2026-02-28' })
    expect(verdict.triggers).not.toContain('scheduled')
  })

  it('fires when the workload ratio passes 1.5', () => {
    const verdict = checkDeload({ ...base, acwr: 1.6 })
    expect(verdict.due).toBe(true)
    expect(verdict.triggers).toContain('workload_spike')
  })

  it('does not fire at exactly 1.5', () => {
    expect(checkDeload({ ...base, acwr: 1.5 }).triggers).not.toContain('workload_spike')
  })

  it('fires after two sessions of estimated-max regression', () => {
    const verdict = checkDeload({ ...base, recentE1rmBySession: [110, 105, 100] })
    expect(verdict.due).toBe(true)
    expect(verdict.triggers).toContain('e1rm_regression')
  })

  it('can fire on more than one trigger at once', () => {
    const verdict = checkDeload({
      ...base,
      lastDeloadDayKey: '2026-02-01',
      acwr: 2,
      recentE1rmBySession: [110, 105, 100],
    })
    expect(verdict.triggers).toHaveLength(3)
  })

  it('says nothing is needed when all three are fine', () => {
    const verdict = checkDeload(base)
    expect(verdict.due).toBe(false)
    expect(verdict.triggers).toEqual([])
    expect(verdict.headline).toBe('No deload needed')
  })

  it('keeps every exercise in the prescription, cutting only the load', () => {
    expect(checkDeload({ ...base, acwr: 2 }).prescription).toContain('60%')
  })
})

describe('hasE1rmRegression', () => {
  it('needs two consecutive steps down, so one bad day is not enough', () => {
    expect(hasE1rmRegression([100, 95])).toBe(false)
    expect(hasE1rmRegression([100, 98, 95])).toBe(true)
  })

  it('is not a regression if the middle session went up', () => {
    expect(hasE1rmRegression([100, 105, 95])).toBe(false)
  })

  it('is not a regression when a session merely matched the previous one', () => {
    expect(hasE1rmRegression([100, 100, 100])).toBe(false)
  })

  it('needs enough history to judge', () => {
    expect(hasE1rmRegression([])).toBe(false)
    expect(hasE1rmRegression([100])).toBe(false)
  })

  it('looks only at the most recent sessions', () => {
    expect(hasE1rmRegression([50, 200, 120, 110, 100])).toBe(true)
  })
})

describe('the anchor when there has never been a deload', () => {
  it('measures from when training started', () => {
    const verdict = checkDeload({
      ...base,
      lastDeloadDayKey: null,
      trainingStartDayKey: '2026-01-01',
      today: '2026-03-01',
    })
    expect(verdict.triggers).toContain('scheduled')
  })

  it('does not schedule a deload for someone with no history at all', () => {
    const verdict = checkDeload({
      ...base,
      lastDeloadDayKey: null,
      trainingStartDayKey: null,
      recentE1rmBySession: [],
    })
    expect(verdict.due).toBe(false)
  })
})
