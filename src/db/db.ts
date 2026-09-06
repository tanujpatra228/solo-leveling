/**
 * The IndexedDB schema. This is the source of truth for the whole app — the
 * server is a mirror and never a dependency.
 *
 * This module and `repo.ts` are the only places that know Dexie exists.
 * Components call the repository.
 */
import Dexie, { type EntityTable } from 'dexie'
import type {
  BodyMetric,
  Exercise,
  PersonalRecord,
  Profile,
  QuestLog,
  Routine,
  SessionLog,
  SetLog,
  Settings,
  Shadow,
  StatBlock,
  Title,
} from '../domain/types'

/**
 * Rows waiting to be pushed to the mirror. Kept as a separate table rather than
 * a flag on the log rows themselves, so that `SessionLog` and `SetLog` stay
 * genuinely immutable once written.
 */
export interface OutboxEntry {
  id: string
  table: 'sessions' | 'sets' | 'bodyMetrics'
  rowId: string
  createdAt: number
}

/**
 * The Hunter Secret, persisted. Its own store rather than folded into
 * `SyncState`, so "wipe my training history, keep my key" is expressible:
 * `wipeEverything` excludes this table unless explicitly told otherwise.
 */
export interface StoredIdentity {
  id: 'self'
  /** 15 random bytes. The credential. Never logged, never rendered. */
  secret: Uint8Array
  createdAt: number
}

/** Everything about talking to the mirror. One row, id `state`. */
export interface SyncState {
  id: 'state'
  /** The highest sequence number received from the server. */
  lastServerSeq: number
  lastSyncedAt: number | null
  /** SHA-256 of the Hunter Secret, which is the account identifier. */
  hunterId: string | null
  lastError: string | null
}

/** Stat points the hunter has assigned by hand. One row, id `state`. */
export interface Allocation {
  id: 'state'
  allocated: StatBlock
  updatedAt: number
}

/** Days the hunter declared as illness or travel, for the forgiveness rules. */
export interface DeclaredAbsence {
  dayKey: string
  reason: 'illness' | 'travel'
  declaredAt: number
}

/** Progress through the Demon Castle and other one-off counters. */
export interface Progress {
  id: 'state'
  towerFloorCleared: number
  gatesCleared: number
  redGatesCleared: number
  dailyQuestsCompleted: number
  gold: number
  restTokens: number
  restTokensMonth: string
  lastDeloadDayKey: string | null
  trainingStartDayKey: string | null
  /** When the first-launch Double Dungeon sequence was seen, by completion or
   *  skip — both count. `null` means it has never run. */
  doubleDungeonSeenAt: number | null
  /** When the bodyweightFactor tonnage correction was announced. `null` means
   *  it has never shown — see docs/substitution-plan.md §5 commit 1. */
  bodyweightFactorAnnouncedAt: number | null
  updatedAt: number
}

export class SystemDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  sessions!: EntityTable<SessionLog, 'id'>
  sets!: EntityTable<SetLog, 'id'>
  bodyMetrics!: EntityTable<BodyMetric, 'id'>
  quests!: EntityTable<QuestLog, 'id'>
  shadows!: EntityTable<Shadow, 'id'>
  titles!: EntityTable<Title, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'id'>
  profile!: EntityTable<Profile, 'id'>
  settings!: EntityTable<Settings, 'id'>
  allocation!: EntityTable<Allocation, 'id'>
  progress!: EntityTable<Progress, 'id'>
  absences!: EntityTable<DeclaredAbsence, 'dayKey'>
  outbox!: EntityTable<OutboxEntry, 'id'>
  syncState!: EntityTable<SyncState, 'id'>
  identity!: EntityTable<StoredIdentity, 'id'>

  constructor(name = 'solo-leveling-system') {
    super(name)

    this.version(1).stores({
      exercises: 'id, name, pattern',
      routines: 'id, dayOfWeek',
      sessions: 'id, dayKey, startedAt, routineId',
      // The compound index is what makes "the last time I did this exercise"
      // a single indexed range query rather than a scan of every set ever.
      sets: 'id, sessionId, exerciseId, [exerciseId+completedAt], completedAt',
      bodyMetrics: 'id, dayKey, recordedAt',
      quests: 'id, dayKey, type, status',
      shadows: 'id, exerciseId, rank',
      titles: 'id, earnedAt',
      personalRecords: 'id, exerciseId, achievedAt',
      profile: 'id',
      settings: 'id',
      allocation: 'id',
      progress: 'id',
      absences: 'dayKey',
      outbox: 'id, table, createdAt',
      syncState: 'id',
      identity: 'id',
    })

    // Adds an index on SetLog.substitutedFor, for a future "how often did I
    // substitute this exercise" query. See docs/substitution-plan.md §5
    // commit 6. Every other table carries its v1 definition forward
    // unchanged, per Dexie's own versioning model.
    this.version(2).stores({
      sets: 'id, sessionId, exerciseId, [exerciseId+completedAt], completedAt, substitutedFor',
    })
  }
}

/** One database per tab, which is why this is a module-level singleton. */
export const db = new SystemDatabase()
