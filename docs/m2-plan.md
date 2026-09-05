# M2 — App shell and the Awakening Test

> **Correction, 5 September 2026.** This plan proposed moving the 252-row strength-standards table
> to a lazily loaded chunk if the bundle overshot its budget. That remedy does not work:
> `standards.data.ts` measures **3,733 bytes gzipped**, under 2% of the shipped JavaScript. The
> claim was made twice without measuring it. See `docs/m4-plan.md` H1 and H2 for the measured
> breakdown and the re-derived budget.


The milestone where this stops being a library and starts being an app. It adds the entry point, the
router, the reusable System window vocabulary, and onboarding — ending on the E-Rank window and the
Player line.

It is also where `pnpm run build` goes green for the first time, in the very first commit.

**Verified starting point:** 415 tests across 25 files, all six TypeScript projects clean, the
Worker booting in `workerd`, and `pnpm run build` failing with exactly one error:

```
Error: Failed to resolve /src/main.tsx from index.html
```

---

## 1. Six findings from surveying the ground first

Before planning the work, I read every file M2 touches. Six things turned up that the milestone
description did not account for. One is a real defect.

### F1 — the Hunter Secret is never persisted anywhere

**This is a defect, and it is the most important thing in this document.**

`src/sync/identity.ts` generates a secret with `crypto.getRandomValues`, derives the licence key and
the hunter id, and returns them. Nothing ever writes them down. There is no `identity` store in
Dexie, no `localStorage` write, and `src/app/state.ts` never calls `createIdentity`.

`SyncState.hunterId` stores the SHA-256 — which identifies the account but cannot authenticate as it,
because the bearer token is derived from the secret itself. So today:

- a first launch would mint an identity that vanishes on reload,
- every reload would mint a different one,
- the mirror would accumulate orphaned tenants, one per page load,
- and System Link pairing could never work, because there is no stable key to show.

Sync is off by default (`syncEnabled: false`), which is the only reason this has not surfaced.
**Identity persistence belongs in M2**, because first launch is where the secret is born.

### F2 — `public/` contains only `_headers`

`index.html` references `/favicon.svg` and `/icons/apple-touch-icon.png`. The PWA manifest in
`vite.config.ts` references `/icons/icon-192.png`, `/icons/icon-512.png` and
`/icons/icon-maskable-512.png`. None of these files exist.

Icons are M4's job and stay there. What matters for M2 is whether `vite-plugin-pwa` treats missing
manifest icons as a build failure or a runtime 404. Commit 1 answers that; section 6 carries the
fallback.

### F3 — `dist/` is empty

The M1 plan said `wrangler dev` works "against a `dist/` directory that is already present from an
earlier build". The directory exists; it has nothing in it. `wrangler dev` tolerated that and served
the Worker anyway, so M1's verification stands — but the stated reason was wrong, and after M2's
first commit the point is moot.

### F4 — there is no height parser

`units.ts` has `parseWeightToKg(input, pref)` but no equivalent for length. Onboarding needs height,
and an imperial hunter will type `5'11"`, or `5 11`, or `71`. `formatHeight` exists for output; the
input side does not.

### F5 — the global reduced-motion rule would break a CSS-driven cinematic

`src/index.css` ends with a blanket rule setting `animation-duration: 0.01ms !important` on
everything. That is correct for incidental animation, and it means the Double Dungeon sequence
**cannot** be built on CSS animations or keyframes: it would complete instantly and flash rather than
degrade. The sequence has to branch in JavaScript on the reduced-motion preference and render a
static, readable version.

### F6 — Vitest only collects `*.test.ts`

`vitest.config.ts` sets `include: ['src/**/*.test.ts', 'worker/**/*.test.ts']` and
`environment: 'node'`. A component test written as `.test.tsx` would be silently collected by
nobody. This constrains the testing decision in section 2, and it is a constraint worth keeping
rather than working around.

---

## 2. Decisions this milestone commits to

### M2-D1 — the Hunter Secret lives in a new Dexie `identity` store

Not `localStorage`. Both are origin-scoped and neither survives a browser data wipe, so the security
properties are equivalent — the deciding reasons are different:

- **Consistency with Standard 5** ("repository over Dexie"): every other persistent fact goes
  through `src/db/repo.ts`, and a credential is not the thing to make an exception for.
- **It makes "wipe my data, keep my key" expressible.** `clearAll()` currently truncates every
  table. With identity in its own store it can be deliberately excluded, so resetting training
  history does not silently abandon the mirror. A separate, explicitly named path forgets the key
  too.

Schema shape, one row:

