/**
 * These are the drift alarm for the bridge (mana-plate docs/m1-plan.md §9.1
 * point 6): if this repo's schema ever changes shape, the failure shows up
 * here, in the repo making the change, rather than as a silently broken
 * prefill in Mana Plate. Seeded through the real repo functions and the real
 * Zod schemas, never a hand-rolled fixture that could drift from them.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readForManaPlate } from './read'
import { db } from '../db/db'
import { addBodyMetric, saveProfile, wipeEverything } from '../db/repo'
import type { Profile } from '../domain/types'

const PROFILE: Profile = {
  id: 'profile',
  sex: 'male',
  birthYear: 1994,
  heightCm: 178,
  unitPref: 'metric',
  trainingYears: 2,
  equipmentAccess: ['barbell', 'dumbbell', 'bench'],
  createdAt: Date.parse('2026-01-01T00:00:00Z'),
  awakenedAt: Date.parse('2026-01-01T00:00:00Z'),
}

// Must run before anything else in this file opens the database (a
// wipeEverything call, a saveProfile, an addBodyMetric all do), or the
// premise — that the hunter has never opened the app — stops being true.
it('replies found: false, and leaves no database behind, when the app has never been opened', async () => {
  const reply = await readForManaPlate(indexedDB)

  expect(reply).toEqual({ type: 'solo-leveling:profile', v: 1, found: false })

  const names = (await indexedDB.databases()).map((entry) => entry.name)
  expect(names).not.toContain('solo-leveling-system')
})

describe('once the app has data', () => {
  beforeEach(async () => {
    await wipeEverything()
  })

  it('returns sex, unitPref, the newer weight, and the older body fat', async () => {
    await saveProfile(PROFILE)
    const older = await addBodyMetric({
      weightKg: 92,
      bodyFatPct: 24,
      at: Date.parse('2026-08-01T08:00:00Z'),
    })
    const newer = await addBodyMetric({
      weightKg: 90,
      at: Date.parse('2026-09-01T08:00:00Z'),
    })

    const reply = await readForManaPlate(indexedDB)

    expect(reply.found).toBe(true)
    expect(reply.sex).toBe('male')
    expect(reply.unitPref).toBe('metric')
    expect(reply.weight).toEqual({ kg: 90, recordedAt: newer.recordedAt })
    expect(reply.bodyFat).toEqual({ pct: 24, recordedAt: older.recordedAt })
  })

  it('drops a body metric row with a non-positive weight, so no weight comes back', async () => {
    await saveProfile(PROFILE)
    // Written straight to the table, bypassing addBodyMetric's own Zod
    // validation, standing in for a row an older or buggier version of the
    // app could have left behind.
    await db.bodyMetrics.add({
      id: 'bad-row',
      dayKey: '2026-09-02',
      recordedAt: Date.parse('2026-09-02T08:00:00Z'),
      weightKg: -1,
    })

    const reply = await readForManaPlate(indexedDB)

    expect(reply.found).toBe(true)
    expect(reply.weight).toBeUndefined()
    expect(reply.bodyFat).toBeUndefined()
  })
})
