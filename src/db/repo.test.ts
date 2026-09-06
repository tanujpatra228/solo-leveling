/**
 * `ensureSeeded`'s exercises-vs-routines asymmetry (F1, `docs/m5-plan.md`
 * commit 1). Exercises are upserted unconditionally so a shipped correction
 * reaches a device seeded before it existed; routines stay add-only so a
 * hunter's edit is never silently discarded.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { ensureSeeded, wipeEverything } from './repo'
import { SEED_EXERCISES, SEED_ROUTINES } from './seed'

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
})

describe('ensureSeeded', () => {
  it('corrects an exercise row seeded before bodyweightFactor existed (commit 5ce8d44)', async () => {
    const shipped = SEED_EXERCISES.find((e) => e.id === 'diamond-pushups')
    expect(shipped).toBeDefined()
    expect(shipped!.bodyweightFactor).toBeLessThan(1)

    // A device seeded before the field existed: the same row, but read back
    // through the old full-bodyweight default instead of the corrected one.
    await db.exercises.put({ ...shipped!, bodyweightFactor: 1 })

    await ensureSeeded()

    const row = await db.exercises.get('diamond-pushups')
    expect(row?.bodyweightFactor).toBe(shipped!.bodyweightFactor)
  })

  it('never overwrites a routine the hunter has already edited', async () => {
    const seeded = SEED_ROUTINES[0]
    expect(seeded).toBeDefined()
    await db.routines.put({ ...seeded!, name: 'Hand-edited name' })

    await ensureSeeded()

    const row = await db.routines.get(seeded!.id)
    expect(row?.name).toBe('Hand-edited name')
  })

  it('still adds a routine missing entirely, same as before', async () => {
    await ensureSeeded()
    const count = await db.routines.count()
    expect(count).toBe(SEED_ROUTINES.length)
  })
})
