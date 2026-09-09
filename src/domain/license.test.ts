import { describe, expect, it } from 'vitest'
import { licenseAriaLabel, licenseFields, type LicenseInput } from './license'
import { TITLES, titleById } from './titles'

/** Every one of these has a name of 14 characters or fewer, so a test built
 * from them exercises the overflow/padding logic without truncation (tested
 * separately below) muddying the assertion. */
const SHORT_TITLE_IDS = [
  'risen',
  'kaisel',
  'unbroken',
  'awakened',
  'architect',
  'iron-lung',
  'tower-tenth',
  'first-flight',
  'wolf-assassin',
  'first-of-many',
  'igris-equal',
  'deadlift-triple',
  'thousand-hands',
  'tower-fiftieth',
]

const BASE: LicenseInput = {
  hunterId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9',
  hunterName: 'Jinwoo',
  rank: 'S',
  hunterClass: 'fighter',
  earnedTitleIds: [],
  level: 42,
  total: { STR: 43, VIT: 5, AGI: 8, INT: 20, PER: 32 },
  gatesCleared: 3,
  awakenedAt: 1_700_000_000_000,
}

describe('licenseFields', () => {
  it('reads NO CLASS and eight empty slots on a fully blank profile — slot 0 states its answer, never a bare dash (§4)', () => {
    const fields = licenseFields({ ...BASE, hunterClass: 'none', earnedTitleIds: [] })
    expect(fields.categorySlots).toHaveLength(9)
    expect(fields.categorySlots[0]).toBe('NO CLASS')
    expect(fields.categorySlots.slice(1)).toEqual(Array(8).fill('-- --'))
  })

  it('states UNRANKED explicitly rather than falling through to a phantom rank (rule 13)', () => {
    expect(licenseFields({ ...BASE, rank: null }).rankLetter).toBe('UNRANKED')
    expect(licenseFields({ ...BASE, rank: 'E' }).rankLetter).toBe('E')
  })

  it('folds a fourteenth-and-beyond title into a single overflow slot', () => {
    const fields = licenseFields({ ...BASE, earnedTitleIds: SHORT_TITLE_IDS })
    const titleSlots = fields.categorySlots.slice(1)
    expect(titleSlots).toHaveLength(8)
    expect(titleSlots.slice(0, 7)).toEqual(SHORT_TITLE_IDS.slice(0, 7).map((id) => titleById(id)!.name))
    expect(titleSlots[7]).toBe('+6 MORE')
  })

  it('shows every title with room to spare, padding the rest with the empty slot', () => {
    const ids = SHORT_TITLE_IDS.slice(0, 3)
    const fields = licenseFields({ ...BASE, earnedTitleIds: ids })
    expect(fields.categorySlots.slice(1, 4)).toEqual(ids.map((id) => titleById(id)!.name))
    expect(fields.categorySlots.slice(4)).toEqual(Array(5).fill('-- --'))
  })

  it('drops an id with no matching title rather than rendering a hole or throwing', () => {
    const fields = licenseFields({ ...BASE, earnedTitleIds: ['not-a-real-title', TITLES[0]!.id] })
    expect(fields.categorySlots[1]).toBe(TITLES[0]!.name)
    expect(fields.categorySlots[2]).toBe('-- --')
  })

  it('truncates a title that overflows the slot, ellipsis and all', () => {
    const nationalLevel = TITLES.find((t) => t.id === 'national-level')!
    const fields = licenseFields({ ...BASE, earnedTitleIds: [nationalLevel.id] })
    expect(fields.categorySlots[1]).toBe('National Leve…')
    expect(fields.categorySlots[1]!.length).toBeLessThanOrEqual(14)
  })

  it('omits the certification date rather than formatting a null timestamp when never awakened', () => {
    expect(licenseFields({ ...BASE, awakenedAt: null }).issuedAt).toBeNull()
  })

  it('does not throw slicing a hunterId shorter than the document-number window', () => {
    expect(() => licenseFields({ ...BASE, hunterId: 'ab' })).not.toThrow()
    expect(licenseFields({ ...BASE, hunterId: 'ab' }).documentNumber).toBe('AB')
  })

  it('groups the document number into fours from the first twelve characters', () => {
    expect(licenseFields(BASE).documentNumber).toBe('A1B2 C3D4 E5F6')
  })

  it('falls back to the hunter-id-derived display name when hunterName is unset', () => {
    expect(licenseFields({ ...BASE, hunterName: undefined }).name).toBe('HUNTER A1B2')
  })

  it('builds a stat band with every stat and the gate count, in the app-wide stat order', () => {
    expect(licenseFields(BASE).statBand).toBe('LV 42 · STR 43 · VIT 5 · AGI 8 · INT 20 · PER 32 · 3 GATES')
  })
})

describe('licenseAriaLabel', () => {
  it('reads back the same figures the card draws, since it is built from licenseFields alone', () => {
    const fields = licenseFields(BASE)
    const label = licenseAriaLabel(fields)
    expect(label).toContain(fields.name)
    expect(label).toContain(fields.rankLetter)
    expect(label).toContain(fields.documentNumber)
    expect(label).toContain(fields.statBand)
  })

  it('says plainly that no titles are held yet, rather than a bare list of dashes', () => {
    const fields = licenseFields({ ...BASE, hunterClass: 'none', earnedTitleIds: [] })
    expect(licenseAriaLabel(fields)).toContain('No titles held yet.')
  })
})
