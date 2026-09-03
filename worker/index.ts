/**
 * The Worker. A sync mirror and one daily push, and nothing else.
 *
 * It does not compute progression, it does not hold state the client depends
 * on, and it never becomes a dependency: with this Worker unreachable the app
 * still logs sessions, still computes targets, and still levels up.
 *
 * Written against the free plan's 10 ms CPU budget per invocation, so there is
 * no password hashing, no large JSON transform, and a hard cap on the number of
 * rows and D1 statements per request.
 */
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import * as z from 'zod'
import { authenticate } from './identity'
import { sendDailyQuestPush } from './push'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /** Set with `wrangler secret put`. Never present in the client bundle. */
  VAPID_PRIVATE_KEY?: string
  /** Public by design; the client needs it to subscribe. */
  VAPID_PUBLIC_KEY?: string
  VAPID_SUBJECT?: string
}

/**
 * D1 allows 50 queries per Worker invocation, so rows are inserted in
 * multi-row statements and the request is capped. The client loops until its
 * outbox is empty rather than sending everything at once.
 */
const MAX_ROWS_PER_REQUEST = 200
const ROWS_PER_STATEMENT = 20
const MAX_ROWS_RETURNED = 500

/** Fixed-window rate limit, counted in D1 because KV allows 1,000 writes a day. */
const RATE_WINDOW_SECONDS = 900
const RATE_MAX_REQUESTS = 120

const app = new Hono<{ Bindings: Env; Variables: { hunterId: string } }>()

/* ------------------------------------------------------------------ */
/* Validation at the boundary                                          */
/* ------------------------------------------------------------------ */

/**
 * The Worker validates the envelope and treats each row as opaque JSON. It
 * deliberately does not re-validate the shape of a session or a set: the client
 * that wrote the row already did, the client that reads it back validates
 * again, and a schema copy here would be a second definition to keep in step.
 */
const RowSchema = z.object({ id: z.string().min(1).max(200) }).loose()

const SyncRequestSchema = z.object({
  since: z.number().int().nonnegative().default(0),
  changes: z
    .object({
      sessions: z.array(RowSchema).default([]),
      sets: z.array(RowSchema).default([]),
      bodyMetrics: z.array(RowSchema).default([]),
    })
    .default({ sessions: [], sets: [], bodyMetrics: [] }),
})

const SubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
    }),
  }),
  notifyMinute: z.number().int().min(0).max(1439).default(480),
  tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
})

const UnsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) })

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

app.use('/api/*', async (c, next) => {
  // No request body is ever logged. Bodies carry bodyweight, waist
  // measurements and body-fat readings, which is health data.
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
})

/** Health check needs no identity, so it sits above the auth middleware. */
app.get('/api/health', (c) => c.json({ ok: true }))

/**
 * Turns the bearer token into a hunter id and applies the rate limit. Every
 * authenticated route goes through here, so neither step can be forgotten on a
 * route added later.
 */
const authGuard = createMiddleware<{ Bindings: Env; Variables: { hunterId: string } }>(
  async (c, next) => {
    const hunterId = await authenticate(c.req.raw)
    if (!hunterId) {
      return c.json({ error: 'A valid Hunter License Key is required.' }, 401)
    }
    c.set('hunterId', hunterId)

    if (await consumeRateLimit(c.env.DB, hunterId)) {
      return c.json({ error: 'Too many requests. Try again shortly.' }, 429)
    }

    await next()
    return undefined
  },
)

app.use('/api/sync', authGuard)
app.use('/api/push/*', authGuard)

/**
 * Fixed-window counter. A fixed window rather than a sliding one because it is
 * two statements instead of a scan, and this is a single-user mirror where the
 * limit exists to bound abuse rather than to shape traffic precisely.
 */
