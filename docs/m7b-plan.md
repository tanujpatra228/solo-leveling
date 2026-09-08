# M7b — The System Shop, the Job Change Quest, and the Reawakening Test

The three features M7 was split away from, because each needs an engine designed rather than a
surface built. Written 2026-09-08.

## 0. What the brief already settled

`BUILD_PROMPT.md` is more specific than the milestone list suggested, and it answers the hardest
question before it has to be asked:

| Feature | Brief |
|---|---|
| Job Change Quest | "Around level 20, a benchmark test week. My stat distribution picks a class — Fighter, Tanker, Assassin, Ranger — with Shadow Monarch as the endgame" (line 89) |
| Reawakening Test | "Re-assessment every 8–12 weeks, recomputes rank" (line 91), plus a body-composition re-check (line 316) |
| System Shop | "Rest tokens, quest rerolls, cosmetics, shadow skins, themes" (line 93) |

**The Shop's inventory is the important part of that.** Not one item on the list falsifies the
training record. That is not a coincidence to be preserved by luck — see F2.

## 1. Findings

### F1 — `hunterClass` has been hardcoded `'none'` since M2

`projection.ts:441` sets it literally:

```ts
hunterClass: 'none',
```

`HunterClassSchema` exists, `PlayerState` carries the field, and the Status Window renders it — the
user's own screenshot shows **NO CLASS YET**. There is no code path that can ever set it to anything
else. The app has been advertising a feature that does not exist for five milestones.

The Job Change Quest is the only thing that changes that, which makes it the most visible of the
three and the one worth doing first.

### F2 — gold has two sources, zero sinks, and one rule it must never break

`finishGate` pays 25 and `completeDailyQuest` pays 25, both since M3. Nothing spends it. On a full
training week — six gates, six dailies, no rest-day quest — that is about **300 gold a week**
accumulating into a number that means nothing.

The rule the Shop must respect, stated so a future item cannot quietly break it:

> **Gold never buys anything the log would otherwise have to earn.** Not XP, not stats, not rank,
> not a gate clear, not a streak day that was not trained.

The whole app rests on everything visible being derived from what was actually done (rule 4). An
item that grants XP would make the level a number you can buy, and every derived figure downstream
of it a lie. The brief's list respects this: rest tokens buy *forgiveness*, rerolls buy *a different
ask*, cosmetics buy *nothing functional*.

Rest tokens are the natural anchor because the mechanic already exists — `Progress.restTokens`,
two a month, spent by `resolveForgiveness` in `quests.ts`.

**Pricing needs calibration, not invention.** Against ~300 gold a week, a rest token at 300 makes
buying one a real week's choice; at 25 it makes the two free monthly tokens meaningless. The XP
constants have a calibration test asserting a target rather than a comment (`xp.test.ts`); the
Shop's prices should get the same treatment — an assertion that a month of consistent training
affords roughly one meaningful purchase, so the numbers can be tuned without guessing twice.

### F3 — a quest reroll must supersede, not delete

Rerolling today's Daily Quest is the second Shop item, and it collides with the log model. The quest
row is in Dexie with `status: 'issued'`. Deleting it and writing a new one loses the fact that a
quest was issued and abandoned, which the streak and penalty logic reads.

So a reroll follows the correction pattern already in the codebase: **the new quest supersedes the
old one, and the old row stays.** `SetLog.supersedes` is the precedent; a quest needs the same
field. Consequence worth testing: a rerolled-away quest must not generate tomorrow's Penalty Quest,
because it was replaced, not failed.

### F4 — "recomputes rank" is the wrong description of the Reawakening Test

Rank is already recomputed on every projection, from the log, every time. Nothing about it is stale
and nothing needs recomputing.

What *is* stale is the **inputs**: bodyweight and body-composition measurements taken at the
Awakening and never since, and estimated 1RMs from lifts that may not have been trained in months.
Every derived number — rank, tonnage on bodyweight movements, the body-fat estimate — silently
drifts as the hunter's actual body diverges from the numbers on file.

So the Reawakening Test is **a prompt to re-measure, not a recalculation**. Its value is keeping the
derived figures honest. That reframing changes what gets built: a cadence check, a measurement flow
reusing the Awakening's tape step, and a before-and-after window — not a rank recalculation, which
would be a no-op.

