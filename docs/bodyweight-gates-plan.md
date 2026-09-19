# Bodyweight gates — implementation plan

A hunter who picks **Bodyweight** in the Awakening Test currently gets the same six gates
as a hunter with a full commercial gym: Monday opens with an Incline Barbell Press they
cannot perform. This plan gives that hunter their own six gates, built from a bodyweight
library that holds to the same evidence standard as the rest of the programme.

Written 2026-09-19. Delete once landed, per CLAUDE.md's plan-file lifecycle — the permanent
record is a summary in `implementation-plan.md` §4 and a line in `TODO.md`.

---

## 1. What is actually broken, in code

- `repo.ensureSeeded()` is called from `state.ts`'s `load()` (line 597) on **every** app
  start, including the very first, when no profile exists and equipment access is therefore
  unknowable. It seeds all six `SEED_ROUTINES` unconditionally.
- Routines are seeded **add-only** (`bulkAdd` of missing ids) on purpose — they are meant to
  become user-editable, and overwriting on every load would discard a hunter's edits
  (`repo.ts` §`ensureSeeded` doc comment). So once the barbell set is in, it never leaves.
- Nothing anywhere reads `profile.equipmentAccess` to choose a routine. It is read in exactly
  four places: `substitution.ts` (swap candidates), `progression.ts` (`canAddExternalLoad`),
  `gate.tsx:413` (Instant Dungeon), and `state.ts` (feeding those two).
- The only escape hatch is the per-exercise Swap button, and eleven prescribed exercises have
  no bodyweight answer at all — that is already written down as `substitution.test.ts`'s
  `EXCEPTION_LIST`.

Verified: routines reach the UI only through the database (`repo.getRoutines()` →
`state.routines`). `seed.ts`'s `routineForDayOfWeek` has **no callers** and is dead code —
worth deleting while we are here.

## 2. Decisions this plan commits to

**A pull-up bar is the baseline tier.** Without one there is no vertical pull and no
horizontal pull, which means lats, upper back and biceps get nothing — the classic
calisthenics dead end. We do not paper over it with a "table row" tagged as equipment it does
not need (the same call `seed.ts` already made for jump ropes and loose plates). We flag it
with an advisory and let the hunter decide.

**A static routine set, not a generator.** Six hand-designed gates, the same shape as the
barbell six. `buildInstantDungeon` already exists for dynamic, equipment-filtered sessions,
and it is deliberately a *one-off travel session* — not a programme. Generated weekly
programming would make progression non-deterministic and break the design philosophy stated
at the top of `seed.ts`: the hunter's actual training week, encoded.

**Progression runs on the ladder, not on load.** For `equipmentAccess: ['bodyweight',
'pullup_bar']`, `canAddExternalLoad()` returns false (it wants dumbbell, kettlebell, bands or
cable), so `nextTarget` skips `add_external_load` and falls straight through to the
`progressionLadder` → `advance_variation` branch. That is exactly the mechanism we want, and
it already works. The design work is authoring a ladder per movement pattern where each rung
is harder **by leverage and range of motion**, not by rep count.

**The stretch standard applies here too.** Same bar as the Romanian Deadlift and Nordic Curl
calls: where a choice exists, prefer the variation that loads the muscle at long length. That
is why deficit push-ups, sissy squats, deficit calf raises and Nordic curls sit at or near the
top of their ladders, rather than "do more reps".

### Constraints any implementation must respect

These are existing, tested invariants — not suggestions:

| Rule | Source |
|---|---|
| A routine may only reference a `role: 'prescribed'` exercise | `seed.test.ts` |
| Every rung of a ladder shares the same `pattern` | `seed.test.ts` |
| Every exercise named in a ladder carries the **identical** ladder array | `seed.test.ts` |
| No `fallback` carries a `progressionLadder` | `seed.test.ts` |
| `advance_variation` refuses to promote onto a `fallback` | `progression.ts:203` |
| Every prescribed exercise has a guide | `exerciseGuides.test.ts` |
| Every prescribed exercise has a swap candidate when its own equipment is blocked, or is a named exception | `substitution.test.ts` |

## 3. The library

Roughly **17 new exercises** and **11 promotions** from `fallback` to `prescribed`. Every one
needs a guide entry (`content/exerciseGuides.ts`), which is the bulk of the content work.

