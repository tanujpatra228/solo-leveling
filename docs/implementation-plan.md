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

**C9 — the cron schedule polls 96 times a day to do one thing.** `*/15 * * * *` exists only to
approximate an arbitrary user-chosen local reminder time, so 95 of the 96 daily runs do nothing.
Replace it with a single daily trigger at the UTC time matching the local morning, and delete the
`isDue` polling logic along with the `notify_minute` and `tz_offset_min` columns. The full
comparison against Durable Object alarms, Workflows and Queues is in `infrastructure.md` section 4.

**C10 — remove the photo and Cloudinary remnants.** Progress photos are cut from the product, so
the code written for them is now dead weight. Delete the `photos` table and `LocalPhoto` type from
the Dexie schema, the five photo functions from the repository, the `photoBackend`,
`cloudinaryCloudName` and `cloudinaryUploadPreset` fields from the settings schema, and the two
Cloudinary hosts from the `img-src` and `connect-src` directives in `public/_headers`. No R2
binding is ever added.

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

**D4 — No service that can bill is used.** Workers, Static Assets, D1 and Cron Triggers all
hard-fail against a free-tier limit. R2 was the sole exception and is gone with the photo feature,
so the worst case across the whole stack is a feature pausing until midnight UTC.

**D5 — Every loop in the Worker is bounded**, and each bound is written next to the Cloudflare
limit it respects.

**D6 — A test guards the limits.** `budget.test.ts` asserts every configured cap is below the
documented Cloudflare allowance, with the Cloudflare figures as literals. Raising a cap past the
free tier fails the build instead of quietly costing money.

**D7 — Sync stays event-log-only.** Sessions, sets and body metrics, all append-only. Derived
state is never synced. Corrections are superseding rows, never updates.

---

## 3a. Delivery is continuous, not a milestone

Changed on 2026-09-05, at the point the app could render something.

The original plan held deployment as **M4 - "Installable, deployed, on the phone"**, sitting after
session logging. That was the wrong shape, for the ordinary reason: it puts every delivery risk -
icons, the manifest, the SPA fallback, D1, secrets, the install prompt - behind two milestones of
feature work, and discovers them all at once, late, when the app is large enough that a failure is
hard to localise.

So the pipeline moves to the front and becomes a standing practice rather than a stage. Every
milestone from here lands on the phone as it is built.

**What is already live**, done through the Cloudflare API rather than needing dashboard clicks:

| Thing | State |
|---|---|
| workers.dev subdomain | `tanujpatra228.workers.dev`, created via API |
| D1 database | `solo-leveling`, `9cbfab12-854d-487a-8343-1af206195c46`, APAC region |
| D1 schema | Four tables applied, and recorded in `d1_migrations` so wrangler sees 0001 as done |
| PWA icons | Generated by `scripts/generate-icons.mjs`, no new dependency |
| `wrangler.jsonc` | Carries the real database id |

**What still needs a person:** `wrangler deploy` needs an authenticated wrangler. The Cloudflare MCP
server can read the account, create D1 and manage the subdomain, but it cannot mint an API token -
`/user/tokens/permission_groups` returns `9109 Unauthorized`, so the OAuth grant does not cover
token creation. One `wrangler login` in a terminal unlocks deploys permanently, and is a smaller
security surface than a long-lived token in a file.

**What M4 keeps.** Only the parts that genuinely require a deployed app on a real device: the
Lighthouse installability pass, the install prompt verified on Android, and the first real CPU
measurement read from observability. Icons, the setup script, the first deploy and the Actions
workflow leave M4 and happen as pipeline work.

### The first thing on the phone

Read-only **Today's Gate**: the routine for today, its blocks and supersets in the order the routine
defines, sets, rep ranges, rest per item, and each exercise's cue. It writes nothing, so it needs no
profile and no session - it reads the seeded week, which was already built and tested. Useful in a
gym before logging exists, which is the test of whether it was worth deploying early.

**Bundle, measured rather than projected:** 186.6 KB of JavaScript, 5.1 KB of CSS and 2.3 KB of
workbox, so **194 KB gzipped** on the initial route - against the 200 KB budget M2 set, with the
Awakening Test screens still to come. The M2 plan's fallback is therefore not hypothetical: the
252-row standards table moves to a chunk loaded after first paint, since rank is not needed to draw
a boot window.

---

## 3b. Rest days

Added on 2026-09-05, from a real constraint: the gym is shut on Sundays.

The seeded week already ran Monday to Saturday, so the **gate** layer was correct - Sunday has no
routine, so it could never open or break one. The **quest and streak** layers were not. A Daily
Quest was issued every day including Sunday, and the next morning an unfinished one either spent a
rest token or was marked failed and became a Penalty Quest. A closed gym cost the hunter something.

