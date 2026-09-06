# M5 — The game layer

The Status Window becomes the home screen: the Daily Quest with per-item progress, the streak and
its forgiveness controls, stat allocation, the fatigue gauge, volume bars, the deload prompt, and
the advisories. Written 2026-09-06.

## 0. Where the build stands

Everything below the interface is finished and tested — 564 tests passing, typecheck and build
clean.

| | State |
|---|---|
| M1–M3 | Landed |
| Exercise substitution (8 commits) | Landed, `5ce8d44`–`4d6f484` |
| System visuals and notifications | Landed, `cdc8b25`, `b79de6d` |
| M4 | Half done. Actions workflow, bundle attribution, sync CPU measurement, doc correction |
| Indian club training | Planned, unblocked, not started |
| M5 | This document |

**M5 is almost entirely UI over an engine that already exists.** Every action it needs is already
on the store — `completeDailyQuest`, `allocatePoint`, `resetAllocation`, `dismissAdvisory`,
`declareAbsence`, `spendRestToken`, `markDeload` — and the projection already exposes `volume`,
`deload`, `questBias`, `fatigue`, and `advisories`. The component vocabulary landed with the
visuals work: `SystemMeter`, `SystemIcon`, `SegmentedRing`, `StatRow`.

That makes this a low-risk milestone with one real exception, F2 below.

## 1. Findings

### F1 — shipped corrections never reach a device that was already seeded

`repo.ensureSeeded()` adds only exercises **missing by id**, and never updates a row already in
Dexie:

```ts
const missingExercises = SEED_EXERCISES.filter((e) => !existingExerciseIds.has(e.id))
if (missingExercises.length > 0) await db.exercises.bulkAdd(missingExercises as Exercise[])
```

`ExerciseSchema` declares `bodyweightFactor: z.number().min(0).max(1).default(1)`. A device seeded
before that field existed reads its 34 rows back through the default — **factor 1, full bodyweight,
the exact bug commit `5ce8d44` was written to fix.** On the real phone a sit-up still scores as
though it moved the whole body, the level is still inflated, and the re-grade announcement window
compares two identical numbers and says nothing changed.

This is not an M5 feature. It is the reason an already-shipped feature is invisible, and it should
land first and alone.

The fix is narrow: upsert exercises unconditionally with `bulkPut`. Safe for exercises specifically,
because they are seed data the hunter never edits. **Routines must keep the add-only behaviour** —
those will become user-editable, and overwriting them on every load would silently discard edits.

### F2 — the Daily Quest has no per-item progress, despite the type saying it does

`AppState` declares:

```ts
completeDailyQuest: (progressByKind?: Partial<Record<DailyItemKind, number>>) => Promise<void>
```

The implementation is `async completeDailyQuest()` — the parameter is accepted by the type and
ignored by the body. The quest is all-or-nothing: `setQuestStatus(row.id, 'complete')`.

M5's headline item is "Daily Quest with per-item progress", so this is the one place M5 needs real
domain and store work rather than presentation. A `DailyQuest` has four items (`pushups`, `situps`,
`squats`, `run`), and partial progress needs somewhere to live — extending the stored `QuestLog`
payload rather than adding a table, since a quest row already carries its payload.

Decide explicitly: progress is **entered by the hunter**, not inferred from logged sets. Inferring
sounds elegant and is wrong — 40 sit-ups inside a gate are not the Daily Quest's sit-ups unless the
hunter says so, and guessing would either double-count the day's work or quietly complete a quest
nobody did.

### F3 — the fatigue gauge will read "danger" for a beginner's first four weeks

`chronicWeekly` is the 28-day tonnage total divided by four. In week one the 28-day window contains
only week one, so chronic ≈ acute ÷ 4 and the ratio sits near **4.0** — well past the danger
threshold. `bandFor(null)` correctly returns `insufficient_data` when there is no history at all,
but the moment there is *any*, a perfectly normal first week reads as a dangerous spike.

The user's first cleared gate was docked to a 0.6 multiplier this way: subtotal 1,080 XP paid out as
648. That was invisible while nothing displayed the band. M5 puts the gauge on screen, so it will
now tell a beginner they are in danger during the exact weeks they are building the baseline.

Fix while building the gauge: hold `insufficient_data` until the chronic window actually spans four
weeks of training history, rather than until it is non-zero. ACWR is not meaningful before that, and
a multiplier of 1 is the honest answer.

