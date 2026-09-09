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

*Correction, M4 finding H1:* that fallback was proposed twice and never measured. The standards
table is 3.7 KB gzipped, under 2% of the total — lazy-loading it would not have helped and was never
implemented. M4 commit 3 found the bundle's real second-largest contributor (`motion`, 84 KB
gzipped for one component's one-time animation) and cut that instead; see the M4 section below.

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

*The step-by-step M1 plan was deleted once M1 landed; it is in git history at `3edda1e`.*

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

*The step-by-step M2 plan was deleted once M2 landed; it is in git history at `3edda1e`.*

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

*The step-by-step M3 plan is in git history at `3edda1e`.* Its first three commits are engine and store
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

All five commits have landed. **The release path now runs the suite, not just the typechecker**, and
a post-deploy smoke check (health, an unauthenticated 401, an unknown route's 404, the SPA fallback)
runs after every `pnpm run deploy`. **The sync path's real CPU is measured**, not estimated: P50
3.08 ms, P99 10.82 ms, over a window of M6's real `/api/sync` traffic — over the 10 ms limit at P99,
on too small a sample to be certain, plausibly the heaviest 17-19-row session pushes the budget was
written for. **The bundle was attributed and a real budget derived**: `motion` turned out to be the
second-largest thing in it (84 KB gzipped, for one component's one-time first-launch fade) and was
cut entirely; the 200 KB line from M2 was replaced with one tied to install time on Slow 4G (under
3 seconds, about 480 KB) rather than public-website habits. Current total: 200.87 KB gzipped, under
half that budget. Full detail in `infrastructure.md` §3.

**Commit 4, the Actions workflow, landed 2026-09-09**: `.github/workflows/deploy.yml` installs with
the frozen lockfile (pnpm pinned to the `packageManager` field, so a floating CI pnpm below 10.16
cannot silently ignore `.npmrc`'s `minimum-release-age`), then runs `pnpm run deploy` — verify,
build, `wrangler deploy`, smoke check — on every push to `main`. The user created the scoped
`CLOUDFLARE_API_TOKEN` the Cloudflare MCP grant could not mint and added it as a repository secret;
the first run (`run 34400341485`) passed end to end and deployed live.

Only the phone checklist (Home Screen install, a session logged in airplane mode, the rest timer
surviving a locked screen, Lighthouse) remains — it needs a physical device, not automation.

*Acceptance:* the release path refuses to deploy without a green suite — met; a push to `main`
deploys on its own and a failing test blocks it — met; the smoke check passes against the live URL —
met; sync-path CPU and a re-derived bundle budget are both recorded in `infrastructure.md` with
reasons — met; the phone checklist comes back clean — outstanding, user-only.
*Budget impact:* none beyond the deploy itself. Static assets are free and uncounted.

### M5 — The game layer

Landed as eight commits, in order. Four were corrections found reading the engine and store before
touching UI, same shape as M3's findings: `ensureSeeded` only ever `bulkAdd`'d exercises missing by
id, so a device seeded before a correction (the `bodyweightFactor` fix in `5ce8d44`) kept reading
the old row forever — now upserted unconditionally, with routines staying add-only since those will
become user-editable. The fatigue gauge read a brand-new hunter's first week as `danger` — the
28-day chronic window was mostly empty, so acute/chronic sat near 4.0 — held to `insufficient_data`
now until the chronic window actually spans four weeks of training. A bodyweight movement (weight
always 0) could never win a boss kill through `resolveBosses`, so a pushups-and-pull-ups programme
set no PRs ever; `resolveRepRecords` is the rep-count equivalent. And `completeDailyQuest`'s
`progressByKind` parameter was declared but ignored — the quest was all-or-nothing; it now merges
entered progress additively into the stored payload and pays out once every item is met.

The remaining four built the Status Window into the home screen: the Daily Quest panel with its
per-item entry controls, the streak panel with the forgiveness controls
(`declareAbsence`/`spendRestToken`) wired in, stat allocation plus the fatigue ring
(`SegmentedRing`'s first real caller, having landed uncalled with the visuals work), the weekly
volume bars and the deload prompt and the dismissible advisories, and a level-up window —
`recompute()` is the one choke point every XP-changing action passes through, so it is also the one
place a level change can be caught regardless of which action caused it.

A same-day addition, not part of the eight: the segmented-ring construction turned out to fit a
rest-timer countdown as well as a fatigue gauge, so `useRestTimer` gained `elapsedPct` and the gate
screen's rest timer shows a ring that fills as time runs out.

Two defects found on a real device screenshot mid-milestone, fixed alongside: `SystemWindow` had
grown two design systems — `sharp` was an opt-in only the Status Window used, so it was made the
only look; and `StatRow`'s meter stopped a third of the way across the card because `StatBar`, a
flex row in its own right, shrank to fit its own content as a plain flex item one level up.

*Acceptance:* the daily quest scales with level as specified; the penalty quest adds work and never
removes progress and now carries the hunter's actual recorded progress rather than an assumed zero;
a rest token forgives yesterday and holds the streak; a level change announces itself once,
regardless of which action caused it. 595 tests passing, typecheck and `check:render` clean.
*Budget impact:* the initial-route bundle measured 205.33 KB JS + 5.86 KB CSS gzipped after this
milestone (M4's own visuals-work measurement was 203.37 KB JS just before it) — still pending M4
H1/H2's real, measured budget rather than the invented 200 KB line.

### M6 — Sync and System Link
Landed as six commits. `runSync` had never been called from anywhere in the app before this
milestone; wiring it in turned out to need no seam-fixing at all — a live run against the deployed
Worker with real Dexie rows (a full session, a correction, a re-push) confirmed push, idempotent
pull, dedupe and forget-me all work exactly as the client and Worker already implemented them.
`syncNow` is fire-and-forget and coalesced, so two triggers firing together produce one request, and
a failure backs off exponentially before giving up rather than retrying forever — never reachable
from `logSet` or `correctSet`, only from app foreground, after `finishGate`, and a manual button. A
client-side daily request budget (300, well under the Worker's 100,000/day hard limit) persists
across reloads so a runaway client stops itself.

The `/link` screen states the loss warning before showing the key: no account, no password reset,
losing the key loses the mirror. `qrcode` renders the pairing QR and is bundled outright; `jsqr` is
dynamically imported only when `BarcodeDetector` is absent, confirmed in its own chunk and never
touched by the main bundle on the one platform (Android Chrome) that has the native detector.
Scanning another device's key adopts it as this device's identity and resets the local sync cursor,
additively — nothing already logged on the device is touched.

Two-device convergence needed no fix either: `dropSuperseded` already collects every `supersedes`
reference before filtering, so a correction arriving ahead of the row it replaces was already safe —
confirmed both by an explicit domain test and a live run pulling one device's pushed rows into a
second, genuinely separate Dexie database, where both projected to identical tonnage and XP.

*Acceptance:* two independent Dexie databases under the same Hunter Secret converge on the same
projection; a correction is safe regardless of arrival order; `logSet` triggers no network call
(asserted in a test); airplane mode never blocks logging, reports offline, and recovers on
reconnect; two simultaneous triggers produce one request; a failing Worker backs off and stops;
`jsqr` is absent from the initial bundle; every route including `/link` still mounts.
*Budget impact:* the Worker request budget starts being used — about 50 requests a day against
100,000, with a 300/day client-side cap as a backstop.

### M7 — The rest of the fantasy layer

Split in two once written (`docs/m7-plan.md` §0), because eleven of the fourteen originally listed
items were surfaces over engine code that already existed and was already tested, while three —
the System Shop, the Job Change Quest, and the Reawakening Test — need designing from scratch. Only
the eleven shipped as M7; the other three are **M7b**, planned separately.

Landed across seven commits: the gate week view with Dungeon Break marked (commit 1); Red Gate and
Instant Dungeon Key made fully playable, which required real store actions
(`startInstantDungeon`, `enterRedGate`, `resolveRedGate`) rather than the read-only surface first
assumed, and surfaced a structural bug where `gateRank` was silently null for any session without a
matching `Routine` — fixed in `projection.ts` (commit 2); titles, runes and gold on the Status
Window, gold shown honestly with no Shop to spend it in yet (commit 3); the Demon Castle tower and
Monarchs, read from `projection.nextTowerFloor` and `towerFloorCleared` (commit 4); the shadow army
roster with the INT-derived cap made legible — benching an active shadow promotes a dormant one by
`resolveRoster`'s existing ordering, so the hunter chooses who stays rather than the System picking
(commit 5); the Hunter License PNG card, the app's first canvas rendering, drawn at the real device
pixel ratio and shared through the `shareImage` adapter with a download fallback, showing
`identity.hunterId` and never the license key (commit 6); and route-level code splitting for the
tower, roster and license card panels via `React.lazy`, since none of them sits on the path to
logging a set (commit 7).

*Acceptance:* every engine feature already tested has a surface; the licence card renders sharp at
3x device pixel ratio and shares via the Web Share adapter with a working download fallback; a
shadow going dormant when the cap falls is explained rather than silently dropped.
*Budget impact:* none. Initial-route bundle after commit 7: 196.16 KB JS + 5.97 KB CSS + 2.20 KB
`workbox-window` ≈ 204.33 KB gzipped — the tower, roster and license card panels now ship in their
own chunks (0.49 + 0.84 + 1.47 KB gzip) fetched only when the Status Window renders, rather than
growing the initial chunk. Still under M4's ~480 KB Slow-4G install budget.

### M7b — The System Shop, the Job Change Quest, and the Reawakening Test

The three items M7 was split away from (`docs/m7b-plan.md` §0), because each needed an engine
designed rather than a surface built: `hunterClass` had been hardcoded `'none'` since M2, gold had
had two sources and no sink since M3, and `domain/bodycomp.ts`'s `remeasureDue` had been written and
never called.

Landed across seven commits: `classFromStats` picks Fighter/Tanker/Assassin/Ranger from whichever of
STR/VIT/AGI/PER is highest, with an explicit tie-break rather than an accidental one — INT is
excluded, since it already governs the shadow roster's mana capacity (commit 1); `hunterClass`
derived from a completed `job_change` `QuestLog` row rather than stored on `Progress`, so a
correction re-grades the class exactly like every other derived figure, plus a `jobChangeDue`
Status Window line that explains "no class yet" instead of dead-ending on it (commit 2); the Job
Change Quest wired into `ensureQuestsForToday` and a surface with the benchmark-week framing — made
explicit as framing, not an enforced timer, since nothing in the brief specifies what a partial
week should do (commit 3); `QuestLog.supersedes` (the same pattern as `SetLog.supersedes`) and the
Daily Quest reroll, which required fixing every dayKey+type quest lookup to resolve the active
(non-superseded) row rather than assuming one row per day (commit 4); the Shop engine — a two-item
catalogue (Rest Token, Quest Reroll), priced by calibration against real gold income rather than
invented, with a closed-set test enforcing "gold never buys what the log has to earn" (commit 5);
the Shop surface, replacing the now-inaccurate GoldPanel (deleted) — a Quest Reroll purchase checks
there is something open to reroll *before* charging gold, so a no-op purchase never happens (commit
6); and the Reawakening Test, reframed from "recomputes rank" (rank already recomputes on every
call) to "a prompt to re-measure" — the input goes stale, not the arithmetic — reusing the
Awakening Test's own physique-step fields (commit 7).

*Acceptance:* nothing in the Shop catalogue grants XP, stats, rank, a gate clear, or an untrained
streak day; a rerolled-away Daily Quest generates no penalty for the row it replaced; the Job Change
Quest is offered exactly once, at level 20, and never again once completed; the Reawakening Test
prompts on an 8-to-12-week cadence and changes no derived figure except through the new
measurement's own inputs.
*Budget impact:* none. Initial-route bundle after commit 7: 197.91 KB JS + 5.99 KB CSS + 2.20 KB
`workbox-window` ≈ 206.10 KB gzipped, still under M4's ~480 KB Slow-4G install budget.

### M8 — Push notifications — **parked 2026-09-07**

Deliberately deferred until the rest of the platform is finished, at the user's decision. Nothing is
removed: the Worker endpoints, `fetchPushKey`, the subscription helpers and the capability adapters
all stay where they are and stay tested. Nothing wires them, and nothing will until M7 and M9 are
done and push can be judged on whether it is still wanted.

This is the milestone the plan already called genuinely optional — the only unverified part of the
stack, and the app is complete without it.

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

Variety pools for the System's eight most-repeated announcements (level up, Daily Quest arrived,
rest token spent, penalty issued, Red Gate cleared/failed, boss slain, deload recorded), so the
hundredth gate does not read identically to the first. `ARISE.` stays fixed — the one line canon
treats as immovable.

Generated ahead of time and committed as data, never at runtime: a network call on the finish-gate
path would put the app's most important moment behind a request, in exactly the gym-basement
environment the offline rule exists for. Landed across four commits: `domain/flavour.ts`'s
`flavourFor(table, key, seed, fallback)`, a pure, deterministic lookup that falls back to the
caller's own current line on a missing key or an empty table (commit 1); `scripts/generate-flavour.mjs`,
run by hand like the other `generate-*.mjs` scripts, producing gitignored candidates for review —
not a build step, so a bad line can never ship unread (commit 2); every call site rewired to read
through `flavourFor`, reviewable as a pure refactor since the table started empty and behaviour
stayed byte-for-byte identical (commit 3); and the table itself, filled with lines curated from 37
generated candidates — each pool keeps the exact line already shipped, so old behaviour stays one
of the possible outcomes rather than being replaced (commit 4). One real mismatch was caught during
that last step (a curated line read "The Daily Quest has arrived" against a fallback of "Daily Quest
has arrived", no "The") and fixed before it shipped.

*Acceptance:* `flavourFor` is pure — same key, seed and table always return the same line, so an
event never flickers across re-renders; a missing key or empty table always falls back to the
line the app ships today; every line in the committed table was read before it shipped.
*Budget impact:* none at build time. Bundle after commit 4: 198.49 KB JS + 5.99 KB CSS + 2.20 KB
`workbox-window` ≈ 206.68 KB gzipped, still comfortably under M4's ~480 KB Slow-4G install budget.

### M10 — The Status Window, made faithful and readable

Driven by using the app rather than building it: the Status page read as sixteen equally-weighted
panels in one nine-screen scroll, against a supplied screenshot of the anime Status window plus
researched source material. Landed across ten commits (`docs/m10-plan.md`, now `git rm`'d — detail
recoverable at the commits named in `docs/TODO.md`'s M10 entry).

Two standalone gym bugs first: `keepScreenAwake` was stored, defaulted true, and read nowhere —
wired through `createWakeLock()` whenever a session is live, not only while resting; and the rest
timer dock was Gate-only, so checking the Daily Quest mid-rest lost the countdown — lifted into
`root.tsx` above the tab bar (commit 0). Then the design pass itself: near-white bold type and
`font-variant-numeric: tabular-nums` in place of the muted monospace-everywhere read; `SystemIcon`'s
default stroke doubled to 2.5px; `SystemValue`, the large-figure-over-dim-max pair the reference
draws at every one of six sites; and `SystemMeter` rebuilt in four layers (near-white outline, inset
gap, dim body, fixed 2px core) after the previous single-alpha fill was found to collapse at small
heights (commit 1). The mega-window split into an inline head — vitals strip, two-column stat grid,
class line — with the six archive panels (fatigue detail, volume, warnings, roster, tower, license)
moved behind a summon list and a `SystemOverlay`, which window is open living in the URL search
param rather than `Settings` so the hardware back button closes it for free (commits 2-3).

The Daily Quest gained the canon deadline ring (`SegmentedRing`, freed by commit 2), the penalty
stake quoted from the System's own voice, a reward block pulled out of the header caption, and
GOAL/CLEARED task groups in place of a disclosure control (commit 4). Weekly volume split into a
Trained group and a collapsed Untrained line; advisories went title-only with severity read as a
left edge rule, revealing finding/suggestion/acknowledge only on the row tapped open and collapsing
anything past three behind a count (commit 5). Every gym-relevant target reached the 44px floor;
Daily Quest progress moved from a keyboard-summoning number input to reps/metres steppers with
manual entry behind a pill; Revoke Allocation became the one new confirmation this milestone adds,
moved into the Status footer under an allocation banner that only appears with unspent points; and
the Hunter License canvas moved behind a footer button so its chunk is never fetched on a normal
visit (commit 6). A blueprint grid layer, a staggered per-window entrance driven by an `index` prop,
and a copy pass (Dismiss → Acknowledge, Bench/Activate → Return/Summon, and the rest) landed across
all three routes at once rather than as a Status-only treatment (commit 7). Each stat row gained a
one-line caption naming what it is derived from, cited back to `domain/stats.ts` rather than
restated (commit 8). Finally the window title became a bordered box straddling the top border,
`SystemPanel` gained a `boxed` variant for the vitals strip and stat grid, and the frame itself now
levels up with the hunter — a `frameTierFor(rank, hunterClass)` lookup threaded through every
`SystemWindow` via a `FrameTierContext` set once in `root.tsx`, so Gate and Link inherit the same
tier automatically rather than each route wiring it by hand (commit 9).

*Acceptance:* an open session's screen never sleeps; a gate's rest timer is visible from any route;
`todaysDailyQuest`'s deadline ring and warn threshold are computed from an injected clock, never
`Date.now()` inside `src/domain/`; a fully cleared Daily Quest renders as one row; an all-zero
volume list renders no meters; a stepper tap pays the same store action a manual entry would; the
Hunter License canvas chunk is absent from the network tab until its button is pressed; the frame
tier is derived from the projection every render, never stored.
*Budget impact:* one context provider and a handful of new small components; no new dependency.
The one item this milestone could not settle from a keyboard — real-device scroll framerate with
`[ANALYSIS]` summoned and the frame at its brightest — still needs a phone.

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
