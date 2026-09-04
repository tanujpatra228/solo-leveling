# M1 — Foundations and corrections

The first milestone of the implementation plan. It writes no features and no user interface. It
lands the eleven corrections found by actually running the Worker, extracts the resource bounds into
one file, and adds the test that stops a future edit from quietly walking past a Cloudflare limit.

Everything here is a change to code that already exists. Nothing here adds a service, a binding, a
dependency, or a resource cost.

---

## 1. What M1 is, and what it is not

**It is:** eleven corrections, one new dependency-free module (`worker/limits.ts`), one new test
file, and a refactor of one client function.

**It is not:** the build going green. `index.html` points at `/src/main.tsx`, which does not exist,
so `pnpm run build` fails today and still fails after M1. That is M2's job. M1 is verified through
`pnpm run typecheck`, `pnpm vitest run`, and `wrangler dev` — all three of which work without the
client entry point, because `dist/` is already present from an earlier build.

**One user-visible consequence**, stated up front rather than buried inside C9: with a single daily
cron, the reminder time stops being a per-device setting and becomes a deploy-time constant. The
cron is set to `30 2 * * *` — 02:30 UTC, which is 08:00 IST. Changing the reminder hour becomes a
one-line edit and a redeploy. This is the direct consequence of dropping from 96 invocations a day
to 1, and it is why the `dailyQuestPushMinute` setting goes away.

---

## 2. Order of work

Seven commits, ordered so each one is independently verifiable and nothing is left half-changed
across a protocol boundary.

| # | Commit | Corrections | Why here |
|---|---|---|---|
| 1 | Config hygiene | C1, C2 | `wrangler dev` starts clean before anything else is judged |
| 2 | Extract the bounds, tighten them | C3, C6 | The guard test needs `worker/limits.ts` to exist |
| 3 | Zod 4 idiom | C8 | Trivial, same file as commit 2 |
| 4 | Sync protocol | C4, C5, C11 | Client and Worker must change in one commit |
| 5 | One daily cron | C9 | Touches schema, Worker, client and settings together |
| 6 | Delete the photo remnants | C10 | Pure deletion, no behaviour change |
| 7 | Stop re-reading the database | C7 | The largest client-side change, isolated last |

---

## 3. The corrections, one at a time

### C1 — `migrations_dir` sits at the wrong level

**File:** `wrangler.jsonc:40`

Wrangler warns *"Unexpected fields found in top-level field"*. The schema puts `migrations_dir`
inside each `d1_databases` entry, because it is a per-database property.

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "solo-leveling",
    "database_id": "REPLACE_WITH_D1_DATABASE_ID",
    "migrations_dir": "./migrations"
  }
]
```

**Verified by:** `wrangler dev` starting with no warning on stderr.

---

### C2 — `compatibility_date` is in the future

**File:** `wrangler.jsonc:10`

`2026-09-03` is newer than the bundled `workerd` supports, which caps at `2026-09-02`. The Worker
cannot start at all. Set it to `2026-09-02`.

This stays above `2026-08-04`, which is the date that makes `nodejs_compat` and `nodejs_compat_v2`
default-on — and that is the only reason `web-push` imports without an explicit flag. The comment in
the file already says so; it stays.

**Risk:** none. Compatibility dates are honoured indefinitely, so this never needs raising again
unless some specific new default is wanted.

---

### C3 — 20 rows per statement is exactly D1's parameter ceiling

**File:** `worker/index.ts:34`

Each row binds five parameters (`hunter_id`, `kind`, `row_id`, `payload`, `created_at`). Twenty rows
is 100 bound parameters, which is *exactly* D1's documented maximum. It works, and it has zero
headroom: adding a sixth column to `events` breaks sync at runtime, not at compile time.

Drop to **16 rows, 80 parameters** — a 20% margin.

Cost of the change: a 200-row request goes from 10 insert statements to 13. Total D1 statements per
sync invocation becomes 1 rate-limit + 1 hunter upsert + 13 inserts + 1 select = **16**, against a
limit of 50 queries and 50 subrequests per invocation. Comfortable.

---

### C4 — the Worker does three full JSON passes over health data

**Files:** `worker/index.ts`, `src/sync/client.ts`

Today, on one sync call, every row's contents are serialised or parsed three times:

1. `c.req.json()` parses the whole request body, including every row object.
2. `JSON.stringify(row)` re-serialises each row to store it.
3. `JSON.parse(result.payload)` parses every returned row, and then `c.json()` re-serialises all of
   them into the response.

In a 10 ms CPU budget, spending it re-serialising data the Worker never reads is the wrong trade.
The Worker's whole job is to move opaque rows; it should never look inside one.

**The change: rows cross the wire as pre-serialised strings.**

Request shape becomes:

```ts
const RowSchema = z.object({
  id: z.string().min(1).max(200),
  // The row, already serialised by the client. The Worker stores it verbatim.
  json: z.string().min(2).max(MAX_PAYLOAD_BYTES),
})
```

The push path then binds `row.json` straight into the insert — no `stringify`. The outer
`c.req.json()` still runs, but it now parses an envelope whose leaves are opaque strings rather than
object trees, which is strictly cheaper than parsing the same bytes as structure.

The pull path stops parsing entirely. Every stored payload is already valid JSON, so the response is
**concatenated, not serialised**:

```ts
const body =
  `{"seq":${highestSeq},"received":${incoming.length},"hasMore":${hasMore},"rows":{` +
  `"sessions":[${sessions.join(',')}],` +
  `"sets":[${sets.join(',')}],` +
  `"bodyMetrics":[${bodyMetrics.join(',')}]}}`