### F4 — records are never set by bodyweight-only work

`resolveBosses` works from estimated 1RM, which needs a load. A set logged at `weight: 0` produces
an e1RM of 0, so it can never beat the running best. A hunter whose programme is pushups, pull-ups
and abs work sets **no records ever**, and M5 is where level-ups and records become visible.

Rep-count records already exist in the projection as `bestRepsByExercise`. The gap is that nothing
treats beating one as a boss kill worth XP.

### F5 — the bundle is over target, and M5 is the largest UI milestone

The initial route is **200.76 KB JS + 5.52 KB CSS gzipped**, past the 200 KB line `infrastructure.md`
set at M2 — a number M4 finding H2 already argues was borrowed from the wrong kind of app. Nothing
gates on it; there is no automated check.

M5 adds more screen surface than any milestone so far. Either M4 commit 3 lands first and replaces
the invented budget with a measured one, or M5 adds a route-level code split. Doing neither means
the number drifts with nobody deciding anything.

## 2. What M5 does

The Status Window becomes the home screen and grows the panels that already have data behind them:

- **Daily Quest** — the four items, each with entered progress against its target, the announcement
  in the System's voice, and the completion window.
- **Streak** — current and longest, forgiven days marked, with the rest-token and absence controls
  that already exist as store actions.
- **Stat allocation** — spend unspent points, see `questBias` change as a consequence, reset.
- **Fatigue** — the `SegmentedRing` driven by `fatigue.gauge`, with its band and message.
- **Volume** — one `SystemMeter` per muscle against its landmark, from `projection.volume`.
- **Deload** — the prompt when `projection.deload` says so, and `markDeload`.
- **Advisories** — the dismissible list already in the store.
- **Level-up** — a window-tier notification when the level changes, using the notification tier that
  landed with the visuals.

## 3. Commits

### Commit 1 — seed upsert (F1)

`bulkPut` for exercises, `bulkAdd` kept for routines, with a comment saying why they differ. A test
that seeds an old-shaped exercise row, re-runs `ensureSeeded`, and asserts the corrected
`bodyweightFactor` is present. Ships alone, ahead of everything.

### Commit 2 — fatigue honesty (F3)

Hold `insufficient_data` until the chronic window spans four weeks of actual training. Pure domain,
tests first, including the week-one case that currently returns `danger`.

### Commit 3 — rep records (F4)

Beating `bestRepsByExercise` on a bodyweight movement counts as a boss kill and pays the PR bonus.
Pure domain, and it re-grades history like any other derived change.

### Commit 4 — Daily Quest per-item progress (F2)

Extend the stored quest payload with entered progress, implement the `progressByKind` parameter the
interface already declares, and complete the quest when every item is met. Store and domain work,
tested before any UI.

### Commit 5 — the Daily Quest panel

The four items with their entry controls, the announcement, and the completion window.

### Commit 6 — streak, absence, and rest tokens

The streak panel and the forgiveness controls over the existing actions.

### Commit 7 — allocation, fatigue, volume, deload, advisories

The remaining panels. Each is a thin read of the projection; grouped because none is large enough to
justify its own commit and they share the Status Window layout.

### Commit 8 — level-up window

The window-tier notification on a level change.

## 4. Verification

- A device seeded before `5ce8d44` picks up the corrected `bodyweightFactor` on next load, and the
  re-grade announcement shows a real before-and-after.
- Routine rows are not overwritten by seeding.
- A first training week reports `insufficient_data` and a multiplier of 1, not `danger` and 0.6.
- A pushup rep record registers as a boss kill and pays the PR bonus.
- Entering 40 of 100 pushups leaves the quest incomplete and persists across a reload; entering the
  rest completes it exactly once.
- Logging sets inside a gate never advances Daily Quest progress on its own.
- Every panel renders from the projection with no new derived state in a selector (rule 13), and
  `pnpm run check:render` stays clean.
- Every route still mounts (rule 14), including the Status Window with a quest, an advisory, and a
  deload prompt present.
- The initial-route bundle is measured after M5 and recorded against whatever budget M4 commit 3
  settles on.

## 5. What M5 does not do

Sync and System Link stay in M6. The tower, red gates and instant dungeons stay in M7. Push stays in
M8. Indian club training is planned separately in `docs/club-training-plan.md` and is small enough to
land whenever, but it is not M5 and should not be folded in to make the milestone look fuller.
