/**
 * The sync client.
 *
 * Sync is a background convenience, never a dependency. Nothing here is on the
 * critical path of logging a set: every call is fire-and-forget from the
 * caller's point of view, failures are recorded and swallowed rather than
 * surfaced as errors, and the app is fully functional with this module never
 * succeeding once.
 *
 * Only the immutable event log is synchronised. Derived state is recomputed on
 * each device, and settings are last-write-wins and handled separately, so
 * conflicts are close to impossible by construction.
 */
import * as z from 'zod'
import {
  applyRemoteRows,
  clearOutboxEntries,
  collectPendingRows,
  getSyncState,
  saveSyncState,
} from '../db/repo'
import type { Identity } from './identity'

/**
 * Matches the Worker's own cap, so a request is never rejected for size.
 * Exported so `worker/limits.test.ts` can assert the two never drift apart.
 */
export const MAX_ROWS_PER_REQUEST = 200

/** Stops a runaway loop if the server keeps saying there is more. */
const MAX_ROUNDS_PER_RUN = 20

const SyncResponseSchema = z.object({
  seq: z.number().int().nonnegative(),
  /** Rows the Worker received in this request, not rows it applied — a retry
   *  of already-mirrored rows still reports the count offered. Kept only as a
   *  cross-check; `pushed` below is counted from what this device sent. */
  received: z.number().int().nonnegative(),
  rows: z.object({
    sessions: z.array(z.unknown()).default([]),
    sets: z.array(z.unknown()).default([]),
    bodyMetrics: z.array(z.unknown()).default([]),
  }),
  hasMore: z.boolean().default(false),
})

export interface SyncOutcome {
  ok: boolean
  pushed: number
  pulled: number
  seq: number
  /** Present when sync did not complete. Shown as a quiet status, not an error. */
  message?: string
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Reused for every round that is pulling only, so nothing is re-sent. */
const EMPTY_CHANGES = { sessions: [], sets: [], bodyMetrics: [] } as const

/**
 * One sync run: push whatever is in the outbox, then pull anything newer than
 * the stored cursor. Returns an outcome rather than throwing, because a failed
 * sync is a normal state in a gym basement and not an exceptional one.
 */
export async function runSync(identity: Identity, baseUrl = ''): Promise<SyncOutcome> {
  if (!navigator.onLine) {
    return { ok: false, pushed: 0, pulled: 0, seq: 0, message: 'Offline. The mirror will catch up later.' }
  }

  const state = await getSyncState()
  let since = state.lastServerSeq
  let pushed = 0
  let pulled = 0

  try {
    const pending = await collectPendingRows()

    // The outbox may hold more than one request's worth, so the rows are sent
    // in batches and each batch's entries are cleared only once the server has
    // acknowledged them.
    const batches = buildBatches(pending)

    for (const batch of batches.length > 0 ? batches : [null]) {
      let rounds = 0
      let hasMore = true
      // The batch's rows are sent on the first round only; every further
      // round in this batch's pull loop carries an empty change set, so the
      // same rows are never re-posted while more of the server's backlog is
      // still being pulled down.
      let sent = false

      while (hasMore && rounds < MAX_ROUNDS_PER_RUN) {
        rounds += 1

        const response = await fetch(`${baseUrl}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${identity.licenseKey}`,
          },
          body: JSON.stringify({
            since,
            changes: !sent && batch ? batch.changes : EMPTY_CHANGES,
          }),
        })

        if (response.status === 401) {
          await saveSyncState({ lastError: 'The mirror rejected this Hunter License Key.' })
          return {
            ok: false,
            pushed,
            pulled,
            seq: since,
            message: 'The mirror rejected this Hunter License Key.',
          }
        }
        if (response.status === 429) {
          await saveSyncState({ lastError: 'Rate limited by the mirror.' })
          return { ok: false, pushed, pulled, seq: since, message: 'Rate limited. Will retry later.' }
        }
        if (!response.ok) {
          await saveSyncState({ lastError: `Mirror returned ${response.status}.` })
          return {
            ok: false,
            pushed,
            pulled,
            seq: since,
            message: `The mirror returned ${response.status}.`,
          }
        }

        const parsed = SyncResponseSchema.safeParse(await response.json())
        if (!parsed.success) {
          await saveSyncState({ lastError: 'Unreadable response from the mirror.' })
          return {
            ok: false,
            pushed,
            pulled,
            seq: since,
            message: 'The mirror sent something unreadable.',
          }
        }

        const applied = await applyRemoteRows(parsed.data.rows)
        pulled += applied.sessions + applied.sets + applied.bodyMetrics
        since = Math.max(since, parsed.data.seq)
        hasMore = parsed.data.hasMore

        // Only clear the outbox once the server has taken the rows, and only
        // once per batch: `pushed` counts what this device actually handed
        // over, not the server's per-round echo of it.
        if (!sent && batch) {
          await clearOutboxEntries(batch.entryIds)
          pushed += batch.entryIds.length
          sent = true
        }
      }
    }

