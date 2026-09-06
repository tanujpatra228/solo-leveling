# Exercise substitution — plan

A gate prescribes Cable Crunch. The cable station is occupied and three people are waiting. The
hunter needs to swap to something that trains the same thing, log it honestly, and keep moving.

**Scope: every exercise in every gate.** Any station in a commercial gym can be occupied on any
day, so this is not a curated set of alternatives for a few known-awkward machines. Every block on
every routine gets a Swap control, and the candidates are derived from muscles, movement pattern
and what is currently free — not from a hand-maintained pairing table that would rot the moment the
library grew. Section 4 carries the invariant that makes that claim testable rather than
aspirational, and names the four groups where it cannot fully hold.

Written 2026-09-06, from a real Saturday Cardio and Abs Gate where the cable station and then the
hanging bar were both taken, back to back.

## 0. The finding that changes the design

The intuition was "an easier variant should pay less XP". Measured against the current engine, the
opposite is true, and by a wide margin.

`tonnage()` in `src/domain/e1rm.ts` adds the hunter's **full** bodyweight for any exercise with
`usesBodyweight: true`. Every abs movement in the seed is flagged that way. So at 72 kg:

| Logged | Tonnage | XP from tonnage |
|---|---|---|
| Cable Crunch 3×15 @ 25 kg | 1,125 kg | 94 |
| Sit-ups 3×20 (bodyweight) | 4,320 kg | 360 |

The substitute a hunter reaches for when a machine is busy pays **3.8× more** than the prescribed
movement. Ship substitution on top of this and the dominant strategy is to swap every loaded
movement for a bodyweight one. The feature would be an XP exploit wearing a convenience costume.

The cause is that a sit-up does not move 72 kg. It moves the trunk, which is roughly 45% of that. A
lying leg raise moves the legs, roughly 30%. A pull-up genuinely does move ~95%. The model has one
number where it needs a per-exercise fraction.

**So the XP half of this feature is not a penalty. It is a correction.** Measure the work honestly
and every downstream number — XP, gate rank, the gate-clear bonus — self-corrects, because
`gateDifficulty` and `computeSessionXp` are already derived from what was actually performed. A
substitution-specific penalty multiplier would be a second XP system running against the first,
and the two would disagree the first time someone substituted *upward* to a harder movement.

### The second finding: a time-unit exercise pays nothing at all

`isHardSet` rejects any set with `reps <= 0`, and the gate's entry form sends `reps: 0` for a
`time` or `distance` exercise because `needsReps` is false for those units. Tonnage is zero too —
no load, and `usesBodyweight` is false. So:

**`treadmill-intervals` earns 0 XP. Not less. Zero.** The Saturday Cardio and Abs Gate has a cardio
block that pays nothing, and contributes nothing to the gate rank either, since `gateDifficulty`
receives `weightKg: 0, reps: 0`.

This matters here because substitution must work for every exercise, and any `time` or `distance`
stand-in inherits the same zero. Swapping the treadmill for skipping or stairs would move XP from
nothing to nothing, which makes the feature look broken when it is the scoring model that is.

Time-based work needs its own XP term — a per-minute rate, and hard-set counting that recognises a
work interval rather than requiring reps. That is a scoring change with its own calibration
argument, so it belongs in its own commit ahead of the UI, not bolted onto this one.

## 1. What substitution is, structurally

A substitution is **a logged fact, not an edit to the routine** (standards rule 4). The routine is
the plan; the log is what happened. `SetLog` already carries its own `exerciseId`, so logging
sit-ups against the Cable Crunch block is already representable — what is missing is the record
that it *stood in for* something, which the projection needs in order to:

- give gate-clear credit for a block that was performed with a different movement,
- avoid reading the gap as abandoned progression on the planned exercise,
- state plainly in the summary that 1 of 4 blocks was substituted.

One new optional field: `SetLog.substitutedFor?: string` — the planned `exerciseId`. Absent on
every existing row, which the Zod boundary already tolerates (rule 3). Nothing is mutated, nothing
is deleted, and the original prescription stays legible in the routine.

