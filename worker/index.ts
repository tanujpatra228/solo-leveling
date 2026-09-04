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
import {
  MAX_PAYLOAD_BYTES,
  MAX_RESPONSE_BYTES,
  MAX_ROWS_PER_REQUEST,
  MAX_ROWS_RETURNED,
  RATE_MAX_REQUESTS,
  RATE_WINDOW_SECONDS,
  ROWS_PER_STATEMENT,
} from './limits'
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

const app = new Hono<{ Bindings: Env; Variables: { hunterId: string } }>()

/* ------------------------------------------------------------------ */
/* Validation at the boundary                                          */
/* ------------------------------------------------------------------ */

/**
 * The Worker validates the envelope and treats each row as an opaque,
 * pre-serialised string. It deliberately does not re-validate the shape of a
 * session or a set: the client that wrote the row already did, the client
 * that reads it back validates again, and a schema copy here would be a
 * second definition to keep in step. Storing the row verbatim rather than as
 * a parsed object tree means the Worker never spends CPU re-serialising data
 * it never reads.
 */
const RowSchema = z.object({
  id: z.string().min(1).max(200),
  json: z.string().min(2).max(MAX_PAYLOAD_BYTES),
})

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
    endpoint: z.url().max(1000),
    keys: z.object({
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
    }),
  }),
})

const UnsubscribeSchema = z.object({ endpoint: z.url().max(1000) })

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

  const incoming: { kind: RowKind; row: { id: string; json: string } }[] = [
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

  // The response is built by concatenating stored payloads verbatim, which is
  // only safe if every payload in D1 is well-formed JSON. Zod already bounded
  // the size and type of `json`; this confirms it actually parses, so a
  // malformed row can never wedge a future pull for this hunter. The parsed
  // value itself is discarded — the Worker never looks inside a row.
  for (const { row } of incoming) {
    try {
      JSON.parse(row.json)
    } catch {
      return c.json({ error: 'Malformed sync request.' }, 400)
    }
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
      bindings.push(hunterId, kind, row.id, row.json, now)
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

  // Every stored payload was checked as valid JSON on the way in, so the
  // response is built by concatenation rather than parse-then-reserialise.
  const sessions: string[] = []
  const sets: string[] = []
  const bodyMetrics: string[] = []
  let highestSeq = since
  let responseBytes = 0
  let truncated = false

  for (const result of results ?? []) {
    // A row cap alone does not bound CPU: this also stops once the response
    // would get too large to build inside the CPU budget. The sequence cursor
    // only advances for rows actually emitted, so the next pull resumes
    // exactly here — no row is skipped and none is sent twice.
    if (responseBytes + result.payload.length > MAX_RESPONSE_BYTES) {
      truncated = true
      break
    }
    if (result.kind === 'session') sessions.push(result.payload)
    else if (result.kind === 'set') sets.push(result.payload)
    else bodyMetrics.push(result.payload)
    responseBytes += result.payload.length
    highestSeq = result.seq
  }

  const hasMore = truncated || (results?.length ?? 0) === MAX_ROWS_RETURNED

  const body =
    `{"seq":${highestSeq},"received":${incoming.length},"hasMore":${hasMore},"rows":{` +
    `"sessions":[${sessions.join(',')}],` +
    `"sets":[${sets.join(',')}],` +
    `"bodyMetrics":[${bodyMetrics.join(',')}]}}`

  return new Response(body, { headers: { 'content-type': 'application/json' } })
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

  const { subscription } = parsed.data
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions
       (endpoint, hunter_id, p256dh, auth, created_at, failure_count)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT (endpoint) DO UPDATE SET
       hunter_id = excluded.hunter_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       failure_count = 0`,
  )
    .bind(subscription.endpoint, hunterId, subscription.keys.p256dh, subscription.keys.auth, Date.now())
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
