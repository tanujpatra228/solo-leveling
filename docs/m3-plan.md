# M3 — Session logging, the rest timer, and targets

> **Correction, 5 September 2026.** This plan proposed moving the 252-row strength-standards table
> to a lazily loaded chunk if the bundle overshot its budget. That remedy does not work:
> `standards.data.ts` measures **3,733 bytes gzipped**, under 2% of the shipped JavaScript. The
> claim was made twice without measuring it. See `docs/m4-plan.md` H1 and H2 for the measured
> breakdown and the re-derived budget.


The gate screen. Blocks and supersets in the order the routine defines, a per-exercise target from
the progression engine with its reason shown, set entry sized for a thumb, RPE, the warmup flag, set
correction, a rest timer that keeps the screen awake, and a session summary on finish.

This is the milestone the whole app exists for. Everything before it is scaffolding and everything
after it is a costume.

---

## 0. A note on sequencing

**M2 is partly implemented, and moved while this was being written.** When I began surveying, `HEAD`
was the M2 plan commit with no client code at all. By the time the plan was finished, M2's first
commit had appeared in the working tree — `src/main.tsx`, `App.tsx`, `router.tsx`, the root, index
and awaken routes, a boot screen and an update prompt — and **`pnpm run build` now succeeds**, which
was M2's headline criterion.

