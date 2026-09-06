# TODO

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## Exercise substitution, landed 2026-09-06

All eight commits of the substitution plan (git history, deleted; see `3edda1e`-style note below)
are in — not a milestone from `implementation-plan.md`, but a full feature written and shipped the
same day it was found needed, from a real Saturday Cardio and Abs Gate where two stations in a row
were occupied.

- [x] **C1** `bodyweightFactor` per exercise, replacing "full bodyweight for any `usesBodyweight`
      movement" (a sit-up does not move 72 kg — commit `5ce8d44`). Re-grades history, since the
      projection is derived, never stored (rule 4); announced once via a System window comparing the
      level before and after.
- [x] **C2** XP for time/distance work at 20 XP/minute — `isHardSet` rejected `reps <= 0` outright,
      so a treadmill interval earned zero XP and zero gate credit (`27c12f0`).
- [x] **C3** One progression ladder per movement pattern, fixing Incline/Pike/Diamond Pushups
      disagreeing with Pushups' own ladder (`66d39f5`).
- [x] **C4** `role: 'prescribed' | 'fallback'` on `ExerciseSchema`, plus 16 seeded fallbacks for the
      equipment deserts the audit found (`5d33216`).
- [x] **C5** `substitutesFor`, the pure ranking function: excludes anything needing blocked
      equipment, tiers the rest by pattern/muscle match, ranks by ladder adjacency and rep-range
      overlap, demotes anything already in today's routine (`d07154c`).
- [x] **C6** `SetLog.substitutedFor`/`substitutionReason`, and the `substituteExercise` store action
      (`9de7140`).
- [x] **C7** The Swap control on every block in `ActiveGateScreen` (`6b2b0eb`).
- [x] **C8** The substitution count in the finish-gate summary (`4d6f484`).

**Known gap, not yet fixed:** `repo.ensureSeeded()` only `bulkAdd`s exercises missing by id — it
never updates a row already in Dexie. A real device seeded before C1/C4 will not pick up the
corrected `bodyweightFactor` values or the new fallback exercises until exercise seeding upserts
unconditionally (safe, unlike routines, since exercises are never hand-edited).

**Also known:** the initial-route bundle is 200.76 KB JS + 5.52 KB CSS gzipped, over the 200 KB
target `infrastructure.md` set at M2 (which was already "at the line" before this feature). Nothing
failed the build — there is no automated gate on this number — but it is drifting and worth a
code-splitting pass before it drifts further.

## Bugs found on a real device after M3, fixed 2026-09-06

Both reproduced by clicking Start Gate on `/gate`.

- [x] **`/gate` crashed with React #185** the instant a session opened. `targetFor` called
      `computeNextTarget` fresh on every read, and a Zustand v5 selector that calls a store method
      returns a new object every render — `useSyncExternalStore`'s `Object.is` check never settles,
      so the component re-renders forever. Fixed by computing every exercise's target once in
      `recompute()` (`targetsByExerciseId`), so `targetFor` and the map itself are stable references
      until the next real state change. Also added `abandonGate` (deletes an open session and its
      sets outright) since a session stuck open behind the old crash had no other way out.
      Written up as engineering-standards rule 13, with `scripts/check-render-rules.mjs` enforcing
      the mechanical half of it in `pnpm run build`.
- [x] **Opening a gate paid a full E-rank gate-clear bonus (200 XP) before any set was logged.** Two
      defects combined: `gateDifficulty([])` scored 0 but still returned the initialiser rank `'E'`
      (an empty plan is not an E-rank session — it is no session), and `projectPlayer` walked every
      session with no `endedAt` filter, so an open session banked XP, tonnage, PRs and a gate rank
      immediately rather than waiting for Finish Gate. Fixing only one hid the other. Written up as
      engineering-standards rule 15.

Regression tests: `src/domain/gates.test.ts` (empty plan → null rank), `src/domain/projection.test.ts`
("an open session pays nothing until it is finished"), `src/app/state.test.ts` (the same through the
real store actions, plus a `targetFor` reference-stability test).

Rule 14's route mount tests now exist: `src/app/routes/routes.dom.test.tsx`, four routes under
happy-dom. They assert TanStack Router's `CatchBoundary` is absent rather than that nothing threw,
because the router catches a render crash and swaps in its own "Something went wrong!" screen — a
test looking for a throw passes green while the app is dead. Verified against a deliberately
unstable selector: only the live-session case goes red, which is the production symptom exactly.

## Where the build stands (M3 landed 2026-09-04)