### Ladders

Each row is one ladder array, shared verbatim by every exercise in it.

| Pattern | Ladder (easiest → hardest) |
|---|---|
| `horizontal_push` | incline-pushups → pushups → diamond-pushups → **deficit-pushups** → **archer-pushups** |
| `vertical_push` | pike-pushups → **deficit-pike-pushups** → **wall-handstand-pushups** |
| `vertical_pull` | **negative-pull-ups** → pull-ups → **archer-pull-ups** |
| `horizontal_pull` | **incline-inverted-row** → inverted-row* → **feet-elevated-inverted-row** |
| `squat` | bodyweight-squat → **sissy-squat** → **pistol-squat** |
| `lunge` | split-squat* → **deficit-split-squat** |
| `hinge` | glute-bridge* → single-leg-glute-bridge* → **feet-elevated-single-leg-glute-bridge** |
| `isolation` (hamstrings) | **sliding-leg-curl** → nordic-curl |
| `isolation` (calves) | standing-calf-raise* → **single-leg-calf-raise** → **deficit-single-leg-calf-raise** |
| `core` | leg-raises → hanging-leg-raises → **toes-to-bar** |

**bold** = new. `*` = promoted from fallback.

Note on the existing push ladder: it ships today as
`['incline-pushups', 'pushups', 'diamond-pushups']` and appears in the barbell hunter's Monday
and Thursday gates. We **append only** — reordering it would churn a live hunter's progression
history for no gain.

One thing to settle during implementation: the `hinge` ladder crosses primary muscles
(glute-bridge is glutes, single-leg-glute-bridge is hamstrings). The invariant only requires a
shared *pattern*, and the shipped push ladder already crosses chest→triceps, so this is
precedented — but decide deliberately whether to align the primaries instead of inheriting the
precedent by accident.

### Other promotions

`chin-ups` (biceps — deliberately modelled with biceps as primary, see commit 5d33216, so it
stays off the lats ladder), `side-plank` (obliques), `dead-hang` (grip), `prone-ytw-raise`
(rear delts), `burpees` / `outdoor-run` (cardio, for Saturday).

### New, outside a ladder

`plank-shoulder-tap` — anti-rotation core, the bodyweight stand-in for the Pallof Press. Same
reasoning as the Pallof: this is spine-stability work, not hypertrophy work, so the stretch
standard does not apply to it.

### Side effect worth naming

`substitutesFor` sorts `prescribed` above `fallback` at equal tier. Promoting eleven bodyweight
exercises therefore changes swap rankings for the **barbell** hunter too — e.g. a promoted
Split Squat now outranks other tier-2 candidates when the squat rack is taken. Tier-1 matches
still win, so the effect is mild, but it is real and should not arrive as a surprise.

## 4. The six gates

Same six days, same `dayOfWeek` values, so `weekDayStatus`, streaks, gate ranks and the week
strip all keep working untouched. Ids prefixed `bw-` to avoid colliding with the barbell set.

| Day | Gate | Shape |
|---|---|---|
| Mon | Push | deficit-pushups · pike-pushups · diamond-pushups · prone-ytw-raise |
| Tue | Pull | pull-ups · inverted-row · chin-ups · prone-ytw-raise · dead-hang |
| Wed | Lower + core | split-squat · sliding-leg-curl · single-leg-calf-raise · side-plank · plank-shoulder-tap |
| Thu | Push (supersets) | incline-pushups + pike-pushups · pushups + diamond-pushups · archer-pushups |
| Fri | Legs | sissy-squat · deficit-split-squat · single-leg-glute-bridge · nordic-curl · deficit-single-leg-calf-raise |
| Sat | Cardio + core | leg-raises · hanging-leg-raises · side-plank · outdoor-run |

Set and rep prescriptions get finalised against `volume.ts`'s `LANDMARKS` during
implementation — the target is clearing MEV for every muscle this equipment can actually
reach, and being honest (§6) about the ones it cannot.

## 5. Seeding — the crux

The hard part is not the exercises, it is *when* routines are written.

**Chosen approach: defer routine seeding until a profile exists.**

