# NOTES

Carry-between-sessions lessons. One entry per lesson, newest concerns first. Read this before
starting work.

---

## WHERE I LEFT OFF (2026-09-03, second pause) - read this first

Everything below the user interface is built, tested, and committed. Two commits are on `main`
and the working tree is clean. No GitHub remote exists yet and nothing has been deployed.

`pnpm run test` gives 414 passing tests across 23 files. `pnpm run typecheck` is clean across all
four TypeScript projects.

### What exists

- `src/domain/` - the whole engine, pure and tested: progression, e1RM, volume landmarks, ACWR,
  deload, XP and levels, the hybrid stats, rank from real published tables, body composition,
  quests, gates, shadows, titles, runes, the 100-floor tower, programme advisories, streaks, and
  the projection that rebuilds player state from the log.
- `src/db/` - the Dexie schema and the repository. Nothing else touches IndexedDB.
- `src/platform/capabilities.ts` - adapters for wake lock, haptics, the chime, install prompt,
  notifications, push, sharing, and QR camera.
- `src/sync/` - the capability-token identity and the sync client.
- `src/app/state.ts` - the Zustand store: loads the log, holds the projection, and owns every
  action including session logging, quest issuing, shadow extraction, and title awarding.
- `src/sw.ts` - the service worker.
- `worker/` - the Hono Worker, D1 access, the push scheduler, and the server half of identity.
- `migrations/0001_init.sql`, `wrangler.jsonc`, `public/_headers`, `index.html`, `src/index.css`.

### What does not exist yet

**The React user interface. None of it.** There is no `src/main.tsx`, no router, no components,
and no screens. The store and engine behind them are finished, so this is presentation work, but
it is all of the presentation work: the Awakening Test, the Status Window, the session logger with
its rest timer, the Physique panel, the gates and shadows and tower and shop screens, System Link
pairing, and settings.

Also outstanding: the PWA icons (`public/icons/` is empty and `vite.config.ts` already references
the files), the one-time Cloudflare setup script, the GitHub Actions workflow, and
`infrastructure.md`.

Because `index.html` loads `/src/main.tsx` and that file does not exist, **`pnpm run build` will
fail until the interface is started**. That is expected, not a regression.

### Deliberate deviations from the brief, both flagged rather than hidden

**The Hunter License Key is 120 bits, not 256.** The brief asks for both 32 random bytes and a
24-character key, and those cannot both hold: 32 bytes needs 52 base32 characters. Since the key
has to be typeable on a second device, the secret is 15 bytes, which encodes to exactly 24
characters in Crockford base32. 120 bits from `crypto.getRandomValues` is not brute-forceable, so
nothing practical is lost. See the comment at the top of `src/sync/identity.ts`.

**The six-rank ladder is built from five published thresholds.** Both strength-standard sources
publish exactly five tiers and neither has a "Proficient" band. Five thresholds partition into six
bands, which is the only way to reach six ranks without inventing a number. The consequence is
that a lifter exactly on the published Intermediate threshold lands at B rather than C, and that
is asserted in a test so it cannot drift silently.

### Two things that need verifying on the first real deploy

- **`web-push` inside the Worker.** Cloudflare documents this path and their own guide uses the
  library, and `nodejs_compat` is on by default at our compatibility date, but it has not been
  exercised against a live push service from this codebase. The scheduling arithmetic around it is
  unit-tested; the actual send is not.
- **GitHub secret scanning and push protection.** The brief wants both on before the first commit.
  On a **private** repository these are Advanced Security features and are not available on a free
  plan, so the requirement cannot be met as written for the chosen repository visibility. What
  stands in for it: no secret is ever committed, `.env*` and `.dev.vars` are gitignored, and the
  VAPID private key lives only in a Worker secret. Worth telling the user explicitly rather than
  quietly skipping.

## `minimum-release-age` needs pnpm 10.16 or newer, and older pnpm ignores it silently

The user requires `minimum-release-age=10080` (seven days), set in `.npmrc`, so that no dependency
newer than a week can be resolved into the lockfile. The purpose is to avoid being the person who
discovers a freshly published broken or compromised release.

The trap: `pnpm config get minimum-release-age` prints `10080` on pnpm 10.6.1 and looks like it
worked. It did not. pnpm only began honouring that setting in 10.16.0. Older versions parse the
`.npmrc` key, report it back, and then resolve as if it were absent. There is no warning.