All seven commits of the M3 plan (git history, `3edda1e`) are in. The engine, store, and rest-timer corrections
(G1-G6) landed first, needing no screen to exist; then the gate screen itself — live blocks and
supersets in the routine's own order, each with its target and reason from the progression engine,
thumb-sized set entry per the exercise's unit, in-place correction, and the rest timer wired to the
Screen Wake Lock and a chime. M3-D5's full Friday Legs integration test passes: 17 sets logged,
finished, and every exercise's next target reads `increase_load` at the right increment.

One deliberate scope cut from the plan: no separate session-summary *screen*. `finishGate` already
queues everything a summary would show — tonnage, hard sets, XP, gate rank, PRs, shadows, titles —
through `pushMessage`, and `MessageQueue` renders it. Building a second screen for the same numbers
would have been an abstraction the milestone didn't need; revisit only if the message-queue
presentation turns out not to read as a summary on a real phone.

## Where the build stood (M2 landed 2026-09-04)

Done: the whole domain engine, the data model, the storage layer, the platform adapters, the
identity and sync client, the Worker with D1 and the cron trigger, the service worker, and now the
app shell: entry point, router, the System component vocabulary, identity persistence, the
Awakening Test, the Double Dungeon, and the minimal Status Window. `pnpm run build` succeeds.
448 tests pass and every TypeScript project typechecks clean.

Not started: session logging, the rest timer, targets, and everything past the E-Rank window. The
engine behind those screens is finished and tested, so what remains is presentation work on top of
a working core.

The sequenced plan lives in `docs/implementation-plan.md`, and the verified Cloudflare limits and
resource budget live in `infrastructure.md`. Read both before starting. Milestone M4 in the plan
is the point at which this becomes usable on a phone in the gym.

## Corrections landed (found by running the Worker; see docs/implementation-plan.md)
- [x] C1 Move `migrations_dir` inside the d1_databases entry; wrangler warns it is unexpected
- [x] C2 Set `compatibility_date` to 2026-09-02, since today's date is newer than the runtime runs
- [x] C3 Reduce the multi-row insert to 16 rows; 20 rows is exactly D1's 100-parameter limit
- [x] C4 Sync payloads cross as opaque strings so the Worker does no JSON work; cap rows at 200
- [x] C5 Rename the sync response `applied` field to `received`; it reports offered, not inserted
- [x] C6 Contentless push, and cap subscriptions per cron run at 8 (subrequest and CPU limits)
- [x] C7 Stop re-reading the whole database after every logged set; append in memory instead
- [x] C8 Use the Zod 4 idiom `z.url()` rather than `z.string().url()`
- [x] C9 One daily cron instead of `*/15` polling; drop `isDue`, `notify_minute`, `tz_offset_min`
- [x] C10 Delete the photo and Cloudinary remnants: the Dexie `photos` table and `LocalPhoto`, the
      four repo photo functions, the three photo settings fields, and the Cloudinary hosts in
      `public/_headers`
- [x] C11 Sync client resends the same batch on every pull round; send once, then pull with an
      empty change set. Also fixes the double-counted `pushed` total
- [x] Extract the bounds into `worker/limits.ts` and add the guard test asserting they sit under the
      documented Cloudflare limits

Step-by-step plans for M1, M2 and M3 were deleted once each milestone landed. They are in git
history at `3edda1e` (`docs/m1-plan.md`, `m2-plan.md`, `m3-plan.md`). Only the current
milestone's plan is kept on disk; see `docs/m4-plan.md`.

## Phase 0 — Awakening, logging, PWA
- [x] Scaffold Vite + React + TS + Tailwind, pnpm, strict tsconfig
- [x] Domain types + Zod schemas (single source of truth)
- [x] Unit conversion layer (store kg/cm, convert at render only)
- [x] Day-rollover clock at 04:00 local
- [x] Dexie schema + repositories
- [x] Exercise library seeded from the real training week, with aliases
- [x] Seed the 6 routines including Thursday and Friday supersets
- [x] Awakening Test onboarding (sex, bodyweight, height, age, training years, units, equipment)
- [x] Optional skippable tape step at end of onboarding (waist, neck, hip; body-fat % deferred to
      the M5 Physique panel, along with a live Navy-formula estimate)
- [x] F1 **Persist the Hunter Secret.** `createIdentity()` was never called and the secret was
      stored nowhere, so an identity would not survive a reload and System Link could never pair.
      New Dexie `identity` store, minted on first launch, kept by `clearAll()` unless explicitly
      forgotten
- [x] F4 `parseHeightToCm` for imperial height entry; `parseWeightToKg` had no length equivalent
- [x] F5 The Double Dungeon branches on `useReducedMotion()`, not CSS — the global reduced-motion
      rule in `index.css` would make a keyframe-driven sequence flash instead of degrade
