/**
 * `ensureSeeded`'s exercises-only scope (F1), and `reconcileRoutines`'s
 * proof-before-replace safety check (docs/bodyweight-gates-plan.md §5b).
 * Exercises are upserted unconditionally so a shipped correction reaches a
 * device seeded before it existed; routines only ever replace wholesale,
 * and only when every existing row's id is one this codebase has shipped
 * under (live or `LEGACY_SEED_ROUTINES_CST`) — content is allowed to have
 * drifted from whatever that id maps to today, since there is no edit path
 * to have drifted it any other way than a seed correction that never
 * reached the device.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { endSession, ensureSeeded, reconcileRoutines, startSession, wipeEverything } from './repo'
import { LEGACY_SEED_ROUTINES_CST, SEED_EXERCISES, SEED_ROUTINES, SEED_ROUTINES_BODYWEIGHT } from './seed'

const BARBELL_ACCESS = ['barbell', 'dumbbell', 'bench'] as const
const BODYWEIGHT_ACCESS = ['bodyweight', 'pullup_bar'] as const

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

  it('never touches routines — that is reconcileRoutines’s job now', async () => {
    await ensureSeeded()
    expect(await db.routines.count()).toBe(0)
  })
})

describe('reconcileRoutines', () => {
  it('seeds the barbell set for barbell-shaped access, from nothing', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES.map((r) => r.id).sort())
  })

  it('seeds the bodyweight set for bodyweight-shaped access, from nothing', async () => {
    await reconcileRoutines(BODYWEIGHT_ACCESS)
    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES_BODYWEIGHT.map((r) => r.id).sort())
  })

  it('writes nothing once the matching set is already seeded and current', async () => {
    await reconcileRoutines(BARBELL_ACCESS)

    let creates = 0
    const onCreate = () => {
      creates += 1
    }
    db.routines.hook('creating', onCreate)
    try {
      await reconcileRoutines(BARBELL_ACCESS)
    } finally {
      db.routines.hook('creating').unsubscribe(onCreate)
    }

    expect(creates).toBe(0)
  })

  it('refreshes a row whose id is live but whose content is stale, so a shipped correction reaches an already-seeded device', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    const seedRow = SEED_ROUTINES.find((r) => r.id === 'ppl-friday-pull-b')!
    // A device seeded before the rear-delt work landed: same id, one block short.
    await db.routines.update('ppl-friday-pull-b', { blocks: seedRow.blocks.slice(0, -1) })

    await reconcileRoutines(BARBELL_ACCESS)

    expect(await db.routines.get('ppl-friday-pull-b')).toEqual(seedRow)
    expect(await db.routines.count()).toBe(SEED_ROUTINES.length)
  })

  it('keeps cleared-gate history on the same routine id when only content is refreshed', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    const session = await startSession({ routineId: 'ppl-friday-pull-b', at: Date.parse('2026-01-09T10:00:00Z') })
    await endSession(session.id, Date.parse('2026-01-09T11:00:00Z'))
    await db.routines.update('ppl-friday-pull-b', { name: 'Stale name' })

    await reconcileRoutines(BARBELL_ACCESS)

    expect((await db.routines.get('ppl-friday-pull-b'))?.name).toBe('Pull Gate B')
    expect((await db.sessions.get(session.id))?.routineId).toBe('ppl-friday-pull-b')
  })

  it('replaces the barbell set with the bodyweight one when every existing row is untouched', async () => {
    await reconcileRoutines(BARBELL_ACCESS)

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES_BODYWEIGHT.map((r) => r.id).sort())
  })

  it('migrates a hunter still seeded with the old CST week, even though a later correction means their rows no longer byte-match the captured legacy shape', async () => {
    // Reproduces the real bug: a device seeded before Cable External
    // Rotation was added to the CST week has a monday-cst row with 7 blocks,
    // one short of LEGACY_SEED_ROUTINES_CST's 8. Add-only seeding never
    // patched it in, so this row can never byte-match any snapshot this
    // codebase has ever captured — but its id still proves it came from a
    // past run of this same seed script, which is all reconcileRoutines
    // needs to prove replacing it discards nothing.
    const drifted = LEGACY_SEED_ROUTINES_CST.map((r) =>
      r.id === 'monday-cst' ? { ...r, blocks: r.blocks.slice(0, -1) } : r,
    )
    await db.routines.bulkAdd(drifted)

    await reconcileRoutines(BARBELL_ACCESS)

    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES.map((r) => r.id).sort())
  })

  it('never replaces when an existing routine has an id this codebase has never shipped under', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    await db.routines.add({
      ...(await db.routines.get('ppl-monday-push-a'))!,
      id: 'some-hand-rolled-routine-id',
    })

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    // The whole set is left alone — an id no seed script has ever produced
    // is the only signal this function has for "something else wrote this",
    // since there is no edit path yet to leave any other trace.
    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toContain('some-hand-rolled-routine-id')
    expect(ids).toEqual([...SEED_ROUTINES.map((r) => r.id), 'some-hand-rolled-routine-id'].sort())
  })

  it('remaps cleared-gate history to the new set’s routine for the same day, so switching does not trigger a Dungeon Break', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    const session = await startSession({ routineId: 'ppl-monday-push-a', at: Date.parse('2026-01-05T10:00:00Z') })
    await endSession(session.id, Date.parse('2026-01-05T11:00:00Z'))

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    const updated = await db.sessions.get(session.id)
    expect(updated?.routineId).toBe('bw-monday-push') // same dayOfWeek: 1
  })

  it('is deferred entirely while a session is open', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    await startSession({ routineId: 'ppl-monday-push-a' }) // endedAt: null

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    // Still the barbell set — nothing was touched mid-workout.
    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES.map((r) => r.id).sort())
  })
})