## 2. The prescribed library keeps priority

The 34 seeded exercises are the hunter's own programme, chosen deliberately. Filling the
substitution gaps means adding exercises to the library, and those additions must never dilute the
programme. So the library splits in two:

- **Prescribed** — the current 34. Routines are built from these, the progression engine targets
  these, and they are always ranked first in any swap sheet.
- **Fallback** — everything added to close the deserts in section 4. Never appears in a routine,
  never becomes a default, never gets promoted by mastering it. It exists only inside the swap
  sheet, for the evening the station is taken.

One field carries this: `role: z.enum(['prescribed', 'fallback']).default('prescribed')` on
`ExerciseSchema`. The default keeps all 34 existing exercises prescribed with no seed edit, and
new fallbacks opt in explicitly.

Two rules follow, both worth asserting in tests:

- A `Routine` may only reference `prescribed` exercises. A fallback appearing in a routine is a
  seed bug, and cheap to catch.
- `advance_variation` may not advance onto a `fallback`. Mastering a stand-in must not quietly
  rewrite the programme — the ladder is the programme's own progression, and a fallback is not on
  it.

A substituted set still logs against the fallback's own `exerciseId`, so its history accumulates
and its own targets work normally. It simply never gets prescribed.

## 3. Choosing the candidates

### Availability is a session fact, not a profile fact

`profile.equipmentAccess` says what the hunter's gym *has*. The problem this feature exists for is
what is **occupied right now**, which is a different thing and changes set to set. A function that
only knows `equipmentAccess` will cheerfully offer Cable Fly as a substitute for Cable Crunch —
same station, still busy, useless answer.

So the signature carries both:

```ts
substitutesFor(planned, {
  exercises,
  equipmentAccess,        // what the gym has          — from the profile
  blockedEquipment,       // what is taken right now    — this session only
  routine,                // to demote what is already prescribed today
})
```

**Hard rule, not a ranking weight: a candidate requiring any blocked equipment is not a candidate.**
Ranking sorts useful answers; this excludes useless ones, and the two must not be confused. It is
the single most important line in the function.

**The default costs zero taps.** Tapping Swap on Cable Crunch implies the cable is the problem, so
`blockedEquipment` defaults to the planned exercise's own `equipment`. The hunter mid-set does not
want a checklist. If a second station is also busy they can add it, but the common case — one thing
occupied, swap off it — needs no input at all.

This also means substitution is never limited to a curated pairing. Any exercise can be swapped,
because the query is derived from muscles, pattern, and what is free, not from a hand-maintained
map of alternatives that would rot the moment the library grew.

### Ranking, once the useless answers are gone

1. **Tier 1** — same `pattern` and at least one shared `primaryMuscles` entry.
2. **Tier 2** — same primary muscle, any pattern. Required, not optional: ten of the eighteen
   (pattern, muscle) groups in the seed hold a single exercise (section 4), so tier 1 alone returns
   nothing for most of the library. Cable Fly has no other `isolation` chest movement, but Pushups
   train the same muscle through a different pattern and are a fine answer when the cable is busy.
   The sheet says which tier a candidate came from, because "same movement, different implement"
   and "different movement, same muscle" are not the same promise.
3. Within a tier: on the same `progressionLadder` first, since that is a known rung rather than a
   lateral guess. Hanging Leg Raises → Leg Raises is the cleanest case in the library, and the
   System can say "one rung below, and the bar is taken".
4. Then `repRange` overlap, so the prescription still reads sensibly.
5. Demote anything already prescribed elsewhere in today's routine. Substituting Hanging Leg Raises
   with Leg Raises means doing Leg Raises twice, since they are already block 1 — legitimate, but
   not the stimulus the gate intended, and worth saying rather than leaving the hunter to notice.

Every candidate carries a plain-language `why` in the System's voice. A ranked list with no reason
is a list the hunter has to second-guess mid-set.

## 4. The library audit: substitution deserts

