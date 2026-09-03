# Implementation plan

Written 2026-09-03, before any further code. Read `infrastructure.md` first — it holds the
verified Cloudflare limits and the resource budget that this plan is built to respect.

The plan has three jobs: land the corrections that verification turned up, commit to the design
decisions that keep every Cloudflare resource inside its free allowance, and sequence the
remaining work so the app becomes usable in the gym as early as possible.

---

## 1. Where the build actually stands

**Finished, tested, committed.** The domain engine (progression, e1RM, volume landmarks, ACWR,
deload, XP, the hybrid stats, rank from published tables, body composition, quests, gates,
shadows, titles, runes, the tower, advisories, streaks, and the projection that rebuilds all
player state from the log); the Dexie schema and repository; the platform capability adapters;
the capability-token identity; the sync client; the Zustand store; the service worker; the Hono
Worker; the D1 schema; and the Wrangler and CSP configuration.

414 tests pass. All four TypeScript projects typecheck. The bundle is 94.76 KiB gzipped.

**Verified by running it, not by reading it.** The Worker boots in the local runtime with
`web-push` imported; `/api/health` answers; unauthenticated sync returns 401; a full sync round
trip against local D1 pushes rows, pulls them back, deduplicates a resend, and correctly shows
nothing to a different licence key.

**Not built at all: the user interface.** There is no `src/main.tsx`, no router, no components, no
screens. `pnpm run build` fails today because `index.html` points at an entry file that does not
exist. Everything in milestones M2 onward is that gap.

---

## 2. Corrections to land before anything else

These came out of actually running the Worker and reading the config schema. Each one is a real
defect, not a style preference.

**C1 — `migrations_dir` is in the wrong place.** Wrangler warns *"Unexpected fields found in
top-level field: migrations_dir"*. The config schema puts it inside each `d1_databases` entry. It
works today only because `./migrations` happens to be the default. Move it or delete it.

**C2 — `compatibility_date` is newer than the runtime can run.** Set to today's date, which broke
`wrangler dev` outright: *"This Worker requires compatibility date 2026-09-03, but the newest date
supported by this server binary is 2026-09-02."* Set it to `2026-09-02`. It must stay at or after
2026-08-04, which is what makes `nodejs_compat` default-on.

**C3 — the multi-row insert sits exactly on D1's bound-parameter limit.** D1 allows 100 bound
parameters per query. `ROWS_PER_STATEMENT = 20` at five columns each is exactly 100 — no headroom,
and one added column becomes a runtime failure. Drop to **16 rows (80 parameters)**.

**C4 — the sync response makes the Worker do JSON work it does not need to.** Today the Worker
serialises every incoming row and parses up to 500 outgoing payloads, all inside the 10 ms CPU
budget. Change the protocol so payloads cross as opaque strings:

```
POST /api/sync
  { since, changes: [ { kind, id, json } ] }     // json is already serialised by the client
    -> { seq, received, rows: [ { seq, kind, json } ], hasMore }
```

The Worker stores `json` verbatim and hands it back verbatim. The client parses and validates with
Zod, which it already does. Also drop `MAX_ROWS_RETURNED` from 500 to 200, and cap each `json` at
3 KB so a batch of 16 cannot approach D1's 100 KB statement limit.

**C5 — `applied` is misleading.** The live test showed `applied: 1` when resending a row that was
already stored and correctly not inserted again. It reports what was offered, not what landed.
Rename to `received`.

**C6 — the cron push handler can exceed both the subrequest and CPU limits.** This is the most
serious of the six. `MAX_SUBSCRIPTIONS_PER_RUN = 50`, and each push is a subrequest — so a full run
would consume the *entire* 50-subrequest allowance for that invocation. Worse, each push with a
payload costs an ECDH agreement, an HKDF derivation and an AES-GCM encryption, and the 10 ms CPU
limit applies to cron just as it does to a request.

Two changes fix it:

- **Send a contentless push.** The service worker already builds the notification text from the
  local database and ignores the payload entirely, so the payload was never doing any work. Without
  one, a push needs only an ES256 signature, and that signature can be reused across every
  subscription sharing a push-service origin.
