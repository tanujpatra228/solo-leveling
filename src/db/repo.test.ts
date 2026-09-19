/**
 * `ensureSeeded`'s exercises-only scope (F1), and `reconcileRoutines`'s
 * proof-before-replace safety check (docs/bodyweight-gates-plan.md §5b).
 * Exercises are upserted unconditionally so a shipped correction reaches a
 * device seeded before it existed; routines only ever replace wholesale,
 * and only when every existing row still matches its seed-set counterpart
 * exactly — otherwise a hunter's edit could be silently discarded.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { endSession, ensureSeeded, reconcileRoutines, startSession, wipeEverything } from './repo'
import { SEED_EXERCISES, SEED_ROUTINES, SEED_ROUTINES_BODYWEIGHT } from './seed'

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

  it('is a no-op once the matching set is already seeded', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    await db.routines.update('monday-cst', { name: 'Renamed for this test' })

    await reconcileRoutines(BARBELL_ACCESS)

    // Untouched by the second call: the id set already matched, so the
    // early-return fires before the row is ever inspected.
    expect((await db.routines.get('monday-cst'))?.name).toBe('Renamed for this test')
  })

  it('replaces the barbell set with the bodyweight one when every existing row is untouched', async () => {
    await reconcileRoutines(BARBELL_ACCESS)

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES_BODYWEIGHT.map((r) => r.id).sort())
  })

  it('never replaces when any existing routine has been hand-edited', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    await db.routines.update('monday-cst', { name: 'Hand-edited name' })

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    // The whole set is left alone, not just the edited row — a partial
    // replace would silently discard the edit's siblings' original meaning
    // of "this is the hunter's programme".
    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES.map((r) => r.id).sort())
    expect((await db.routines.get('monday-cst'))?.name).toBe('Hand-edited name')
  })

  it('remaps cleared-gate history to the new set’s routine for the same day, so switching does not trigger a Dungeon Break', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    const session = await startSession({ routineId: 'monday-cst', at: Date.parse('2026-01-05T10:00:00Z') })
    await endSession(session.id, Date.parse('2026-01-05T11:00:00Z'))

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    const updated = await db.sessions.get(session.id)
    expect(updated?.routineId).toBe('bw-monday-push') // same dayOfWeek: 1
  })

  it('is deferred entirely while a session is open', async () => {
    await reconcileRoutines(BARBELL_ACCESS)
    await startSession({ routineId: 'monday-cst' }) // endedAt: null

    await reconcileRoutines(BODYWEIGHT_ACCESS)

    // Still the barbell set — nothing was touched mid-workout.
    const ids = (await db.routines.toArray()).map((r) => r.id).sort()
    expect(ids).toEqual(SEED_ROUTINES.map((r) => r.id).sort())
  })
})