A ranking function is only as good as the library behind it. All 34 seeded exercises, grouped by
(pattern, primary muscle), with what a hunter can reach when the equipment is taken:

| Group | Exercises | Bodyweight fallback |
|---|---|---|
| horizontal_push / chest | incline-barbell-press, cable-chest-press ×3, incline-pushups, pushups | **yes** |
| horizontal_push / triceps | diamond-pushups | **yes** |
| vertical_push / front_delts | machine-shoulder-press, pike-pushups | **yes** |
| core / abs | leg-raises, situps, machine-abs-crunch, cable-crunch, hanging-leg-raises | **yes** |
| squat / quads | barbell-squat, leg-press, bodyweight-squat | **yes** |
| vertical_pull / lats | one-arm-cable-lat-pulldown, pull-ups | no — both need cable or a bar |
| isolation / biceps | cable-bicep-curl, machine-preacher-curl, strict-curl | no |
| isolation / triceps | skullcrusher, tricep-overhead-extension | no (diamond-pushups covers it via tier 2) |
| horizontal_pull / upper_back | dumbbell-row | **only one exercise** |
| isolation / chest | cable-fly | **only one** |
| isolation / side_delts | machine-lateral-raise | **only one** |
| isolation / rear_delts | machine-reverse-fly | **only one** |
| isolation / front_delts | front-raises | **only one** |
| isolation / traps | cable-shrug | **only one** |
| isolation / hamstrings | hamstring-curl | **only one** |
| isolation / quads | leg-extension | **only one** |
| isolation / calves | barbell-calf-raise | **only one** |
| cardio / cardio | treadmill-intervals | **only one** |

Ten groups hold a single exercise. Five have a bodyweight fallback. So on a busy evening the
feature would shrug at most of the routine — the machine is taken and the System has nothing to
offer. Tier 2 (same muscle, different pattern) rescues some of it; the rest needs seed work, which
is why commit 2 below exists and why it comes before the UI.

The gaps worth seeding first are the ones with no answer at all when a station is occupied:
bodyweight row (inverted row or a table row), a dumbbell or bodyweight lateral raise and reverse
fly, bodyweight calf raise, Nordic or single-leg hamstring work, a chin-up or towel-row alternative
for lats, and at least one cardio option that needs no treadmill — skipping, stairs, or an outdoor
run against `time`.

### The coverage guarantee

"Any exercise can be substituted" is only real if it is checkable, so it becomes an invariant with
a test behind it. The test must model the actual scenario — the equipment this exercise needs is
the equipment that is taken:

> For every `prescribed` exercise in the library, calling `substitutesFor` with
> `blockedEquipment` set to that exercise's **own** `equipment` returns at least one candidate.

That is the real gym case, and it is stronger than the bodyweight-only version it replaces: it
proves there is always an answer that does not need the thing you cannot get to. A test that walks
the whole library and asserts a non-empty result for every entry turns the deserts above from
something to remember into something that fails the build, and means a new prescribed exercise
cannot arrive later without a fallback behind it.

A second, harsher pass for the worst case — everything taken at once:

> For every `prescribed` exercise, with `equipmentAccess: ['bodyweight']`, either a candidate is
> returned or the exercise appears in the documented exception list below.

### Four groups where physics wins

The harsher pass cannot pass everywhere, and pretending otherwise would be a lie in a test file.
Some muscles cannot be loaded with nothing at all:

| Group | Minimum implement | Why nothing works |
|---|---|---|
| vertical_pull / lats | a bar, rings, or a table edge | pulling requires something to pull against |
| horizontal_pull / upper_back | same | as above |
| isolation / side_delts | a dumbbell, plate, or band | an unloaded lateral raise is not a working set |
| isolation / traps | a dumbbell, plate, or bar | a shrug with no load is not a shrug |

For these four, the guarantee is the first form only: a substitute exists that avoids the *blocked*
equipment. In a commercial gym that is enough — if the cable is busy, a dumbbell or a barbell in a
rack is almost certainly free. The exception list is asserted explicitly, so it is a decision on
the record rather than a hole someone finds later.

