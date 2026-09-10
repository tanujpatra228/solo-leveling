/**
 * Eligibility rules for offering Android's install prompt. The browser event
 * itself (`beforeinstallprompt`) and the actual `.prompt()` call live in
 * `platform/capabilities.ts`, which is impure by nature — this file only
 * decides *when* to ask, given settings and today's date, so the decision is
 * testable without a DOM.
 */
import type { DayKey } from './types'
import { toDayKey } from './time'

/** Declining once buys a week of silence before the System asks again. */
export const INSTALL_REPROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** True the first time ever, or once the cooldown since the last decline has passed. */
export function canOfferInstall(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt === null) return true
  return now - dismissedAt >= INSTALL_REPROMPT_COOLDOWN_MS
}

/**
 * The one-time celebratory nudge: fires the first time a hunter has actually
 * done something (a first gate cleared, or a first level up), never on page
 * load before the app has proven itself. Never fires twice — re-showing
 * "you just cleared your first gate!" days later would be incoherent, so this
 * ignores `nudgeSeen` and returns false permanently once it has fired once,
 * regardless of what the cooldown says.
 */
export function shouldOfferInstallNudge(input: {
  nudgeSeen: boolean
  dismissedAt: number | null
  now: number
  gatesCleared: number
  level: number
}): boolean {
  if (input.nudgeSeen) return false
  if (!canOfferInstall(input.dismissedAt, input.now)) return false
  return input.gatesCleared >= 1 || input.level >= 2
}

/**
 * The passive reminder banner: withheld on the day a hunter first opens the
 * app (nothing to point to yet, and asking before the app has shown anything
 * is the least convincing moment), and withheld again for a week after a
 * decline.
 */
export function shouldOfferInstallBanner(input: {
  createdAt: number
  today: DayKey
  dismissedAt: number | null
  now: number
}): boolean {
  if (toDayKey(input.createdAt) === input.today) return false
  return canOfferInstall(input.dismissedAt, input.now)
}
