# NOTES

Findings that still bite, carried between sessions. One entry per lesson.

Not a status log — for where the build stands see `docs/TODO.md`; for the resource
budget see `docs/infrastructure.md`. An entry whose problem is fixed gets deleted,
not left here: a stale note costs more than a missing one.

---

## R2 is the only Cloudflare service here that can produce a bill

Verified against the docs on 2026-09-03, and it reshaped the design.

**Workers and D1 hard-fail when you exceed a free limit. They do not charge.** Workers returns
error 1027 past 100,000 requests a day; D1 returns errors on queries past its daily row limits.

**R2 bills instead of blocking**, and it rounds up to the next whole unit: one operation past a
million Class A operations is invoiced as two million. There is also **no hard spend cap anywhere
in Cloudflare** — the only feature is "Budget alerts", and the documentation says outright that
they are *"informational only. They do not pause or cap usage."*

So the Worker has to police itself: a `usage_budget` table in D1, incremented and checked in the
same statement, **before** each R2 call, against caps far below the free allowance. The cap is
global across all hunters rather than per hunter, because the licence key is the only credential
and a per-hunter cap would not bound spend if one leaked.

Also worth writing down: `DeleteObject` is free in R2, neither Class A nor Class B, so deleting
aggressively costs nothing. Lifecycle transitions to Infrequent Access *do* cost a Class A
operation each, so we do not use them. And `LIST` is Class A, which is why D1 is the photo index
and we never list the bucket.

---

## Three hard limits that are tighter than they look

**R2, KV and D1 binding calls all count as subrequests.** The docs are explicit: *"A subrequest is
any request a Worker makes using the Fetch API or to Cloudflare services like R2, KV, or D1."* The
free allowance is 50 per invocation. This turned the daily-push handler into a real bug: it was
willing to send to 50 subscriptions in one cron run, which would have consumed the entire
subrequest budget for that invocation.

**The 10 ms CPU limit applies to the cron handler too**, not just to HTTP requests. Waiting on I/O
is free, so what costs is arithmetic and cryptography. That is the second half of the same bug: a
push *with* a payload needs an ECDH agreement, an HKDF derivation and an AES-GCM encryption per
subscription. The fix is to send a **contentless** push — the service worker already composes the
notification text from the local database and ignores the payload entirely, so the payload was
never doing anything. Without it, a push needs one ES256 signature, reusable across subscriptions
that share a push-service origin.

**D1 allows only 100 bound parameters per query.** The multi-row insert used 20 rows at five
columns, which is exactly 100 — sitting on a hard limit with zero headroom, where adding one column
becomes a runtime failure. Sixteen rows (80 parameters) is the corrected figure.

One more, less dangerous but worth knowing: the 128 MB memory limit is **per isolate and shared
across concurrent requests**, not per request. So per-request memory has to be a small fraction of
it, which is why photo uploads stream into R2 rather than being buffered.

---

## What the local runtime can and cannot tell you

Worth knowing before trying to measure performance locally.

The Worker does boot in workerd with `web-push` bundled and imported, `/api/health` answers, and a
full sync round trip works against local D1 — including deduplicating a resent row and showing
nothing to a different licence key. That is genuine verification and it caught the config defects
above.

What it **cannot** tell you is CPU time. The local observability API reports wall-clock span
durations, and the first request measured 811 ms — almost all of it cold-start compilation and
local filesystem I/O on Windows. That number says nothing about production CPU. The `cpuTimeMs`
attribute is not populated locally. **Actual CPU has to be read from Workers observability after a
real deploy**, and until then any CPU figure in this repository is an estimate.

---

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

## Verified Cloudflare free-tier facts (checked against live docs 2026-09-03)

Every figure was read off a Cloudflare docs page on that date rather than recalled, because these
numbers move faster than training data and a stale one here would be load-bearing. The numbers
themselves live in `docs/infrastructure.md` section 3, which is the single copy — this entry
records only their provenance and the two conclusions that are not obvious from the table.

Rate-limit counters and sync sequence state go in **D1, not KV**: 1,000 KV writes a day is nothing.
And the app shell must stay static assets, because those are the only free unlimited thing offered.

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
