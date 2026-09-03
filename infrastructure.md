# Infrastructure

What runs where, what each thing costs, and the budget that keeps it free. Written for a developer
picking this up cold.

Every Cloudflare figure below was checked against the official documentation on **2026-09-03**.
These numbers move, so re-check before relying on them, and update this file when you do.

---

## 1. The shape of the thing

```
Your phone
├── The app                 React PWA, installed to the Home Screen
├── IndexedDB               THE SOURCE OF TRUTH. All training data lives here.
└── Service worker          Precached shell, and composes the notification text

Cloudflare (one Worker, one deploy)
├── Static Assets           The React shell. Free, unlimited, and not counted as requests.
├── Worker script           /api/* only. A sync mirror and one daily push. Nothing else.
├── D1 (SQLite)             The mirror of the event log, plus rate-limit counters
└── Cron Trigger            One invocation a day: the reminder notification
```

The single most important property: **the server is a mirror, never a dependency.** With
Cloudflare unreachable the app still logs sessions, still computes what to lift next, still levels
up. If a change would break that, the change is wrong.

---

## 2. The billing model: nothing here can charge you

This is the most important property of the architecture, and it was a deliberate choice rather
than luck.

Cloudflare's free services fail in two completely different ways when you exceed a limit. Most of
them **hard-fail**: Workers returns error 1027 past its daily request limit, and D1 starts
returning errors on queries until the counter resets. Unpleasant for an hour, and free.

**R2 was the exception. It bills instead of blocking**, with no throttle, rounding *up* to the next
whole unit — one operation past a million is invoiced as two million. And there is no hard spend cap
anywhere in Cloudflare. The only feature is "Budget alerts", and the documentation is blunt about
it: *"Budget alerts are informational only. They do not pause or cap usage."*

R2 existed in this design for exactly one thing: mirroring progress photos. Those photos fed
nothing — no experience, no rank, no stats, no progression. Nothing in the engine ever read them.
So the only service capable of producing a bill was carrying the least valuable feature in the app.

**That feature was cut, and R2 with it.** Every remaining service — Workers, Static Assets, D1,
Cron Triggers — hard-fails against a free-tier limit. The worst case across the entire stack is now
"a feature stops working until midnight UTC", never an invoice.

Two notes to keep it that way:

- **Do not add R2, KV-with-paid-limits, Durable Objects, Workflows, or Queues without revisiting
  this section.** Of those, Workflows now bills for steps and storage, and R2 bills on overage. The
  rest hard-fail, but each one is a new dimension to reason about.
- **If your Cloudflare account still carries an R2 subscription from enabling it, you can remove
  it.** Unused R2 costs nothing, so this is tidiness rather than urgency — but with no R2
  subscription the account has no usage-based service at all, which is a cleaner place to stand.

## 3. The resource budget

Our caps are deliberately far below the Cloudflare allowance. The gap is not timidity — it is the
margin that absorbs a bug, a retry loop, or a leaked licence key before it becomes money.

### Workers

| Resource | Cloudflare free | Our cap | Expected real use | Over-limit behaviour |
|---|---|---|---|---|
| Requests | 100,000/day | none needed | ~150/day | Hard-fails, no bill |
| CPU per invocation | **10 ms** | design target 3 ms | ~1–2 ms | Request killed |
| Subrequests per invocation | **50** | 10 | 4–14 (D1 statements) | Request fails |
| Memory per isolate | 128 MB, **shared across concurrent requests** | never buffer >64 KB | streaming | Isolate recycled |
| Script size | 3 MB gzipped | 1 MB gzipped | **94.76 KiB measured** | Deploy rejected |
| Global scope startup | 1 second | — | trivial | Deploy rejected |
| Cron Triggers | 5 per account | 1 | 1 | — |
| Cron invocations | counted as requests | 1/day | 1/day | Hard-fails, no bill |

The ~150 requests a day is roughly 50 API calls plus a handful of cron invocations. The
documentation does not actually say whether cron invocations count as requests, so we assume they
do and budget accordingly. See section 4 for why that number is one a day and not ninety-six.

Three of these are tighter than they look:

- **CPU is 10 ms and it applies to the cron handler too.** Waiting on I/O is free, so what matters
  is arithmetic and cryptography, not database round-trips.
- **Subrequests include D1 and KV binding calls**, not just `fetch()`. The documentation is
  explicit: *"A subrequest is any request a Worker makes using the Fetch API or to Cloudflare
  services like R2, KV, or D1."* A sync request costs a handful of D1 statements, so it sits well
  under the 50.
- **128 MB is per isolate, not per request**, and one isolate serves many concurrent requests. So
  per-request memory has to be a small fraction of it. Hence streaming.

### D1