- `ensureSeeded()` keeps upserting **exercises** unconditionally on every load. That must not
  change — it is what lets a shipped library correction reach an already-seeded device (F1).
- Routine seeding moves out of the unconditional path. `completeAwakening()` picks the set by
  equipment access and seeds it once. Add-only semantics are preserved.
- A returning hunter who already has routines is untouched, because seeding stays add-only.

Rejected alternatives:

- *Seed both sets, filter at display.* Two routines share each `dayOfWeek`; the week strip and
  every `dayOfWeek` lookup would need a tiebreak. Pollutes the data model to dodge a
  three-line ordering problem.
- *Seed barbell, then replace on awakening.* Requires deleting rows the hunter may have
  edited, which is exactly what add-only exists to prevent.

**Selection rule.** Bodyweight set when equipment access can reach no external load and no
machine — i.e. it contains none of barbell, dumbbell, machine, cable, kettlebell, bands,
ez_bar. Otherwise the existing set. Put this in `domain/` as a pure, tested function; it is a
programme decision, not a UI one.

**To verify during implementation:** `/gate` has no profile guard (only `index.tsx:155`
redirects to `/awaken`). With deferred seeding, navigating straight to `/gate` pre-awakening
shows an empty gate rather than a crash — confirm that renders sanely, and consider adding the
same redirect.

## 6. Advisories — telling the truth about the gaps

`detectAdvisories` has no equipment access today. Thread it through: add
`equipmentAccess: readonly Equipment[]` to `AdvisoryInput`, pass
`state.profile?.equipmentAccess ?? []` from `state.ts`'s recompute (line 672).

Two new advisories:

**`no-pullup-bar`** — fires when access is bodyweight-only with no bar and no loaded
equipment. There is no vertical or horizontal pull available, so lats, upper back and biceps
receive nothing at all; this is a hole in the programme, not a tuning problem. Suggestion: a
doorway bar is the single highest-value thing to acquire.

**`no-external-load`** — fires when nothing can add load. Side delts, rotator cuff, traps and
forearms have no bodyweight option in the library and will sit below MEV no matter how the
week is arranged. Say so rather than letting the volume bars read as a programming failure.

## 7. Tests

Updated: `seed.test.ts` (ladders, prescribed-only routines, fallback audit groups),
`substitution.test.ts` (coverage for ~28 newly prescribed exercises — expect several genuine
`EXCEPTION_LIST` additions for the bar-dependent ones), `advisories.test.ts` (new input field,
two new advisories), `exerciseGuides.test.ts` (guides for every new prescribed exercise).

New, and the one that actually guards this feature:

- **Every exercise in a `bw-` routine is performable with `['bodyweight', 'pullup_bar']`.**
  A mistagged exercise slipping into a bodyweight gate is the exact bug this whole plan
  exists to prevent, and it should fail a test rather than a workout.
- **Every bodyweight ladder advances to a `prescribed` rung**, since `progression.ts` silently
  falls through to `hold_add_rep` otherwise — a broken ladder would look like "keep adding
  reps forever" rather than an error.
- Volume report over the bodyweight week, asserting which muscles clear MEV and pinning the
  ones that cannot as a documented expectation.

## 8. Phases

1. **Library** — new exercises, promotions, ladders, guides. Tests green.
2. **Routines** — `SEED_ROUTINES_BODYWEIGHT`, six gates, the performable-with-bodyweight test.
3. **Seeding** — pure selection function, deferred routine seeding, awakening wiring.
4. **Advisories** — thread equipment access, two new advisories.
5. **Verify in the browser** — complete the Awakening as a bodyweight hunter, confirm the gates
   that appear are the bodyweight ones and every exercise is doable, then clear one.

Phases 1 and 2 are additive and safe to land on their own; nothing reads the new routine set
until phase 3 flips the switch.

## 9. Known gaps, stated plainly

With bodyweight and a bar and nothing else:

- **Side delts, rotator cuff, traps, forearms** have no exercise in the library and no honest
  bodyweight movement to add. They stay below MEV. The advisory says so.
- **The `carry` pattern** is unreachable — carries need something to carry.
- **Without a bar**, add lats, upper back and biceps to that list. That is a programme with no
  back training in it, which is why the advisory recommends buying a bar rather than
  pretending the week is complete.
