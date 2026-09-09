/**
 * Everything the Hunter License card draws, decided before any canvas call
 * (m11-plan §9). `HunterLicenseCard.tsx` paints this and nothing else — no
 * field derivation lives in the component, so the drawn card and its
 * `aria-label` (`licenseAriaLabel` below) can never disagree.
 *
 * Pure: no locale, no clock, no React. `issuedAt` comes back as a timestamp
 * because locale date formatting belongs in the component, not here
 * (`CLAUDE.md`).
 */
import { hunterDisplayName } from './hunterName'
import { titleById } from './titles'
import type { HunterClass, Rank, StatBlock } from './types'

export interface LicenseInput {
  hunterId: string
  hunterName: string | undefined
  rank: Rank | null
  hunterClass: HunterClass
  /** Newest first — slot order on the card follows earn order, not id order. */
  earnedTitleIds: readonly string[]
  level: number
  total: StatBlock
  gatesCleared: number
  awakenedAt: number | null
}

export interface LicenseFields {
  /** "4010 5813 2519" — the first 12 characters of `hunterId`, grouped in fours. */
  documentNumber: string
  /** The rank letter, or the word "UNRANKED" — never falls through to a phantom "E" (rule 13). */
  rankLetter: string
  name: string
  /** Exactly 9: slot 0 is the class, slots 1-8 are titles, "-- --" for an empty one. */
  categorySlots: readonly string[]
  statBand: string
  issuedAt: number | null
}

const EMPTY_CATEGORY_SLOT = '-- --'
const TITLE_SLOT_COUNT = 8
const CATEGORY_SLOT_MAX_CHARS = 14
const NAME_MAX_CHARS = 22

const CLASS_LABEL: Record<HunterClass, string> = {
  none: 'NO CLASS',
  fighter: 'FIGHTER',
  tanker: 'TANKER',
  assassin: 'ASSASSIN',
  ranger: 'RANGER',
  shadow_monarch: 'SHADOW MONARCH',
}

const STAT_BAND_ORDER: readonly (keyof StatBlock)[] = ['STR', 'VIT', 'AGI', 'INT', 'PER']

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1)}…`
}

function documentNumber(hunterId: string): string {
  const chars = hunterId.slice(0, 12).toUpperCase()
  const groups: string[] = []
  for (let i = 0; i < chars.length; i += 4) groups.push(chars.slice(i, i + 4))
  return groups.join(' ')
}

/**
 * Slot 0 is the class, always present (`NO CLASS` rather than blank — §4:
 * "before level 20 it reads NO CLASS", not the empty-slot placeholder). Slots
 * 1-8 are titles, newest first. Past eight, slot 8 becomes an overflow count
 * rather than an eighth name — `TITLE_SLOT_COUNT - shown` titles get folded
 * into it, so the card never claims a precise remainder it isn't showing
 * (m11-plan §9's own worked example: fourteen titles reads "+6 MORE", seven
 * shown plus six folded away, not the fifteenth-title-exact seven).
 */
function categorySlots(hunterClass: HunterClass, earnedTitleIds: readonly string[]): string[] {
  const titleNames = earnedTitleIds.map((id) => titleById(id)?.name).filter((name): name is string => name !== undefined)

  const slots: string[] = [CLASS_LABEL[hunterClass]]
  if (titleNames.length <= TITLE_SLOT_COUNT) {
    for (let i = 0; i < TITLE_SLOT_COUNT; i += 1) {
      const name = titleNames[i]
      slots.push(name !== undefined ? truncate(name, CATEGORY_SLOT_MAX_CHARS) : EMPTY_CATEGORY_SLOT)
    }
  } else {
    for (let i = 0; i < TITLE_SLOT_COUNT - 1; i += 1) slots.push(truncate(titleNames[i]!, CATEGORY_SLOT_MAX_CHARS))
    slots.push(`+${titleNames.length - TITLE_SLOT_COUNT} MORE`)
  }
  return slots
}

export function licenseFields(input: LicenseInput): LicenseFields {
  return {
    documentNumber: documentNumber(input.hunterId),
    rankLetter: input.rank ?? 'UNRANKED',
    name: truncate(hunterDisplayName(input.hunterName, input.hunterId), NAME_MAX_CHARS),
    categorySlots: categorySlots(input.hunterClass, input.earnedTitleIds),
    statBand: [
      `LV ${input.level}`,
      ...STAT_BAND_ORDER.map((key) => `${key} ${input.total[key]}`),
      `${input.gatesCleared} GATES`,
    ].join(' · '),
    issuedAt: input.awakenedAt,
  }
}

/**
 * Built from `LicenseFields` alone, never from `LicenseInput` — the whole
 * point (m11-plan §9) is that the drawn card and its screen-reader text
 * cannot drift apart because they read the same derived values.
 */
export function licenseAriaLabel(fields: LicenseFields): string {
  const heldCategories = fields.categorySlots.slice(1).filter((slot) => slot !== EMPTY_CATEGORY_SLOT)
  const categorySentence =
    heldCategories.length > 0 ? ` Holding: ${heldCategories.join(', ')}.` : ' No titles held yet.'

  return (
    `Hunter's License. Name: ${fields.name}. Class: ${fields.categorySlots[0]}. ` +
    `Rank: ${fields.rankLetter}.${categorySentence} ${fields.statBand}. ` +
    `Document number ${fields.documentNumber}.`
  )
}
