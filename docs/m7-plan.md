# M7 — The rest of the fantasy layer

Every engine feature that has been built and tested finally gets a surface, plus the three that were
never built at all. Written 2026-09-07.

## 0. M7 as written is two milestones wearing one name

`implementation-plan.md` §4 lists fourteen things under M7: gates with ranks and the week view,
Dungeon Break, Red Gate, Instant Dungeon Key, the shadow army with its INT-capped roster, marshals,
titles, gold and the System Shop, runes in the session screen, the Job Change Quest, the Demon
Castle, Monarchs, the Reawakening Test, and the Hunter License card.

Sorting them by whether an engine exists splits the list cleanly, and the split is the plan:

| Feature | Engine | Where |
|---|---|---|
| Gates, ranks, week view | **Done** | `gates.ts` |
| Dungeon Break | **Done** | `resolveDungeonBreaks`, already in the store |
| Red Gate | **Done** | `gates.ts`, `types.ts`, `Progress.redGatesCleared` |
| Instant Dungeon Key | **Done** | `gates.ts` |
| Shadow army, roster, marshals | **Done** | `shadows.ts`, `projection.roster`, `shadowCap` |
| Titles | **Done** | `titles.ts`, `projection.newTitles` |
| Gold | **Done** | `Progress.gold` |
| Runes | **Done** | `runes.ts`, `projection.unlockedRunes` |
| Demon Castle / tower floors | **Done** | `tower.ts` |
| Monarchs | **Done** | `stats.ts`, `titles.ts`, `tower.ts` |
| Hunter License card | Adapter done | `shareImage` in `capabilities.ts` |
| **System Shop** | **None** | No module. Gold accumulates and buys nothing |
| **Job Change Quest** | **None** | No reference anywhere in `src/` |
| **Reawakening Test** | **None** | Only an unrelated `bodycomp.ts` mention |

Eleven surfaces over tested code; three features that need designing from scratch. Those are
different kinds of work with different risk, and bundling them hides that.

**So M7 is the eleven. The three become M7b**, planned separately once M7 lands, because designing
a shop economy is a game-design problem and not a presentation problem, and it should not be rushed
to fill out a milestone.

## 1. Findings

### F1 — gold has been accumulating with nothing to spend it on

`finishGate` pays 25 gold, `completeDailyQuest` pays 25. `Progress.gold` has been counting up since
M3 and there has never been anything to buy. Every hunter using the app has a growing meaningless
number.

That is an argument for the Shop being real work rather than a panel: the economy needs prices that
mean something against a balance that already exists, and picking those numbers is a design
decision, not an implementation one. It is the strongest reason to hold M7b separate rather than
inventing prices under milestone pressure.

M7 should still **show** gold honestly, and say what it is for, rather than displaying a number with
no explanation.

### F2 — the roster is INT-capped and INT is derived, so the cap moves on its own

`activeShadowCap` comes from INT, and INT is derived from programme adherence, not chosen. So the
number of shadows a hunter can field changes as a consequence of training consistency, without any
action they took.

The roster surface must make that legible. A shadow silently deactivating because the cap fell after
a missed week would read as a bug. Show the cap, show what drives it, and when the cap falls below
the active count, say so and let the hunter choose who stays rather than picking for them.

### F3 — most of M7 is read-only, which makes it cheap and makes one part expensive

Nine of the eleven surfaces are pure reads of `projection`: gates, Dungeon Break, Red Gate, titles,
runes, tower floors, Monarchs, marshals, gold. They need no new store actions and no new domain
work — they are layout over data that already exists and is already tested.

The two that are not: the shadow roster needs `setShadowActive` (which exists) plus the cap
handling in F2, and the Hunter License card needs canvas rendering and the Web Share adapter.

Sequence the reads first. They are low risk, they make the app feel finished quickly, and they
surface any projection field that turns out to be shaped wrong for display before the harder work
starts.

### F4 — the licence card is the only new rendering technology in the app

A PNG card means drawing to a canvas, which nothing else here does. It also means a share path
through `shareImage`, which is written but has never been called.

Two things to check rather than assume: that the canvas is drawn at a device-pixel-ratio the phone
actually produces (a card that looks soft on a 3x screen is worse than no card), and that Web Share
with a file works on Android Chrome — `navigator.canShare({ files })` is the guard, and the fallback
is a download.

### F5 — the bundle, again

205.33 KB JS gzip today. M7 adds eleven surfaces and a canvas renderer, and it is the largest
presentation milestone remaining. M4 commit 3 must land before this, not after, or the number will
have drifted through four features with nobody ever deciding what it should be.

Route-level code splitting is the obvious lever: the tower, roster and licence card are not needed
on first paint and none of them is on the path to logging a set.

## 2. Commits

### Commit 1 — the gate week view

Seven days, each with its routine, rank and cleared state, and Dungeon Break marked where
`resolveDungeonBreaks` says a gate went unclosed. Read-only.

### Commit 2 — Red Gate and Instant Dungeon Key

The two special gate kinds surfaced on the week view and the gate screen. Both already resolve in
`gates.ts`; this is presentation and the copy that explains them.

### Commit 3 — titles, runes and gold

Three panels on the Status Window. Titles held with their descriptions, runes unlocked, and gold
with an honest line about the Shop not existing yet (F1).

### Commit 4 — the tower, the Demon Castle and Monarchs

Floors cleared, the next uncleared floor, and the Monarch surface. All read from
`projection.nextTowerFloor`, `towerFloorCleared` and the title definitions.

### Commit 5 — the shadow army

The roster with the INT cap made legible (F2), marshals marked, and `setShadowActive` wired. The
one commit here with real interaction, and the cap-fell case needs its own test.

### Commit 6 — the Hunter License card

Canvas render at the real device pixel ratio, shared through `shareImage` with a download fallback
(F4).

### Commit 7 — route-level code splitting

The tower, roster and licence routes lazily loaded, measured against whatever budget M4 commit 3
settled (F5).

## 3. Verification

- Every field on `Projection` is either displayed somewhere or deliberately not, with the
  deliberate ones listed.
- A gate left unclosed past its window shows as a Dungeon Break on the week view.
- Dropping INT below the active shadow count prompts the hunter to choose, and never silently
  deactivates a shadow.
- The licence card renders sharp on a 3x screen and shares on Android Chrome, with the download
  fallback exercised where `canShare({ files })` is false.
- Gold is displayed with an explanation rather than as a bare number.
- Every route mounts (rule 14), including the new ones, and `check:render` stays clean.
- The initial-route bundle is measured after commit 7 and recorded against M4's budget.

## 4. What M7 does not do

The System Shop, the Job Change Quest and the Reawakening Test are **M7b**, planned after this lands.
Sync is M6. Push is parked. Flavour text is M9.
