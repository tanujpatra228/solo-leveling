import { describe, expect, it } from 'vitest'
import {
  MARSHAL_NAMES,
  extractShadow,
  extractionAnnouncement,
  resolveRoster,
  selectMarshals,
  shadowXpBonus,
  shouldExtract,
  streakShieldDays,
} from './shadows'
import type { Shadow } from './types'

function shadow(partial: Partial<Shadow> & { id: string }): Shadow {
  return {
    id: partial.id,
    exerciseId: partial.exerciseId ?? 'barbell-squat',
    name: partial.name ?? 'Kaisel',
    rank: partial.rank ?? 'C',
    extractedAt: partial.extractedAt ?? 0,
    buff: partial.buff ?? 'buff',
    buffKind: partial.buffKind ?? 'xp_bonus',
    buffMagnitude: partial.buffMagnitude ?? 0.02,
    isMarshal: partial.isMarshal ?? false,
    active: partial.active ?? true,
  }
}

describe('shouldExtract', () => {
  it('extracts on crossing into a new tier', () => {
    expect(shouldExtract(2.1, 1.9)).toBe(true)
  })

  it('does not extract for drifting up inside the same tier', () => {
    expect(shouldExtract(2.9, 2.1)).toBe(false)
  })

  it('does not extract for going backwards', () => {
    expect(shouldExtract(1.5, 3.2)).toBe(false)
  })

  it('extracts on the very first tier crossed', () => {
    expect(shouldExtract(1.0, 0)).toBe(true)
  })
})

describe('extractShadow', () => {
  const trigger = {
    exerciseId: 'barbell-squat',
    exerciseName: 'Barbell Squat',
    score: 3.2,
    rank: 'B' as const,
  }

  it('names the shadow deterministically, so it does not rename itself on reload', () => {
    const a = extractShadow({ trigger, extractedAt: 1000, isMarshal: false })
    const b = extractShadow({ trigger, extractedAt: 2000, isMarshal: false })
    expect(a.name).toBe(b.name)
  })

  it('gives marshals the canon names', () => {
    const marshal = extractShadow({ trigger, extractedAt: 0, isMarshal: true, marshalIndex: 0 })
    expect(MARSHAL_NAMES).toContain(marshal.name)
    expect(marshal.isMarshal).toBe(true)
  })

  it('carries the rank the lift earned', () => {
    expect(extractShadow({ trigger, extractedAt: 0, isMarshal: false }).rank).toBe('B')
  })

  it('describes its buff in words', () => {
    const s = extractShadow({ trigger, extractedAt: 0, isMarshal: false })
    expect(s.buff.length).toBeGreaterThan(0)
    expect(s.buffMagnitude).toBeGreaterThan(0)
  })

  it('keeps buffs small, so the honest half of the stats stays honest', () => {
    for (const rank of ['E', 'D', 'C', 'B', 'A', 'S'] as const) {
      const s = extractShadow({ trigger: { ...trigger, rank }, extractedAt: 0, isMarshal: false })
      if (s.buffKind === 'xp_bonus') expect(s.buffMagnitude).toBeLessThanOrEqual(0.05)
    }
  })

  it('announces the extraction in System voice', () => {
    const s = extractShadow({ trigger, extractedAt: 0, isMarshal: false })
    const line = extractionAnnouncement(s, 'Barbell Squat')
    expect(line).toContain('new shadow')
    expect(line).toContain('Barbell Squat')
  })
})

describe('the roster is capped by INT', () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    shadow({ id: `s${i}`, extractedAt: i, exerciseId: `ex${i}` }),
  )

  it('benches the excess rather than dropping it', () => {
    const roster = resolveRoster(many, 0) // cap 1
    expect(roster.cap).toBe(1)
    expect(roster.active).toHaveLength(1)
    expect(roster.benched).toHaveLength(7)
    expect(roster.overCap).toBe(true)
  })

  it('raises the cap as INT rises', () => {
    expect(resolveRoster(many, 100).cap).toBe(6)
  })

  it('prefers marshals, then higher ranks, then longer service', () => {
    const roster = resolveRoster(
      [
        shadow({ id: 'plain', rank: 'S', extractedAt: 5 }),
        shadow({ id: 'marshal', rank: 'E', isMarshal: true, extractedAt: 9 }),
      ],
      0,
    )
    expect(roster.active[0]!.id).toBe('marshal')
  })

  it('is stable, so which buffs apply does not change on reload', () => {
    const a = resolveRoster(many, 40)
    const b = resolveRoster([...many].reverse(), 40)
    expect(a.active.map((s) => s.id)).toEqual(b.active.map((s) => s.id))
  })

  it('treats a deactivated shadow as benched without counting it', () => {
    const roster = resolveRoster([shadow({ id: 'off', active: false })], 100)
    expect(roster.active).toHaveLength(0)
    expect(roster.benched).toHaveLength(1)
  })

  it('explains the cap in words', () => {
    expect(resolveRoster(many, 0).message).toContain('dormant')
  })
})

describe('buffs from the active roster', () => {
  it('applies an XP bonus only to the lift the shadow came from', () => {
    const active = [shadow({ id: 's', exerciseId: 'barbell-squat', buffMagnitude: 0.05 })]
    expect(shadowXpBonus(active, 'barbell-squat')).toBe(0.05)
    expect(shadowXpBonus(active, 'bench-press')).toBe(0)
  })

  it('sums streak shields', () => {
    const active = [
      shadow({ id: 'a', buffKind: 'streak_shield', buffMagnitude: 1 }),
      shadow({ id: 'b', buffKind: 'streak_shield', buffMagnitude: 1 }),
    ]
    expect(streakShieldDays(active)).toBe(2)
  })

  it('is zero with no shadows', () => {
    expect(shadowXpBonus([], 'squat')).toBe(0)
    expect(streakShieldDays([])).toBe(0)
  })
})

describe('selectMarshals', () => {
  it('picks the strongest lifts, capped at the canon marshal count', () => {
    const scores = new Map([
      ['a', 1],
      ['b', 4.5],
      ['c', 3],
      ['d', 2],
      ['e', 5],
    ])
    const marshals = selectMarshals(scores)
    expect(marshals).toHaveLength(MARSHAL_NAMES.length)
    expect(marshals[0]!.exerciseId).toBe('e')
    expect(marshals.map((m) => m.exerciseId)).not.toContain('a')
  })

  it('handles fewer lifts than marshal slots', () => {
    expect(selectMarshals(new Map([['a', 1]]))).toHaveLength(1)
  })
})