- **Cap subscriptions per run at 8.** This is a personal app; the realistic number is one or two
  devices.

**C7 — `refresh()` re-reads the entire database after every logged set.** `logSet` calls `refresh`,
which calls `loadAll`, which reads every table. During a session that is roughly 25 full reloads,
and the cost grows with training history — tolerable at a few thousand sets, bad at forty thousand.
Keep the log in the store and append to it in memory, re-reading from IndexedDB only on load and
after a sync pull. The projection stays a pure function of in-memory arrays.

**C8 — use the Zod 4 idiom.** `z.string().url()` still works at 4.4.3 but `z.url()` is the current
form. Same for the other string formats.

---

## 3. Design decisions this plan commits to

Each of these exists to keep a specific Cloudflare resource inside its allowance. The reasoning
matters more than the rule, so it is stated.

**D1 — The Worker moves bytes and counts things; it computes nothing.** No progression, no
password hashing, no payload parsing, no rendering. This is what keeps every invocation inside
10 ms of CPU, and it is why identity is SHA-256 over a random token rather than a password hash.

**D2 — The shell is static assets, always.** Asset requests are free, unlimited, and not counted
against the daily request limit. `run_worker_first` stays scoped to `/api/*` and must never cover a
path that serves the shell: once the daily limit is hit, paths listed there return 429 instead of
falling back to the asset. The `assets_navigation_prefers_asset_serving` flag keeps navigations off
the Worker entirely.

**D3 — Counters live in D1, never KV.** KV allows 1,000 writes a day; a rate limiter and a usage
counter write on every request. D1 allows 100,000.

**D4 — R2 usage is capped by our own code, enforced before the call.** Cloudflare has no spend cap
and R2 bills on overage with round-up pricing, so a self-imposed cap is the only real protection.
The cap is global across all hunters, because the licence key is the only credential and a
per-hunter cap would not bound spend if one leaked.

**D5 — D1 is the photo index; R2 is only the bytes.** `LIST` is a Class A operation and D1 already
knows every object we own. We never list.

**D6 — Bodies stream into R2 and are never buffered.** 128 MB is per isolate and shared across
concurrent requests, so per-request memory has to stay small. `bucket.put(key, request.body)` takes
a `ReadableStream` and is the documented idiom.

**D7 — Photos are encrypted in the browser before upload.** AES-256-GCM under a key derived from
the Hunter Secret. Body photos are the most sensitive data here; this way a bucket
misconfiguration or a compromised Worker exposes ciphertext. It costs client CPU only, and the
existing "lose the key, lose the mirror" warning already covers the consequence.

**D8 — Every loop in the Worker is bounded**, and each bound is written next to the Cloudflare
limit it respects.

**D9 — A test guards the budget.** `budget.test.ts` asserts every configured cap is below the
documented Cloudflare allowance, with the Cloudflare figures as literals. Raising a cap past the
free tier fails the build instead of quietly costing money.

**D10 — Sync stays event-log-only.** Sessions, sets and body metrics, all append-only. Derived
state is never synced. Corrections are superseding rows, never updates.

---

## 4. The R2 photo subsystem, in detail

Replaces the Cloudinary plan. R2 is off by default and the app is complete without it.

### Client pipeline

1. The hunter picks or takes a photo.
2. Downscale to at most 1280 px on the long edge via `OffscreenCanvas`.
3. Re-encode to WebP at quality 0.8, targeting 250 KB. If still larger, step quality down to 0.6,
   then the long edge to 1024 px. Reject anything still over **400 KB**.
4. Store the processed image in IndexedDB. **This is the copy that matters**; everything else is a
   mirror.
5. Derive an encryption key: `HKDF-SHA256(hunterSecret, info: "photo-encryption-v1")`.
6. Encrypt with AES-256-GCM under a fresh 12-byte IV, prepended to the ciphertext.
7. `PUT /api/photos/:id` with the ciphertext as the body.

### Worker endpoints

