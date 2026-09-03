import { describe, expect, it } from 'vitest'
import { RUNES, newlyUnlockedAt, runeById, runesFor, unlockedRunes } from './runes'

describe('the three unlock levels the brief fixes', () => {
  it('unlocks drop sets at exactly level 10', () => {
    expect(runeById('drop-set')!.unlockLevel).toBe(10)
    expect(unlockedRunes(9).map((r) => r.id)).not.toContain('drop-set')
    expect(unlockedRunes(10).map((r) => r.id)).toContain('drop-set')
  })

  it('unlocks rest-pause at exactly level 15', () => {
    expect(runeById('rest-pause')!.unlockLevel).toBe(15)
    expect(unlockedRunes(14).map((r) => r.id)).not.toContain('rest-pause')
    expect(unlockedRunes(15).map((r) => r.id)).toContain('rest-pause')
  })

  it('unlocks clusters at exactly level 25', () => {
    expect(runeById('clusters')!.unlockLevel).toBe(25)
    expect(unlockedRunes(24).map((r) => r.id)).not.toContain('clusters')
    expect(unlockedRunes(25).map((r) => r.id)).toContain('clusters')
  })
})

describe('the catalogue', () => {
  it('has unique ids and both a real and a System name for each technique', () => {
    const ids = RUNES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const rune of RUNES) {
      expect(rune.name.length).toBeGreaterThan(0)
      expect(rune.runeName.length).toBeGreaterThan(0)
      expect(rune.howToPerform.length).toBeGreaterThan(10)
      expect(rune.suitableFor.length).toBeGreaterThan(0)
    }
  })

  it('gives a level-one hunter nothing to misuse', () => {
    expect(unlockedRunes(1)).toEqual([])
  })

  it('unlocks more as the level climbs', () => {
    expect(unlockedRunes(30).length).toBeGreaterThan(unlockedRunes(10).length)
  })

  it('unlocks everything eventually', () => {
    expect(unlockedRunes(99)).toHaveLength(RUNES.length)
  })
})

describe('newlyUnlockedAt', () => {
  it('reports only what unlocks on that exact level', () => {
    const at10 = newlyUnlockedAt(10)
    expect(at10.map((r) => r.id)).toEqual(['drop-set'])
  })

  it('reports nothing on a level with no unlock', () => {
    expect(newlyUnlockedAt(11)).toEqual([])
  })
})

describe('runesFor guards against unsafe pairings', () => {
  it('never offers drop sets on a heavy squat, where racking the bar near failure is the problem', () => {
    expect(runesFor(99, 'squat').map((r) => r.id)).not.toContain('drop-set')
  })

  it('does offer drop sets on isolation work', () => {
    expect(runesFor(99, 'isolation').map((r) => r.id)).toContain('drop-set')
  })

  it('offers cluster sets on heavy compounds, which is what they are for', () => {
    expect(runesFor(99, 'squat').map((r) => r.id)).toContain('clusters')
  })

  it('respects the level gate as well as the pattern', () => {
    expect(runesFor(9, 'isolation').map((r) => r.id)).not.toContain('drop-set')
  })
})
