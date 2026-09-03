# TODO

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## Where the build stands (paused 2026-09-03)

Done: the whole domain engine, the data model, the storage layer, the platform adapters, the
identity and sync client, the Worker with D1 and the cron trigger, and the service worker.
414 tests pass and every TypeScript project typechecks clean.

Not started: the React user interface. Every screen still needs building, along with the icons,
the setup script and the CI workflow. The engine behind those screens is finished and tested, so
what remains is presentation work on top of a working core.

The sequenced plan lives in `docs/implementation-plan.md`, and the verified Cloudflare limits and
resource budget live in `infrastructure.md`. Read both before starting. Milestone M4 in the plan
is the point at which this becomes usable on a phone in the gym.

## Corrections to land first (found by running the Worker; see docs/implementation-plan.md)
- [ ] C1 Move `migrations_dir` inside the d1_databases entry; wrangler warns it is unexpected
- [ ] C2 Set `compatibility_date` to 2026-09-02, since today's date is newer than the runtime runs
- [ ] C3 Reduce the multi-row insert to 16 rows; 20 rows is exactly D1's 100-parameter limit
- [ ] C4 Sync payloads cross as opaque strings so the Worker does no JSON work; cap rows at 200
- [ ] C5 Rename the sync response `applied` field to `received`; it reports offered, not inserted
- [ ] C6 Contentless push, and cap subscriptions per cron run at 8 (subrequest and CPU limits)
- [ ] C7 Stop re-reading the whole database after every logged set; append in memory instead
- [ ] C8 Use the Zod 4 idiom `z.url()` rather than `z.string().url()`
- [ ] C9 One daily cron instead of `*/15` polling; drop `isDue`, `notify_minute`, `tz_offset_min`
- [ ] C10 Delete the photo and Cloudinary remnants: the Dexie `photos` table and `LocalPhoto`, the
      five repo photo functions, the three photo settings fields, and the Cloudinary hosts in
      `public/_headers`
- [ ] Add the guard test asserting our configured bounds sit under the documented Cloudflare limits

## Phase 0 — Awakening, logging, PWA
- [x] Scaffold Vite + React + TS + Tailwind, pnpm, strict tsconfig
- [x] Domain types + Zod schemas (single source of truth)
- [x] Unit conversion layer (store kg/cm, convert at render only)
- [x] Day-rollover clock at 04:00 local
- [x] Dexie schema + repositories
- [x] Exercise library seeded from the real training week, with aliases
- [x] Seed the 6 routines including Thursday and Friday supersets
- [ ] Awakening Test onboarding (sex, bodyweight, height, age, training years, units, equipment)
- [ ] Optional skippable tape and body-fat step at end of onboarding
- [ ] Session logging UI (log sets, weight, reps, RPE, warmup flag)
- [ ] Rest timer with Screen Wake Lock
- [ ] PWA manifest, icons, Workbox precache, install prompt (Android)
- [ ] Double Dungeon first-launch sequence

## Phase 1 — Game layer
- [x] XP formula and level curve, calibrated to about level 50 per year
- [x] Five stats: derived half (28-day rolling window)
- [x] Five stats: allocated half (3 points per level) biasing quest generation
- [ ] Status Window home screen
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