Still absent: the identity store (M2's F1 defect), `src/app/awakening.ts` and its step machine, and
the System window vocabulary beyond the boot screen. So M3's component work still rests on M2's
remaining commits, and it is worth being precise about what that does and does not undermine.

Everything on the **engine and store side is grounded in code that exists today** and was read line
by line for this plan: the progression engine, the seed routines, the repository, `state.ts`, and the
platform adapters. All six findings in section 1 come from that real code, not from speculation.

Only the **component assembly** depends on M2 — the System window primitives and the router. Which
means something useful falls out:

> **Three of the seven commits do not depend on M2 at all.** Commits 1, 2 and 3 are engine
> corrections, store corrections, and a pure timer module. They can land before M2 or after it, in
> any order.

---

## 1. Six findings from the code as it stands

### G1 — `targetFor` looks up the wrong routine

**`src/app/state.ts`, `targetFor`.** It resolves the routine from *today's* day of week:

```ts
const routine = state.routines.find((r) => r.dayOfWeek === dayOfWeekForKey(state.today))
const plannedSets = routine?.blocks.flatMap((b) => b.items)
  .find((item) => item.exerciseId === exerciseId)?.sets ?? 3
```

But during a session the routine is whichever one the session was started against —
`session.routineId`. The two disagree whenever a session crosses the 04:00 rollover, or is logged on
a different day than the routine's own.

The consequence is quiet and wrong rather than loud: `routine` resolves to a different day's blocks,
the exercise is not found in them, and `plannedSets` falls through to the default of **3**. Friday's
squat is prescribed for **4** sets. The hunter would be shown three rep targets for a four-set
exercise, with nothing to indicate the number was a fallback.

**Fix:** resolve from the active session's `routineId` when there is one, and fall back to the
day-of-week lookup only when a session has no routine — which is the Instant Dungeon Key case.

### G2 — the routine's rep range is written, seeded deliberately, and never read

`BlockItem` carries its own `repRange`, and every seeded block sets one. The progression engine never
looks at it:

```ts
// progression.ts — the only rep range the engine knows about
const [lo, hi] = exercise.repRange
```

Grepping every `.repRange` read in `src/` returns three sites, all of them `exercise.repRange` or a
ladder rung's. **The block's value is dead data.**

Being accurate about severity: this is **not currently producing wrong behaviour**, because every
seeded block range happens to match the exercise's own — `barbell-squat` is `[5, 8]` in both places,
`leg-extension` `[12, 15]` in both, `incline-pushups` `[10, 20]` in both.

It is a **latent trap**, which is a different thing and still worth fixing. There are two sources of
truth for one fact and the engine consults the one a person would not think to edit. The natural
thing to want — *higher reps on leg extension in this block* — would be typed into the routine and
silently ignored.

### G3 — nothing supplies the session's bodyweight, and tonnage depends on it

`startGate(routineId, bodyweightKg?)` takes bodyweight as an optional argument. `SessionLog` stores
it. And `projection.ts` feeds it straight into the tonnage calculation:

```ts
bodyReadyKg: session.bodyweightKg,   // projection.ts:159
usesBodyweight,
```

For every exercise with `usesBodyweight: true` — the push-up and pull-up family, which is most of
this programme's upper-body volume — a missing bodyweight means those sets contribute **only their
external load** to tonnage. Which for a bodyweight push-up is zero.

So tonnage is understated, and since XP is driven by relative tonnage, **experience is understated
too**. Silently, with no error and no visible symptom beyond a number being smaller than it should
be.

**Fix, and where:** default it inside `startGate` from `projection.latestBodyMetric`, not at the call
site. An optional argument that must be remembered will eventually be forgotten; a default in the
store cannot be.

### G4 — a mis-flagged warmup cannot be corrected

The repository supports it:

```ts
export async function correctSet(
  originalId: string,
  patch: { weight?: number; reps?: number; rpe?: number; isWarmup?: boolean },
)
```

The store does not:

```ts
correctSet: (setId: string, patch: { weight?: number; reps?: number; rpe?: number }) => Promise<void>
```

The store narrows what the layer beneath it already does. And this is the one correction that changes
the future rather than the past: `workingSets()` filters warmups out of the progression input, so a
working set wrongly flagged as a warmup is invisible to next week's target, and a warmup wrongly
logged as a working set drags the target down.

**Fix:** widen the store's patch type to match the repository's. One line, and it restores the only
correction that alters what the System prescribes next.

### G5 — `order` counts superseded rows

```ts
const existing = state.sets.filter((s) => s.sessionId === sessionId)
// …
order: existing.length,
```

`state.sets` holds both an original and its replacement after a correction, because the log is
append-only. So correcting set 2 leaves two rows at `order: 2` — `correctSet` copies the original's
order — and the next set logged takes `order: 4`, skipping 3.

**Low severity, and stated as such.** `dropSuperseded()` runs before any ordering, so by the time
anything sorts, the duplicate is gone and the remaining orders are unique — merely non-contiguous,
which sorts identically. Nothing is broken today.

It is still the wrong computation, and M3 corrects sets constantly, so the honest version is
`max(order) + 1` over live rows.

### G6 — a rest countdown cannot be built on `setInterval`

A constraint rather than a defect, and the one most likely to produce a bad experience if missed.

Background tabs have their timers throttled to roughly **once per minute**, with harder freezing
after a few minutes. Squat rest in this programme is **210 seconds**. A `setInterval` countdown would
drift badly the moment the hunter's phone screen turns off or they switch to something else — which
during three and a half minutes of rest is exactly what happens.

**The timer must derive from an absolute `endsAt` timestamp** and recompute on every tick *and* on
`visibilitychange`, so returning to the app shows the truth rather than wherever the counter froze.

A second edge in the same area: `createWakeLock()` in `capabilities.ts` nulls its sentinel when the
browser fires `release`, which browsers do whenever the page becomes hidden. The adapter is correct,
but it does **not** re-acquire for you. The timer has to re-acquire on becoming visible again, or the
screen stays awake only until the first time it is not looked at.

---

## 2. What the seed data already gets right

Worth recording, because it removes a design question I expected to have to answer.

**Supersets already encode their own rest convention.** In a superset you rest after the round, not
between the pair — and the seed says so in the data:

```ts
{
  type: 'superset',
  items: [
    { exerciseId: 'hamstring-curl',  sets: 3, repRange: [10, 15], restSec: 0  },
    { exerciseId: 'leg-extension',   sets: 3, repRange: [12, 15], restSec: 90 },
  ],
}
```

`restSec: 0` on the non-final item means *go straight to the next exercise*; the real rest sits on the
last one. So the gate screen needs no superset-specific rest rule at all — it honours each item's
`restSec`, and zero means no timer. The intent is already in the data.

---

## 3. Decisions this milestone commits to

### M3-D1 — the block's rep range overrides the exercise's

`computeNextTarget` gains an optional rep-range override, and the gate screen passes the block item's
range. The alternative — deleting `BlockItem.repRange` and letting the exercise own the fact
outright — is defensible and would also close G2. It loses something real though: varying rep ranges
for the same movement across a week is ordinary programming, and the data model already expresses it.
Better to make the field live than to remove the capability.

The exercise's own range stays the default, so nothing changes for a routine that does not specify.

### M3-D2 — the rest timer is absolute-time, derived, and pure

Per G6. `src/app/rest-timer.ts` holds pure functions over `(now, endsAt)`: remaining seconds, whether
the chime is due, and the display string. No React import, no ambient clock — time is passed in, the
same rule the domain layer follows. The hook does nothing but re-render, re-derive on
`visibilitychange`, and re-acquire the wake lock.

### M3-D3 — rest state lives in `sessionStorage`

Not in the append-only log, and not in Dexie.

**Not the log,** because a rest period is not an event that happened to the hunter's training — it is
transient interface state, and writing it into the log would put a fiction in the one place that is
supposed to be true.

**Not Dexie,** because it would mean a write per rest period at best and per tick at worst, for data
whose entire useful life is four minutes.

`sessionStorage` has precisely the right lifetime: it survives a reload in the same tab, which is the
case worth surviving, and it dies with the tab, which is the case where a stale timer would be
wrong. One `endsAt` number and the block item it belongs to.

### M3-D4 — set entry branches on `exercise.unit`, with one exception

Four kinds, and they need genuinely different fields:

| `unit` | Fields | Example |
|---|---|---|
| `kg` | weight, reps, RPE | `barbell-squat` |
| `reps` | reps, RPE | `incline-pushups` |
| `time` | seconds, RPE | `treadmill-intervals` |
| `distance` | metres, seconds | — |

**The exception:** a `reps`-unit exercise still needs a weight field once the engine says to add load.
`computeNextTarget` returns `kind: 'add_external_load'` for a bodyweight movement that has run out of
reps, and if the entry form has no weight input at that point the prescription cannot be followed. So
the weight field appears whenever the target's kind is `add_external_load` or its `weightKg` is above
zero, regardless of unit.

`treadmill-intervals` also gets its heart-rate zones: `intervalTargets(age)` in `hr.ts` already
returns the walk and run zones from Tanaka, and the exercise's own cue says *"Walk in zone 2, run in
zone 4."* Showing the two bpm ranges next to that cue turns it into something actionable.

### M3-D5 — the acceptance criterion becomes one integration test through the store

Continuing M2-D2: no DOM stack. The criterion — *a full Friday Legs session can be logged offline,
and targets change the following week according to the double-progression rules* — is expressible
without rendering anything.

**Friday Legs is 17 working sets** across four blocks: squat 4, leg press 3, the hamstring-curl and
leg-extension superset 3 each, calf raise 4. The test drives the store: start the gate, log all
seventeen at the top of each rep range with RPE 8, finish, then assert every target moved.

That single test exercises `logSet`, the `order` computation, the superset structure, `finishGate`,
the projection, XP, gate-clear accounting, and the progression engine's `increase_load` path — and it
is the acceptance criterion written as code rather than as a hope. It also covers G1 and G3
end to end, because a wrong routine lookup or a missing bodyweight both change its assertions.

With RPE 8 at the ceiling, `allAtCeiling && effortClean` holds — 8 is `PROGRESSION_RPE_CEILING` and
the check is `<=` — so every loaded lift should return `increase_load` at `+increment`, rounded:
squat `+5 kg`, the pin-loaded machines by their pin step.

### M3-D6 — the chime's limitation is stated rather than hidden

If the hunter switches apps mid-rest, the chime will be late: audio cannot be scheduled from a
frozen page, and the Wake Lock only holds while the page is visible. The mitigations that exist are
honest ones — the wake lock keeps the screen on if they leave the app alone, and the timer shows the
truth immediately on return rather than a frozen number.

The fix that would actually solve it is a scheduled local notification, which needs notification
permission and belongs with the push work in M8. Until then the rest screen says what it does: it
keeps the screen awake so the chime can fire.

---

## 4. Commit order

| # | Commit | Needs M2? | What lands |
|---|---|---|---|
| 1 | Rep-range override in the engine | **No** | G2. `computeNextTarget` takes an optional range, plus tests |
| 2 | Store corrections | **No** | G1, G3, G4, G5 — routine lookup, bodyweight default, warmup correction, `order` |
| 3 | The pure rest-timer module | **No** | G6's arithmetic, tested with no DOM |
| 4 | The gate screen | Yes | Blocks and supersets in order, targets with their reason and cue |
| 5 | Set entry | Yes | Per-unit fields, RPE, warmup flag, the `add_external_load` exception |
| 6 | Set correction | Yes | Superseding rows from the UI, including the warmup flag |
| 7 | Rest timer wired, summary, integration test | Yes | Wake lock, chime, visibility re-acquire, session summary, M3-D5's test |

Commits 1 through 3 are the ones with real defects in them, and none of them need a single component
to exist. If M2 slips, they still land.

---

## 5. The gate screen, in detail

`/gate` joins the route table — per M2-D4, a route appears when it can be served.

**Structure follows the routine exactly.** Blocks in order; within a superset block, items rendered
as an alternating pair rather than a flat list, because that is how the work is performed and the
data already distinguishes it (`type: 'single' | 'superset'`).

**Each exercise shows its target and why.** `NextTarget` already carries everything needed:
`weightKg`, one `repTargets` entry per set so a partly-progressed exercise keeps its shape, a
plain-language `reason`, and an optional `cue`. None of this needs inventing — it needs displaying.
The eight `ProgressionKind` values each deserve to read differently, because *"reps are there but the
effort is above RPE 8"* and *"no record of this movement"* are not the same message and should not
look the same.

**Set entry is sized for a thumb**, which mostly means the increment and decrement controls are large
and the keyboard is a last resort. `index.css` already suppresses number-input spinners globally for
this reason. Logged sets appear immediately, because `logSet` writes to IndexedDB before it touches
the store.

**One guard.** `logSet` returns silently when there is no active session:

```ts
const sessionId = state.activeSessionId
if (!sessionId) return
```

A silent no-op behind a tap is a bug the hunter cannot diagnose. The gate screen must not render set
entry unless a session is open — the route resolves to a start-gate prompt otherwise.

**The summary on finish** needs no new computation. `finishGate` already resolves the `SessionSummary`
from the projection — tonnage, hard sets, PR exercise ids, XP, gate rank — and already queues the
gate-cleared, boss-slain, shadow-extraction and title messages through `pushMessage`. The summary
screen renders what that produced.

A note on `finishGate`'s cost: it calls the full `refresh()` twice, so two complete thirteen-table
reads and two projection passes. C7 removed that from the per-set path where it mattered. Here it
happens once, at the end of a session, while the hunter is reading a summary — so it stays as it is.
Worth knowing rather than worth changing.

---

## 6. Verification

**1. Typecheck and tests.** All projects clean; the count in section 7.

**2. The integration test passes** — M3-D5's full Friday Legs run, which is the acceptance criterion.

**3. The rest timer survives backgrounding.** Start a 210-second squat rest, background the app for
sixty seconds, return, and confirm the remaining time is correct rather than frozen. This is the
check G6 exists for, and it cannot be done in a unit test.

**4. The screen stays awake**, and stays awake after the app has been hidden and shown again — which
is the re-acquire path, and the part most likely to be quietly broken.

**5. Offline.** A full session logged with the network off. `pnpm dev` with devtools offline, and
again against the built app under `wrangler dev`.

**6. Corrections behave.** Log a set, correct its weight, and confirm the original survives in the
log while the projection counts only the replacement. Then mis-flag a warmup, correct that, and
confirm next week's target changes accordingly — the G4 path.

### What M3 cannot verify

**The acceptance criterion as originally written straddles two milestones.** It asks for a session
logged *"offline, in airplane mode, with the app installed"*. Installability is M4's work — icons,
the manifest, the install prompt, the first deploy. M3 can prove the app functions with no network;
it cannot prove it functions as an installed app, because there is nothing to install yet.

So the criterion splits: **M3 owns offline**, and **M4 owns installed-and-offline**, on the phone, in
the gym, which is where it actually matters.

Also unverifiable here: whether set entry is genuinely usable one-handed with chalky fingers between
sets. No test answers that. M4 does.

---

## 7. Test count

| | Tests |
|---|---|
| After M2 (projected) | **≈448** |
| G2 — the rep-range override, including the default-when-absent case | +6 |
| G1 — routine resolved from the session, and the Instant Dungeon fallback | +3 |
| G3 — bodyweight defaulted, and tonnage correct for a bodyweight exercise | +2 |
| G4 — the warmup correction, and its effect on the next target | +2 |
| G5 — `order` after a correction | +2 |
| G6 — the pure timer: remaining, chime due, formatting, the elapsed-while-hidden case | +10 |
| **M3-D5 — the full Friday Legs session and next week's targets** | +4 |
| After M3 | **≈477** |

Every one of these is pure logic or store behaviour. None is a rendering assertion.

---

## 8. What M3 leaves alone

- **Icons, the manifest, the setup script, Actions, the first deploy, and the installed-and-offline
  run.** M4.
- **The full Status Window, the Physique panel, and the Daily Quest screen.** M5. The engine for all
  three already exists and is tested; they are missing screens, not missing logic.
- **Runes and intensity techniques** — drop sets at level 10, rest-pause at 15, clusters at 25.
  `runes.ts` exists and is tested. Surfacing them in the gate screen is later work, and doing it now
  would mean building the unlock interface before the thing it modifies is proven.
- **Instant Dungeon Key** — the travel and home session generator. `gates.ts` has it. It shares the
  gate screen, so it wants that screen to be finished first.
- **A scheduled notification for the rest timer.** M8, per M3-D6.
