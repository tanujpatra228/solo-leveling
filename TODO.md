# TODO

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## Blocked — do this first on resuming
- [!] Get pnpm 10.16+ onto PATH (`npm install -g pnpm@10.34.5`); the local standalone pnpm cannot
      self-update, and `minimum-release-age` is ignored below 10.16. See NOTES.md.
- [!] Re-run `pnpm install` from the deleted lockfile, then re-read resolved versions

## Phase 0 — Awakening, logging, PWA
- [~] Scaffold Vite + React + TS + Tailwind, pnpm, strict tsconfig (deps chosen, install blocked)
- [ ] Domain types + Zod schemas (single source of truth)
- [ ] Unit conversion layer (store kg/cm, convert at render only)
- [ ] Day-rollover clock at 04:00 local
- [ ] Dexie schema + repositories
- [ ] Exercise library seeded from the real training week, with aliases
- [ ] Seed the 6 routines including Thursday and Friday supersets
- [ ] Awakening Test onboarding (sex, bodyweight, height, age, training years, units, equipment)
- [ ] Optional skippable tape and body-fat step at end of onboarding
- [ ] Session logging UI (log sets, weight, reps, RPE, warmup flag)
- [ ] Rest timer with Screen Wake Lock
- [ ] PWA manifest, icons, Workbox precache, install prompt (Android)
- [ ] Double Dungeon first-launch sequence

## Phase 1 — Game layer
- [ ] XP formula and level curve, calibrated to about level 50 per year
- [ ] Five stats: derived half (28-day rolling window)
- [ ] Five stats: allocated half (3 points per level) biasing quest generation
- [ ] Status Window home screen
- [ ] Daily Quest generation and completion
- [ ] Streak tracking, rest tokens, illness and travel declaration, streak freeze
- [ ] Penalty Quest on missed daily (adds work, never deletes progress)

## Phase 2 — Progression engine (the deliverable)
- [ ] e1RM (Epley) and PR detection
- [ ] Double progression per exercise (rep range and increment table)
- [ ] Bodyweight progression ladder (reps, tempo, load, variation)
- [ ] Next-session target computation per exercise
- [ ] Weekly hard-set volume per muscle against MEV, MAV, MRV landmarks
- [ ] ACWR fatigue (7-day tonnage over 28-day tonnage divided by 4) and XP multiplier
- [ ] Deload trigger (fifth week, ACWR above 1.5, or two sessions of e1RM regression)
- [ ] Recovery Quest when ACWR is above 1.5
- [ ] Program-gap advisories (no hinge, no grip, no unilateral, front-delt volume), dismissible

## Phase 3 — Sync
- [ ] Hunter Secret generation and SHA-256 identity
- [ ] D1 schema and migrations
- [ ] Hono `/api/sync` with monotonic per-hunter seq
- [ ] Per-hunter rate limiting in D1, not KV
- [ ] Client sync loop, append-only event log only
- [ ] Hunter License Key display and loss warning
- [ ] System Link QR pairing (render and scan)

## Phase 4 — Gates and progression fantasy
- [ ] Gate rank E to S from planned tonnage times intensity
- [ ] Boss set is the top set, a PR is a boss kill
- [ ] Dungeon Break at 7 days open, backlog penalty
- [ ] Red Gate (voluntary, no partial credit)
- [ ] Instant Dungeon Key (bodyweight-only from available equipment)
- [ ] Hunter Rank from published strength standards, offline table
- [ ] Reawakening Test every 8 to 12 weeks
- [ ] Shadow extraction, shadow ranks from e1RM percentile, INT-capped roster
- [ ] Marshal shadows for strongest lifts
- [ ] Titles and achievements
- [ ] Gold and the System Shop
- [ ] Runes and Skills gated by level (drop sets at 10, rest-pause at 15, clusters at 25)
- [ ] Job Change Quest around level 20
- [ ] Demon Castle 100-floor tower
- [ ] Monarchs (own past PRs, Monarch of Sloth is the longest missed streak)
- [ ] Hunter License shareable PNG stat card

## Phase 5 — Push
- [ ] VAPID keypair via setup script, private key as a Worker secret
- [ ] Push subscription endpoint and D1 storage
- [ ] Cron Trigger daily quest push
- [ ] Service worker push and notificationclick handling
- [ ] Android install prompt and permission request from a user gesture

## Photos — Cloudinary behind an adapter (user amendment to the brief)
- [ ] `PhotoStore` adapter interface; IndexedDB implementation is the default
- [ ] Cloudinary implementation using an unsigned upload preset (no secret in the bundle)
- [ ] Cloud name and preset entered by the user in Settings, stored locally
- [ ] Delete routed through the Worker, Cloudinary API secret as a Worker secret

## Phase 6 — Flavour
- [ ] Build-time generated System flavour text
- [ ] Optional Workers AI endpoint for free-text set parsing

## Infrastructure and ops
- [ ] wrangler.jsonc with static assets, SPA fallback, D1 binding, cron
- [ ] One-time setup script (D1 create, VAPID, secrets)
- [ ] GitHub Actions deploy on push to main
- [ ] GitHub secret scanning and push protection enabled before first push
- [ ] Strict CSP headers on all routes
- [ ] Vitest suite over the whole domain layer
- [ ] Verification pass by a fresh-context sub-agent against BUILD_PROMPT.md