return new Response(body, { headers: { 'content-type': 'application/json' } })
```

**The invariant this depends on, and how it is kept.** Concatenation is only safe if every payload
in D1 is well-formed JSON. The Worker no longer parses on the way out, so it must guarantee validity
on the way in: each incoming `json` string is checked with `JSON.parse` inside a `try`, and the
result is thrown away. That costs roughly what the `JSON.stringify` it replaces cost, so the push
path is CPU-neutral and the pull path drops to near zero.

Without that check, a hunter holding a valid licence key could store `"not json"` and permanently
wedge their own pull response — recoverable only through `/api/forget-me`. Self-inflicted and
tenant-scoped, but cheap enough to prevent that there is no reason not to.

**Two new bounds fall out of this.**

`MAX_PAYLOAD_BYTES = 4096`. Today `RowSchema` is `.loose()` with no size bound at all, so a client
can send a one-megabyte row. A real `SetLog` is around 250 bytes; 4 KB is an abuse ceiling, not an
expected size. At 16 rows per statement that is 64 KB of parameters plus SQL text, against D1's
100 KB statement limit — and that assumes the limit counts bound values, which the documentation
does not say either way, so we take the stricter reading.

`MAX_RESPONSE_BYTES = 131_072`. A row cap alone does not bound CPU: 200 rows at the 4 KB ceiling
would mean building an 800 KB string inside a 10 ms budget. So the pull loop also stops once the
accumulated payload length crosses 128 KB and reports `hasMore: true`. Reading `payload.length` is
free, and `highestSeq` only advances for rows actually emitted, so the client's next cursor resumes
exactly where the response stopped. No row is skipped and none is sent twice.

`MAX_ROWS_RETURNED` drops from **500 to 200**, matching the request cap so both directions of the
protocol are bounded by the same number.

---

### C5 — `applied` reports something it does not measure

**Files:** `worker/index.ts:233`, `src/sync/client.ts:32,143`

The response field is named `applied`, but its value is `incoming.length` — the number of rows
*offered*. Because the insert is `ON CONFLICT DO NOTHING`, the number actually applied is often
smaller, and on a retry it is zero. A field that names one thing and returns another is the kind of
detail that gets trusted years later.

Rename to `received`. The client's `SyncResponseSchema` and its one read site change with it.

---

### C6 — 50 push sends in one invocation cannot fit in 10 ms

**Files:** `worker/schedule.ts:21`, `worker/push.ts`

`MAX_SUBSCRIPTIONS_PER_RUN` is 50. Subrequests are not the binding constraint — 50 sends plus four
D1 statements sits inside the 50-subrequest limit with nothing to spare — but the real problem is
CPU. Each `webpush.sendNotification` performs an ECDH key agreement, an HKDF derivation, an AES-GCM
encryption, and an ES256 JWT signature. That is four cryptographic operations per subscription
against a 10 ms total budget.

Drop to **8**. The number comes from the CPU cost, not the subrequest count. For one hunter with a
phone and a tablet it is more than ample, and if it ever needs to be larger the correct fix is to
spread sends across cron runs, not to raise the constant.

**Contentless payload: already correct.** `push.ts:53` sends `{ type: 'daily-quest' }` and nothing
else; the service worker composes the real text from IndexedDB on the device. No change needed — the
correction as originally written overstated the work.

**What does change** is how the 12-hour guard is enforced. With `isDue` gone (C9) the JS filter loop
disappears and the constraint moves into SQL:

```sql
SELECT endpoint, hunter_id, p256dh, auth, failure_count
FROM push_subscriptions
WHERE failure_count < ?
  AND (last_sent_at IS NULL OR last_sent_at < ?)