| Route | Cost | Notes |
|---|---|---|
| `PUT /api/photos/:id` | 1 R2 Class A, ~3 D1 statements | Checks the budget *before* the R2 call. Enforces 400 KB from `Content-Length` **and** by counting bytes through the stream, because the header can lie. |
| `GET /api/photos/:id` | 1 R2 Class B, 1 D1 read | Ownership checked in D1 first. Responds `Cache-Control: private, immutable` — the ciphertext never changes. |
| `DELETE /api/photos/:id` | free in R2, 2 D1 statements | `DeleteObject` costs nothing, so deletion is cheap by design. |
| `GET /api/photos` | 0 R2 ops | Served from the D1 index. Never `LIST`. |

Object key: `p/<hunterId>/<photoId>`. The hunter id is a SHA-256 digest, so the key identifies
nobody.

### New migration `0002_photos_and_budget.sql`

- `photos` — the index: hunter id, photo id, byte length, created-at, day key.
- `usage_budget` — `(period, metric)` primary key with a counter, incremented and checked in one
  statement.

### Enforced caps

Global 5,000 Class A and 20,000 Class B operations a month, 2 GB stored in total and 250 MB per
hunter, 400 KB per object. Expected real use is about five uploads and 50 MB *in total over four
years*. The caps are sized to bound a bug, not to fit the use case.

Over the cap the endpoint returns 429 with a plain message. The photo is already on the device, so
nothing is lost and nothing breaks.

---

## 5. Milestones

Each milestone is independently shippable and states what it costs in Cloudflare resources.
M4 is the point at which this is usable on your phone in the gym.

### M1 — Foundations and corrections
Land C1 through C8. Add the `budget.ts` module with pure accounting functions, `budget.test.ts`
with the guard test, and migration `0002`. Add the `r2_buckets` binding to `wrangler.jsonc`.

*Acceptance:* all existing tests still pass; new budget tests pass; `wrangler dev` starts and the
sync round trip still works end to end against the new string-payload protocol.
*Budget impact:* reduces CPU and parameter pressure. No new resource use.

### M2 — App shell and the Awakening Test
`src/main.tsx`, a code-based TanStack Router (no codegen step), the System window component
vocabulary (window, panel, stat bar, mana bar, rank badge, message queue), and onboarding: sex,
bodyweight, height, age, training years, units, equipment, plus the genuinely skippable tape and
body-fat step. Ends on the E-Rank window and the Player line.

*Acceptance:* `pnpm run build` succeeds; onboarding completes with every optional field blank and
writes a profile; the Double Dungeon first-launch sequence plays once.
*Budget impact:* none. Entirely client-side.

### M3 — Session logging, the rest timer, and targets
The gate screen: blocks and supersets in the order the routine defines, per-exercise target from
the progression engine with its reason shown, set entry sized for a thumb, RPE, warmup flag, and
set correction. Rest timer with Screen Wake Lock and the System chime. Session summary on finish.

*Acceptance:* a full Friday Legs session can be logged offline, in airplane mode, with the app
installed; targets change the following week according to the double-progression rules; the timer
keeps the screen awake.
*Budget impact:* none. IndexedDB only.

### M4 — Installable, deployed, on the phone
PWA icons generated by script with no new dependencies, manifest verified, Workbox precache
confirmed, Android install prompt. The one-time setup script (D1 database, R2 bucket, VAPID keys,
secrets, writing ids into `wrangler.jsonc`), the GitHub Actions workflow, the private GitHub
repository, and the first real deploy.

*Acceptance:* installs to the Home Screen from the workers.dev URL; opens and logs a session with
the network off; Lighthouse installability passes; CPU per request read from observability and
recorded in `infrastructure.md`.
*Budget impact:* the first real usage. Static assets are free and uncounted; a deploy costs no
requests.

### M5 — The game layer
Status Window as the home screen, Daily Quest with per-item progress, streak and forgiveness
controls, stat allocation with its effect on next-cycle quest generation shown, XP and level-up
windows, fatigue gauge, volume mana bars, deload prompt, and the dismissible advisories.

*Acceptance:* the daily quest scales with level as specified; the penalty quest adds work and
never removes progress; a rest token forgives yesterday and holds the streak.
*Budget impact:* none.

