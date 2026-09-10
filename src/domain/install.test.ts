import { describe, expect, it } from 'vitest'
import {
  INSTALL_REPROMPT_COOLDOWN_MS,
  canOfferInstall,
  shouldOfferInstallBanner,
  shouldOfferInstallNudge,
} from './install'
import { addDaysToKey, toDayKey } from './time'

const DAY = 24 * 60 * 60 * 1000

describe('canOfferInstall', () => {
  it('offers when never declined', () => {
    expect(canOfferInstall(null, 1_000)).toBe(true)
  })

  it('withholds right after a decline', () => {
    expect(canOfferInstall(1_000, 1_000)).toBe(false)
  })

  it('withholds up to and including the cooldown boundary', () => {
    const dismissedAt = 0
    expect(canOfferInstall(dismissedAt, INSTALL_REPROMPT_COOLDOWN_MS - 1)).toBe(false)
    expect(canOfferInstall(dismissedAt, INSTALL_REPROMPT_COOLDOWN_MS)).toBe(true)
  })
})

describe('shouldOfferInstallNudge', () => {
  const base = { nudgeSeen: false, dismissedAt: null, now: 1_000, gatesCleared: 0, level: 1 }

  it('does not fire before anything has happened', () => {
    expect(shouldOfferInstallNudge(base)).toBe(false)
  })

  it('fires on a first gate cleared', () => {
    expect(shouldOfferInstallNudge({ ...base, gatesCleared: 1 })).toBe(true)
  })

  it('fires on reaching level 2', () => {
    expect(shouldOfferInstallNudge({ ...base, level: 2 })).toBe(true)
  })

  it('never fires twice, whatever the cooldown says', () => {
    expect(shouldOfferInstallNudge({ ...base, nudgeSeen: true, gatesCleared: 5, level: 10 })).toBe(false)
  })

  it('stays withheld during the cooldown after a decline, even once earned', () => {
    expect(
      shouldOfferInstallNudge({ ...base, gatesCleared: 1, dismissedAt: 500, now: 500 + DAY }),
    ).toBe(false)
  })
})

describe('shouldOfferInstallBanner', () => {
  // Mid-morning, well clear of `toDayKey`'s day-start cutover, so it maps to
  // the calendar day it looks like regardless of the machine's timezone.
  const createdAt = new Date(2026, 0, 1, 10, 0).getTime()
  const firstDay = toDayKey(createdAt)
  const base = { createdAt, today: addDaysToKey(firstDay, 1), dismissedAt: null, now: 1_000 }

  it('is withheld on the day the hunter first opened the app', () => {
    expect(shouldOfferInstallBanner({ ...base, today: firstDay })).toBe(false)
  })

  it('offers on a later day with no prior decline', () => {
    expect(shouldOfferInstallBanner(base)).toBe(true)
  })

  it('is withheld during the cooldown after a decline', () => {
    expect(shouldOfferInstallBanner({ ...base, dismissedAt: 500, now: 500 + DAY })).toBe(false)
  })

  it('offers again once the cooldown has passed', () => {
    expect(
      shouldOfferInstallBanner({ ...base, dismissedAt: 0, now: INSTALL_REPROMPT_COOLDOWN_MS }),
    ).toBe(true)
  })
})
