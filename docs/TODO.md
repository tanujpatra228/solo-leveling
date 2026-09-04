# TODO

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## Where the build stands (M2 landed 2026-09-04)

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

Step-by-step plan for all of the above: docs/m1-plan.md

Step-by-step plan for M2, with six findings from surveying the ground: docs/m2-plan.md

Step-by-step plan for M3, with six findings in the engine and store: docs/m3-plan.md
Commits 1-3 of M3 (G1-G6) need no UI and can land before M2.

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
- [ ] Session logging UI (log sets, weight, reps, RPE, warmup flag)
- [ ] Rest timer with Screen Wake Lock
- [ ] G1 `targetFor` resolves the routine by today's day of week, not the active session's
      `routineId`. A session crossing the 04:00 rollover falls through to the default 3 planned
      sets, so Friday's 4-set squat is shown 3 rep targets with no sign the number is a fallback
- [ ] G2 `BlockItem.repRange` is seeded deliberately and never read - the engine only ever uses
      `exercise.repRange`. Not wrong today (every seeded value matches) but two sources of truth for
      one fact, and editing a routine's rep range would silently do nothing. Engine takes an override
- [ ] G3 Nothing supplies `startGate`'s optional `bodyweightKg`, and `projection.ts` feeds it into
      tonnage for every `usesBodyweight` exercise. Omitting it counts a bodyweight push-up as zero
      tonnage, understating XP silently. Default it inside the store, not at the call site
- [ ] G4 `state.correctSet` cannot patch `isWarmup` though `repo.correctSet` can. It is the one
      correction that changes the future: warmups are filtered out of the progression input
- [ ] G5 `logSet` computes `order` as `existing.length`, which counts superseded rows - a correction
      leaves a duplicate order and a gap. Low severity (`dropSuperseded` runs before any sort) but
      `max(order) + 1` over live rows is the honest computation
- [ ] G6 The rest timer cannot use `setInterval`: hidden tabs throttle to ~once a minute and squat
      rest is 210s. Derive from an absolute `endsAt`, recompute on `visibilitychange`, and re-acquire
      the wake lock on becoming visible - `createWakeLock()` drops its sentinel when the page hides
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
