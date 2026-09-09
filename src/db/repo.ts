/**
 * The repository. The only module besides `db.ts` that knows IndexedDB exists.
 *
 * Every write goes to the device first and returns immediately. Sync happens
 * later and its failure is never an error the hunter sees, so nothing here
 * awaits a network response and nothing here can block logging a set.
 *
 * Log rows are append-only: `addSet` and `startSession` insert, and a
 * correction is a new row carrying `supersedes` rather than an edit.
 */
import * as z from 'zod'
import type { Table } from 'dexie'
import { db, type Allocation, type DeclaredAbsence, type Progress, type SyncState } from './db'
import { SEED_EXERCISES, SEED_ROUTINES } from './seed'
import { createIdentity, identityFromSecret, type Identity } from '../sync/identity'
import {
  BodyMetricSchema,
  ExerciseSchema,
  ProfileSchema,
  QuestLogSchema,
  RoutineSchema,
  SessionLogSchema,
  SetLogSchema,
  SettingsSchema,
  ShadowSchema,
  type BodyMetric,
  type Exercise,
  type PersonalRecord,
  type Profile,
  type QuestLog,
  type Routine,
  type SessionLog,
  type SetLog,
  type Settings,
  type Shadow,
  type StatBlock,
  type SubstitutionReason,
  type Title,
} from '../domain/types'
import { toDayKey } from '../domain/time'
import { ZERO_STATS } from '../domain/stats'

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Rows read back out of IndexedDB are validated, because they may have been
 * written by an older version of the app. A row that no longer parses is
 * dropped from the result rather than crashing the screen that asked for it.
 */