```ts
export interface StoredIdentity {
  id: 'self'
  /** 15 random bytes. The credential. Never logged, never rendered. */
  secret: Uint8Array
  createdAt: number
}
```

`load()` gains a bootstrap step: read the row, and if it is absent mint one and write it. The store
exposes `identity: Identity | null` for the licence-key display and for `runSync`, and the `secret`
is never rendered and never passed to a log call (Standards 11 and 12).

**Generating an identity has no network consequence.** `syncEnabled` is false by default, so first
launch mints a key and contacts nothing. Worth stating because "identity is created on first launch"
sounds like it should.

**This is the last milestone that may edit `version(1)` in place.** No device has held this database
yet, so adding the store to `version(1)` is honest. After M4 the app is installed on a real phone
and schema changes become Dexie upgrades.

### M2-D2 — no DOM testing stack; the step machine is pure and tested instead

M2 is the first UI milestone, and the tempting move is to add `jsdom` and
`@testing-library/react`. Not yet, for a reason rather than out of laziness:

The parts of onboarding worth testing are not rendering. They are *which step comes next given the
answers so far*, *whether a step's input is valid*, and *whether the flow can complete with every
optional field blank* — which is a stated requirement of the brief. All three are pure functions
over a small state object.

So the step machine goes in `src/app/awakening.ts` as pure logic with no React import, and the
components become thin readers of it. That keeps the suite at `environment: 'node'`, keeps F6's
constraint intact, and defers the DOM decision until something genuinely needs it — the rest timer
in M3 is the first real candidate.

What this deliberately does not cover: that a button is wired to the right handler. That is caught by
using the app, which happens in M4.

### M2-D3 — units are asked before any number

`Settings`/`Profile` store kilograms and centimetres, and Standard 10 says conversion happens only at
render. Unit preference is itself an onboarding field, so it has to be answered before any field it
governs, or the first numeric input has no unit to interpret. This is not a UX preference; it falls
out of the canonical-units rule.

### M2-D4 — routes are declared when they become servable

TanStack Router, code-based, no codegen step. M2 declares three routes and no more:

| Route | M2 content |
|---|---|
| `__root` | The shell: safe-area layout, message queue, connectivity indicator, nav |
| `/` | Home. The E-Rank window and a level/stat summary — the minimal Status Window |
| `/awaken` | The Awakening Test. Redirects to `/` once a profile exists |

No `/gate`, `/physique` or `/settings` placeholder. A personal app with four "coming soon" screens is
worse than an app with two working ones, and each milestone adds its own route where it belongs.
`/` guards on profile presence and redirects to `/awaken`.

### M2-D5 — `motion` is imported through `LazyMotion` and `m`

The full `motion` import pulls the whole feature set into the initial bundle. `LazyMotion` with the
`domAnimation` feature bundle and the `m` component gives the same API for what we need at a fraction
of the size. Static assets are free and unlimited on Cloudflare, so this is not a billing question —
it is a first-paint question on a gym connection.

### M2-D6 — the Double Dungeon branches in JavaScript, not CSS

Per F5. The sequence uses `useReducedMotion()` from `motion` and renders a static, immediately
readable version when the preference is set. It is also **skippable on every beat** — a cinematic you
cannot dismiss is hostile the second time you install the app.

It plays once, gated on a new `doubleDungeonSeenAt: number | null` field on the local-only `Progress`
row. The natural gate — "play while there is no profile" — is wrong: it replays if the hunter
reloads mid-onboarding.

### M2-D7 — onboarding validates through the existing schemas

Per Standard 3, validation happens at the boundary and there is one definition of each shape. Each
step validates with the field schema already declared in `ProfileSchema` (`SexSchema`,
`EquipmentSchema`, the `birthYear` range, `heightCm` positivity) rather than a second copy that can
drift.

---

## 3. Commit order

| # | Commit | What lands | Gate it opens |
|---|---|---|---|
| 1 | Entry point, router, boot screen | `main.tsx`, `App.tsx`, `__root`, `/`, `load()` wired | **`pnpm run build` goes green** |
| 2 | Identity persistence (F1) | `identity` Dexie store, repo functions, boot bootstrap | Sync survives a reload |
| 3 | The System vocabulary | Eight primitives, no screens | Screens become assembly |
| 4 | `parseHeightToCm` and the step machine | Pure logic, test-first | Onboarding has a spine |
| 5 | The Awakening Test screens | Nine steps wired to `completeAwakening` | A profile can exist |
| 6 | The Double Dungeon | Sequence, skip, reduced-motion branch, seen flag | First launch has an opening |
| 7 | The E-Rank window and home | The Player line, minimal Status Window | The milestone closes |