    await saveSyncState({
      lastServerSeq: since,
      lastSyncedAt: Date.now(),
      hunterId: identity.hunterId,
      lastError: null,
    })

    return { ok: true, pushed, pulled, seq: since }
  } catch {
    // Never log the error object: a failed request can carry the body.
    await saveSyncState({ lastError: 'Could not reach the mirror.' })
    return { ok: false, pushed, pulled, seq: since, message: 'Could not reach the mirror.' }
  }
}

/** A row on the wire: the id the Worker indexes by, and the row pre-serialised
 *  by the client. The Worker stores `json` verbatim and never parses it. */
interface WireRow {
  id: string
  json: string
}

interface Batch {
  entryIds: string[]
  changes: {
    sessions: WireRow[]
    sets: WireRow[]
    bodyMetrics: WireRow[]
  }
}

/**
 * Splits the outbox into request-sized batches, keeping each row paired with
 * the outbox entry that will be cleared once it lands.
 */
function buildBatches(pending: Awaited<ReturnType<typeof collectPendingRows>>): Batch[] {
  const items: { entryId: string; kind: 'sessions' | 'sets' | 'bodyMetrics'; row: WireRow }[] = [
    ...pending.sessions.map((row) => ({
      entryId: `sessions:${row.id}`,
      kind: 'sessions' as const,
      row: { id: row.id, json: JSON.stringify(row) },
    })),
    ...pending.sets.map((row) => ({
      entryId: `sets:${row.id}`,
      kind: 'sets' as const,
      row: { id: row.id, json: JSON.stringify(row) },
    })),
    ...pending.bodyMetrics.map((row) => ({
      entryId: `bodyMetrics:${row.id}`,
      kind: 'bodyMetrics' as const,
      row: { id: row.id, json: JSON.stringify(row) },
    })),
  ]

  return chunk(items, MAX_ROWS_PER_REQUEST).map((group) => {
    const batch: Batch = {
      entryIds: group.map((item) => item.entryId),
      changes: { sessions: [], sets: [], bodyMetrics: [] },
    }
    for (const item of group) batch.changes[item.kind].push(item.row)
    return batch
  })
}

/** Deletes the mirror's copy. The device keeps its own log either way. */
export async function forgetMirror(identity: Identity, baseUrl = ''): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/forget-me`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${identity.licenseKey}` },
    })
    if (response.ok) await saveSyncState({ lastServerSeq: 0, lastSyncedAt: null, lastError: null })
    return response.ok
  } catch {
    return false
  }
}

/** The VAPID public key, fetched rather than bundled so it can be rotated. */
export async function fetchPushKey(identity: Identity, baseUrl = ''): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/api/push/key`, {
      headers: { Authorization: `Bearer ${identity.licenseKey}` },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { publicKey?: string }
    return body.publicKey ?? null
  } catch {
    return null
  }
}

export async function registerPushSubscription(
  identity: Identity,
  subscription: PushSubscription,
  baseUrl = '',
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${identity.licenseKey}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function removePushSubscription(
  identity: Identity,
  endpoint: string,
  baseUrl = '',
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${identity.licenseKey}`,
      },
      body: JSON.stringify({ endpoint }),
    })
    return response.ok
  } catch {
    return false
  }
}