### M6 — Sync and System Link
The Hunter License Key screen with the loss warning stated before it matters, QR rendering, QR
scanning behind the capability adapter with a decoder fallback, sync status, manual sync, and the
forget-the-mirror control. Client-side sync discipline: trigger on foreground, after a session, and
manually — never per set; coalesce in-flight syncs; exponential backoff on failure.

*Acceptance:* two browser profiles converge on the same log; conflicts do not arise; airplane mode
never blocks logging; API requests measured at well under 100 a day.
*Budget impact:* the Worker request budget starts being used — about 50 requests a day against
100,000.

### M7 — Photos on R2
The whole of section 4: the client pipeline, the encryption, the four endpoints, the D1 index, and
the enforced caps. `PhotoStore` adapter with the local implementation as the default and R2 as an
opt-in.

*Acceptance:* a photo round-trips through R2 and decrypts; the byte cap is enforced against a lying
`Content-Length`; exceeding the configured cap returns 429 and the app keeps working; no `LIST`
call exists anywhere in the codebase.
*Budget impact:* the only spend risk in the stack, capped as above.

### M8 — The rest of the fantasy layer
Gates with ranks and the week view, Dungeon Break, Red Gate, Instant Dungeon Key, the shadow army
with the INT-capped roster, marshals, titles, gold and the System Shop, runes surfaced in the
session screen, the Job Change Quest, the Demon Castle, Monarchs, the Reawakening Test, and the
Hunter License PNG card.

*Acceptance:* every engine feature already tested has a surface; the licence card renders and
shares via the Web Share adapter.
*Budget impact:* none.

### M9 — Push notifications
VAPID keys from the setup script, the subscription flow gated behind a user gesture, the contentless
cron push, and the notification composed on-device.

*Acceptance:* a real notification arrives on the Android device at the chosen local time; a dead
subscription is deleted on 404 or 410; the cron handler stays inside 10 ms of CPU and 8 subrequests.
*Budget impact:* 96 cron invocations a day, worst case.

### M10 — Flavour
Build-time generated System flavour text. Any runtime AI, if it ever happens, uses Workers AI so
no external key exists to leak — and not one of the model families that require a paid plan.

*Budget impact:* none at build time.

---

## 6. How the work gets checked

- **Tests before formulas.** Anything producing a number gets a Vitest case with the expected
  value as a literal, taken from the brief where the brief states one.
- **The budget guard test.** Configured caps versus documented Cloudflare allowances, as described
  in D9.
- **A local smoke script** run before each deploy: start `wrangler dev`, apply migrations, health
  check, sync round trip, dedupe check, tenant-isolation check, photo round trip. This is the
  sequence already run by hand for the sync path; it becomes a script.
- **Real CPU measurement after the first deploy.** Local wall time is not CPU time. The number goes
  into `infrastructure.md` with the date.
- **A fresh-context sub-agent audit** against `BUILD_PROMPT.md` at M4 and again at M8, because
  self-review misses what self-review wrote.

---

## 7. Residual risks, stated plainly

**R2 can bill and Cloudflare will not stop it.** Our caps make organic overage impossible and bound
a bug to a rounding error. They cannot make it theoretically impossible: the caps live in the same
system they protect. Mitigation is defence in depth — the cap check before every operation, the
guard test, a dashboard budget alert, and the fact that photos are opt-in and off by default.

**A leaked Hunter License Key is full access.** That is the trade for having no login screen, and
the brief chose it deliberately. It is bounded by the global R2 cap and the per-hunter rate limit,
and `POST /api/forget-me` lets the mirror be wiped. Rotating to a new key means the old mirror is
abandoned rather than revoked.

**Push delivery is unproven.** The library bundles and imports and the scheduling logic is tested,
but nothing has reached a real device. If `web-push` fails against a live push service, the fallback
is a hand-rolled ES256 VAPID signature over WebCrypto — which is small precisely because we send no
payload.

**The strength-standard tables have no stated reuse licence.** Individual measurements are facts,
but a compiled table can attract thin protection. The repository is private, which bounds the
exposure. Worth resolving before it is ever made public.

**Client-side projection cost grows with history.** C7 fixes the immediate problem. The projection
still walks the whole log on each recompute, which is fine at four years of training and would need
an incremental cache well beyond that. The threshold to watch is roughly 40,000 logged sets.
