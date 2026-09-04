/**
 * Protocol-level tests for /api/sync, run against a hand-written in-memory D1
 * stand-in rather than `wrangler dev` — there is no Workers runtime available
 * to a plain `vitest` process. The fake implements exactly the handful of
 * query shapes `worker/index.ts` issues, keyed by matching on the SQL text.
 *
 * These prove the C4 protocol change specifically: that a pushed row's exact
 * bytes come back byte-identical on pull (proving the Worker concatenates
 * rather than parses-and-reserialises), that a malformed row is rejected
 * before anything is written, and that the response-byte cap truncates a
 * pull without skipping or duplicating a row.
 */
import { describe, expect, it } from 'vitest'
import worker, { type Env } from './index'
import { MAX_PAYLOAD_BYTES, MAX_RESPONSE_BYTES } from './limits'

type Row = { hunter_id: string; kind: string; row_id: string; payload: string }

class FakeD1 {
  events: (Row & { seq: number })[] = []
  private hunters = new Map<string, { created_at: number; last_seen_at: number }>()
  private rateLimits = new Map<string, number>()
  private nextSeq = 1

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql)
  }

  async batch(statements: FakeStatement[]): Promise<unknown[]> {
    const out: unknown[] = []
    for (const statement of statements) out.push(await statement.run())
    return out
  }

  runRateLimit(hunterId: string, windowStart: number): { count: number } {
    const key = `${hunterId}:${windowStart}`
    const count = (this.rateLimits.get(key) ?? 0) + 1
    this.rateLimits.set(key, count)
    return { count }
  }

  upsertHunter(hunterId: string, now: number): void {
    const existing = this.hunters.get(hunterId)
    this.hunters.set(hunterId, { created_at: existing?.created_at ?? now, last_seen_at: now })
  }

  insertEvents(rows: Omit<Row, never>[]): void {
    for (const row of rows) {
      const dupe = this.events.some(
        (e) => e.hunter_id === row.hunter_id && e.kind === row.kind && e.row_id === row.row_id,
      )
      if (dupe) continue
      this.events.push({ ...row, seq: this.nextSeq })
      this.nextSeq += 1
    }
  }

  selectEvents(hunterId: string, since: number, limit: number): (Row & { seq: number })[] {
    return this.events
      .filter((e) => e.hunter_id === hunterId && e.seq > since)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
  }
}

class FakeStatement {
  private args: unknown[] = []

  constructor(
    private readonly db: FakeD1,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): this {
    this.args = args
    return this
  }

  async run(): Promise<{ success: true }> {
    if (this.sql.includes('INSERT INTO hunters')) {
      this.db.upsertHunter(this.args[0] as string, this.args[1] as number)
    } else if (this.sql.includes('INSERT INTO events')) {
      const rows: Row[] = []
      for (let i = 0; i < this.args.length; i += 5) {
        rows.push({
          hunter_id: this.args[i] as string,
          kind: this.args[i + 1] as string,
          row_id: this.args[i + 2] as string,
          payload: this.args[i + 3] as string,
        })
      }
      this.db.insertEvents(rows)
    } else {
      throw new Error(`FakeD1: unhandled statement in run(): ${this.sql}`)
    }
    return { success: true }
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes('INSERT INTO rate_limits')) {
      return this.db.runRateLimit(this.args[0] as string, this.args[1] as number) as T
    }
    throw new Error(`FakeD1: unhandled statement in first(): ${this.sql}`)
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes('SELECT seq, kind, payload FROM events')) {
      const results = this.db.selectEvents(
        this.args[0] as string,
        this.args[1] as number,
        this.args[2] as number,
      )
      return { results: results as T[] }
    }
    throw new Error(`FakeD1: unhandled statement in all(): ${this.sql}`)
  }
}

function makeEnv(): { env: Env; db: FakeD1 } {
  const db = new FakeD1()
  return { env: { DB: db as unknown as Env['DB'], ASSETS: {} as Fetcher }, db }
}

const AUTH = { Authorization: 'Bearer TESTTESTTESTTESTTESTTEST' }

