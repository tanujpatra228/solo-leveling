/**
 * Resource bounds for the Worker.
 *
 * Two kinds of number live here, and the file's whole point is keeping them
 * apart: what Cloudflare documents, and what we chose to sit under it.
 *
 * Dependency-free, exactly like `worker/schedule.ts` was, which is what lets
 * `limits.test.ts` import it without dragging in Hono, `web-push`, or the
 * Cloudflare type globals.
 */

/* ---- Documented Cloudflare limits. Not ours to choose. ---- */
/** D1: maximum bound parameters per query. */
export const D1_MAX_BOUND_PARAMS = 100
/** D1: maximum queries per Worker invocation. */
export const D1_MAX_QUERIES_PER_INVOCATION = 50
/** D1: maximum SQL statement length in bytes, including bound values. */
export const D1_MAX_STATEMENT_BYTES = 100_000
/** Workers free plan: maximum subrequests per invocation. */
export const WORKER_MAX_SUBREQUESTS = 50

/* ---- Our own bounds, chosen to sit under those. ---- */

/** Rows accepted in one /api/sync push. */
export const MAX_ROWS_PER_REQUEST = 200
/** Rows bound into one multi-row insert statement. */
export const ROWS_PER_STATEMENT = 16
/** Bound parameters per row: hunter_id, kind, row_id, payload, created_at. */
export const PARAMS_PER_ROW = 5
/** A stored row's JSON payload, in bytes. An abuse ceiling, not an expected size. */
export const MAX_PAYLOAD_BYTES = 4096
/** Rows returned from one pull. Matches the request cap, so both directions
 *  of the protocol are bounded by the same number. */
export const MAX_ROWS_RETURNED = 200
/** Accumulated payload bytes per pull response, before it reports hasMore
 *  and stops rather than building an oversized string inside the CPU budget. */
export const MAX_RESPONSE_BYTES = 131_072

/** Fixed-window rate limit, counted in D1 rather than KV. */
export const RATE_WINDOW_SECONDS = 900
export const RATE_MAX_REQUESTS = 120

/** Push sends per cron invocation. Bounded by CPU cost (four crypto
 *  operations per send), not by the subrequest count. */
export const MAX_SUBSCRIPTIONS_PER_RUN = 8
/** Consecutive delivery failures before a subscription is deleted. */
export const MAX_FAILURES = 3
/** A subscription is not sent to twice inside this many hours. */
export const MIN_HOURS_BETWEEN_SENDS = 12