ORDER BY last_sent_at ASC
LIMIT ?
```

The second parameter is `now - 12h`. `ORDER BY last_sent_at ASC` puts never-notified subscriptions
first and, if there are ever more than eight, guarantees the least-recently-notified are served
first so nothing starves.

---

### C7 — every logged set re-reads the entire database

**File:** `src/app/state.ts:444-462` and `src/app/state.ts:269-335`

`logSet` calls `refresh()`, and `refresh()` calls `loadAll()`, which reads **thirteen Dexie tables**
and then re-derives the whole projection from all history. During a session that happens on every
single set. On a four-year log that is the difference between a responsive rest timer and a stutter.

**The fix is a split, not a rewrite.** `refresh()` becomes two functions:

```ts
// Reads the database, then derives.
async refresh() {
  const data = await loadAll()
  set(data)
  get().recompute()
}

// Pure derivation from whatever is already in the store. No IO.
recompute() { /* today, streak, projection, advisories, dungeonBreaks, activeSessionId */ }
```

`logSet` then appends in memory and derives, with no database read at all:

```ts
async logSet(input) {
  const state = get()
  const sessionId = state.activeSessionId
  if (!sessionId) return

  const created = await repo.addSet({ /* … */ })
  set({ sets: [...state.sets, created] })
  get().recompute()
}
```

`repo.addSet` already returns the created `SetLog`, and `repo.correctSet` already returns the
superseding row or `null`, so both actions can take this path without touching the repository layer.

Thirteen IndexedDB reads per set become zero. The projection recompute stays — it is what makes XP
and level move as sets land, and with an append-only log it is the only correct way to get them.
Making the projection itself incremental is real work and is deliberately not M1's.

**Two accidental quadratics in the same function get fixed while we are here**, because both live in
code this change is already restructuring.

`state.ts:301-303` builds the week's sets by filtering all sets once per recent session:

```ts
const weekSets = data.sessions
  .filter((s) => s.dayKey >= addDaysToKey(today, -6))
  .flatMap((s) => data.sets.filter((set) => set.sessionId === s.id))
