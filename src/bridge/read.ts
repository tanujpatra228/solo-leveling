/**
 * What the bridge (main.ts) hands back to Mana Plate: a read-only summary for
 * setup prefill, never the license key, the hunter name, or any training
 * data (mana-plate docs/m1-plan.md §9.1 point 2).
 *
 * Reads the same `solo-leveling-system` database the app itself uses, but
 * through the raw IndexedDB API rather than Dexie, and with no version
 * requested, so a hunter who has never opened the app never gets a database
 * created on their behalf just because a sibling app asked.
 */
import { BodyMetricSchema, ProfileSchema, type Sex, type UnitPref } from '../domain/types'

const DB_NAME = 'solo-leveling-system'

// Bounds how far back the walk for a body-fat reading goes, so a hunter with
// years of daily weigh-ins does not turn one bridge request into a full-table
// scan. The newest weight never needs this: it is always the first row.
const BODY_FAT_SCAN_LIMIT = 60

export interface BridgeReply {
  type: 'solo-leveling:profile'
  v: 1
  found: boolean
  sex?: Sex
  unitPref?: UnitPref
  weight?: { kg: number; recordedAt: number }
  bodyFat?: { pct: number; recordedAt: number }
}

const NOT_FOUND: BridgeReply = { type: 'solo-leveling:profile', v: 1, found: false }

export async function readForManaPlate(idb: IDBFactory): Promise<BridgeReply> {
  const database = await openExisting(idb)
  if (!database) return NOT_FOUND

  try {
    if (!database.objectStoreNames.contains('profile') || !database.objectStoreNames.contains('bodyMetrics')) {
      return NOT_FOUND
    }

    const [profileRow, metricRows] = await Promise.all([
      readByKey(database, 'profile', 'profile'),
      readNewestByIndex(database, 'bodyMetrics', 'recordedAt', BODY_FAT_SCAN_LIMIT),
    ])

    // A row that fails to parse is dropped rather than trusted (standards
    // rule 3) — the same rule the app's own repo.ts applies to every read.
    const profile = ProfileSchema.safeParse(profileRow)
    const metrics = metricRows
      .map((row) => BodyMetricSchema.safeParse(row))
      .filter((result) => result.success)
      .map((result) => result.data)

    const newestWeight = metrics[0]
    const bodyFatRow = metrics.find((metric) => metric.bodyFatPct !== undefined)

    return {
      type: 'solo-leveling:profile',
      v: 1,
      found: true,
      sex: profile.success ? profile.data.sex : undefined,
      unitPref: profile.success ? profile.data.unitPref : undefined,
      weight: newestWeight ? { kg: newestWeight.weightKg, recordedAt: newestWeight.recordedAt } : undefined,
      bodyFat:
        bodyFatRow?.bodyFatPct !== undefined
          ? { pct: bodyFatRow.bodyFatPct, recordedAt: bodyFatRow.recordedAt }
          : undefined,
    }
  } finally {
    database.close()
  }
}

/**
 * Opens the database with no version. When it does not exist yet, that is
 * indistinguishable from "hunter never opened the app" only if nothing here
 * commits the empty database IndexedDB would otherwise create — hence the
 * abort in `onupgradeneeded`, which fails the open request rather than
 * finishing it, and leaves no trace for `indexedDB.databases()` to report.
 */
function openExisting(idb: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let settled = false
    let didNotExist = false
    const finish = (value: IDBDatabase | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    let request: IDBOpenDBRequest
    try {
      request = idb.open(DB_NAME)
    } catch {
      finish(null)
      return
    }

    request.onupgradeneeded = () => {
      didNotExist = true
      request.transaction?.abort()
    }
    request.onsuccess = () => {
      // Belt-and-braces: an aborted upgrade should already reach onerror, not
      // onsuccess, but never hand back a database this call just created.
      if (didNotExist) {
        request.result.close()
        finish(null)
        return
      }
      finish(request.result)
    }
    request.onerror = () => finish(null)
    request.onblocked = () => finish(null)
  })
}

function readByKey(database: IDBDatabase, storeName: string, key: string): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

/** Walks an index newest-first via its cursor, stopping after `limit` rows. */
function readNewestByIndex(
  database: IDBDatabase,
  storeName: string,
  indexName: string,
  limit: number,
): Promise<unknown[]> {
  return new Promise((resolve) => {
    const rows: unknown[] = []
    try {
      const index = database.transaction(storeName, 'readonly').objectStore(storeName).index(indexName)
      const request = index.openCursor(null, 'prev')
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor || rows.length >= limit) {
          resolve(rows)
          return
        }
        rows.push(cursor.value)
        cursor.continue()
      }
      request.onerror = () => resolve(rows)
    } catch {
      resolve(rows)
    }
  })
}