function parseAll<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  const out: T[] = []
  for (const row of rows) {
    const result = schema.safeParse(row)
    if (result.success) out.push(result.data)
    else if (import.meta.env.DEV) {
      // Never log the row itself. It carries health data.
      console.warn(`Dropped an unreadable ${label} row from IndexedDB.`)
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  updatedAt: 0,
  soundEnabled: true,
  hapticsEnabled: true,
  keepScreenAwake: true,
  pushEnabled: false,
  syncEnabled: false,
  dismissedAdvisories: [],
  systemIntroSeen: false,
}

const DEFAULT_PROGRESS: Progress = {
  id: 'state',
  towerFloorCleared: 0,
  gatesCleared: 0,
  redGatesCleared: 0,
  dailyQuestsCompleted: 0,
  gold: 0,
  restTokens: 2,
  restTokensMonth: '',
  lastDeloadDayKey: null,
  trainingStartDayKey: null,
  doubleDungeonSeenAt: null,
  bodyweightFactorAnnouncedAt: null,
  updatedAt: 0,
}

/**
 * Puts the exercise library and routines in place. Safe to call on every start.
 *
 * Exercises and routines differ on purpose. Exercises are seed data the
 * hunter never edits, so they are upserted unconditionally (`bulkPut`) —
 * otherwise a shipped correction to the library (a fixed `bodyweightFactor`,
 * a new fallback) never reaches a device that was already seeded before it
 * existed; it just keeps reading the old row back through Zod's default
 * forever (F1). Routines will become user-editable, so
 * they stay add-only (`bulkAdd` of whatever id is missing) — overwriting one
 * on every load would silently discard a hunter's edit.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, db.settings, db.progress, async () => {
    await db.exercises.bulkPut(SEED_EXERCISES as Exercise[])

    const existingRoutineIds = new Set(await db.routines.toCollection().primaryKeys())
    const missingRoutines = SEED_ROUTINES.filter((r) => !existingRoutineIds.has(r.id))
    if (missingRoutines.length > 0) await db.routines.bulkAdd(missingRoutines as Routine[])

    if (!(await db.settings.get('settings'))) {
      await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: Date.now() })
    }
    if (!(await db.progress.get('state'))) {
      await db.progress.put({ ...DEFAULT_PROGRESS, updatedAt: Date.now() })
    }
  })
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export async function getStoredIdentity(): Promise<Identity | null> {
  const row = await db.identity.get('self')
  if (!row) return null
  return identityFromSecret(row.secret)
}

/**
 * Mints the Hunter Secret on first call and returns the same identity on
 * every call after. Has no network consequence — `syncEnabled` defaults to
 * false, so this contacts nothing.
 */
export async function ensureIdentity(): Promise<Identity> {
  const existing = await db.identity.get('self')
  if (existing) return identityFromSecret(existing.secret)

  const identity = await createIdentity()
  await db.identity.put({ id: 'self', secret: identity.secret, createdAt: Date.now() })
  return identity
}

/**
 * Overwrites this device's Hunter Secret with one scanned from another
 * device, for pairing (M6 commit 5). Deliberately distinct from
 * `ensureIdentity`: this replaces an existing secret rather than only
 * minting one when none exists.
 */
export async function adoptIdentity(secret: Uint8Array): Promise<void> {
  await db.identity.put({ id: 'self', secret, createdAt: Date.now() })
}

/** Abandons the mirror identity. Distinct from `wipeEverything`, on purpose. */
export async function forgetIdentity(): Promise<void> {
  await db.identity.delete('self')
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getExercises(): Promise<Exercise[]> {
  return parseAll(ExerciseSchema, await db.exercises.toArray(), 'exercise')
}

export async function getRoutines(): Promise<Routine[]> {
  return parseAll(RoutineSchema, await db.routines.toArray(), 'routine')
}

export async function getSessions(): Promise<SessionLog[]> {
  return parseAll(SessionLogSchema, await db.sessions.toArray(), 'session')
}

export async function getSets(): Promise<SetLog[]> {
  return parseAll(SetLogSchema, await db.sets.toArray(), 'set')
}

export async function getSetsForSession(sessionId: string): Promise<SetLog[]> {
  return parseAll(
    SetLogSchema,
    await db.sets.where('sessionId').equals(sessionId).toArray(),
    'set',
  )
}

export async function getBodyMetrics(): Promise<BodyMetric[]> {
  return parseAll(BodyMetricSchema, await db.bodyMetrics.orderBy('recordedAt').toArray(), 'body metric')
}

export async function getQuests(): Promise<QuestLog[]> {
  return parseAll(QuestLogSchema, await db.quests.toArray(), 'quest')
}

export async function getQuestsForDay(dayKey: string): Promise<QuestLog[]> {
  return parseAll(QuestLogSchema, await db.quests.where('dayKey').equals(dayKey).toArray(), 'quest')
}

export async function getShadows(): Promise<Shadow[]> {
  return parseAll(ShadowSchema, await db.shadows.toArray(), 'shadow')
}

export async function getTitles(): Promise<Title[]> {
  return db.titles.toArray()
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  return db.personalRecords.toArray()
}

export async function getProfile(): Promise<Profile | null> {
  const row = await db.profile.get('profile')
  if (!row) return null
  const parsed = ProfileSchema.safeParse(row)
  return parsed.success ? parsed.data : null
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings')
  const parsed = SettingsSchema.safeParse(row)
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS, updatedAt: Date.now() }
}

export async function getAllocation(): Promise<StatBlock> {
  const row = await db.allocation.get('state')
  return row?.allocated ?? ZERO_STATS
}

export async function getProgress(): Promise<Progress> {
  return (await db.progress.get('state')) ?? { ...DEFAULT_PROGRESS, updatedAt: Date.now() }
}

export async function getAbsences(): Promise<DeclaredAbsence[]> {
  return db.absences.toArray()
}

export async function getSyncState(): Promise<SyncState> {
  return (
    (await db.syncState.get('state')) ?? {
      id: 'state',
      lastServerSeq: 0,
      lastSyncedAt: null,
      hunterId: null,
      lastError: null,
      requestsToday: 0,
      requestsDayKey: '',
    }
  )
}

/* ------------------------------------------------------------------ */
/* Writes                                                             */
/* ------------------------------------------------------------------ */

/** Queues a log row for the mirror. Never blocks the write that produced it. */
async function enqueue(table: 'sessions' | 'sets' | 'bodyMetrics', rowId: string): Promise<void> {
  await db.outbox.put({ id: `${table}:${rowId}`, table, rowId, createdAt: Date.now() })
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db.profile.put(ProfileSchema.parse(profile))
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next = SettingsSchema.parse({ ...current, ...patch, id: 'settings', updatedAt: Date.now() })
  await db.settings.put(next)
  return next
}

export async function saveAllocation(allocated: StatBlock): Promise<void> {
  const row: Allocation = { id: 'state', allocated, updatedAt: Date.now() }
  await db.allocation.put(row)
}

export async function updateProgress(patch: Partial<Omit<Progress, 'id'>>): Promise<Progress> {
  const current = await getProgress()
  const next: Progress = { ...current, ...patch, id: 'state', updatedAt: Date.now() }
  await db.progress.put(next)
  return next
}

export async function startSession(input: {
  routineId: string | null
  questId?: string
  bodyweightKg?: number
  at?: number
}): Promise<SessionLog> {
  const startedAt = input.at ?? Date.now()
  const session: SessionLog = SessionLogSchema.parse({
    id: newId(),
    routineId: input.routineId,
    questId: input.questId,
    startedAt,
    endedAt: null,
    dayKey: toDayKey(startedAt),
    bodyweightKg: input.bodyweightKg,
  })
  await db.sessions.add(session)
  await enqueue('sessions', session.id)

  // The first session ever is what the deload calendar counts from.
  const progress = await getProgress()
  if (!progress.trainingStartDayKey) {
    await updateProgress({ trainingStartDayKey: session.dayKey })
  }

  return session
}

export async function endSession(sessionId: string, at?: number): Promise<void> {
  const endedAt = at ?? Date.now()
  await db.sessions.update(sessionId, { endedAt })
  await enqueue('sessions', sessionId)
}

/**
 * Discards an open session outright: deletes the session row, every set
 * logged against it, and any outbox entries pointing at either, so nothing
 * tries to sync a session that was abandoned rather than finished. Unlike
 * `endSession`, this is not "finish with whatever was done" — it is "this
 * session never happened", for a hunter who opened a gate by mistake or is
 * clearing a stuck row left behind by an earlier crash.
 */
export async function abandonSession(sessionId: string): Promise<void> {
  const setIds = await db.sets.where('sessionId').equals(sessionId).primaryKeys()
  await db.transaction('rw', db.sessions, db.sets, db.outbox, async () => {
    await db.sessions.delete(sessionId)
    await db.sets.bulkDelete(setIds)
    await db.outbox.bulkDelete([
      `sessions:${sessionId}`,
      ...setIds.map((id) => `sets:${id}`),
    ])
  })
}

/** Appends one set. The row is never updated after this. */
export async function addSet(input: {
  sessionId: string
  exerciseId: string
  order: number
  weight: number
  reps: number
  seconds?: number
  metres?: number
  rpe?: number
  isWarmup?: boolean
  at?: number
  substitutedFor?: string
  substitutionReason?: SubstitutionReason
}): Promise<SetLog> {
  const set: SetLog = SetLogSchema.parse({
    id: newId(),
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    order: input.order,
    weight: input.weight,
    reps: input.reps,
    seconds: input.seconds,
    metres: input.metres,
    rpe: input.rpe,
    isWarmup: input.isWarmup ?? false,
    completedAt: input.at ?? Date.now(),
    substitutedFor: input.substitutedFor,
    substitutionReason: input.substitutionReason,
  })
  await db.sets.add(set)
  await enqueue('sets', set.id)
  return set
}

/**
 * Corrects an earlier set by appending a replacement that supersedes it. The
 * original row stays exactly where it is, which is what makes the log
 * re-gradeable.
 */
export async function correctSet(
  originalId: string,
  patch: { weight?: number; reps?: number; rpe?: number; isWarmup?: boolean },
): Promise<SetLog | null> {
  const original = await db.sets.get(originalId)
  if (!original) return null

  const replacement: SetLog = SetLogSchema.parse({
    ...original,
    ...patch,
    id: newId(),
    supersedes: originalId,
    completedAt: original.completedAt,
  })
  await db.sets.add(replacement)
  await enqueue('sets', replacement.id)
  return replacement
}

export async function addBodyMetric(input: {
  weightKg: number
  waistCm?: number
  neckCm?: number
  hipCm?: number
  bodyFatPct?: number
  bodyFatSource?: BodyMetric['bodyFatSource']
  at?: number
}): Promise<BodyMetric> {
  const recordedAt = input.at ?? Date.now()
  const metric: BodyMetric = BodyMetricSchema.parse({
    id: newId(),
    dayKey: toDayKey(recordedAt),
    recordedAt,
    weightKg: input.weightKg,
    waistCm: input.waistCm,
    neckCm: input.neckCm,
    hipCm: input.hipCm,
    bodyFatPct: input.bodyFatPct,
    bodyFatSource: input.bodyFatSource,
  })
  await db.bodyMetrics.add(metric)
  await enqueue('bodyMetrics', metric.id)
  return metric
}

export async function putQuest(quest: QuestLog): Promise<void> {
  await db.quests.put(QuestLogSchema.parse(quest))
}

export async function setQuestStatus(id: string, status: QuestLog['status']): Promise<void> {
  await db.quests.update(id, { status })
}

export async function addShadow(shadow: Shadow): Promise<void> {
  await db.shadows.put(ShadowSchema.parse(shadow))
}

export async function setShadowActive(id: string, active: boolean): Promise<void> {
  await db.shadows.update(id, { active })
}

export async function addTitle(title: Title): Promise<void> {
  await db.titles.put(title)
}

export async function putPersonalRecord(record: PersonalRecord): Promise<void> {
  await db.personalRecords.put(record)
}

export async function declareAbsence(
  dayKey: string,
  reason: 'illness' | 'travel',
): Promise<void> {
  await db.absences.put({ dayKey, reason, declaredAt: Date.now() })
}

export async function undeclareAbsence(dayKey: string): Promise<void> {
  await db.absences.delete(dayKey)
}

/* ------------------------------------------------------------------ */
/* Sync plumbing                                                      */
/* ------------------------------------------------------------------ */

export async function getOutbox(limit = 500) {
  return db.outbox.orderBy('createdAt').limit(limit).toArray()
}

export async function clearOutboxEntries(ids: readonly string[]): Promise<void> {
  await db.outbox.bulkDelete([...ids])
}

export async function saveSyncState(patch: Partial<Omit<SyncState, 'id'>>): Promise<SyncState> {
  const current = await getSyncState()
  const next: SyncState = { ...current, ...patch, id: 'state' }
  await db.syncState.put(next)
  return next
}

/**
 * Applies rows pulled from the mirror. Uses `put` rather than `add` so a row
 * this device already has is simply overwritten with an identical copy, which
 * makes the pull idempotent.
 */
export async function applyRemoteRows(rows: {
  sessions?: unknown[]
  sets?: unknown[]
  bodyMetrics?: unknown[]
}): Promise<{ sessions: number; sets: number; bodyMetrics: number }> {
  const sessions = parseAll(SessionLogSchema, rows.sessions ?? [], 'remote session')
  const sets = parseAll(SetLogSchema, rows.sets ?? [], 'remote set')
  const bodyMetrics = parseAll(BodyMetricSchema, rows.bodyMetrics ?? [], 'remote body metric')

  await db.transaction('rw', db.sessions, db.sets, db.bodyMetrics, async () => {
    if (sessions.length > 0) await db.sessions.bulkPut(sessions)
    if (sets.length > 0) await db.sets.bulkPut(sets)
    if (bodyMetrics.length > 0) await db.bodyMetrics.bulkPut(bodyMetrics)
  })

  return { sessions: sessions.length, sets: sets.length, bodyMetrics: bodyMetrics.length }
}

/** Rows the mirror has not seen yet, resolved from the outbox. */
export async function collectPendingRows(): Promise<{
  entryIds: string[]
  sessions: SessionLog[]
  sets: SetLog[]
  bodyMetrics: BodyMetric[]
}> {
  const entries = await getOutbox()
  const sessionIds = entries.filter((e) => e.table === 'sessions').map((e) => e.rowId)
  const setIds = entries.filter((e) => e.table === 'sets').map((e) => e.rowId)
  const metricIds = entries.filter((e) => e.table === 'bodyMetrics').map((e) => e.rowId)

  const [sessions, sets, bodyMetrics] = await Promise.all([
    db.sessions.bulkGet(sessionIds),
    db.sets.bulkGet(setIds),
    db.bodyMetrics.bulkGet(metricIds),
  ])

  return {
    entryIds: entries.map((e) => e.id),
    sessions: sessions.filter((row): row is SessionLog => row !== undefined),
    sets: sets.filter((row): row is SetLog => row !== undefined),
    bodyMetrics: bodyMetrics.filter((row): row is BodyMetric => row !== undefined),
  }
}

/**
 * Wipes every table. Used by the "start over" control in settings, and
 * deliberately explicit about what it destroys rather than being reachable by
 * accident.
 *
 * Keeps the Hunter Secret by default: resetting training history should not
 * silently abandon the mirror. Pass `forgetIdentity: true` for the separate,
 * explicitly named path that does both.
 */
export async function wipeEverything(options?: { forgetIdentity?: boolean }): Promise<void> {
  // Explicitly `any`: the tables being cleared have no field in common, and
  // Dexie's own `transaction` signature only wants them as a scope list.
  const tables: Table<any, any, any>[] = [
    db.exercises,
    db.routines,
    db.sessions,
    db.sets,
    db.bodyMetrics,
    db.quests,
    db.shadows,
    db.titles,
    db.personalRecords,
    db.profile,
    db.settings,
    db.allocation,
    db.progress,
    db.absences,
    db.outbox,
    db.syncState,
  ]
  if (options?.forgetIdentity) tables.push(db.identity)

  await db.transaction('rw', tables, async () => {
    await Promise.all([
      db.exercises.clear(),
      db.routines.clear(),
      db.sessions.clear(),
      db.sets.clear(),
      db.bodyMetrics.clear(),
      db.quests.clear(),
      db.shadows.clear(),
      db.titles.clear(),
      db.personalRecords.clear(),
      db.profile.clear(),
      db.settings.clear(),
      db.allocation.clear(),
      db.progress.clear(),
      db.absences.clear(),
      db.outbox.clear(),
      db.syncState.clear(),
      ...(options?.forgetIdentity ? [db.identity.clear()] : []),
    ])
  })
}
