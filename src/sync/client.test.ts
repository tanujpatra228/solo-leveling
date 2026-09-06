/**
 * Regression test for the resend defect (C11): a pull loop that keeps going
 * round for more of the server's backlog must not keep re-posting the same
 * outbox batch. `fetch` is stubbed to demand three rounds, and the request
 * bodies of round two and three are asserted to carry no rows at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toDayKey } from '../domain/time'
import { DAILY_REQUEST_CAP, runSync } from './client'
import type { Identity } from './identity'

const repoMocks = vi.hoisted(() => ({
  applyRemoteRows: vi.fn(async () => ({ sessions: 0, sets: 0, bodyMetrics: 0 })),
  clearOutboxEntries: vi.fn(async () => undefined),
  collectPendingRows: vi.fn(async () => ({
    entryIds: ['sessions:s1'],
    sessions: [{ id: 's1' }],
    sets: [],
    bodyMetrics: [],
  })),
  getSyncState: vi.fn(async () => ({
    id: 'state' as const,
    lastServerSeq: 0,
    lastSyncedAt: null as number | null,
    hunterId: null as string | null,
    lastError: null as string | null,
    requestsToday: 0,
    requestsDayKey: '',
  })),
  saveSyncState: vi.fn(async () => undefined),
}))

vi.mock('../db/repo', () => repoMocks)

const identity: Identity = {
  secret: new Uint8Array(15),
  licenseKey: 'TESTTESTTESTTESTTESTTEST',
  hunterId: 'hunter-1',
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

interface SyncRequestBody {
  since: number
  changes: { sessions: unknown[]; sets: unknown[]; bodyMetrics: unknown[] }
}

describe('runSync', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true })
    repoMocks.clearOutboxEntries.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the outbox batch once, then pulls the rest with empty change sets', async () => {
    const bodies: SyncRequestBody[] = []
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(init!.body as string) as SyncRequestBody)
      const round = bodies.length
      if (round === 1) {
        return jsonResponse({
          seq: 1,
          received: 1,
          hasMore: true,
          rows: { sessions: [], sets: [], bodyMetrics: [] },
        })
      }
      if (round === 2) {
        return jsonResponse({
          seq: 2,
          received: 0,
          hasMore: true,
          rows: { sessions: [], sets: [], bodyMetrics: [] },
        })
      }
      return jsonResponse({
        seq: 3,
        received: 0,
        hasMore: false,
        rows: { sessions: [], sets: [], bodyMetrics: [] },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await runSync(identity)

    expect(fetchMock).toHaveBeenCalledTimes(3)

    // Round one carries the batch's row.
    expect(bodies[0]!.changes.sessions).toHaveLength(1)
    expect(bodies[0]!.changes.sessions[0]).toMatchObject({ id: 's1' })

    // Rounds two and three are pull-only: no row is re-posted.
    expect(bodies[1]!.changes).toEqual({ sessions: [], sets: [], bodyMetrics: [] })
    expect(bodies[2]!.changes).toEqual({ sessions: [], sets: [], bodyMetrics: [] })

    // The outbox is cleared once, not once per round.
    expect(repoMocks.clearOutboxEntries).toHaveBeenCalledTimes(1)
    expect(repoMocks.clearOutboxEntries).toHaveBeenCalledWith(['sessions:s1'])

    // `pushed` is the local count of rows handed over, not the server's
    // per-round echo of `received`, which would have summed to 1 anyway here
    // but would double- or triple-count if the old nested loop still ran.
    expect(outcome.pushed).toBe(1)
    expect(outcome.ok).toBe(true)
    expect(outcome.seq).toBe(3)
  })
})

describe('the daily request budget (F5)', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stops a runaway client before a single request goes out once today\'s cap is already spent', async () => {
    repoMocks.getSyncState.mockResolvedValueOnce({
      id: 'state' as const,
      lastServerSeq: 0,
      lastSyncedAt: null,
      hunterId: null,
      lastError: null,
      requestsToday: DAILY_REQUEST_CAP,
      requestsDayKey: toDayKey(Date.now()),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await runSync(identity)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain('Daily sync request budget reached')
  })

  it('starts a fresh budget once the stored day key is not today', async () => {
    repoMocks.getSyncState.mockResolvedValueOnce({
      id: 'state' as const,
      lastServerSeq: 0,
      lastSyncedAt: null,
      hunterId: null,
      lastError: null,
      requestsToday: DAILY_REQUEST_CAP,
      requestsDayKey: '2000-01-01',
    })
    const fetchMock = vi.fn(async () =>
      jsonResponse({ seq: 1, received: 1, hasMore: false, rows: { sessions: [], sets: [], bodyMetrics: [] } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await runSync(identity)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome.ok).toBe(true)
  })
})
