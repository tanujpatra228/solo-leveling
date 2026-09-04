/**
 * Asserts our bounds sit under Cloudflare's documented limits, with margin.
 *
 * The platform limits are written here as literals rather than imported, so
 * each assertion is a claim about the platform rather than a tautology. This
 * test caught the 100-bound-parameter problem once already; its job is to
 * catch the next person who raises a constant without opening the
 * documentation.
 */
import { describe, expect, it } from 'vitest'
import { MAX_ROWS_PER_REQUEST as CLIENT_MAX_ROWS_PER_REQUEST } from '../src/sync/client'
import {
  D1_MAX_BOUND_PARAMS,
  D1_MAX_QUERIES_PER_INVOCATION,
  D1_MAX_STATEMENT_BYTES,
  MAX_PAYLOAD_BYTES,
  MAX_ROWS_PER_REQUEST,
  MAX_ROWS_RETURNED,
  MAX_SUBSCRIPTIONS_PER_RUN,
  PARAMS_PER_ROW,
  ROWS_PER_STATEMENT,
  WORKER_MAX_SUBREQUESTS,
} from './limits'

describe('worker/limits.ts stays under documented Cloudflare limits', () => {
  it('bound parameters per insert statement', () => {
    expect(ROWS_PER_STATEMENT * PARAMS_PER_ROW).toBeLessThanOrEqual(100)
    expect(ROWS_PER_STATEMENT * PARAMS_PER_ROW).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS)
  })

  it('D1 statements per /api/sync invocation', () => {
    // 1 rate-limit upsert + 1 hunter upsert + N inserts + 1 select.
    const inserts = Math.ceil(MAX_ROWS_PER_REQUEST / ROWS_PER_STATEMENT)
    const total = inserts + 3
    expect(total).toBeLessThanOrEqual(50)
    expect(total).toBeLessThanOrEqual(D1_MAX_QUERIES_PER_INVOCATION)
  })

  it('statement bytes per insert, assuming bound values count toward the limit', () => {
    // 1024 bytes of headroom for the SQL text and the non-payload columns.
    const bytes = ROWS_PER_STATEMENT * MAX_PAYLOAD_BYTES + 1024
    expect(bytes).toBeLessThanOrEqual(100_000)
    expect(bytes).toBeLessThanOrEqual(D1_MAX_STATEMENT_BYTES)
  })

  it('subrequests per cron run', () => {
    // MAX_SUBSCRIPTIONS_PER_RUN sends plus a handful of D1 statements.
    const total = MAX_SUBSCRIPTIONS_PER_RUN + 4
    expect(total).toBeLessThanOrEqual(50)
    expect(total).toBeLessThanOrEqual(WORKER_MAX_SUBREQUESTS)
  })

  it('rows returned from a pull never exceed rows accepted by a push', () => {
    expect(MAX_ROWS_RETURNED).toBeLessThanOrEqual(MAX_ROWS_PER_REQUEST)
  })

  it('the client and the Worker agree on the request cap', () => {
    expect(CLIENT_MAX_ROWS_PER_REQUEST).toBe(MAX_ROWS_PER_REQUEST)
  })
})