Commit 1 earning the build-green criterion is deliberate. It is the single most valuable thing in the
milestone and it should not be waiting behind six commits of component work.

---

## 4. The work, in detail

### Commit 1 — the entry point

`src/main.tsx` mounts React 19 into `#root`, wraps the tree in the router provider and a
`LazyMotion`, and calls `watchInstallPrompt()` once at module scope — it has to be registered before
the browser fires `beforeinstallprompt`, which can happen very early.

`src/app/App.tsx` owns the boot gate. `useApp` exposes `ready`, which `load()` sets after seeding and
two projection passes. Until then the app renders a boot window rather than nothing: on a first
launch `load()` seeds the exercise library, six routines and the 252-row standards table, and a white
flash there would be the hunter's first impression of the System.

The service worker registration uses `registerType: 'prompt'`, already configured — so the shell
needs an "update available" affordance that asks rather than reloading. A reload mid-set loses the
set. That is a small component, and it belongs with the shell rather than with M4's PWA work.

**Bundle budget, set here and measured here:** ≤ **200 KB gzipped** for the initial route. React and
`react-dom` are roughly 45 KB of that, TanStack Router 15, Dexie 25, Zod 15 tree-shaken, Zustand 1,
`m` plus `domAnimation` about 5, and the standards table around 3. That leaves real headroom for app
code. The number is recorded in `infrastructure.md` alongside the Worker bundle figure.

### Commit 2 — identity persistence

Closes F1.

- `src/db/db.ts`: the `identity` store added to `version(1)`, keyed on `id`.
- `src/db/repo.ts`: `getStoredIdentity()`, `ensureIdentity()` (mint-if-absent, returning the
  `Identity`), and `forgetIdentity()`. `clearAll()` gains a parameter deciding whether identity goes
  with it, defaulting to keeping it.
- `src/app/state.ts`: `identity` on the state, populated by `load()` before the first `refresh()`.

**Tests** — the first repository tests in the project, using the `fake-indexeddb` devDependency that
has been sitting unused:

- `ensureIdentity()` twice returns the same licence key, and writes one row.
- The stored secret round-trips: `decodeLicenseKey(encodeLicenseKey(stored))` is byte-identical.
- `clearAll()` keeps identity by default and drops it when asked.

That third test is the one that matters, because it is the assertion that a hunter resetting their
training history does not silently lose their mirror.

### Commit 3 — the System window vocabulary

Eight primitives, in `src/components/`. Everything else in the app is assembled from these, so they
are worth getting right once.

| Component | Notes |
|---|---|
| `SystemWindow` | The holographic panel. Title rendered in `[brackets]`, the System's voice. Uses the `--animate-system-in` token already defined. |
| `SystemPanel` | An inner section with a hairline edge. Not a card — see below. |
| `ManaBar` | The level bar: `xpIntoLevel / xpToNext`, with the level and the remainder. |
| `StatBar` | **Two segments, not one.** `PlayerState` carries `derived`, `allocated` and `total`; a single bar throws away the distinction between what training earned and what the hunter assigned. The split is information. |
| `RankBadge` | E through S — **and a `null` state.** `rank` is nullable and reads "Unranked", which the unspecified-sex path in M2-D7 makes reachable on day one. |
| `MessageQueue` | Renders `state.messages` in order, dismissible, with `playSystemChime()` and `vibrate()` gated on `settings.soundEnabled` / `hapticsEnabled`. |
| `NumberField` | Thumb-sized numeric entry. Converts at the boundary via `parseWeightToKg` / `parseHeightToCm` and displays via `formatWeight` / `formatHeight`. The spinner arrows are already suppressed globally in `index.css`. |
| `ChoiceGroup` | Segmented select, single and multi. Sex, units, equipment — and RPE in M3. |

A note on restraint, because the palette in `index.css` is generous with glow: border, fill and
shadow each say "separate object". Spending `--shadow-system` on every panel flattens the hierarchy
into noise. The strong variant is for the one window that is speaking.

### Commit 4 — `parseHeightToCm` and the step machine

**`parseHeightToCm(input, pref)` in `src/domain/units.ts`**, test-first per Standard 2. Metric is a
plain centimetre number. Imperial has to accept what people actually type:

| Input | Result |
|---|---|
| `5'11"` | 180.34 |
| `5' 11` | 180.34 |
| `5 11` | 180.34 |
| `5'` | 152.4 |
| `71` | 180.34 (bare number in imperial reads as inches) |
| `5.9` | 149.86 — decimal feet is *not* five foot nine, and must not be guessed at |
| `` / `abc` / `-5` | `null` |