- [x] F6 (deferred, correctly) Vitest collects `*.test.ts` only, so a component test would need to
      stay non-JSX or the include pattern would need to change. Sidestepped rather than fixed: the
      onboarding step machine is pure and tested instead, and the components that read it are thin
      and untested by design. Still open for the rest timer in M3, the first real candidate for a
      DOM testing stack
- [x] Session logging UI (log sets, weight, reps, RPE, warmup flag)
- [x] Rest timer with Screen Wake Lock
- [x] G1 `targetFor` resolves the routine by today's day of week, not the active session's
      `routineId`. A session crossing the 04:00 rollover falls through to the default 3 planned
      sets, so Friday's 4-set squat is shown 3 rep targets with no sign the number is a fallback
- [x] G2 `BlockItem.repRange` is seeded deliberately and never read - the engine only ever uses
      `exercise.repRange`. Not wrong today (every seeded value matches) but two sources of truth for
      one fact, and editing a routine's rep range would silently do nothing. Engine takes an override
- [x] G3 Nothing supplies `startGate`'s optional `bodyweightKg`, and `projection.ts` feeds it into
      tonnage for every `usesBodyweight` exercise. Omitting it counts a bodyweight push-up as zero
      tonnage, understating XP silently. Default it inside the store, not at the call site
- [x] G4 `state.correctSet` cannot patch `isWarmup` though `repo.correctSet` can. It is the one
      correction that changes the future: warmups are filtered out of the progression input
- [x] G5 `logSet` computes `order` as `existing.length`, which counts superseded rows - a correction
      leaves a duplicate order and a gap. Low severity (`dropSuperseded` runs before any sort) but
      `max(order) + 1` over live rows is the honest computation
- [x] G6 The rest timer cannot use `setInterval`: hidden tabs throttle to ~once a minute and squat
      rest is 210s. Derive from an absolute `endsAt`, recompute on `visibilitychange`, and re-acquire
      the wake lock on becoming visible - `createWakeLock()` drops its sentinel when the page hides.
      `src/app/rest-timer.ts` holds the pure arithmetic; `src/app/useRestTimer.ts` wires it to the
      gate screen with the wake lock, the chime, and sessionStorage per M3-D3
- [x] PWA icons generated by script with no new dependency (scripts/generate-icons.mjs)
- [x] Read-only Today's Gate screen, so the programme is on the phone before logging exists
- [x] Rest days: no quest, no penalty, and the streak steps over them. Fixed a second bug where the
      longest streak could never exceed 6 on a six-day week
- [x] workers.dev subdomain, D1 database and its schema, all created through the Cloudflare API
- [ ] `wrangler login`, then the first deploy — the only step that needs a person
- [ ] PWA manifest verified on device, Workbox precache confirmed, install prompt (Android)
- [x] F2 (closed) `public/` held only `_headers`: the favicon, apple-touch-icon and all three manifest icons
      referenced by `index.html` and `vite.config.ts` do not exist yet (M4, unless the build refuses)
- [x] Double Dungeon first-launch sequence

## M4 — Installed, automated, and measured

- [x] PWA icons generated by script, no new dependency
- [x] Private GitHub repository, pushed
- [x] First real deploy, verified with curl
- [x] CPU measured from Workers GraphQL analytics: P50 780 us, P99 2994 us (cheap paths only)
- [ ] H6 `pnpm run deploy` runs the typechecker but never vitest, so it can ship a red suite.
      Add a `verify` script and make `deploy` depend on it
- [ ] H3 Measure the sync path: it has never been measured. `subrequests: 0` on the four sampled
      requests proves none of them touched D1. Push a real batch to the deployed Worker, re-query
      the quantiles, then `POST /api/forget-me` so the synthetic hunter leaves nothing behind
- [ ] H1/H2 Attribute the bundle with a throwaway sourcemap build via `pnpm dlx`, then write down a
      budget with a reason. Lazy-loading the standards table is NOT the fix - it is 3,733 bytes
      gzipped, under 2% of the JS. That remedy was asserted twice without measuring it
- [ ] Post-deploy smoke check: health, 401 on unauthenticated sync, JSON 404, SPA fallback on /gate
- [ ] H4 GitHub Actions workflow. Blocked on a scoped CLOUDFLARE_API_TOKEN in repo secrets - the
      Cloudflare MCP grant returns 9109 on token creation, so this needs a person
- [ ] H5 The setup script is now disaster recovery rather than setup, and wants writing after the
      VAPID keys exist in M8. Demoted off the critical path