So the setting is only real once pnpm is at least 10.16, which is why `packageManager` is pinned to
10.34.5 rather than left at whatever is installed. If a future session sees dependency versions
that are only a day or two old, this is the first thing to suspect.

---

## The first install ran before the age rule existed, so those versions must not be trusted

Dependencies were installed once before the user asked for `minimum-release-age`. That install
resolved bleeding-edge versions, several of which were days old. Those are the versions listed in
`package.json` dependency ranges at the moment, and they are **not** necessarily what a
release-age-respecting install will produce.

After the reinstall, re-read the resolved versions from the new lockfile before assuming anything
about API shape. In particular the notes below about Vite 8, TypeScript 7, and React 19 may or may
not apply depending on what the age filter allows through.

---

## Verified Cloudflare free-tier facts (checked against live docs 2026-09-03)

Checked because the brief says these numbers move faster than model training data, and a stale
answer here would be load-bearing. Every figure below came from a page fetched on that date.

| Resource | Free plan | Source |
|---|---|---|
| Worker requests | 100,000/day, resets midnight UTC | workers/platform/limits |
| Worker CPU | 10 ms per invocation, **not raisable on free** | workers/platform/limits |
| Worker subrequests | 50 per request | workers/platform/limits |
| Worker script size | 3 MB compressed | workers/platform/limits |
| Static assets | free, unlimited, and **not counted as requests** | workers/static-assets/billing-and-limitations |
| Static asset file cap | 20,000 files per version, 25 MiB per file | workers/platform/limits |
| D1 | 5 GB total, 500 MB per database, 10 databases, 5M row reads/day, 100k row writes/day | d1/platform/{pricing,limits} |
| D1 per invocation | 50 queries per Worker invocation | d1/platform/limits |
| KV | 1 GB, 100k reads/day, 1,000 writes/day, 1,000 deletes/day | kv/platform/pricing |
| Cron Triggers | 5, minimum interval 1 minute, 15 min wall time | workers/{platform/limits,configuration/cron-triggers} |
| Workers AI | 10,000 Neurons/day free | workers-ai/platform/pricing |

Two consequences worth restating because they shape code: rate-limit counters and sync sequence
state go in **D1, not KV**, because 1,000 writes a day is nothing. And the shell must stay static
assets, because those are the only free unlimited thing in the list.

### The credit-card question, answered as precisely as the docs allow

The user's hard requirement is that nothing needs a payment method on file. What the documentation
actually supports:

- **R2 does effectively require a card, so it stays out.** This is a two-step inference rather than
  a single quotable sentence: R2 getting-started says you need "a Cloudflare account with an R2
  subscription" and to "complete the checkout flow to add an R2 subscription", and Cloudflare
  billing docs say that if you subscribe to any add-on service, "Cloudflare must always have a
  payment method on file." No single page says "R2 requires a credit card." The brief had already
  decided against R2; this confirms the decision rather than revisiting it.
- **Workers, Static Assets, D1, KV, Cron Triggers, and Workers AI show no billing step anywhere in
  their documented prerequisites.** D1 and Workers list only "sign up for an account" and "install
  Node.js". That absence is the strongest evidence available, because Cloudflare publishes no
  affirmative "no credit card required" statement for any product and no consolidated list of which
  products need one. Treat this as well-supported but not quotable.
- **Some Workers AI models now require a paid plan** even though the 10,000 Neuron allocation is
  free: the Kimi, GLM, and DeepSeek families. If Phase 6 ever calls Workers AI, pick a model
  outside those families.

### A free-plan trap in the assets configuration

With `run_worker_first`, matching requests always invoke the Worker, and once the free request limit
is exhausted those requests return **429 rather than falling back to serving the static asset**. So
`run_worker_first` must be scoped to `/api/*` only and never to a path that serves the app shell.

Related and worth having: the `assets_navigation_prefers_asset_serving` compatibility flag makes
navigation requests skip the Worker script entirely, which directly reduces billable invocations.

---

## `nodejs_compat` is on by default at our compatibility date, which changes the push story

For any `compatibility_date` of **2026-08-04 or later**, Workers enables both `nodejs_compat` and
`nodejs_compat_v2` automatically. Our date is 2026-09-03, so no compatibility flag is needed for
Node built-ins, and older guidance telling you to add `nodejs_compat` for web push is now redundant.