That `5.9` row is the interesting one. A decimal in imperial height is ambiguous between decimal feet
and a typo for `5'9"`. Guessing either way is worse than refusing, so it parses as inches like any
other bare number and the field shows what it understood — a live "180 cm" echo under the input,
which is the only honest way to run a unit-converting field.

**`src/app/awakening.ts`** — the pure step machine.

```ts
export type AwakeningStepId =
  | 'units' | 'sex' | 'standardsTable' | 'age' | 'height'
  | 'bodyweight' | 'trainingYears' | 'equipment' | 'physique'

export interface AwakeningAnswers { /* every field optional, filled as it goes */ }

export function stepsFor(answers: AwakeningAnswers): AwakeningStepId[]
export function validateStep(step: AwakeningStepId, answers: AwakeningAnswers): string | null
export function isComplete(answers: AwakeningAnswers): boolean
export function toProfileInput(answers: AwakeningAnswers): /* completeAwakening's argument */
```

`stepsFor` is a function rather than a constant because the sequence is genuinely conditional:
`standardsTable` appears only when sex is `unspecified`. Everything else is fixed, and the order is
forced by what each field gates:

1. **`units`** — must be first (M2-D3).
2. **`sex`** — male, female, prefer-not-to-say.
3. **`standardsTable`** — conditional. `standardsTableFor()` returns `null` for `unspecified` with no
   override, and a `null` table means `rank` is `null` and the hunter is unranked. So this step asks,
   plainly, which table to compare against, and says what declining costs: no rank, and every other
   feature working exactly as before. That is what the brief means by handling the third case
   gracefully — offering the choice and being honest about the consequence, rather than picking a
   table on the hunter's behalf.
4. **`age`** — birth year. Feeds Tanaka (`208 − 0.7 × age`) for heart-rate zones and the increment
   softening past 40.
5. **`height`** — the Navy body-fat estimate's only consumer.
6. **`bodyweight`** — every strength standard is per kilogram, and relative tonnage feeds XP.
7. **`trainingYears`** — the starting rank floor and how aggressive increments are.
8. **`equipment`** — multi-select, gates generation and Instant Dungeon Key fallbacks.
9. **`physique`** — waist, neck, hip, body fat. **Skippable, and skipped by default.**

**The test that matters most:** `isComplete()` is true with `physique` untouched and
`standardsTableOverride` absent, and `toProfileInput()` produces an object that `ProfileSchema`
accepts. That is the brief's requirement — *"Onboarding must complete, and every subsequent feature
must work, with all of them left blank"* — expressed as an assertion instead of a hope.

Also tested: each step's validator rejects the obvious bad input (a birth year in the future, a
negative bodyweight, an empty equipment list) with a message written for a person.

### Commit 5 — the Awakening Test screens

One screen per step, assembled from commit 3's primitives, reading commit 4's machine. The flow
carries a progress indicator, every step is reversible, and answers survive going back.

The step components hold no validation logic of their own — they render `validateStep`'s message.
The final step calls `completeAwakening`, which already exists in `state.ts` with exactly the right
signature and already writes the profile, the first body metric, the quests and two projection
passes.

The physique step needs its skip to be the visually equal option, not a greyed-out afterthought.
Most people arriving here have no tape measure, and a skip that looks like a failure state teaches
the wrong thing about the app on the first screen that offers a choice.

### Commit 6 — the Double Dungeon

The first-launch sequence, ending in *"You have acquired the qualification to be a Player."*

- Beats revealed in sequence, each dismissible, with a persistent skip.
- `useReducedMotion()` branches to a static render of every beat at once (F5).
- `doubleDungeonSeenAt` written to `Progress` on completion **or** on skip — skipping still counts as
  seen, or the skip is a lie.
- It runs before `/awaken` and after `ready`, so it never plays over a boot spinner.

### Commit 7 — the E-Rank window and home

`/` renders the minimal Status Window: `RankBadge`, `ManaBar`, the five `StatBar`s, streak, and the
hunter class from `PlayerState`. The full Status Window with quests, roster and fatigue detail is M5;
this is the shape it grows into, not a placeholder to throw away.

Immediately after onboarding, `completeAwakening` already queues the Player line through
`pushMessage`, so the E-Rank reveal is the message queue doing its job rather than a special case.

---

## 5. Verification

**1. `pnpm run build` succeeds.** The headline criterion, met in commit 1 and re-checked at the end.
Bundle size recorded.

**2. `pnpm run typecheck`** clean across all six projects. `noUnusedLocals` and `noUnusedParameters`
are on, so stub props and unused imports fail here — which is the reason M2-D4 declares no
placeholder routes.

