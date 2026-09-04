/**
 * The first repository tests in the project. `fake-indexeddb/auto` installs a
 * global `indexedDB` before anything imports Dexie, which is what lets these
 * run under Vitest's node environment with no browser.
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { decodeLicenseKey, encodeLicenseKey } from '../sync/identity'
import { db } from './db'
import { ensureIdentity, getStoredIdentity, wipeEverything } from './repo'

afterEach(async () => {
  await db.identity.clear()
})

describe('identity persistence', () => {
  it('mints once and returns the same licence key on every later call', async () => {
    const first = await ensureIdentity()
    const second = await ensureIdentity()

    expect(second.licenseKey).toBe(first.licenseKey)
    expect(second.hunterId).toBe(first.hunterId)
    expect(await db.identity.count()).toBe(1)
  })

  it('the stored secret round-trips through the licence key encoding', async () => {
    const identity = await ensureIdentity()
    const stored = await getStoredIdentity()

    expect(stored).not.toBeNull()
    expect(encodeLicenseKey(stored!.secret)).toBe(identity.licenseKey)

    const decoded = decodeLicenseKey(encodeLicenseKey(stored!.secret))
    expect([...decoded!]).toEqual([...stored!.secret])
  })

  it('wipeEverything keeps the identity by default, and drops it only when asked', async () => {
    const identity = await ensureIdentity()

    await wipeEverything()
    const keptStill = await getStoredIdentity()
    expect(keptStill).not.toBeNull()
    expect(keptStill!.licenseKey).toBe(identity.licenseKey)

    await wipeEverything({ forgetIdentity: true })
    expect(await getStoredIdentity()).toBeNull()
  })
})