### The fallbacks to seed, named

Turning section 4's audit into a concrete list. Everything here is `role: 'fallback'` — it fills a
gap and never enters the programme.

| Group | Fallback to seed | Equipment |
|---|---|---|
| vertical_pull / lats | Inverted Row, Chin-ups | bar / bodyweight |
| horizontal_pull / upper_back | Inverted Row, Single-arm Dumbbell Row (no bench) | bar, dumbbell |
| isolation / side_delts | Dumbbell Lateral Raise, Plate Raise | dumbbell |
| isolation / rear_delts | Prone Y-T-W Raise | bodyweight |
| isolation / traps | Dumbbell Shrug, Barbell Shrug | dumbbell, barbell |
| isolation / biceps | Chin-ups, Towel Curl | bar / bodyweight |
| isolation / hamstrings | Single-leg Glute Bridge, Nordic Curl | bodyweight |
| isolation / quads | Split Squat, Wall Sit | bodyweight |
| isolation / calves | Standing Calf Raise | bodyweight |
| isolation / chest | Pushups (already seeded, reached via tier 2) | bodyweight |
| cardio / cardio | Stair Climb, Skipping, Outdoor Run, Burpees | bodyweight / rope |

`treadmill-intervals` being the only cardio movement is the gap most likely to bite, because every
gate that ends in cardio ends in a single point of failure. Seeding three no-equipment options
costs almost nothing.

### A defect the audit turned up, unrelated to substitution

The pushup ladders disagree with each other. Three exercises carry
`['incline-pushups', 'pike-pushups', 'diamond-pushups']`, while `pushups` carries
`['incline-pushups', 'pushups', 'diamond-pushups']`.

`computeNextTarget` advances by `ladder.indexOf(exercise.id)` then `ladder[i + 1]`, reading the
ladder off the *current* exercise. So mastering Incline Pushups unlocks **Pike Pushups** — a
`vertical_push` movement for the front delts — rather than full Pushups, which is a pattern and
muscle change dressed as a progression. And because no other exercise's ladder routes to `pushups`,
full Pushups are unreachable by progression at all.

Fix separately, ahead of this feature, since it is a live progression bug rather than a
substitution one: one ladder per pattern, `['incline-pushups', 'pushups', 'diamond-pushups']` for
the horizontal push line, and pike pushups on their own vertical-push ladder. Worth an assertion
that every exercise on a ladder shares the pattern of the rung below it.

## 5. Commits

### Commit 1 — `bodyweightFactor`, and honest tonnage

Add `bodyweightFactor: z.number().min(0).max(1).default(1)` to `ExerciseSchema`. Seed a value for
every `usesBodyweight` exercise. Thread it through `tonnage()` and through the `weightKg` that
`projection.ts` hands to `gateDifficulty` — that second call site currently passes `s.weight` raw,
so a bodyweight substitute contributes nothing to gate difficulty and lands at
`ASSUMED_INTENSITY_WITHOUT_HISTORY`.

Pure domain, tests first (rule 2), including the empty and zero cases.

**This re-grades history, and that is the decided behaviour** (2026-09-06). Every past session's
tonnage and XP recomputes, which is the append-only model working as designed (rule 4). A level can
go *down* as a result.

The re-grade must be announced, not discovered: on the first load after this ships, a System window
states that the measure of bodyweight work was corrected, what the level was, and what it is now.
A silent downward correction would read as data loss. Gate this on a `Progress` flag so it shows
once, in the same shape as `doubleDungeonSeenAt`.

### Commit 2 — XP for time and distance work

A per-minute XP term and hard-set counting that recognises a work interval, so `isHardSet` stops
rejecting every cardio set on `reps <= 0`. Also feeds `gateDifficulty`, which currently scores a
cardio block at zero.

**Decided rate: 20 XP per minute of work interval**, priced level with one hard set, since both
are roughly a unit of hard effort. Calibrate against the existing "a consistent year lands near
level 50" assertion in `xp.test.ts` rather than tuning it twice — if pricing cardio breaks that
assertion, the rate moves, not the assertion.