**3. `pnpm vitest run`** — 415 now, and section 7 has the expected count after.

**4. Onboarding completes with every optional field blank.** Asserted in the step-machine tests, then
confirmed by hand in `pnpm dev`: prefer-not-to-say, decline the standards table, skip physique, and
land on an *Unranked* window with a working level bar and stats.

**5. Identity survives a reload.** Complete onboarding, note the licence key, reload, and confirm the
same key. Then `clearAll()` and confirm the key is still there.

**6. The Double Dungeon plays once.** Fresh IndexedDB, watch it, complete onboarding, reload, and
confirm it does not replay. Repeat with `prefers-reduced-motion` forced and confirm the beats are
readable rather than flashing.

**7. `pnpm run cf:dev` still serves the built app.** With `dist/` now genuinely populated (F3), the
Worker's static-asset serving and the SPA fallback get their first real exercise:
`not_found_handling: "single-page-application"` should return `index.html` for `/awaken`, and
`run_worker_first: ["/api/*"]` should keep `/api/health` reaching the Worker.

That last check is worth calling out. It is the first time the asset configuration is tested against
actual assets, and a mistake there is invisible until deploy.

**What cannot be verified in M2:** installability, the real Lighthouse pass, and CPU measurement. All
M4. Also unverified: that the app is usable one-handed in a gym, which no test answers and only M4
answers honestly.

---

## 6. Risks, with the fallback already chosen

**`vite-plugin-pwa` may fail the build on missing manifest icons (F2).** If it does, commit 1 adds
three placeholder PNGs generated by a small script with no new dependency, and M4 replaces them with
the real artwork. The alternative — pulling all of M4's icon work forward — is not warranted by a
build error.

**The step machine could grow into a framework.** Nine steps, one conditional. If `stepsFor` starts
accumulating branches, the answer is fewer steps, not a more clever machine.

**First-launch seeding may be slow enough to notice.** `load()` seeds the library, six routines and
the standards table, then runs two projection passes over an empty log. The boot window covers it,
but if it is slow enough to feel broken the fix is to seed inside a transaction and render the boot
window's own progress — not to defer seeding, because the app is useless without the exercise library.

**The bundle budget could be missed by the standards table.** 252 rows are bundled rather than
fetched, deliberately, so the app works offline on first run. If the initial route overshoots 200 KB,
the table moves to a dynamically imported chunk loaded after first paint — rank is not needed to
render the boot window.

---

## 7. Test count accounting

| | Tests |
|---|---|
| After M1 | **415** |
| `parseHeightToCm` — the table in commit 4, plus the rejections | +12 |
| The step machine — order, the conditional step, each validator | +14 |
| **The blank-optionals invariant**, asserted directly | +2 |
| Identity persistence — idempotence, round trip, `clearAll` behaviour | +5 |
| After M2 | **≈448** |

Nothing is deleted this time. Every number here is pure logic or repository behaviour; none of it is
a rendering assertion, per M2-D2.

---

## 8. What M2 deliberately leaves alone

- **Session logging, the rest timer, and targets.** M3. `/gate` does not exist yet.
- **Icons, the manifest verification, the setup script, Actions, and the first deploy.** M4 — the
  milestone where this is installable and usable in the gym.
- **The full Status Window.** M5. Commit 7 builds the shape it grows into.
- **The Physique panel** where tape measurements are added later. M5, and the reason skipping them in
  onboarding costs nothing permanent.
- **A DOM testing stack.** Deferred by M2-D2, with the rest timer in M3 as the first real candidate
  for revisiting it.

---

## 9. Acceptance criteria

M2 is done when all of the following are true:

1. `pnpm run build` succeeds, and the initial-route bundle is at or under 200 KB gzipped with the
   figure recorded in `infrastructure.md`.
2. `pnpm run typecheck` is clean across all six projects.
3. `pnpm vitest run` passes at roughly 448 tests.
4. Onboarding completes with prefer-not-to-say, no standards table, and physique skipped — landing on
   an *Unranked* status window whose level bar and stats are correct.
5. Onboarding also completes with every field answered, and the resulting rank is not `null`.
6. The licence key is identical after a reload, and survives `clearAll()`.
7. The Double Dungeon plays once, is skippable at every beat, and is readable with
   `prefers-reduced-motion` set.
8. `pnpm run cf:dev` serves the built app: `/awaken` returns the shell through the SPA fallback and
   `/api/health` still reaches the Worker.
9. F1 through F6 are recorded as resolved or deliberately deferred in `TODO.md`.