This matters because it makes the ordinary `web-push` npm package viable inside the Worker —
`node:crypto` in workerd now includes `createECDH`, which was the historical blocker, and
Cloudflare's own push-notifications guide uses `web-push` directly.

Decision taken for this project: use `web-push` for delivery, but **send a payload containing no
health data** — something like `{"type":"daily-quest"}` — and let the service worker compose the
real notification text by reading the local IndexedDB. Delivery stays on the documented, reliable
path, and no training or body data ever transits a third-party push service. Also handle 404 and
410 from the push endpoint by deleting the dead subscription row.

Unverified and worth testing in `wrangler dev` before relying on it: Cloudflare's Web Crypto docs
confirm ECDSA sign, verify, generateKey, and importKey are supported, but **never name the P-256
curve**, and there is no ECDSA example in their docs. If hand-rolling the VAPID JWT instead of using
`web-push`, prove `namedCurve: "P-256"` works empirically first.

---

## Worker types come from `wrangler types`, not `@cloudflare/workers-types`

For a Worker application, run `wrangler types`, commit the generated
`worker-configuration.d.ts`, regenerate it whenever a binding changes, and point tsconfig at it with
`"types": ["./worker-configuration.d.ts"]`. Do not also install `@cloudflare/workers-types`; listing
both causes conflicting global declarations. The generated file is correct for our actual
compatibility date, flags, and bindings, which a generic package cannot be.

Note that `.gitignore` currently excludes `worker-configuration.d.ts`. That needs reversing when
the Worker is written, because CI runs a typecheck and cannot typecheck the Worker without it. The
file contains binding names and types only — no secrets.

---

## TypeScript 7 is the Go compiler and it is a landmine for tooling

TypeScript 7 is the native Go rewrite. It ships as `tsc` and is dramatically faster, but it has
**no public programmatic API until 7.1**, which breaks every tool that imports TypeScript as a
library: typescript-eslint, ts-jest, ts-morph, ts-loader, and vite-plugin-checker.

It also turns several tsconfig options into hard errors rather than warnings: `target: es5`,
`moduleResolution: node`, `baseUrl`, `downlevelIteration`, and `esModuleInterop: false`. New
defaults include `strict: true` and, importantly, **`types: []`** — ambient type packages are no
longer picked up automatically and must be listed explicitly.

Decision for this project: pin `typescript@^6` and treat the type checker as a plain
`tsc --noEmit` step. TypeScript 6 remains published for exactly this reason. This is a repository
the user maintains alone, and compatibility with the ordinary lint and test ecosystem is worth more
than compile speed here. Revisit after 7.1 restores the API.

---

## Library API shapes that differ from older habits

Verified on 2026-09-03. Re-check against the post-reinstall lockfile, since the release-age filter
may hold some of these back.

- **Vite 8** replaced Rollup and esbuild with Rolldown and Oxc, with no opt-out. Config keys
  renamed: `build.rollupOptions` to `build.rolldownOptions`, `optimizeDeps.esbuildOptions` to
  `optimizeDeps.rolldownOptions`, and top-level `esbuild` to `oxc`.
- **`@vitejs/plugin-react` 6 requires Vite 8** and no longer runs Babel by default, so its `babel`,
  `fastRefresh`, and `jsxRuntime` options are gone.
- **Tailwind 4** is CSS-first. The whole setup is the `@tailwindcss/vite` plugin plus a single
  `@import "tailwindcss";` line. There is no `tailwind.config.js` and no `postcss.config.js`, and a
  JS config is no longer auto-detected — it must be opted into with `@config`. Class renames that
  bite: `shadow` became `shadow-sm`, `shadow-sm` became `shadow-xs`, `rounded-sm` became
  `rounded-xs`, `outline-none` became `outline-hidden`, `ring` became `ring-3`, and arbitrary CSS
  variables changed from `bg-[--var]` to `bg-(--var)`. Content detection skips anything gitignored.
- **Zod 4**: import as `import * as z from "zod"`. `z.object` and `.safeParse` are unchanged, but
  `ZodError.errors` is gone in favour of `.issues`, the `message` and `invalid_type_error` options
  collapsed into one `error` option, `z.string().email()` became `z.email()`, and `.default()` now
  has to satisfy the output type — `.prefault()` is the old behaviour.