Ahead of the UI because otherwise the first thing a hunter substitutes on a Cardio and Abs Gate
moves their XP from zero to zero and the feature takes the blame.

### Commit 3 — the pushup ladder fix

One ladder per movement pattern, plus an assertion that every rung on a ladder shares the pattern
of the rung below it. Independent of substitution; grouped here because it touches the same seed
data and the same engine path, and shipping the seed twice is wasteful.

### Commit 4 — `role`, and seeding the fallbacks

`role: 'prescribed' | 'fallback'` on `ExerciseSchema`, defaulting to `prescribed` so the existing
34 need no edit. Then seed every movement in the named table in section 4 — roughly twenty
exercises, each with its `bodyweightFactor`, `pattern`, `primaryMuscles` and `equipment` filled in,
because the ranking function reads all four and a fallback with sloppy metadata ranks wrongly.

Tests: a routine may only reference `prescribed`; `advance_variation` never lands on a `fallback`;
and every seeded fallback names at least one group from the audit, so a fallback that fills no gap
is caught rather than accumulating.

### Commit 5 — `substitutesFor`

The ranking function and its tests. Pure, no store, no React. Takes `blockedEquipment` as well as
`equipmentAccess`, excludes any candidate needing blocked equipment before ranking anything, then
tier 1, tier 2, ladder adjacency, rep-range overlap, and the same-routine demotion.

Assertions:

- **The exclusion rule first, because it is the one that makes the feature useful.** Cable Crunch
  with `blockedEquipment: ['cable']` never returns Cable Fly or any other cable movement.
- `blockedEquipment` defaults to the planned exercise's own equipment when omitted.
- The Cable Crunch case explicitly: Machine Abs Crunch, then Sit-ups and Leg Raises.
- Hanging Leg Raises returns Leg Raises as a ladder neighbour, demoted for already appearing in
  today's routine.
- An empty library returns an empty list; a hunter with no machine access never sees Machine Abs
  Crunch.
- **The coverage guarantee, both forms**: every prescribed exercise returns a candidate when its own
  equipment is blocked; and under bodyweight-only access, every prescribed exercise either returns
  a candidate or is in the four-group exception list, which the test names explicitly rather than
  skipping.

### Commit 6 — the log and the store action

Dexie version bump for `SetLog.substitutedFor`. A store action
`substituteExercise(plannedId, substituteId, reason)` that records the choice for the open session
only. Reasons: `occupied | unavailable | injury | preference` — worth recording separately because
"occupied" is a logistics signal about the hunter's gym, while "injury" should eventually raise an
advisory rather than be forgotten.

Progression rule to assert in tests: a substitution neither advances nor resets the planned
exercise's progression. It leaves a gap, and the substitute progresses on its own history. A
first-time substitute correctly reads `no_history`.

### Commit 7 — the swap control

A "Swap" affordance on **every** block in `ActiveGateScreen` — not a curated subset, since any
station in the gym can be occupied on any day. Opening it shows ranked candidates with their `why`,
their tier, and an equipment tag.

The sheet opens already assuming the planned exercise's equipment is the problem, so the common
case is two taps: Swap, then pick. A single "something else is taken too" control adds another
piece of equipment to `blockedEquipment` and re-ranks, for the evening the cables *and* the
dumbbell rack are both mobbed. No checklist, no configuration screen — the hunter is standing in a
gym holding a phone.

If exclusion leaves nothing — one of the four exception groups with everything blocked — the sheet
says so plainly and offers to skip the block, rather than showing an empty list. A gate that
cannot be completed as prescribed should still be closable.

Selectors here must return stable references (rule 13) — the candidate list is derived from three
slices plus session state and therefore belongs in `recompute()`, not in a selector. Route mount
tests cover the sheet open and the empty-result state (rule 14).

### Commit 8 — say so in the summary

`finishGate` already queues a summary through `pushMessage`. Add the substitution count to it: "3
of 4 blocks as prescribed. Cable Crunch → Sit-ups, station occupied." The System should never
quietly re-describe what the hunter did.