```

At roughly 20,000 sets over four years that is 20,000 comparisons per session in the window. One
`Map<sessionId, SetLog[]>`, built once, replaces it.

`state.ts:313-322` scans every session fourteen times to find open gates. A session index keyed by
`dayKey`, built in the same pass, replaces that too.

---

### C8 — superseded Zod idiom

**File:** `worker/index.ts:68` and `worker/index.ts:78`

`z.string().url()` is the Zod 3 spelling; Zod 4 provides `z.url()`. Two occurrences.

**One thing to confirm at the keyboard:** whether `z.url()` chains `.max(1000)` in 4.4.3. It returns
a string schema, so it should. If it does not, the fallback is `z.url({ maxLength: 1000 })`, and
failing that `z.string().max(1000).check(z.url())`. The typecheck decides it in seconds; noted only
so it is not a surprise.

---

### C9 — the cron polls 96 times a day to do one thing

**Files:** `wrangler.jsonc:42-47`, `worker/schedule.ts`, `worker/push.ts`, `worker/index.ts:66-76`,
`migrations/0001_init.sql`, `src/sync/client.ts:225-250`, `src/domain/types.ts:392`,
`src/app/state.ts:209`, `src/db/repo.ts:74`, `worker/push.test.ts`

`*/15 * * * *` fires 96 times a day so a per-device `notify_minute` can be matched to a local-time
window. Ninety-five of those runs do nothing. The whole mechanism exists to approximate something a
single cron expression states directly.

**Schedule:** `"crons": ["30 2 * * *"]` — 02:30 UTC, 08:00 IST.

**Deleted from `worker/schedule.ts`:** `WINDOW_MINUTES`, `localMinuteOfDay`, `DueCandidate`,
`isDue`. What remains is `MAX_FAILURES`, `MIN_HOURS_BETWEEN_SENDS` (now a SQL predicate, per C6) and
`MAX_SUBSCRIPTIONS_PER_RUN` — and since those are bounds, they move into `worker/limits.ts` and
`schedule.ts` is deleted outright.

**Deleted from `SubscribeSchema`:** `notifyMinute`, `tzOffsetMinutes`.

**Deleted from the client:** the `notifyMinute` parameter of `registerPushSubscription`, and the
`-new Date().getTimezoneOffset()` flip that fed `tzOffsetMinutes`.

**Deleted from `Settings`:** `dailyQuestPushMinute`. This is the user-visible consequence from
section 1. It can come back later if a device-local reminder is ever added, which would not involve
the server at all.

**Schema change, done by editing `0001_init.sql` rather than adding `0002`.** Dropping
`notify_minute` and `tz_offset_min` would normally need a migration, and `notify_minute` is indexed,
so it would need `DROP INDEX push_by_minute` first — SQLite refuses `DROP COLUMN` on an indexed
column. None of that is necessary: **this database has never been created anywhere.** There is no
deployment, no migration history, and no data. Editing `0001` in place is the honest thing to do,
and it leaves a clean first migration rather than one that undoes a decision made an hour earlier.
The same reasoning applies to the Dexie schema in C10.

**Tests:** `worker/push.test.ts` covers `localMinuteOfDay` (4 tests) and `isDue` (6 tests). Both
functions are being deleted, so all ten tests go with them. The file is replaced by the guard test
in section 4. Test count accounting is in section 6 — the number goes down before it goes up, and
that should not read as a regression.

---

### C10 — dead code from the cut photo feature

Progress photos fed no game mechanic, carried the only billing exposure in the stack, and were cut.
The code written for them is still here. All of it is deletion; nothing needs replacing.

| File | What goes |
|---|---|
| `src/db/db.ts:55-68` | The `LocalPhoto` interface and its doc comment |
| `src/db/db.ts:106` | The `photos!: EntityTable<LocalPhoto, 'id'>` field |
| `src/db/db.ts:130` | The `photos: 'id, dayKey, takenAt'` store line |
| `src/db/repo.ts:12` | `LocalPhoto` from the import list |
| `src/db/repo.ts:76` | `photoBackend: 'local'` from `DEFAULT_SETTINGS` |
| `src/db/repo.ts:389-420` | The photo section: `addLocalPhoto`, `getPhotos`, `setPhotoRemoteUrl`, `deletePhoto` |
| `src/db/repo.ts:513` and `:533` | `db.photos` from the `clearAll` table list and its `.clear()` call |
| `src/domain/types.ts:397-400` | `photoBackend`, `cloudinaryCloudName`, `cloudinaryUploadPreset` |
| `src/app/state.ts:212` | `photoBackend: 'local'` from the store's default settings |
| `public/_headers:10` | `https://res.cloudinary.com` from `img-src`, `https://api.cloudinary.com` from `connect-src` |

**A correction to the correction:** `TODO.md` says "five repo photo functions". There are four. That
TODO line gets fixed too.

`img-src` keeps `data:` and `blob:` — those are for QR code rendering in System Link, not photos.

As with C9, the Dexie store line is removed from `version(1)` rather than superseded by a
`version(2)` upgrade, because no device has ever held this database.

---

### C11 — new: the sync client resends the same batch on every pull round

**File:** `src/sync/client.ts:79-145`

Found while reading the protocol for C4, so it is not in the original list of ten.

The loop is nested wrong. For each outbox batch, an inner `while (hasMore)` loop runs until the
server has no more rows to send — and **every iteration re-posts the same `batch.changes`**:

```ts
for (const batch of batches.length > 0 ? batches : [null]) {
  let hasMore = true
  while (hasMore && rounds < MAX_ROUNDS_PER_RUN) {
    const response = await fetch(`${baseUrl}/api/sync`, {
      body: JSON.stringify({ since, changes: batch?.changes ?? { /* empty */ } }),
    })
    // …
    hasMore = parsed.data.hasMore
    if (batch) {
      await clearOutboxEntries(batch.entryIds)   // also every round
      pushed += parsed.data.applied              // also double-counted
    }
  }
}
```

If a first sync on a new device has 400 outbox rows and 1,000 rows to pull, the same 200 rows are
uploaded five times. `ON CONFLICT DO NOTHING` makes it harmless to the mirror, which is exactly why
it went unnoticed — but it burns the phone's data, the Worker's CPU and D1's daily write budget, and
it makes the reported `pushed` count wrong by a factor of however many rounds ran.

**Fix:** send the changes once, then keep pulling with an empty change set.

```ts
let sent = false
while (hasMore && rounds < MAX_ROUNDS_PER_RUN) {
  const changes = !sent && batch ? batch.changes : EMPTY_CHANGES
  // … post …
  if (!sent && batch) {
    await clearOutboxEntries(batch.entryIds)
    pushed += batch.entryIds.length   // the local count, not the server's echo
    sent = true
  }
}
```

`pushed` now counts what this device actually handed over, which is what the caller means by the
word. `received` from the response becomes a cross-check rather than the source of the number.

**Test:** a client-side test with a stubbed `fetch` that returns `hasMore: true` twice and then
`false`, asserting the second and third request bodies carry empty change sets and that
`clearOutboxEntries` was called exactly once.

---

## 4. The new module and the guard test

### `worker/limits.ts`

Two kinds of number live here, and the file's whole point is keeping them apart:

```ts
/* ---- Documented Cloudflare limits. Not ours to choose. ---- */
/** D1: maximum bound parameters per query. */
export const D1_MAX_BOUND_PARAMS = 100
/** D1: maximum queries per Worker invocation. */
export const D1_MAX_QUERIES_PER_INVOCATION = 50
/** D1: maximum SQL statement length in bytes. */
export const D1_MAX_STATEMENT_BYTES = 100_000
/** Workers free plan: maximum subrequests per invocation. */
export const WORKER_MAX_SUBREQUESTS = 50

/* ---- Our own bounds, chosen to sit under those. ---- */
export const MAX_ROWS_PER_REQUEST = 200
export const ROWS_PER_STATEMENT = 16
export const PARAMS_PER_ROW = 5
export const MAX_PAYLOAD_BYTES = 4096
export const MAX_ROWS_RETURNED = 200
export const MAX_RESPONSE_BYTES = 131_072
export const RATE_WINDOW_SECONDS = 900
export const RATE_MAX_REQUESTS = 120
export const MAX_SUBSCRIPTIONS_PER_RUN = 8
export const MAX_FAILURES = 3
export const MIN_HOURS_BETWEEN_SENDS = 12
```

It imports nothing, exactly like `worker/schedule.ts` did, which is what lets a test import it
without dragging in Hono, `web-push`, or the Cloudflare type globals. `worker/index.ts` and
`worker/push.ts` both import from it, and `worker/schedule.ts` is deleted.

### `worker/limits.test.ts`

The test asserts our numbers sit under Cloudflare's, with the platform limits written as literals so
the assertion is a statement about the platform and not a tautology.

| Assertion | Arithmetic | Margin |
|---|---|---|
| Bound parameters per insert | `16 × 5 = 80 ≤ 100` | 20% |
| Statements per sync invocation | `⌈200/16⌉ + 3 = 16 ≤ 50` | 68% |
| Statement bytes per insert | `16 × 4096 + 1024 ≈ 66 KB ≤ 100 KB` | 34% |
| Subrequests per cron run | `8 + 4 = 12 ≤ 50` | 76% |
| Rows returned never exceed rows accepted | `200 ≤ 200` | equal by design |
| Client and Worker agree on the request cap | cross-imported and compared | must be exact |

The last row uses the pattern `worker/identity.cross-check.test.ts` already established: a
non-composite `tsconfig.test.json` lets one test file import from both the client and the Worker,
which the composite projects cannot do. `tsconfig.test.json`'s `include` list needs
`worker/limits.ts` and `src/sync/client.ts` added, and `worker/schedule.ts` removed.