- **Zustand 5** has no default export, and `create()` no longer accepts an equality function;
  that moved to `createWithEqualityFn` from `zustand/traditional`.
- **`motion`** is the current package name for what used to be framer-motion, and React bindings
  import from `motion/react`.
- **`dexie-react-hooks` renumbered from 1.x to 4.x** to line up with Dexie itself. A `^1` range is
  badly stale rather than merely old.
- **React 19**: `propTypes` and `defaultProps` are gone on function components, as are
  `ReactDOM.render` and `findDOMNode`. A ref callback must not return a value, so
  `ref={el => (x = el)}` is now a bug and needs a block body.
- **TanStack Router** does not need `@tanstack/router-plugin` unless you want file-based routing.
  Code-based routing with `createRootRoute`, `createRoute`, `createRouter`, and a
  `declare module "@tanstack/react-router"` block for the `Register` interface is enough, and it
  avoids a codegen step.
- **Vitest 4** renamed `workspace` to `projects` and the thread-count options to `maxWorkers`.
- **Wrangler 4** defaults every command to local mode; anything touching the deployed environment
  needs an explicit `--remote`. This is the most likely silent CI breakage.
- **QR scanning**: `jsqr` still works but is dormant. `BarcodeDetector` is Chromium-only, which is
  fine given the target device is Android, but it must sit behind the capability adapter with a
  fallback rather than being called directly.

---

## Strength standards: sources are usable but the licence is unconfirmed

The brief insists the hunter rank map to real published standards rather than invented numbers, so
the tables were sourced rather than generated.

- **StrengthLevel.com is the primary source.** It is live, publishes male and female tables on a
  clean 5 kg bodyweight grid (male 50–140 kg, female 40–120 kg), and covers all six lifts needed
  including incline bench and pull-ups. Each table was fetched twice by independent methods and
  compared cell by cell, so no number rests on a summariser.
- **ExRx.net is blocked.** Every URL returns 403 behind a JavaScript interstitial. Its tables were
  recovered from Internet Archive captures and are kept only as a secondary citation for the four
  barbell lifts. ExRx publishes no incline bench and no pull-up standards at all.
- **Do not blend the two sources.** StrengthLevel values are mostly estimated one-rep maxes derived
  from logged submaximal sets; ExRx values are competition classification thresholds. They are
  different kinds of measurement and averaging them produces a number that means nothing.
- **StrengthLevel barbell numbers include the 20 kg bar.** Anything comparing a logged load to
  these tables has to account for that.
- **Pull-ups work differently**: two tables per sex, one a rep count and one an added-load-only one
  rep max, where a negative value means assistance was needed. Not a bodyweight-plus-load total.
- **Both sources publish exactly five tiers, not six.** Neither has a "Proficient" band, so the
  brief's six-rank ladder has no published basis as stated. Five thresholds do partition the number
  line into six bands: E below the lowest threshold, then D, C, B, A, and S at or above each
  successive one. That is the mapping to implement, and it means a lifter sitting exactly on the
  published Intermediate threshold lands at rank C only if the bands are lined up deliberately —
  check the off-by-one when writing the lookup.
- **Open question for the user, not resolvable by me: neither site publishes a reuse licence.**
  Individual measurements are facts and generally not copyrightable, but the selection and
  arrangement of a compiled table can attract thin protection. The tables ship with clear
  attribution, and this is flagged as something to confirm before the repository is made public.
  The repository is private, which limits the exposure for now.
- Minor data-quality note: the female incline bench table rests on roughly 25,000 qualifying
  results, about forty times thinner than the female squat table. Treat female incline rank as the
  least reliable output of the rank engine.

Full source report with the retrieved tables and capture timestamps is in the session scratchpad at
`strength-standards-research.md`. Copy the numbers into the shipped lookup table rather than
re-fetching, and keep the citation next to them.

---

## The Cloudflare MCP server is not authorised in this session

Cloudflare tooling was surfaced as an MCP server but requires an OAuth flow that cannot run
non-interactively, so all Cloudflare facts above were gathered by reading the public documentation
instead. Authorising it via `/mcp` in an interactive session would allow direct account access
later, but nothing in the build depends on it — deployment is designed to run through a setup script
and GitHub Actions.