## 6. What needs no change

`hardSetsPerMuscle` resolves muscles through `resolveExercise`, so a substitute sharing
`primaryMuscles` keeps the weekly volume landmarks and the advisories accurate with no work. The
streak, quest, and fatigue paths read sessions and sets generically and are likewise unaffected.

## 7. Decisions, and what is still open

**The `bodyweightFactor` values are a judgment call with no source yet.** Every `usesBodyweight`
exercise currently in the library, with a working estimate of the fraction of bodyweight the
movement actually shifts:

| Exercise | Factor | Note |
|---|---|---|
| `pull-ups` | 0.95 | genuinely moves nearly all of it |
| `pike-pushups` | 0.70 | torso vertical, most of the load on the shoulders |
| `diamond-pushups` | 0.66 | hands under the chest, close to standard |
| `bodyweight-squat` | 0.65 | trunk plus most of the legs |
| `pushups` | 0.64 | the standard reference figure |
| `incline-pushups` | 0.50 | falls with bench height; one value is a simplification |
| `situps` | 0.45 | the trunk, not the whole body |
| `hanging-leg-raises` | 0.35 | legs, with the trunk stabilising |
| `leg-raises` | 0.30 | legs only |

These need the treatment `docs/research/strength-standards-sources.md` gave the standards tables —
a real source, or an explicit note that they are calibration constants tuned by feel. `pushups` at
0.64 is the one figure that is widely published; the rest are reasoned from segment mass and should
not be presented as measured.

`incline-pushups` is the honest weak spot: the factor genuinely varies with bench height, and a
single number is wrong at both ends. Live with the simplification, or drop the exercise's factor to
a range later — do not pretend it is precise.

### Settled 2026-09-06

**The re-grade applies to history.** Rule 4 derives everything, always, so correcting
`bodyweightFactor` recomputes every past session and a level may fall. The rejected alternative was
storing the factor per set at log time, which would have contradicted append-only-plus-derivation
to protect a number. Condition: it is announced in a System window on first load, not discovered.

**A minute of cardio is worth 20 XP**, level with one hard set. Calibrated against the level-50
assertion in `xp.test.ts`; if pricing cardio breaks that assertion, the rate moves rather than the
assertion.

### Still open

**Should a swap be able to stick?** "Always swap this for me" is a per-profile override and a
different feature. Out of scope here (rule 16).

## 8. Verification

- Every prescribed exercise returns at least one substitute when its **own** equipment is blocked —
  the coverage guarantee, walked across the whole library. This is the real gym case.
- Under bodyweight-only access, every prescribed exercise either returns a candidate or is one of
  the four documented exceptions. No exercise is silently uncovered.
- A cable exercise with the cable blocked never returns another cable exercise.
- Swapping with no explicit `blockedEquipment` excludes the planned exercise's own equipment.
- `substitutesFor` returns Machine Abs Crunch first for Cable Crunch with machine access, and
  Sit-ups or Leg Raises without it.
- Hanging Leg Raises returns Leg Raises, flagged as a ladder neighbour and demoted for already
  appearing in the same gate.
- Sit-ups 3×20 at 72 kg score 1,944 kg of tonnage, not 4,320.
- A cardio block earns 20 XP per minute of work interval, and is no longer worth zero.
- The level-50 calibration assertion in `xp.test.ts` still holds after both scoring changes.
- The re-grade announcement window shows once on first load after the change, and not again.
- No routine references a `fallback` exercise, and `advance_variation` never lands on one.
- Mastering Incline Pushups advances to Pushups, not Pike Pushups.
- A Cardio and Abs Gate with Cable Crunch swapped for Sit-ups clears, with a gate rank recomputed
  from the work actually done and no separate penalty applied.
- The planned exercise's next target is unchanged by a substitution; the substitute's own target
  advances from its own history.
- `/gate` mounts with the swap sheet open, and mounts with the sheet in its empty-result state.
- Every block on every seeded routine offers a Swap control, with none excluded.