function syncRequest(body: unknown): Request {
  return new Request('https://example.com/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...AUTH },
    body: JSON.stringify(body),
  })
}

describe('POST /api/sync', () => {
  it('round-trips a pushed row byte-identical to what was sent, under the "received" field name', async () => {
    const { env } = makeEnv()
    const original = { id: 'set-1', sessionId: 's1', weight: 100, reps: 5, note: 'exact bytes, not reformatted' }
    const wireJson = JSON.stringify(original)

    const pushResponse = await worker.fetch(
      syncRequest({ since: 0, changes: { sessions: [], sets: [{ id: 'set-1', json: wireJson }], bodyMetrics: [] } }),
      env,
    )
    expect(pushResponse.status).toBe(200)
    const pushBody = (await pushResponse.json()) as { received: number; seq: number }
    expect(pushBody.received).toBe(1)
    expect(pushBody.seq).toBe(1)

    const pullResponse = await worker.fetch(syncRequest({ since: 0, changes: {} }), env)
    const rawText = await pullResponse.text()
    // Byte-identical: the exact string sent appears verbatim in the response,
    // which only concatenation (never a parse-then-reserialise) can produce.
    expect(rawText).toContain(wireJson)
  })

  it('rejects a malformed row payload with 400 before writing anything', async () => {
    const { env, db } = makeEnv()

    const response = await worker.fetch(
      syncRequest({ since: 0, changes: { sessions: [], sets: [{ id: 'bad-1', json: '"not json' }], bodyMetrics: [] } }),
      env,
    )

    expect(response.status).toBe(400)
    expect(db.events).toHaveLength(0)
  })

  it('resending the same rows does not advance seq (dedupe still works)', async () => {
    const { env } = makeEnv()
    const row = { id: 'set-1', json: JSON.stringify({ id: 'set-1' }) }
    const changes = { sessions: [], sets: [row], bodyMetrics: [] }

    const first = await worker.fetch(syncRequest({ since: 0, changes }), env)
    const firstBody = (await first.json()) as { seq: number; received: number }
    expect(firstBody.received).toBe(1)
    expect(firstBody.seq).toBe(1)

    const second = await worker.fetch(syncRequest({ since: 0, changes }), env)
    const secondBody = (await second.json()) as { seq: number; received: number }
    expect(secondBody.received).toBe(1)
    expect(secondBody.seq).toBe(1)
  })

  it('stops a pull once accumulated bytes cross the response cap, and resumes with no gap or duplicate', async () => {
    const { env } = makeEnv()

    // Enough near-ceiling rows that the pull cannot return them all in one
    // response within MAX_RESPONSE_BYTES, without exceeding MAX_ROWS_PER_REQUEST.
    const rowCount = Math.floor(MAX_RESPONSE_BYTES / MAX_PAYLOAD_BYTES) + 4
    const rows = Array.from({ length: rowCount }, (_, i) => {
      const payload = { id: `set-${i}`, pad: 'x'.repeat(MAX_PAYLOAD_BYTES - 40) }
      return { id: payload.id, json: JSON.stringify(payload) }
    })

    const pushResponse = await worker.fetch(
      syncRequest({ since: 0, changes: { sessions: [], sets: rows, bodyMetrics: [] } }),
      env,
    )
    expect(pushResponse.status).toBe(200)

    const seenIds = new Set<string>()
    let since = 0
    let rounds = 0

    while (rounds < 10) {
      rounds += 1
      const response = await worker.fetch(syncRequest({ since, changes: {} }), env)
      const body = (await response.json()) as {
        seq: number
        hasMore: boolean
        rows: { sets: { id: string }[] }
      }
      for (const set of body.rows.sets) {
        expect(seenIds.has(set.id)).toBe(false) // never duplicated
        seenIds.add(set.id)
      }
      since = body.seq
      if (!body.hasMore) break
    }

    expect(rounds).toBeGreaterThan(1) // proves the byte cap actually truncated
    expect(seenIds.size).toBe(rowCount) // and nothing was skipped
  })
})