Cadence: every 8–12 weeks. The existing `checkDeload` is the precedent for a "the System asks when
it is due" verdict computed in the domain layer.

### F5 — themes conflict with a deliberate visual identity

`index.css` says it plainly: *"The app is dark by design rather than by preference. It is used in a
dim gym at arm's length, and a light theme would be the wrong tool."* The Shop's brief lists themes.

Selling alternative looks would undo a decision made for a reason, and multiply the contrast surface
that already produced one real defect (`--color-ink-faint` at 3.6:1, fixed in the visuals pass). Any
theme sold is a theme that has to be contrast-audited.

Recommendation: **sell accents within the System's language, not alternative looks.** A small set of
validated accent hues for `--color-system`, each contrast-checked once, is the honest version of
this item. Shadow skins are safe — they are flavour on a roster entry. Full themes should be
dropped or deferred until someone wants them enough to pay the audit cost.

### F6 — the class belongs in the log, not on `Progress`

A class assignment is the outcome of one event: completing the Job Change Quest. Storing it as a
mutable field on `Progress` would make it the one visible thing not derived from what happened.

Instead: the Job Change Quest is a `QuestLog` row like any other, its completion payload records
the stat distribution that was read and the class it selected, and `hunterClass` is **derived from
that row** in `projectPlayer`. The model stays intact, the assignment is auditable, and a later
change to how classes are picked re-grades rather than migrating.

Shadow Monarch is endgame and does not come from the test — it is a separate condition, and
`titles.ts` and `tower.ts` already reference monarchs.

## 2. Commits

### Commit 1 — the Job Change Quest engine

A `job_change` quest type (`QuestTypeSchema` already has room), issued around level 20 as a
benchmark week. `classFromStats` as a pure function mapping a stat distribution to Fighter, Tanker,
Assassin or Ranger, with an explicit answer for a tie and for an all-equal distribution — an enum
returning its first member by accident is how the empty-gate bug happened (standards rule 2).

Tests first. No UI.

### Commit 2 — `hunterClass` derived, and the Status Window says so

Replace the hardcoded `'none'` with derivation from the completed Job Change Quest row. The Status
Window shows the class, and before level 20 says what unlocks it rather than "NO CLASS YET" with no
explanation.

### Commit 3 — the Job Change Quest surface

The benchmark week, its progress, and the class-assignment window on completion.

### Commit 4 — quest superseding, and the reroll

`supersedes` on the quest row, the reroll action, and the test that a rerolled quest generates no
penalty (F3).

### Commit 5 — the Shop engine

A priced catalogue as data, `canAfford`/`purchase` as pure functions, and the calibration test from
F2. Rest tokens and quest rerolls only — the two items with existing mechanics behind them.

### Commit 6 — the Shop surface

The catalogue, the balance, and what gold is for. Includes the accent-hue cosmetic from F5 if the
contrast audit is done; otherwise cosmetics wait.

### Commit 7 — the Reawakening Test

The cadence verdict in the domain layer (F4), the re-measurement flow reusing the Awakening's tape
step, and the before-and-after window showing what changed since the last measurement.

## 3. Verification

- `classFromStats` has an explicit, asserted answer for a tie and for an all-equal distribution.
- `hunterClass` is derived from the completed quest row; deleting that row returns the class to
  `none` rather than leaving a stale value.
- Nothing in the Shop catalogue grants XP, stats, rank, a gate clear, or an untrained streak day —
  asserted as a test over the catalogue, not left to review.
- A month of consistent training affords roughly one meaningful purchase (the calibration
  assertion).
- A rerolled Daily Quest leaves its original row in place and generates no Penalty Quest.
- The Reawakening Test prompts on cadence, writes new body metrics, and changes no derived figure
  except through those new inputs.
- Every route mounts (rule 14) including the Shop and the Reawakening flow, and `check:render`
  stays clean.
- The bundle is measured after commit 6 against the ~480 KB Slow-4G budget M4 settled.

## 4. What M7b does not do

Themes are dropped pending F5. Push is parked. Flavour text is M9. The Demon Castle, Monarchs,
runes, titles and the shadow roster all landed in M7.