This test caught the 100-parameter problem once already. Its job is to catch the next person who
raises a constant without opening the Cloudflare documentation.

---

## 5. Verification

In order. Each step is expected to pass before the next is run.

**1. Types.** `pnpm run typecheck` — six tsconfig projects, including `tsconfig.test.json`. Proves
C5, C8 and C10 landed consistently: a missed rename or a leftover `photoBackend` reference fails
here.

**2. Tests.** `pnpm vitest run`. See section 6 for the expected count.

**3. The Worker starts.** `pnpm run cf:dev`. Proves C1 (no "Unexpected fields" warning) and C2 (the
runtime accepts the compatibility date at all). Both were the reasons `wrangler dev` could not start
before.

**4. Migrations apply to a clean local D1.** `pnpm run cf:migrate:local` against a deleted
`.wrangler/state` directory. Proves the edited `0001_init.sql` is valid — the two columns and the
`push_by_minute` index are gone and nothing references them.

**5. The sync round trip, end to end against the new protocol.** The same sequence used before,
extended for the string payloads:

- `GET /api/health` → `{"ok":true}`
- `POST /api/sync` with no `Authorization` → `401`
- Push three rows as `{ id, json }` pairs → `received: 3`, `seq` advances
- Pull them back with `since: 0` → each row comes back **byte-identical** to the string that was sent
- Resend the same three rows → `received: 3`, `seq` **unchanged**, proving dedupe still works
- Push a malformed `json` (`"not json"`) → `400`, proving the C4 validity check holds the invariant
- Repeat the pull with a different licence key → nothing, proving tenant isolation

The byte-identical assertion is the one that specifically proves C4: if the Worker were still
parsing and re-serialising, key order or number formatting could differ.

**6. What cannot be verified here, and is deferred to M4.** Real CPU milliseconds. The local runtime
reports wall clock, not CPU, and does not populate `cpuTimeMs` — the first request measured 811 ms,
almost all of it cold start. The claim that C3, C4 and C6 reduce CPU pressure is sound arithmetic
and remains **unmeasured** until the first deploy has observability data behind it. It will be stated
that way until it is measured.

---

## 6. Test count accounting

Stated explicitly so the number moving does not read as a regression.

| | Tests |
|---|---|
| Before M1 | **414** |
| C9 removes `localMinuteOfDay` (4) and `isDue` (6) | −10 |
| C4/C5 add protocol tests (string payload, byte cap, `hasMore`, malformed rejection) | +5 |
| C11 adds the resend test | +1 |
| Section 4 adds the guard test | +6 |
| After M1 | **≈416** |

The ten deleted tests were correct tests of code that no longer exists. Deleting them is the point,
not a loss of coverage.

---

## 7. What M1 deliberately leaves alone

- **The client entry point.** `pnpm run build` still fails. That is M2.
- **Incremental projection.** C7 removes thirteen database reads per set but keeps the full
  recompute. Making the projection itself incremental is real work and needs a real measurement to
  justify it.
- **The GitHub repository, the setup script, Actions, icons, and the first deploy.** All M4.
- **Push delivery to a real device.** Still the one genuinely unverified part of the stack, and still
  droppable — it is the only reason `web-push` and the `push_subscriptions` table exist.

---

## 8. Acceptance criteria

M1 is done when all of the following are true:

1. `pnpm run typecheck` is clean across all six projects.
2. `pnpm vitest run` passes at roughly 416 tests, with the ten deleted tests accounted for above.
3. `pnpm run cf:dev` starts with no warnings on stderr.
4. `pnpm run cf:migrate:local` applies cleanly to a freshly deleted local D1.
5. Every step of the round trip in section 5 behaves as described, including the byte-identical pull
   and the `400` on a malformed payload.
6. `grep -rniE 'photo|cloudinary' src worker migrations public` returns nothing.
7. `grep -rnE 'notify_minute|tz_offset_min|isDue|dailyQuestPushMinute'` over `src` and `worker`
   returns nothing.
8. Eleven corrections are ticked in `TODO.md`, and `infrastructure.md` section 3 reflects the new
   bounds.
