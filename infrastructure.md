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
├── D1 (SQLite)             The mirror of the event log, plus counters
├── R2                      Encrypted progress photos (optional, off by default)
└── Cron Trigger            One invocation a day: the reminder notification
```

The single most important property: **the server is a mirror, never a dependency.** With
Cloudflare unreachable the app still logs sessions, still computes what to lift next, still levels
up. If a change would break that, the change is wrong.

---

## 2. The billing model, which is the thing to understand first

Cloudflare's free services behave in two completely different ways when you go over, and this
difference drives the whole design.

**Workers and D1 hard-fail. They do not bill.** Exceeding the Workers daily request limit returns
error 1027. Exceeding a D1 daily limit makes queries return errors until the counter resets.
Unpleasant, but free.

**R2 bills.** There is no block and no throttle — you are simply charged for the excess. Worse, the
billing rounds *up* to the next whole unit: one operation past a million is billed as two million.

And there is **no hard spend cap anywhere in Cloudflare.** The only feature is "Budget alerts",
which sends an email after the fact. The documentation says it plainly: *"Budget alerts are
informational only. They do not pause or cap usage."*

Two consequences, and they are not optional:

1. **The Worker counts its own R2 usage in D1 and refuses to proceed past a self-imposed cap.**
   Cloudflare will not stop us, so we stop ourselves. The cap is enforced *before* the R2 call, not
   after.
2. **Turn on a budget alert in the dashboard** (Manage Account → Billing → Billable Usage → Create
   budget alert). Set it low, a dollar or two. It will not prevent a charge, but it means you find
   out in hours rather than at the end of the month.

Enabling R2 is what made billing possible on this account at all. Before that, the account could
not be charged. That is worth knowing rather than discovering.

---

## 3. The resource budget

Our caps are deliberately far below the Cloudflare allowance. The gap is not timidity — it is the
margin that absorbs a bug, a retry loop, or a leaked licence key before it becomes money.

### Workers

| Resource | Cloudflare free | Our cap | Expected real use | Over-limit behaviour |
|---|---|---|---|---|
| Requests | 100,000/day | none needed | ~150/day | Hard-fails, no bill |
| CPU per invocation | **10 ms** | design target 3 ms | ~1–2 ms | Request killed |
| Subrequests per invocation | **50** | 10 | 4 (photo PUT) | Request fails |
| Memory per isolate | 128 MB, **shared across concurrent requests** | never buffer >64 KB | streaming | Isolate recycled |
| Script size | 3 MB gzipped | 1 MB gzipped | **94.76 KiB measured** | Deploy rejected |
| Global scope startup | 1 second | — | trivial | Deploy rejected |
| Cron Triggers | 5 per account | 1 | 1 | — |
| Cron invocations | counted as requests | 1/day | 1/day | Hard-fails, no bill |

The ~150 requests a day is roughly 50 API calls plus a handful of cron invocations. The
documentation does not actually say whether cron invocations count as requests, so we assume they
do and budget accordingly. See section 4a for why that number is one a day and not ninety-six.

Three of these are tighter than they look:

- **CPU is 10 ms and it applies to the cron handler too.** Waiting on I/O is free, so what matters
  is arithmetic and cryptography, not database round-trips.
- **Subrequests include R2, KV and D1 binding calls**, not just `fetch()`. The documentation is
  explicit: *"A subrequest is any request a Worker makes using the Fetch API or to Cloudflare
  services like R2, KV, or D1."* A photo upload costs one R2 put plus a few D1 statements, so it
  sits at about 4 of the 50.
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

### R2 — the only service that can cost money

| Resource | Cloudflare free | **Our enforced cap** | Expected real use | Headroom |
|---|---|---|---|---|
| Class A ops (writes, lists) | 1,000,000/month | **5,000/month** | ~5/month | 200× under our own cap |
| Class B ops (reads) | 10,000,000/month | **20,000/month** | ~50/month | 400× |
| Storage | 10 GB-month | **2 GB total**, 250 MB per hunter | ~50 MB after four years | 40× |
| Object size | 5 TiB | **400 KB** | ~250 KB | — |

Expected use assumes one progress photo a week. Four years of that is about 208 photos and 50 MB.
The caps are not sized for that; they are sized so that a runaway loop is capped at a rounding
error rather than a bill.

Notes that shaped these choices:

- **`DeleteObject` is free.** It is not Class A or Class B. So deleting aggressively costs nothing.
- **Lifecycle transitions to Infrequent Access each cost a Class A operation.** We do not use them.
  Expiry-only lifecycle rules are what we want, if we use lifecycle at all.
- **We never call `LIST`.** It is a Class A operation, and D1 already knows every object we own.
  D1 is the index; R2 is only the bytes.
- Concurrent writes to the *same* key are limited to one per second and return HTTP 429. Our keys
  are unique per photo, so this cannot arise.

### How the R2 cap is actually enforced

A `usage_budget` table in D1, keyed by month and metric. Before every R2 operation the Worker
increments the counter and checks it against the cap in the same statement. Over the cap, it
returns 429 with a plain message and the client shows a System window; the photo stays on the
device and nothing is lost.

The cap is enforced **globally, across all hunters**, not just per hunter. The licence key is the
only credential, so if one ever leaked, a per-hunter cap would not bound the spend. A global cap
does.

A test asserts that every configured cap is below the corresponding documented Cloudflare
allowance, with the Cloudflare numbers written as literals. Raising a cap past the free tier fails
the build rather than quietly costing money.

---

## 4a. Why the daily reminder uses a Cron Trigger and not a queue

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
- **Bodies are streamed into R2, never buffered.** `bucket.put(key, request.body)` is the
  documented idiom and takes a `ReadableStream`.
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

### Photos

Local IndexedDB is the source of truth, as with everything else. R2 is an optional mirror, off
until switched on.

Before upload the client downscales to at most 1280 px on the long edge, re-encodes to WebP,
targets 250 KB, and rejects anything still over 400 KB. Then it **encrypts the image in the
browser** with AES-256-GCM under a key derived from the Hunter Secret, and uploads the ciphertext.

R2 therefore holds bytes nobody can read without the key — not an attacker who reaches the bucket,
and not us. Progress photos are the most sensitive thing in this app, and this costs only client
CPU. It also means the existing "lose the key, lose the mirror" warning covers photos correctly.

---

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
pnpm run setup          # creates the D1 database and R2 bucket, generates VAPID keys,
                        # sets the Worker secrets, and writes the ids into wrangler.jsonc
pnpm run cf:migrate:remote
pnpm run deploy
```

Then, once, in the dashboard: create a budget alert (section 2).

After that, GitHub Actions deploys on every push to `main`. It needs two repository secrets,
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs Workers Scripts: Edit, D1: Edit,
Workers R2 Storage: Edit, and Account Settings: Read.

### Local development

```sh
pnpm dev                          # the client, with hot reload
pnpm run cf:dev                   # the Worker, D1 and R2 simulated locally
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
- Whether cron invocations count toward the daily request limit. Undocumented; assumed yes.
- Whether R2 lifecycle expiry deletes are free. `DeleteObject` is free, but the lifecycle
  documentation does not say so for lifecycle-initiated deletes. We avoid depending on it.