- [ ] Record every measured number in infrastructure.md, replacing the "~1-2 ms" estimate

### On the phone, which nothing here can check
- [ ] Add to Home Screen, and confirm the icon is the chevron mark
- [ ] Launches standalone: no browser chrome, dark, portrait
- [ ] Airplane mode: start a gate, log sets, use the rest timer, finish
- [ ] Rest timer with the screen locked for a minute - remaining time correct, not frozen (M3 G6)
- [ ] Lighthouse PWA category against the live URL
- [ ] Sunday morning: confirm the Rest Day window

Step-by-step plan: docs/m4-plan.md

## Phase 1 — Game layer
- [x] XP formula and level curve, calibrated to about level 50 per year
- [x] Five stats: derived half (28-day rolling window)
- [x] Five stats: allocated half (3 points per level) biasing quest generation
- [x] Status Window home screen (minimal E-Rank window; quests, roster and fatigue detail are M5)
- [x] Daily Quest generation and completion (engine; screen pending)
- [x] Streak tracking, rest tokens, illness and travel declaration, streak freeze
- [x] Penalty Quest on missed daily (adds work, never deletes progress)

## Phase 2 — Progression engine (the deliverable)
- [x] e1RM (Epley) and PR detection
- [x] Double progression per exercise (rep range and increment table)
- [x] Bodyweight progression ladder (reps, tempo, load, variation)
- [x] Next-session target computation per exercise
- [x] Weekly hard-set volume per muscle against MEV, MAV, MRV landmarks
- [x] ACWR fatigue (7-day tonnage over 28-day tonnage divided by 4) and XP multiplier
- [x] Deload trigger (fifth week, ACWR above 1.5, or two sessions of e1RM regression)
- [x] Recovery Quest when ACWR is above 1.5
- [x] Program-gap advisories (no hinge, no grip, no unilateral, front-delt volume), dismissible

## Phase 3 — Sync
- [x] Hunter Secret generation and SHA-256 identity
- [x] D1 schema and migrations
- [x] Hono `/api/sync` with monotonic per-hunter seq
- [x] Per-hunter rate limiting in D1, not KV
- [x] Client sync loop, append-only event log only
- [ ] Hunter License Key display and loss warning
- [ ] System Link QR pairing (render and scan)

## Phase 4 — Gates and progression fantasy
- [x] Gate rank E to S from planned tonnage times intensity
- [x] Boss set is the top set, a PR is a boss kill
- [x] Dungeon Break at 7 days open, backlog penalty
- [x] Red Gate (voluntary, no partial credit)
- [x] Instant Dungeon Key (bodyweight-only from available equipment)
- [x] Hunter Rank from published strength standards, offline table
- [ ] Reawakening Test every 8 to 12 weeks
- [x] Shadow extraction, shadow ranks from e1RM percentile, INT-capped roster
- [x] Marshal shadows for strongest lifts
- [x] Titles and achievements (engine; screen pending)
- [ ] Gold and the System Shop
- [x] Runes and Skills gated by level (drop sets at 10, rest-pause at 15, clusters at 25)
- [ ] Job Change Quest around level 20
- [x] Demon Castle 100-floor tower (engine; screen pending)
- [ ] Monarchs (own past PRs, Monarch of Sloth is the longest missed streak)
- [ ] Hunter License shareable PNG stat card

## Phase 5 — Push
- [ ] VAPID keypair via setup script, private key as a Worker secret
- [x] Push subscription endpoint and D1 storage
- [x] Cron Trigger daily quest push
- [x] Service worker push and notificationclick handling
- [ ] Android install prompt and permission request from a user gesture

## Photos — dropped (decided 2026-09-03)

Progress photos fed nothing in the engine: no XP, no rank, no stats, no progression. They carried
the only billing exposure in the stack, so they were cut and R2 was cut with them. Removing the
dead code is correction C10.

## Phase 6 — Flavour
- [ ] Build-time generated System flavour text
- [ ] Optional Workers AI endpoint for free-text set parsing

## Infrastructure and ops
- [x] wrangler.jsonc with static assets, SPA fallback, D1 binding, cron
- [ ] One-time setup script (D1 create, VAPID, secrets)
- [ ] GitHub Actions deploy on push to main
- [ ] GitHub secret scanning and push protection enabled before first push
- [x] Strict CSP headers via public/_headers, since asset serving bypasses the Worker
- [x] Vitest suite over the whole domain layer (414 tests passing)
- [ ] Verification pass by a fresh-context sub-agent against BUILD_PROMPT.md