async function consumeRateLimit(db: D1Database, hunterId: string): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS) * RATE_WINDOW_SECONDS

  const row = await db
    .prepare(
      `INSERT INTO rate_limits (hunter_id, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (hunter_id, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(hunterId, windowStart)
    .first<{ count: number }>()

  return (row?.count ?? 0) > RATE_MAX_REQUESTS
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

type RowKind = 'session' | 'set' | 'bodyMetric'

app.post('/api/sync', async (c) => {
  const hunterId = c.get('hunterId')

  const parsed = SyncRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Malformed sync request.' }, 400)
  }
  const { since, changes } = parsed.data

  const incoming: { kind: RowKind; row: { id: string } }[] = [
    ...changes.sessions.map((row) => ({ kind: 'session' as const, row })),
    ...changes.sets.map((row) => ({ kind: 'set' as const, row })),
    ...changes.bodyMetrics.map((row) => ({ kind: 'bodyMetric' as const, row })),
  ]

  if (incoming.length > MAX_ROWS_PER_REQUEST) {
    return c.json(
      {
        error: `Too many rows in one request. Send at most ${MAX_ROWS_PER_REQUEST}.`,
        maxRows: MAX_ROWS_PER_REQUEST,
      },
      413,
    )
  }

  const now = Date.now()
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO hunters (hunter_id, created_at, last_seen_at) VALUES (?, ?, ?)
       ON CONFLICT (hunter_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    ).bind(hunterId, now, now),
  ]

  // Rows go in as multi-row statements so a couple of hundred rows costs a
  // handful of the 50 queries allowed per invocation rather than all of them.
  for (let i = 0; i < incoming.length; i += ROWS_PER_STATEMENT) {
    const chunk = incoming.slice(i, i + ROWS_PER_STATEMENT)
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')
    const bindings: unknown[] = []
    for (const { kind, row } of chunk) {
      bindings.push(hunterId, kind, row.id, JSON.stringify(row), now)
    }
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO events (hunter_id, kind, row_id, payload, created_at)
         VALUES ${placeholders}
         ON CONFLICT (hunter_id, kind, row_id) DO NOTHING`,
      ).bind(...bindings),
    )
  }

  if (statements.length > 1) await c.env.DB.batch(statements)
  else await statements[0]!.run()

  // Rows the caller has not seen. Scoped to this hunter, so the global sequence
  // is a strictly increasing subsequence from the caller's point of view.
  const { results } = await c.env.DB.prepare(
    `SELECT seq, kind, payload FROM events
     WHERE hunter_id = ? AND seq > ?
     ORDER BY seq ASC LIMIT ?`,
  )
    .bind(hunterId, since, MAX_ROWS_RETURNED)
    .all<{ seq: number; kind: RowKind; payload: string }>()

  const rows: { sessions: unknown[]; sets: unknown[]; bodyMetrics: unknown[] } = {
    sessions: [],
    sets: [],
    bodyMetrics: [],
  }
  let highestSeq = since

  for (const result of results ?? []) {
    if (result.seq > highestSeq) highestSeq = result.seq
    let payload: unknown
    try {
      payload = JSON.parse(result.payload)
    } catch {
      continue
    }
    if (result.kind === 'session') rows.sessions.push(payload)
    else if (result.kind === 'set') rows.sets.push(payload)
    else rows.bodyMetrics.push(payload)
  }

  return c.json({
    seq: highestSeq,
    applied: incoming.length,
    rows,
    // True when there is more waiting, so the client knows to go round again.
    hasMore: (results?.length ?? 0) === MAX_ROWS_RETURNED,
  })
})

/* ------------------------------------------------------------------ */
/* Push subscription                                                   */
/* ------------------------------------------------------------------ */

app.get('/api/push/key', (c) => {
  // The public key is public by definition. Served rather than baked into the
  // bundle so a key rotation does not need a rebuild.
  const key = c.env.VAPID_PUBLIC_KEY
  if (!key) return c.json({ error: 'Push is not configured on this deployment.' }, 503)
  return c.json({ publicKey: key })
})

app.post('/api/push/subscribe', async (c) => {
  const hunterId = c.get('hunterId')
  const parsed = SubscribeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Malformed subscription.' }, 400)

  const { subscription, notifyMinute, tzOffsetMinutes } = parsed.data
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions
       (endpoint, hunter_id, p256dh, auth, notify_minute, tz_offset_min, created_at, failure_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT (endpoint) DO UPDATE SET
       hunter_id = excluded.hunter_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       notify_minute = excluded.notify_minute,
       tz_offset_min = excluded.tz_offset_min,
       failure_count = 0`,
  )
    .bind(
      subscription.endpoint,
      hunterId,
      subscription.keys.p256dh,
      subscription.keys.auth,
      notifyMinute,
      tzOffsetMinutes,
      Date.now(),
    )
    .run()

  return c.json({ ok: true })
})

app.post('/api/push/unsubscribe', async (c) => {
  const hunterId = c.get('hunterId')
  const parsed = UnsubscribeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Malformed request.' }, 400)

  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND hunter_id = ?`)
    .bind(parsed.data.endpoint, hunterId)
    .run()

  return c.json({ ok: true })
})

/**
 * Deletes everything the mirror holds for this hunter. The device keeps its own
 * copy, so this removes the mirror rather than the training history.
 */
app.post('/api/forget-me', async (c) => {
  const hunterId = await authenticate(c.req.raw)
  if (!hunterId) return c.json({ error: 'A valid Hunter License Key is required.' }, 401)

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM events WHERE hunter_id = ?`).bind(hunterId),
    c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE hunter_id = ?`).bind(hunterId),
    c.env.DB.prepare(`DELETE FROM rate_limits WHERE hunter_id = ?`).bind(hunterId),
    c.env.DB.prepare(`DELETE FROM hunters WHERE hunter_id = ?`).bind(hunterId),
  ])

  return c.json({ ok: true })
})

app.all('/api/*', (c) => c.json({ error: 'No such endpoint.' }, 404))

export default {
  fetch: app.fetch,

  /**
   * The daily quest nudge. Runs every fifteen minutes and sends to whichever
   * subscriptions have reached their chosen local time in this window, so one
   * cron trigger serves every timezone.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sendDailyQuestPush(env))
  },
} satisfies ExportedHandler<Env>