A rest day is now **derived rather than stored**: a day no routine is scheduled for. Adding a Sunday
routine later makes Sunday a training day with no other change. No quest is issued on a rest day, a
rest day is forgiven without spending a token, and the streak steps over it - holding the run rather
than extending or breaking it. A completed quest outranks a rest day, so training anyway still
counts.

This also fixed a second defect in the same function. Rest days have no quest row, so the
longest-streak walk iterated the rows it had, saw a gap every Sunday, reset the run there, and could
**never report a streak above six on a six-day week**. It now walks the calendar span day by day. A
test asserts both halves: 18 unbroken training days across three weeks, where the old code capped
at 6.

---

## 4. Milestones

Each milestone is independently shippable and states what it costs in Cloudflare resources.
M4 is the point at which this is usable on your phone in the gym.

### M1 — Foundations and corrections
Land C1 through C11 — C11 was found while planning this milestone: the sync client re-posts the same
outbox batch on every pull round. Extract the resource bounds into a dependency-free
`worker/limits.ts` and add the guard test asserting they sit under the documented Cloudflare limits.
No new migration and no new binding are needed: the D1 database and the Dexie schema have never
existed anywhere, so `0001_init.sql` and `version(1)` are edited in place rather than superseded.

**Detailed step-by-step plan, with the reasoning behind each correction: `docs/m1-plan.md`.**

*Acceptance:* typecheck clean across all six projects; `pnpm vitest run` passes at roughly 416 tests
(ten `isDue`/`localMinuteOfDay` tests are deleted with the code they cover, and twelve are added);
`wrangler dev` starts with no warnings; migrations apply to a clean local D1; and the sync round trip
works end to end against the new string-payload protocol, with pulled rows byte-identical to what
was pushed.
*Budget impact:* reduces CPU and parameter pressure. No new resource use.

### M2 — App shell and the Awakening Test
`src/main.tsx`, a code-based TanStack Router (no codegen step), the System window component
vocabulary (window, panel, stat bar, mana bar, rank badge, message queue), and onboarding: sex,
bodyweight, height, age, training years, units, equipment, plus the genuinely skippable tape and
body-fat step. Ends on the E-Rank window and the Player line.

Surveying the ground first turned up six findings the milestone description did not account for, one
of them a defect: **the Hunter Secret is generated but never persisted**, so an identity would not
survive a reload and System Link could never pair. Identity persistence therefore belongs here,
because first launch is where the secret is born. The other five are a missing height parser, absent
icon files, an empty `dist/`, a global reduced-motion rule that rules out a CSS-driven cinematic, and
a Vitest include pattern that would silently collect no component tests.

**Detailed step-by-step plan, with those findings and the decisions they force: `docs/m2-plan.md`.**

*Acceptance:* `pnpm run build` succeeds with the initial route at or under 200 KB gzipped; onboarding
completes with prefer-not-to-say, no standards table and physique skipped, landing on a correct
*Unranked* window; the licence key survives a reload and a `clearAll()`; the Double Dungeon plays
once, is skippable, and is readable under `prefers-reduced-motion`; and `wrangler dev` serves the
built app through the SPA fallback while `/api/health` still reaches the Worker.
*Budget impact:* none. Entirely client-side.

### M3 — Session logging, the rest timer, and targets
The gate screen: blocks and supersets in the order the routine defines, per-exercise target from
the progression engine with its reason shown, set entry sized for a thumb, RPE, warmup flag, and
set correction. Rest timer with Screen Wake Lock and the System chime. Session summary on finish.

Reading the engine and store for this milestone turned up six findings. Two matter: `targetFor`
resolves the routine from today's day of week rather than the active session's `routineId`, so a
session crossing the 04:00 rollover silently falls back to 3 planned sets where Friday's squat wants
4; and nothing supplies `startGate`'s optional `bodyweightKg`, which `projection.ts` feeds into
tonnage, so every bodyweight push-up currently counts as zero tonnage and understates XP. The others
are a routine rep range that is stored and never read, a warmup flag the store cannot correct though
the repository can, an `order` computation that counts superseded rows, and the constraint that a
210-second rest cannot be counted down with `setInterval` in a backgroundable tab.

**Detailed step-by-step plan: `docs/m3-plan.md`.** Its first three commits are engine and store
corrections plus a pure timer module, and need no component to exist - so they can land before M2.