| Resource | Cloudflare free | Our cap | Expected real use |
|---|---|---|---|
| Rows written | 100,000/day | none needed | ~100/day |
| Rows read | 5,000,000/day | none needed | a few thousand/day |
| Storage | 500 MB per database, 5 GB per account | 100 MB | ~12 MB after four years |
| Queries per invocation | **50** | 20 | 4–14 |
| **Bound parameters per query** | **100** | **80** | 80 |
| Max SQL statement | 100 KB | 50 KB | ~5 KB |
| Max row size | 2 MB | 3 KB per payload | ~250 bytes |
| Databases | 10 | 1 | 1 |

The bound-parameter limit of 100 is the one that bites. A multi-row insert of 20 rows at five
columns each is exactly 100 parameters — sitting precisely on a hard limit with no headroom. We
insert **16 rows per statement (80 parameters)** instead.

One D1 subtlety worth internalising: **"rows read" counts rows scanned, not rows returned.** A
query that filters an unindexed column over 5,000 rows costs 5,000 rows read even if it returns
one. Every query in this app filters on an indexed column, and every response carries
`meta.rows_read` so it can be measured rather than assumed.

### Nothing else

There is no R2, no KV, no Durable Objects, no Queues and no Workflows in this design. That is the
budget: four services, all of which fail closed.

The one guard still worth keeping is a test that asserts our own configured bounds — rows per sync
request, bound parameters per statement, subscriptions per cron run — sit under the documented
Cloudflare limits, with those limits written as literals. It caught the 100-parameter problem once
already, and it will catch the next person who raises a constant without checking.

---

## 4. Why the daily reminder uses a Cron Trigger and not a queue

Cron exists in this product for exactly one reason: sending the daily reminder notification while
the app is closed. Nothing else uses it. Everything the reminder needs is already on the device —
the quest is generated deterministically client-side and the service worker composes the
notification text from IndexedDB — so the server contributes no content. It is purely a doorbell.

That raises a fair question, since a recurring timer is a poor fit for "fire once at a chosen local
time". Every Cloudflare option was checked against current documentation on 2026-09-03:

| Option | Free? | One-off event? | Cost for one daily reminder |
|---|---|---|---|
| **Cron Trigger** | Yes, 5 per account | **No**, recurring only | 1 invocation/day, fixed schedule |
| Durable Object alarm | Yes, SQLite-backed only | Yes, exact timestamp | 1 request/day |
| Workflows `sleepUntil` | Yes | Yes, up to 365 days | ~3 steps/day, no CPU while asleep |
| Queues `delaySeconds` | Yes, since Feb 2026 | Yes, but **24 h maximum delay** | ~3 operations/day |

**Decision: a single daily Cron Trigger.** Reasons, in order of weight:

1. **It cannot run away.** A cron schedule is fixed and external to our code, so a bug in the
   handler cannot make it fire more often. Every one-off primitive schedules its own successor,
   which is the shape that can tight-loop.
2. **One invocation a day, not ninety-six.** The original design polled every fifteen minutes so it
   could approximate an arbitrary user-chosen local time — 95 of those 96 runs did nothing. A
   personal app in a single timezone needs one cron at the UTC time matching the local morning.
   That deletes the polling logic entirely.
3. **No new machinery.** A Durable Object means a new class, a binding, a config migration, and the
   hibernation and constructor pitfalls that come with alarms. Workflows adds a second billable
   dimension — step and storage billing began 10 August 2026 — which is exactly what we are trying
   not to acquire.

**Queues was rejected on a concrete number.** Its maximum delay is 24 hours and free-plan message
retention is also 24 hours, which is precisely our reminder period. There is no headroom in either
figure, so a daily self-re-enqueue would sit permanently on two separate cliff edges.

**Two web-platform routes that would remove the server entirely do not work.** The Notification
Triggers API, which would have scheduled a local notification with no server at all, was abandoned
— Chrome's own documentation says *"The development of Notification Triggers API… has ended."* And
Periodic Background Sync enforces a minimum gap of at least twelve hours and modulates frequency by
a site-engagement score, so it cannot deliver at a chosen time of day. It is a "freshen content
sometime today" primitive, not a scheduler.

**The upgrade path, if it is ever wanted.** The one real cost of cron is that the reminder time is
fixed at deploy rather than configurable in the app. If that becomes annoying, either run the cron
hourly and fire only in the matching hour (24 invocations a day, still a quarter of the original),
or move to a Durable Object alarm. If we ever do move, two guards are mandatory: compute the next
alarm from the next calendar occurrence rather than `now + 24h`, and keep the existing
twelve-hour minimum between sends, so that even a self-rescheduling bug cannot spam notifications.

Worth knowing for the record: on the free plan, none of these can produce a bill. Workers, D1,
Durable Objects and Queues all hard-fail against a daily cap. A runaway loop costs a broken feature
for a day, not an invoice. The reason to avoid one is that it would spam notifications, which the
twelve-hour guard already prevents.

## 5. Why the Worker is deliberately stupid

It moves bytes and counts things. It does not compute progression, hash passwords, render anything,
or hold state the client needs. That is not minimalism for its own sake — it is what keeps every
invocation inside 10 ms of CPU.

Concretely:

- **No password hashing.** Identity is SHA-256 over a random token, which costs microseconds.
  bcrypt or argon2 would blow the entire CPU budget on their own.
- **The Worker never parses or serialises row payloads.** The client sends each row pre-serialised
  as a string and the Worker stores that string; on read it hands the strings back and the client
  parses them. The Worker only ever escapes strings, never walks object graphs.
- **The daily push carries no payload at all.** A contentless push needs one ES256 signature; a
  push *with* a payload needs an ECDH key agreement, an HKDF derivation and an AES-GCM encryption
  per subscription. Since the service worker composes the notification text from the local database
  anyway, the payload was never doing anything. Removing it removes nearly all the cryptography
  from the cron path.
- **Every loop is bounded.** Rows per request, statements per batch, subscriptions per cron run.

---

## 6. Data flow

### Sync

Only the immutable event log crosses the network: sessions, sets, and body metrics. These are
append-only and never edited, so conflicts are close to impossible. A correction is a new row that
supersedes an old one, not an update.

`PlayerState` — level, XP, stats, rank, fatigue — is **never synced**. Each device recomputes it
from the log. Storing it server-side would create a second truth that could disagree with the log.

```
POST /api/sync
  { since: <seq>, changes: [ { kind, id, json } ] }
    -> stores each json string verbatim, deduped on (hunter, kind, id)
    -> returns rows with seq > since, as { seq, kind, json }
```

The client keeps an outbox table so log rows stay genuinely immutable rather than carrying a
"synced" flag.

### Identity

No accounts, no login screen. The client generates a random secret on first launch. The server
stores only its SHA-256 and scopes every row to that. The secret travels only as a bearer token.
The Hunter License Key is that secret in Crockford base32, 24 characters, which is what the user
saves and what pairs a second device.

Losing the key means losing the mirror. The interface has to say so before it becomes a surprise.

## 7. Security posture

- **Nothing shipped to the browser is secret.** Every `VITE_`-prefixed variable, every string in
  the bundle, everything in the service worker cache is public. The VAPID *public* key is meant to
  be public and ships in the bundle; the private key exists only as a Worker secret.
- Secrets are set with `wrangler secret put`. `.env*` and `.dev.vars` are gitignored.
- The server stores `SHA-256(secret)`, never the secret.
- Rate limiting lives in **D1, not KV**, because KV allows only 1,000 writes a day and a rate
  limiter writes on every request.
- **Request bodies are never logged.** They carry bodyweight, waist measurements and body-fat
  readings, which is health data.
- The Content-Security-Policy lives in `public/_headers` rather than in Worker code, because
  navigation requests are served straight from the asset store and never reach the Worker.
- **GitHub secret scanning and push protection are not available** on a private repository without
  Advanced Security. The brief asks for them; the plan cannot deliver them at this repository
  visibility. What stands in for them: no secret is ever committed, and the ignore rules above.

---

## 8. Deploying

One-time, on your machine:

```sh
pnpm install
wrangler login
pnpm run setup          # creates the D1 database, generates VAPID keys, sets the
                        # Worker secrets, and writes the database id into wrangler.jsonc
pnpm run cf:migrate:remote
pnpm run deploy
```

After that, GitHub Actions deploys on every push to `main`. It needs two repository secrets,
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs Workers Scripts: Edit, D1: Edit, and
Account Settings: Read. It does not need R2 or KV permissions.

### Local development

```sh
pnpm dev                          # the client, with hot reload
pnpm run cf:dev                   # the Worker and D1 simulated locally
pnpm run cf:migrate:local         # apply migrations to the local database
```

One trap, found the hard way: **`compatibility_date` must not be newer than the bundled runtime
supports.** Setting it to today's date broke `wrangler dev` with *"This Worker requires
compatibility date 2026-09-03, but the newest date supported by this server binary is
2026-09-02."* Keep it at a date the installed Wrangler can actually run, and it must stay at or
after 2026-08-04 for `nodejs_compat` to be enabled by default.

---

## 9. What has been verified, and what has not

Verified by running it:

- The Worker starts in the local runtime with `web-push` bundled and imported.
- `/api/health` returns `{"ok":true}`; an unauthenticated `/api/sync` returns 401.
- A full sync round trip works against local D1: rows push, come back on pull, deduplicate on
  resend, and a different licence key sees nothing.
- The bundle is 94.76 KiB gzipped, against a 3 MB limit.
- 414 unit tests pass; all TypeScript projects typecheck.

**Not yet verified, and honestly flagged:**

- **Actual CPU milliseconds per request.** Local wall-clock time is not CPU time and the local
  runtime does not report CPU. This has to be read from Workers observability after the first real
  deploy. The design targets 3 ms; that is an estimate, not a measurement.
- **A real push delivery.** The library bundles and imports, and the scheduling arithmetic is unit
  tested, but no notification has been delivered to a real device from this code.
- Whether cron invocations count toward the daily request limit. Undocumented, so we assume they
  do. At one invocation a day it makes no practical difference.