*Acceptance, split from the original because it straddled two milestones:* **M3 owns offline** - a
full Friday Legs session, all 17 working sets, logged with the network off, driven in test by one
store-level integration test that then asserts every target moved per the double-progression rules;
and the timer keeps the screen awake, including after the app has been hidden and shown again.
**M4 owns installed-and-offline**, on the phone, which is where it actually matters.
*Budget impact:* none. IndexedDB only.

### M4 — Installed, automated, and measured
Half of the original M4 closed when delivery moved to the front: the icons, the private repository,
the D1 database, the subdomain and the first deploy are all done. What remains splits by who can do
it. **Automatable:** the tests joining the release path (`pnpm run deploy` currently runs the
typechecker but never `vitest`, so it can ship a red suite), a post-deploy smoke check, measuring the
sync path's CPU, attributing the bundle, and the Actions workflow. **Only on a real phone:** the
Home Screen install, a session logged in airplane mode, the rest timer surviving a locked screen,
and Lighthouse.

Two measurements taken while planning it. **CPU is no longer unknown** — the Workers GraphQL
analytics give `cpuTimeP50` 780 µs and `cpuTimeP99` 2,994 µs against the 10 ms limit, so about 30%
at P99. But `subrequests: 0` across those requests proves none of them touched D1, so the sync path
the budget was written for is still unmeasured. And **the bundle is 202,411 bytes gzipped**, which
also retires a wrong claim: lazy-loading the strength-standards table was proposed twice as the
remedy and would save under 2%.

**Detailed step-by-step plan: `docs/m4-plan.md`.** It needs one thing from a person — a scoped
`CLOUDFLARE_API_TOKEN` in the repository's Actions secrets, since the Cloudflare MCP grant cannot
mint tokens.

*Acceptance:* the release path refuses to deploy without a green suite; a push to `main` deploys on
its own and a failing test blocks it; the smoke check passes against the live URL; sync-path CPU and
a re-derived bundle budget are both recorded in `infrastructure.md` with reasons; and the phone
checklist comes back clean.
*Budget impact:* none beyond the deploy itself. Static assets are free and uncounted.

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

### M7 — The rest of the fantasy layer
Gates with ranks and the week view, Dungeon Break, Red Gate, Instant Dungeon Key, the shadow army
with the INT-capped roster, marshals, titles, gold and the System Shop, runes surfaced in the
session screen, the Job Change Quest, the Demon Castle, Monarchs, the Reawakening Test, and the
Hunter License PNG card.

*Acceptance:* every engine feature already tested has a surface; the licence card renders and
shares via the Web Share adapter.
*Budget impact:* none.

### M8 — Push notifications
VAPID keys from the setup script, the subscription flow gated behind a user gesture, the contentless
push, and the notification composed on-device. One cron invocation a day at a fixed UTC time, per
C9 — no polling, and no self-rescheduling primitive.

*Acceptance:* a real notification arrives on the Android device; a dead subscription is deleted on
404 or 410; the handler stays inside 10 ms of CPU and 8 subrequests.
*Budget impact:* 1 cron invocation a day.

Note that this milestone is genuinely optional. It is the only unverified part of the stack, and
dropping it would remove 213 lines of Worker code, four API routes, a D1 table, the `web-push`
dependency and the VAPID secret. The app is complete without it.

### M9 — Flavour
Build-time generated System flavour text. Any runtime AI, if it ever happens, uses Workers AI so
no external key exists to leak — and not one of the model families that require a paid plan.

*Budget impact:* none at build time.

---

## 5. How the work gets checked

- **Tests before formulas.** Anything producing a number gets a Vitest case with the expected
  value as a literal, taken from the brief where the brief states one.
- **The budget guard test.** Configured caps versus documented Cloudflare allowances, as described
  in D9.
- **A local smoke script** run before each deploy: start `wrangler dev`, apply migrations, health
  check, sync round trip, dedupe check, and a tenant-isolation check. This is the
  sequence already run by hand for the sync path; it becomes a script.
- **Real CPU measurement after the first deploy.** Local wall time is not CPU time. The number goes
  into `infrastructure.md` with the date.
- **A fresh-context sub-agent audit** against `BUILD_PROMPT.md` at M4 and again at M8, because
  self-review misses what self-review wrote.

---

## 6. Residual risks, stated plainly

**Nothing in the stack can bill.** This used to be the headline risk. Cutting progress photos
removed R2, which was the only service that charged instead of failing closed. What remains is the
weaker risk that a future feature quietly reintroduces a usage-billed service — which is why
`infrastructure.md` section 2 names the ones to watch.

**A leaked Hunter License Key is full access.** That is the trade for having no login screen, and
the brief chose it deliberately. It is bounded by the per-hunter rate limit,
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
