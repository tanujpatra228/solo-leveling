# M10 — The Status Window, made faithful and readable

The Status page is 7,598 px tall at 1080 wide — about **9.4 phone screens** — of uniformly weighted
10–13 px monospace. Nothing on it is wrong; nothing on it is *first*. And nothing on it behaves the
way the System in Solo Leveling behaves.

**Verified starting point:** `origin/main` at `e90e78b`, clean tree, 686 tests passing, typecheck /
`check:render` / build clean. Deployed 2026-09-08 with all four M9 commits.

This revision follows research into the source material (§1). Two conclusions from it overturn
earlier drafts of this plan: the archive is **summoned as overlay windows, not expanded inline**
(§1.3), and the Daily Quest deadline is a **ring**, which the app already has the component for
(§1.4).

---

## 1. The reference, researched

`docs/system-visuals-plan.md` §2 decomposed a single reference image into five techniques. This
section is the wider pass: how the System actually behaves and looks across the anime and manhwa,
and what that demands of an app claiming its feel. Sourced claims are cited; claims from the show's
imagery that no text source states plainly are marked **(imagery)** so the developer knows which are
verifiable and which are a reading.

### 1.0 The Status window, read directly from the frame

A real screenshot of the Status window was supplied 2026-09-08 — the HP/MP/Fatigue strip above the
stat grid. **Where it conflicts with anything below or with `system-visuals-plan.md`, it wins**:
everything else in this section is a text description of an image, and this is the image.

What it actually shows, element by element:

| Element | The reference | What we ship today |
|---|---|---|
| **Structure** | **One outer frame holding boxed inner panels** — a title box straddling the top border, a level block, then two bordered boxes: the vitals strip and the stat grid | One window, sixteen hairline dividers, no inner boxes |
| **Title** | `STATUS` centered inside **its own bordered box straddling the window's top border** | `[STATUS WINDOW]` left-aligned inside the frame |
| **Level block** | `18` huge with `LEVEL` small beneath it, then `JOB: None` and `TITLE: Wolf Assassin` as tiny-label / bright-value rows | A rank pill left, a dim class sentence right, both at 11–12 px |
| **Corners** | Bracket marks visible on the outer frame | None outside the notification window |
| **Frame** | Thin **near-white** hairline, square corners, no radius. Cyan lives in the glow and the ground, never in the border | `border-panel-edge` (#1b3050) — cyan *as* border colour, which §7 calls "what makes HUD styling look cheap" |
| **Text colour** | **White to near-white, bold.** The glow supplies the colour | `text-ink-soft` #93a9c9 and `text-ink-faint` #7b90b3 — muted blue-grey, for nearly every string on the page |
| **Typeface** | Bold geometric **sans**. No monospace anywhere in the frame | `font-system` monospace on nearly every element |
| **Numeric scale** | Dramatic. `STR: 19` — the **19 is roughly 3× the label** | Stat totals at `text-[11px]`, the same size as their label |
| **Value pair** | `100` large and bright, `/100` small and dim. Exactly technique 3 | One size, one colour, at all six sites (F2) |
| **Stats** | **Two-column grid. No bars.** Icon, `LABEL:`, big number | Five stacked rows, each dominated by a meter |
| **Available points** | Small three-line label `Available / Ability / Points:` beside a big `3` | An 11px caption above the rows |
| **Fatigue** | A small segmented-ring **glyph** plus `FATIGUE: 0` — a labelled number, not a gauge | A 48 px `SegmentedRing` owning its own panel |
| **Icons** | **Heavy.** Thick strokes and solid fills — the plus, flask, dumbbell, heart, brain all read as chunky marks | `SystemIcon` at lucide's default ~1.5–2 px, thin |
| **Bars** | Long thin capsule: a **near-white outline**, a **dark inset gap**, then a **thin bright core line floating inside it**. Smooth, no ticks. Value small, at the right end, outside the bar | A solid bright fill spanning the full track height inside a **dark navy** hairline — reads as *coloured*, not *emitting* (§1.0a) |
| **Ground** | Dark navy with a faint **blueprint / city-map** texture reading through the panel | 0.012-alpha diagonal scratches — right instinct, wrong pattern, too faint |

Six corrections follow, and they are the substance of this revision:

1. **Near-white bold text, not muted blue-grey.** This is the single biggest gap. Our page is dim
   *and* tinted; the reference is bright and neutral with the colour in the bloom. Raising
   `--color-ink-faint` to 5.2:1 (`system-visuals-plan.md` §5) was the right move and did not go far
   enough — the labels on the reference are white.
2. **The number is the loud element.** Not "slightly larger than its max" — three times its label.
   §1.6's value pair was right in kind and far too timid in degree.
3. **Icons are heavy.** `system-visuals-plan.md` §3 specified "roughly 1.5px stroke on a 24px grid"
   from the earlier reference; this frame shows thick strokes and solid fills. `SystemIcon` is the
   one-file restyling layer that document promised, so this is a `strokeWidth` and fill decision in
   one place.
4. **Stats are a two-column grid of numbers, not a stack of bars.** The reference gives the five
   stats no meters at all.
5. **The meter is wrong today and has to be rebuilt (§1.0a).** An earlier draft of this plan said
   `SystemMeter` already matched the reference and should not be touched. Comparing the two frames
   directly, that was wrong: ours is a solid fill inside a dark outline; the reference is a thin
   bright core line floating inside a near-white outline. The notched-tick idea from the draft
   before that stays dropped — it was mine, not the show's — but "leave the meter alone" was the
   wrong conclusion in the other direction.
6. **The window has inner boxes, and a title box that straddles its border.** The first supplied
   frame was cropped, and I read the vitals strip and the stat grid as two separate windows. The
   full frame shows one outer window holding both as **bordered inner panels**, with `STATUS`
   centered in a box overlapping the top border — the construction `system-visuals-plan.md` §7
   already specifies, which `MessageQueue` is the only current caller of.

### 1.0a The meter, layer by layer

The most-repeated element in the app — `SystemMeter` draws the XP bar, four quest bars, five stat
bars and eighteen volume bars on this one page — and the one furthest from the reference. Read off
both frames side by side:

| Layer | Reference | `SystemMeter.tsx:34-56` today |
|---|---|---|
| Outline | Near-white hairline, clearly visible against the panel | `ring-1 ring-panel-edge ring-inset` — #1b3050, a dark navy that disappears |
| Inset gap | A visible dark band between outline and fill | None — the fill is `inset-y-0`, so it touches the outline |
| Body | Dim, low-alpha, only under the filled portion | The fill *is* the body, at 60% alpha, which over `bg-void-soft` reads solid |
| Core | A **thin bright line**, floating, vertically centred, well inside the outline | A gradient band at 46–54% of the fill height — at `height={6}` that is under half a pixel |
| Reads as | Emitting | Coloured |

`fillFor()` was written for the right idea (`system-visuals-plan.md` §6: "an outline with a brighter
centre line reads as *emitting*") and the geometry defeats it. A 46–54% band of a 6 px element is
0.5 px, which the browser rounds away, and the 60%-alpha edges bloom into one solid bar under
`--shadow-meter`. That is exactly what the current-app screenshot shows.

**The rebuild — four layers instead of two**, same public API (`segments`, `height`), so all thirty
call sites keep working untouched:

```tsx
export function SystemMeter({ segments, height = 12 }: SystemMeterProps) {
  let offset = 0
  return (
    // Near-white outline with the cyan arriving as glow. Reversing those two is
    // what makes HUD styling look cheap (system-visuals-plan.md section 7).
    <div className="relative rounded-full border border-ink/45" style={{ height }}>
      {/* The inset gap. Without it the core touches the outline and the whole
          thing collapses back into one solid bar (m10-plan section 1.0a). */}
      <div className="absolute inset-[2px] overflow-hidden rounded-full">
        {segments.map((segment, index) => {
          const left = offset
          offset += segment.pct
          return (
            <div key={index} className="absolute inset-y-0" style={{ left: `${left}%`, width: `${segment.pct}%` }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `color-mix(in oklab, var(--color-${segment.tone}) 22%, transparent)` }}
              />
              {/* Fixed 2px, never a percentage: a proportional core is the bug
                  being fixed, and it vanishes at the 6px volume-row height. */}
              <div
                className="shadow-meter absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                style={{ background: `var(--color-${segment.tone})` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

Three constraints on the rebuild:

- **The core is a fixed 2 px, not a percentage.** 2 px of core inside a 2 px inset needs
  `height >= 8`, so the volume rows move from 6 to 8 and the quest rows from 6 to 10.
- **`--color-system-glow` stops being hard-coded in the fill.** Today every tone's core renders the
  same pale cyan (`SystemMeter.tsx:28-29`), so a `warn` meter's centre is cyan rather than amber.
  Taking the core from the segment's own tone is what finally makes the volume panel's amber and red
  bands read as amber and red.
- **`--shadow-meter` moves to the core line only.** A glow on a full-height fill is what blooms the
  inset gap shut.

Verify by screenshotting the XP bar beside the reference at matched width. If the dark gap between
outline and core is not visible, the rebuild has not landed.

### 1.1 The System is windows, never a page

A blue holographic screen that appears anywhere, any time, showing attributes, abilities, levels and
items ([CBR, "The System In Solo Leveling, Explained"](https://www.cbr.com/solo-leveling-system-explained/)).
An anime-accurate recreation converged on **seven discrete screens** — Notification, Status, Quest
Info, Quest Rewards, Inventory, Equipment, Access Code — not one scrolling surface
([CBR, on the 70-hour recreation](https://www.cbr.com/solo-leveling-anime-system-create/)).

The System never shows a nine-screen scroll. It shows **one window, single-purpose, floating over
whatever the hunter was looking at.** Jinwoo says "Status" and the Status window appears; he
dismisses it and it is gone. There is no menu, no tab bar, no accordion. **(imagery)** Windows are
translucent navy behind a cyan hairline, title centered in brackets over a divider rule, body text
centered, and generously padded — *sparse*, not dense. The one exception is the Status window, which
is the dense screen: left-aligned labels, right-aligned values, `+` beside each stat.

**Consequence for this plan:** splitting the mega-window is right, but stacking twelve windows in one
scroll is only half-right. What is read daily stays inline; the archive is **summoned**, one window
at a time, over the page.

### 1.2 The Status window's own field list

Health Points, Mana Points, then Strength, Agility, Perception, Vitality, Intelligence, plus
available ability points ([CBR, on the quest log and stats](https://www.cbr.com/solo-leveling-sung-jinwoo-quest-log-training-stats-explained/)).
Recreations settle on `HP 100/100 · MP 10/10 · EXP 0/100 · FATIGUE 0`, the five stats, and
`Available Points`, with Job and Title as their own fields.

Two details the app gets wrong against this:

- **The five stats are numbers with a `+`, not bars.** Bars are for HP, MP and EXP. Our `StatBar`
  makes the meter the loud element and the number the quiet one — exactly inverted. The
  derived-vs-allocated split the meter carries is real information we are not giving up, so the fix
  is to make the *number* dominant (§1.6), not to delete the bar.
- **Fatigue is a Status-window field**, a plain number beside HP and MP. Ours is a 48 px ring in its
  own panel. The ring is better spent elsewhere (§1.4).

### 1.3 Windows overlay; they do not expand

**(imagery)** Every System window in the show is drawn *over* the scene, dismissed deliberately, and
gone. This is the single most distinctive behaviour of the interface and the app already implements
it — for notifications only. `MessageQueue.tsx:130` uses `.system-frame` (`index.css:90-116`) with
the near-white hairline, inset cyan bloom and two corner brackets, over a `bg-void/80` scrim, one at
a time.

**Consequence:** the archive — Shop, Demon Castle, Shadow Army, Runes, Titles, Analysis — should open
as that window, not as inline sections. An earlier draft of this plan proposed a 3×2 selector grid.
A menu grid is a *game* pattern; the System has no menu. Summoning is both more faithful and
strictly better here, because an overlay costs zero page height.

### 1.4 The Daily Quest is a task list, a reward block, a penalty line, and a ring

Daily quests list their tasks with a warning — *"Failure to complete the daily quest will result in
an appropriate penalty"* — and **a circular countdown timer marks the deadline**
([CBR](https://www.cbr.com/solo-leveling-sung-jinwoo-quest-log-training-stats-explained/)). Rewards
are discrete and explicit: full recovery, ability points shown as `+3`, loot.

Three things follow, and the first is the detail every earlier draft of this plan missed:

- **The deadline ring is canon.** `SegmentedRing` already exists and is currently spent on fatigue.
  It belongs on the Daily Quest, showing time left in the day.
- **The stake is stated on the window.** Our domain has penalty quests (`QuestLog.type === 'penalty'`,
  discharged in `state.ts:1236-1238`) and the panel never mentions them. One amber line fixes that.
- **Rewards are their own block**, not a caption in the header. `150 XP · 25 GOLD` is already the
  right content; it is in the wrong place at the wrong weight.

### 1.5 The System's voice, quoted

*"You have become a Player."* · *"Daily Quest: Strength Training has arrived."* · *"The system is
designed to assist the development of the Player."* · *"Failure to comply with the system may result
in a penalty."* · *"The rewards have been delivered."*
([CBR](https://www.cbr.com/solo-leveling-sung-jinwoo-quest-log-training-stats-explained/))

Short declaratives. Present perfect for things that happened. It never asks, never apologises, and
never says "show more". Our `fatigue.message` and `roster.message` already read like this; our
button labels do not — `Dismiss`, `Share License`, `Bench` are app words.

### 1.6 Value typography, and why the number wins

`system-visuals-plan.md` §2.3 already prescribed the pair — *"a large bright current value against a
smaller, dimmer max — `100`/`100`, not `100/100` at one size"* — and the research confirms why it
matters here: in the show, the **figure** is the loud element on a Status row. It is unimplemented at
every one of six sites in this codebase (F2).

### 1.7 The System's design evolves with the hunter's power

Jinwoo's UI changes at fixed story beats, and the changes are not random: the first design appears
after the rebirth in the Double Dungeon, the third after he takes the full power of the Shadow
Monarch ([thread summarised in search results](https://x.com/SoloLevelingGuy/status/1880995183078387722?lang=en)),
with Season 2's interface shifting toward the dark-violet Shadow Monarch palette
([Anime Tiger](https://animetiger.com/solo-leveling-season-2-sung-jin-woo-powers-monarchs/)).

**This is the most on-theme thing available to us and it is nearly free.** The app already has
`Rank` E→S, `HunterClass` including `shadow_monarch`, and a `DoubleDungeon` sequence. A frame tier
driven by rank means the interface itself levels up — canon, not ornament.

### 1.8 The typeface, corrected

An earlier draft of this section said to keep monospace everywhere and recorded it as a deliberate
deviation. **The reference frame (§1.0) does not support that.** There is no monospace anywhere in
it: the labels and the numerals are bold sans, and the numerals are the largest thing on the screen.

Revised position, and the one that ships:

- **Bold sans for labels and figures**, using the `--font-body` stack the app already has, with
  `font-variant-numeric: tabular-nums` so columns still line up in a gym read — the property does
  the job monospace was carrying, without the typewriter texture.
- **Monospace stays for the chrome**: the bracketed window titles (`[STATUS WINDOW]`), letterspaced
  sublabels, and the license key. That is where a machine voice belongs and where the reference's
  own letterspacing reads as System rather than as a terminal.

This is a correction to `system-visuals-plan.md` §2, which named five techniques and did not name the
typeface. It should be recorded there when this plan is folded in (§8).

---

### 1.9 The Awaken shot: what transfers, what does not

A Dribbble concept ([Frorex Studio, "Awaken"](https://dribbble.com/shots/25649005-Awaken-Habit-Tracker-Mobile-App-UX-UI))
was supplied 2026-09-09 as a liked reference, with the palette decision already settled: **we stay
blue and black, as the anime is.** Three screens — an onboarding splash, a quest list, and a Quest
Info modal.

Its value is that it solves the same problem this app has, on a phone, and arrives independently at
the overlay model §1.3 argued for from the show. The modal is the useful screen.

**Transfers, and how:**

| In the shot | Adopt as |
|---|---|
| A **Quest Info modal over a dimmed screen** | Independent confirmation of §1.3 and §4a. Same model, already planned |
| Header: a small **bordered icon box**, then a **bordered title box**, then an **`×` at top right** | Exactly `system-visuals-plan.md` §7's two-box header plus §4a's close control. Both references now agree, so commit 3 and commit 9 are on firm ground |
| **Bracketed values** — `[50 / 100]`, `[5 / 5km]`, `[100 / 100]` | Our bracket vocabulary already reads as System output. Use for **task rows**; the big bare numeral (§1.0) stays for **stat figures**. Two roles, and each is right where it sits |
| **Grouping by state** with section headers — `GOAL` above what is outstanding, `COMPLETED` below it | Better than the `+7 UNTRAINED` pill an earlier draft proposed. A dim group header is plainer than a disclosure control, and it is honest about what is in each group. Applies to the quest (`GOAL` / `CLEARED`) and to volume (`TRAINED` / `UNTRAINED`) |
| A **checkbox per task** — empty square outstanding, tick when met | A one-glance read of what is left, which green numerals alone do not give (gym rule 5). Square, never a circle |
| A centered **`WARNING:` footer** stating the penalty | Confirms §1.4 and fixes the placement: bottom of the window, centered, warning tone |
| A `>` **chevron on a section header** that opens the full screen | Worth allowing, with the distinction in §3 |
| **Row cards** — bold title, dim subtitle, value at the right | The `boxed` `SystemPanel` from commit 9, square-cornered. Good shape for summon rows and shop items |

**Does not transfer:**

- **The violet palette.** Settled: blue and black, per the anime and per the instruction with the link.
- **Rounded corners on cards and modals.** §2.1 — rounding reads "app", sharp reads "System". This is
  the clearest single difference between the shot and the show, and the show wins.
- **The serif display type.** Ours is bold sans plus monospace chrome (§1.8).
- **The floating five-tab pill bar.** We have three tabs in a square bar, and a fourth or fifth tab
  would undo §4a's one-model navigation.
- **The onboarding splash.** The System explains itself in its own voice through the queue (§4a), not
  through a marketing screen.
- **`PLAN` as a group name.** App vocabulary. `GOAL` — which the same shot uses — is the System's word
  and is canon (§1.4).

## 2. Findings against the code

### F1 — Status is the only route that nests everything in one window

| Route | Shell | Windows | `strong` |
|---|---|---|---|
| Gate (`gate.tsx:221`) | `<main className="flex flex-1 flex-col gap-4 p-4">` | 5 stacked `SystemWindow`s | exactly 1, on the live gate |
| Link (`link.tsx:106`) | `<div className="flex flex-col gap-3 p-4">` | 6 stacked `SystemWindow`s | exactly 1, on the loss warning |
| **Status (`index.tsx:97`)** | same as Gate | **1** window holding **16** `SystemPanel`s | the 9-screen window itself |

Splitting it is not a new look for Status — it is Status rendering the way the other two routes
already do. It also un-inverts the glow rule (`system-visuals-plan.md` §4, §8: faint by default,
strong on the one window that is speaking), which today is spent on a container nine screens tall.

### F2 — Three of the five reference techniques are unimplemented

| # | Technique | State |
|---|---|---|
| 1 | Sharp hairline frames | Shipped |
| 2 | Capsule meters, outline plus lit core | Shipped, but smooth — no tick marks |
| 3 | **Value typography as a pair** | **Missing at all six sites** — `ManaBar.tsx:18`, `DailyQuestPanel.tsx:82`, `TowerPanel.tsx:24`, `ShadowsPanel.tsx:72`, `gate.tsx:919`, `awaken.tsx:108` |
| 4 | Thin glowing icons | Shipped, used on five stat rows and nowhere else on this page |
| 5 | Textured ground | Shipped |

### F3 — The five stat bars are decorative, not comparative

`StatBar.tsx:19`: `scale = max ?? Math.max(total * 1.25, 10)` — **per row**. Every bar fills exactly
80% regardless of value (STR 43, AGI 8, INT 20, PER 32 all → 80%; only VIT 5 differs, at 50%, on the
`10` floor). The `max` prop exists for this. No caller passes it.

### F4 — Actionable, reference and diagnostic content are interleaved

Quest reps at position 3, unspent points at 7, nine advisories at 16 — with runes, titles, the tower,
the shop and the license card between them. The order is the order the panels were written in, M5
through M7b.

### F5 — The archive is always expanded

Runes, Titles, Demon Castle, Shadow Army, Shop and the License card cost ~2,400 px on every visit,
and §1.3 says they should not be on the page at all until summoned.

### F6 — Weekly volume opens with seven empty rows

Sorted worst-deficit-first, so the seven muscles at 0 sets come first (`VolumePanel.tsx:24`). 18 rows
≈ 500 px, opening on a wall of empty tracks.

### F7 — Nine advisories, fully expanded, last on the page

~220 px each ≈ 2,000 px of amber criticism at once, after the shop and the license card. Nine
simultaneous complaints is alarm fatigue; the rational response is dismiss-all-unread.

### F8 — A completed Daily Quest still costs ~400 px

Four labels, four meters, four input rows, all four items met (`DailyQuestPanel.tsx:56-63`).
`status === 'complete'` is never read by the component.

### F9 — The Hunter License card restates eight figures from the same screen

Rank, level, class, five stats, titles held, gates cleared — each already above it
(`index.tsx:158-171`) — plus a lazy chunk fetched on every visit.

### F10 — The primary-button vocabulary exists and Status never uses it

```
primary    w-full rounded bg-system-deep px-5 py-3 font-system text-xs text-ink uppercase disabled:opacity-30
secondary  w-full font-system text-[11px] text-ink-faint uppercase underline disabled:opacity-30
pill       rounded-full border px-3 py-1 font-system text-[10px] uppercase
sublabel   font-system text-[10px] tracking-[0.16em] text-system-dim uppercase
```

Status has **no primary button at all** — its actions are `px-3 py-1.5` chips and 10–11 px underlines.

### F11 — `SystemWindow`'s `footer` slot is unused on Status

Gate puts "Start Gate" there (`SystemWindow.tsx:35`). Status puts actions inline in the body.

### F12 — `.system-frame` is the app's most faithful frame and only the notification uses it

`index.css:90-116` is what §1.3 describes. Its only caller is `MessageQueue.tsx:130`.

### F13 — The entrance animation exists and is wasted on one window

`--animate-system-in` fires per `SystemWindow` (`SystemWindow.tsx:27`). One window means one fade;
several means a stagger, which is what a HUD drawing itself looks like — an inline `animation-delay`,
`transform`/`opacity` only, already covered by the global `prefers-reduced-motion` rule.

### F14 — Which window is open belongs in the URL, not in `Settings`

Two candidate homes, and the second wins on a mobile-specific ground.

`SettingsSchema` (`domain/types.ts:430-441`) + `repo.saveSettings` is last-write-wins and already
carries `dismissedAdvisories`. Settings are also **not synchronised** — `sync/client.ts:235-249`
mirrors `sessions`, `sets` and `bodyMetrics` only — so a new field would cost no Worker change, no D1
migration and no wire-schema change. It works.

But a summoned window is a place the hunter navigated to, and on Android the hardware back button
must close it. Stored in `Settings`, back would leave the route or the app with the window still
"open" underneath. As a router search param — `/?window=shop` — the platform does the work: **one
back press closes the window**, the state survives a reload, and it is deep-linkable. TanStack Router
`^1.170.32` is already a dependency with `validateSearch` / `useSearch` / `navigate({ search })`, and
`awaken.tsx:12` already imports `useNavigate`, so nothing new is added.

So: search param, no `Settings` field, no migration. Recorded because "put it in the store" is the
reflex and it is wrong here for a reason that is not obvious.

### F15 — Status is a couch page with exactly one gym surface

| Read mid-workout, out of breath | Read on the couch, after |
|---|---|
| Daily Quest — check the count, add the reps just done | Volume, warnings, fatigue |
| The level bar, one glance | Shop, Castle, Runes, Titles, Army, License |
| Unspent points, occasionally | Streak forgiveness — a decision, not a reflex |

This is what licenses summoned windows for the archive: **it is not touched with chalk on your hands.**

### F16 — The only gym surface on the page demands a keyboard

`DailyQuestPanel.tsx:88-105` logs progress via `<input type="number">` plus a ~30 px `Add` button.
Between sets that means a software keyboard over half the screen and a precision tap with chalked
fingers.

### F17 — The allocate control is a 20 px circle beside a destructive one

`StatRow.tsx:38-44` renders `+` at `px-2 py-0.5`, five of them 8 px apart, with "Reset allocation"
directly above (`index.tsx:117-123`). A mis-tap allocates to the wrong stat; the only remedy resets
**all** allocation.

### F18 — `keepScreenAwake` is stored, defaulted true, and never read

Exists at `domain/types.ts:435`, defaulted at `state.ts:520` and `repo.ts:74`, consulted **nowhere**.
The wake lock is acquired only by the rest timer (`useRestTimer.ts:86`). The screen sleeps while a
hunter reads this page between sets, and the setting that claims otherwise does nothing.

### F19 — The rest timer is Gate-only, so checking the quest loses it

The dock is `sticky bottom-14` inside `gate.tsx:841-861`. Switching to Status mid-rest — exactly what
F15 says happens — unmounts the visible countdown while `useRestTimer` keeps counting.

### F20 — The Daily Quest states no deadline and no stake

No countdown of any kind, and no mention of the penalty quest the domain already issues
(`state.ts:1236-1238`). Both are canon (§1.4) and both are information a hunter needs.

---

## 3. What this must not become

A HUD is **dense but ranked**; this page is dense and **flat**, and the flatness is why it reads as a
data dump. Banned in this milestone, each having been proposed in an earlier draft:

| Banned | Why | Instead |
|---|---|---|
| A chevron that **expands a section in place** | The most generic pattern in mobile UI. The System does not collapse a panel | §4's summoned window |
| — but a chevron that **opens a window** is allowed | It is a link, not a disclosure, and §1.9's reference uses it exactly that way. It also helps the discoverability problem §4a names | `[ SYSTEM SHOP ]  125 gold  >` |
| A selector grid or tab strip | A *game menu*. The System has no menu — Jinwoo names a window and it appears (§1.3) | A summon list |
| `show more`, `+6 more`, `see all` | Feed-app truncation copy | A stated count: `+7 UNTRAINED` |
| `[UNLOCKS]`, `Findings`, `Training Log` | Product words | `[RUNES]`, `[TITLES]`, `[WARNINGS]`, `[ANALYSIS]` |
| Any new border radius | §2.1 — rounding reads "app", sharp reads "System" | Square, hairline, bracketed |
| Muted blue-grey text on primary information | The reference is near-white and bold; colour lives in the glow (§1.0) | `text-ink` at `font-semibold` |
| Equal-sized numerals | The reference's figure is ~3× its label (§1.0) | `SystemValue` at `lg` |
| Prose where a figure would do | §1.5 — the System states values | Value pair (§1.6) |

### The gym rules

Used standing, one-handed, 60–180 s between sets, heart rate high, hands chalked, phone in the other
hand. Each rule overrides a normal mobile-UI instinct:

1. **Nothing logged mid-workout requires the keyboard.** Steppers, not text entry (F16); manual entry
   survives as a fallback, never the primary path.
2. **44 px floor, 56 px for anything tapped between sets** (F17).
3. **Actions at the bottom of their window, never the header** — the top third of a 6.7" phone is out
   of one-handed thumb reach. `SystemWindow.footer` is already exactly this slot (F11).
4. **Nothing shifts under the thumb after a tap.** A quest row that flips to met keeps its height.
5. **Figure first, prose second** (§1.6).
6. **No confirmation dialogs except on destructive actions.** Reserve `window.confirm` for revoking
   allocation and forgetting the mirror.
7. **The screen stays awake while a session is live, not only while resting** (F18).
8. **State survives a reload, always** — a dropped phone must not lose the quest count.

The dark palette and the raised `--color-ink-faint` already serve the dim-basement case.

---

## 4. What the page becomes

`<main className="flex flex-1 flex-col gap-4 p-4">` with a `<header className="px-1">` kicker, then
stacked `SystemWindow`s — the Gate shell, and titles bracketed by `SystemWindow` itself so they read
`[STATUS WINDOW]` beside `[THIS WEEK]` and `[SYSTEM LINK]`.

### Inline — what a hunter reads daily

| Order | Window | Notes |
|---|---|---|
| — | `<header>` kicker | `formatDayKey(today)`, the slot and classes at `gate.tsx:222-225` |
| 1 | `[STATUS WINDOW]` | Rank, class, level bar, fatigue as a **field**, five stats with the figure dominant. Footer: the allocation primary |
| 2 | `[DAILY QUEST]` | Deadline ring, task rows, reward block, penalty line (§1.4). One row when complete |
| 3 | `[DELOAD]` | Conditional, centered and sparse |
| 4 | `[REAWAKENING TEST]` | Conditional, centered and sparse |
| 5 | `[JOB CHANGE QUEST]` | Conditional, centered and sparse |
| 6 | `[STREAK]` | Streak, best, rest tokens, forgiveness pills |
| 7 | The summon list | Six bracketed commands, ~44 px each |

Windows 3–5 follow §1.1: centered text, generous padding, one thing said, the action in the footer.
Windows 1 and 2 are the dense ones, which is canon — the Status window is the show's dense screen.

### Summoned — the archive, over the page

The summon list is six full-width rows, each `[ NAME ]` plus its figure, in the `pill`/`sublabel`
vocabulary. No grid, no chevron, no tab strip:

```
[ ANALYSIS ]                        9 warnings
[ SHADOW ARMY ]                            2/2
[ DEMON CASTLE ]                        31/100
[ SYSTEM SHOP ]                       125 gold
[ RUNES ]                                    2
[ TITLES ]                                   2
```

Tapping one opens that panel as a **`.system-frame` overlay window** over a `bg-void/80` scrim — the
same construction `MessageQueue` already uses, one at a time, dismissed deliberately (§1.3). The page
behind it does not grow by a pixel. `ANALYSIS`'s figure goes `text-warn` when non-zero: the page's one
nag, nine characters wide instead of 2,000 px tall.

The Hunter License is not in the list — it is a share action, so it lives in `[STATUS WINDOW]`'s
footer (F9, F11) and mounts its canvas on tap.

**Estimated height: ~1,700 px, from 7,598.** Under two screens, the first of which answers what the
System wants.

### Exactly one `strong` window

```
deload due → reawakening due → job change issued → daily quest incomplete
→ dormant shadow over cap → unspent stat points → [STATUS WINDOW]
```

A dormant shadow raises `[SHADOW ARMY]`'s row to `text-warn` rather than auto-summoning it — the
System announces through the notification queue, and stealing the screen unasked is what an overlay
must never do. Derive with `useMemo` over slices already selected in `HomeScreen`, the shape
`DailyQuestPanel.tsx:36-39` uses. Not `recompute()` — no other route needs it (rule 16).

---

## 4a. The mobile translation

In the anime the System is summoned from anywhere, floats in space, and is dismissed with a thought.
A phone gives none of those affordances: no gesture vocabulary of its own, a hardware back button
that must behave, one hand, and a user who has to work out how any of it opens without being taught.
This section is how the model survives the translation, and it is the part that has to stay friendly
for someone who has never read the manhwa.

### The window model, mapped to a phone

| Anime | Phone |
|---|---|
| Windows float over the scene | `.system-frame` overlay over a `bg-void/80` scrim — the construction `MessageQueue` already ships |
| One window at a time | One overlay app-wide; a summoned window yields to an arriving notification |
| Jinwoo names a window and it appears | A labelled summon row: `[ SYSTEM SHOP ]`, `[ SHADOW ARMY ]` |
| Dismissed with a thought | Three ways out, all of which must work (below) |
| Summoned from anywhere | Summoned from `[STATUS WINDOW]`, for a reason (below) |

### Getting out is not optional, and it needs all three

An overlay a user cannot leave is the worst failure available here, so it takes every exit a phone
offers:

1. **Hardware / gesture back closes it.** This is why the state is a search param (F14) — the browser
   history does it, with no listener to get wrong.
2. **A visible close control**, top-right inside the frame, `min-h-11 min-w-11`, reading `[ X ]` in
   the bracket vocabulary. Escape-only is a desktop answer.
3. **Tapping the scrim.** Standard, and free.

`aria-modal`, focus moved to the close control on open and returned to the summon row on close, per
`system-visuals-plan.md` §9.5.

### How anyone knows the windows exist

Discoverability is the whole risk of this model. Three answers, in order of how much they carry:

1. **The summon list is a normal window on the page, titled and always visible** — not a hidden
   gesture, not a hamburger, not a long-press. Every row says what it opens and shows its figure. A
   user who never taps one still sees six labels and six counts.
2. **The System explains itself, once.** On first arrival after awakening, a single notification —
   *"The System is designed to assist the development of the Player."* / *"Open a window to review
   your progress."* — through the queue that already exists. Diegetic, canon (§1.5), one-time,
   dismissible, and it costs one flag in `Settings`. This is the app's only onboarding and it should
   sound like the System, not a product tour.
3. **The figures do the persuading.** `[ ANALYSIS ] 9 warnings` in amber is a reason to tap. A row
   reading `0` is honestly not worth opening, and saying so is better than a badge that lies.

### Why the list lives on Status, not everywhere

Faithfulness argues for summoning from any screen. Friendliness argues against a floating launcher on
every route: it is more chrome, it competes with the rest-timer dock (commit 0) for the same corner,
and it gives the mental model two entry points instead of one. The bottom bar already answers "where
am I" with three plain words — Gate, Status, Link — and the archive belongs to the character sheet, so
it hangs off Status. One place to look, one model to learn.

The exception is the notification queue, which already appears on every route, exactly as in the show.

### Overlay sizing on a 360 px screen

- `w-full max-w-md`, inset by `p-4`, capped at `max-h-[85dvh]` with the **body** scrolling
  (`overflow-y-auto`), never the page behind it. A tall roster must not push its own close control
  off screen.
- The title bar and the close control stay fixed while the body scrolls, so exit 2 is always reachable.
- `env(safe-area-inset-*)` is already handled on `#root`; the overlay is `fixed`, so it re-applies its
  own bottom inset rather than inheriting one.
- No `backdrop-filter` on the scrim (§9.3) — a full-screen blur is one of the most expensive things a
  mid-range Android can be asked for.
- The page behind keeps its scroll position, because the overlay never unmounts it.

### The navigation map, end to end

```
Bottom bar (always)      GATE            STATUS              LINK
                         └ log a set     └ who you are       └ sync
Status page (inline)     [STATUS WINDOW] [DAILY QUEST] [conditional quests] [STREAK] [SYSTEM]
Summoned (overlay)                        ANALYSIS · ARMY · CASTLE · SHOP · RUNES · TITLES
Anywhere (overlay)                        Notification windows, one at a time
Rest timer (docked)                       Above the bottom bar, on every route (commit 0)
```

Three levels, and only one of them is new. Nothing is more than two taps from anywhere.

---

## 5. The commits

### Commit 0 — Two gym bugs that stand on their own

Neither is cosmetic; neither depends on the rest. Ships first and alone, the call
`system-visuals-plan.md` §7 made for the notification defects.

1. **Wire `keepScreenAwake` (F18).** Acquire through the existing `createWakeLock()` whenever a
   session is in progress and the setting is on; release on session end or setting off.
   `useRestTimer.ts:70-115` has the acquire/release/`visibilitychange` handling to copy, including
   the foreground re-acquire mobile browsers require. Degrades to a no-op where unsupported, which
   `capabilities.ts` guarantees.
2. **Move the rest-timer dock into the shell (F19).** Lift `gate.tsx:841-861` into `root.tsx` above
   `<MessageQueue />` so it survives a route change. `useRestTimer` moves with it; Gate reads the
   same hook. Renders nothing when idle.

**Tests:** a live session acquires and releases the lock (fake `navigator.wakeLock`, per the existing
capability tests); the dock renders on the Status route while a timer runs.

### Commit 1 — The type, the icons, the meter, and the value pair

The typographic foundation from §1.0. Shared components only, so all four routes change together and
nothing structural moves yet. This is the commit that makes the app look like the frame.

1. **Near-white, bold (§1.0 correction 1).** Labels and figures move from `text-ink-soft` /
   `text-ink-faint` to `text-ink` (#dbeafe) at `font-semibold`. The dim tokens keep their job —
   secondary prose, units, the dimmer half of a value pair — but they stop carrying primary
   information. Audit every `text-[10px]` and `text-[11px]` on the Status route; if it names a thing
   or states a number, it goes bright.
2. **Bold sans for content, monospace for chrome (§1.8).** Content labels and numerals move to
   `font-body font-semibold` with `tabular-nums`. `font-system` stays on bracketed window titles,
   letterspaced sublabels and the license key. Add nothing to `index.css` — both stacks exist.
3. **Icons get weight (§1.0 correction 3).** `SystemIcon` takes `strokeWidth={2.5}` as its default
   and gains a `solid` variant for the marks the reference draws filled. One file, per
   `system-visuals-plan.md` §3's own promise that the restyling layer is where the look lives.
4. **The value pair, at the reference's ratio (§1.0 correction 2, §1.6):**

```tsx
/**
 * The reference's value pair, read straight off the Status frame (m10-plan
 * §1.0): the figure is roughly 3x its own label and its own max. Equal sizes
 * are what flatten a screen of numbers into one grey read.
 */
export function SystemValue({ value, max, unit }: { value: number | string; max?: number | string; unit?: string }) {
  return (
    <span className="font-body font-semibold tabular-nums text-ink">
      <span className="text-2xl leading-none">{value}</span>
      {max !== undefined ? <span className="text-xs text-ink-faint">/{max}</span> : null}
      {unit ? <span className="text-xs text-ink-faint"> {unit}</span> : null}
    </span>
  )
}
```

   A `size` prop (`'lg' | 'md'`) covers the smaller inline pairs — a summon row's figure does not
   need 24 px — but `lg` is the default, because the reference's default is loud.
5. Adopt at all six F2 sites, Gate and Awaken included, so no route is left behind.
6. `ManaBar` shows the remaining figure — `LV 6` left, `240 XP TO LV 7` right — with
   `xpIntoLevel / xpToNext` kept in the `aria-label`.

7. **The meter, rebuilt to §1.0a.** Four layers, the same `segments` / `height` API, the core colour
   taken from each segment's own tone, and the `height` floors raised where 2 px of core will not
   fit. Thirty call sites across four routes change appearance and none changes code, which is the
   whole point of having the primitive.

Everything in this commit is a `src/components` primitive with no layout change, which is what keeps
it honest as one commit. Split it if review runs long — the meter is the natural seam.

**Tests:** `SystemValue` at both sizes, with and without `max`; the `ManaBar` label assertion
updated; a snapshot of one stat row to catch an accidental return to 11 px; `SystemMeter` renders one
core element per segment and takes its colour from that segment's tone rather than a fixed cyan —
the bug §1.0a names.

### Commit 2 — Split the mega-window into the inline head

Pure restructure — no copy changes, no new features.

1. Delete the outer `<SystemWindow title="Status Window" strong>`; keep the `<main>`; add the
   `<header>` kicker from `gate.tsx:222-225`.
2. Each head panel swaps its `SystemPanel` root for a `SystemWindow` titled per §4. `SystemPanel`
   stays as an in-window divider — its documented job (`SystemPanel.tsx:1-4`), as `link.tsx` uses it.
3. **The vitals strip, as its own window (§1.0).** The reference puts HP / MP / Fatigue in a
   horizontal strip above the stat grid, so `[STATUS WINDOW]` becomes two windows with a gap. We have
   no HP or MP and will not invent them; the three slots map to what the domain actually holds:

   | Slot | Reference | Ours |
   |---|---|---|
   | 1 | `HP 100/100` with a bar | `LV 6` with the XP bar and `240 XP TO LV 7` |
   | 2 | `MP 10/10` with a bar | `STREAK 2` with a flame glyph, `best 5` as the dim half |
   | 3 | `FATIGUE: 0` with a ring glyph | `FATIGUE: 34` with the same ring glyph |

   Fatigue stops being a 48 px gauge and becomes a labelled figure with a **small ring glyph**, per
   §1.0. `fatigue.message` moves to the `[ANALYSIS]` window; `SegmentedRing` is freed for commit 4's
   deadline ring. When `band === 'insufficient_data'` the field reads `—`, never `0`.
4. **The stat grid, as the reference draws it (§1.0 correction 4).** `[STATUS WINDOW]` becomes a
   **two-column grid**: icon, `STR:` label, then the total as a `SystemValue` at `lg`. Five stats
   fill five cells; the sixth cell is `Available / Ability / Points:` as a small three-line label
   beside its own big figure, which is exactly where the reference puts it.

   The reference gives the stats no meters. We keep one anyway, subordinate: a **3 px split meter
   under each cell**, carrying the derived-vs-allocated distinction that `--color-mana` exists to
   show (`system-visuals-plan.md` §8 defends that split as real information). It sits under the
   number at a fraction of its weight, so the figure is the loud element and the split is still
   legible. `index.tsx` passes one shared
   `max={Math.max(...STAT_ORDER.map((k) => player.total[k]), 10) * 1.15}` to every cell, which is the
   F3 fix — five bars that all fill 80% are worse than no bars at all.
5. `StatRow` and `StatBar` are rewritten in place rather than replaced, so their existing callers and
   tests move with them.
4. The six archive panels stay mounted below the head for now; commit 3 moves them behind the summon
   list. Two readable diffs instead of one large one.
5. Gold prints three times today (`StreakPanel.tsx:47`, `ShopPanel.tsx:26`, item prices). Keep it
   where it is spent — the Shop — and drop it from Streak's inline row.
6. Add the `speaking` `useMemo` and pass `strong={speaking === '<id>'}`.

**Tests:** `routes.dom.test.tsx` — Status renders more than one `SystemWindow` heading,
`[STATUS WINDOW]` is present, and **exactly one** element carries `shadow-system-strong`. Add the
Gate equivalent; that assertion is the glow-rule guard for every route.

### Commit 3 — The summon list and the overlay window

The commit §1.3 demands, and the one that removes ~2,400 px.

1. **The open window is a search param (F14).** `indexRoute` gains
   `validateSearch` accepting `window?: 'analysis' | 'army' | 'castle' | 'shop' | 'runes' | 'titles'`,
   anything else normalising to undefined so a hand-edited URL cannot render a broken overlay.
   Summoning is `navigate({ search: { window: id } })`; closing is `navigate({ search: {} })`. No
   `Settings` field, no migration, and back closes the window for free.
2. Extract the overlay shell out of `MessageQueue.tsx:126-140` into
   `src/components/SystemOverlay.tsx` — `.system-frame`, `bg-void/80` scrim, no `backdrop-filter`
   (§9.3), `role="dialog"`, `aria-modal`, `max-w-md max-h-[85dvh]` with the body scrolling and the
   title bar and close control fixed, Escape and scrim-tap to close, focus in on open and returned on
   close (§9.5, §4a). `MessageQueue` renders its window through it, so the two can never drift.
   **One overlay at a time, app-wide** — a summoned window yields to an arriving notification rather
   than stacking under it.
3. **The overlay header, as both references draw it (§1.9, §7):** a small bordered icon box, then the
   bordered title box, then the close control at top right — `min-h-11 min-w-11`, an `X` through
   `SystemIcon` (§4a, exit 2). One construction, shared with the notification window.
4. New `src/components/SummonList.tsx` — its own `[SYSTEM]` window holding the six rows from §4, each
   a `min-h-11` button with its figure. Always visible; tapping the open one closes it.
5. The six archive panels become the overlay's content, unchanged internally.
6. `ANALYSIS` collects fatigue's message, weekly volume and the warnings.
7. **The one-time explanation (§4a).** `SettingsSchema` gains `systemIntroSeen: z.boolean().default(false)`
   — the only new settings field in this milestone. On first Status visit after awakening, push two
   queue messages in the System's own voice and set the flag. Never shown again, and never blocking.

**Tests:** no `window` param renders the list and no overlay; an unknown param value renders no
overlay rather than throwing; navigating back closes it; Escape closes and returns focus to the summon
row; scrim-tap closes; a notification window and a summoned window never render together;
`MessageQueue`'s existing window tests still pass against the extracted shell; the intro fires once
and not on the second visit.

### Commit 4 — The Daily Quest, as the System issues it

§1.4, and the canon detail every earlier draft missed.

1. **The deadline ring.** `SegmentedRing` (freed in commit 2) shows the fraction of the day left,
   `tone="warn"` under two hours, driven by `today` and the clock the store already owns — never
   `Date.now()` inside `src/domain/`, which stays pure with time as an argument.
2. **The penalty line.** One `text-warn` line stating the stake, wording from the domain's own
   penalty-quest behaviour (`state.ts:1236-1238`) rather than invented: a missed daily quest issues a
   penalty quest, and clearing the day's work discharges it.
3. **The reward block** moves out of the header caption into its own `SystemPanel` row —
   `+150 XP · +25 GOLD` as `SystemValue`s (§1.4's `+3` convention).
4. **`GOAL` and `CLEARED` groups (§1.9).** Outstanding tasks sit under a `GOAL` sublabel, met ones
   under a dim `CLEARED` sublabel. The groups say what is left without a disclosure control, and a
   task moving between them is the progress feedback.
5. **A square check per task (§1.9).** An empty square while outstanding, a tick when met, at the
   right of the row beside its bracketed pair. Readable at arm's length in one glance, which green
   numerals alone are not (gym rule 5).
6. **Bracketed task values (§1.9).** `[36 / 35]`, `[2500 / 2500 m]` — `SystemValue` at `md` inside
   brackets for task rows. The big bare numeral stays for stat figures only.
7. **Complete state (F8).** When every task is met the window is one row: `DAILY QUEST CLEARED` in
   `text-good` plus the reward pair, expandable to the groups above.
8. Met rows lose their meter and input and keep their height (gym rule 4).

**Tests:** the ring is absent when no quest is issued; a complete quest renders one row; the penalty
line renders only while the quest is incomplete; the ring's fraction is computed from an injected
clock, not the ambient one.

### Commit 5 — Cut what nobody reads

1. **Volume (F6).** Split into two groups with sublabel headers (§1.9): `TRAINED` holds
   `entries.filter((e) => e.sets > 0)` in its existing worst-first order, `UNTRAINED` holds the rest,
   collapsed to a single dim line naming them rather than seven empty tracks. `useMemo` from the
   prop; no store change.
2. **Warnings (F7).** Title-only rows, severity as a 2 px left edge rule (`border-l-2 border-warn pl-2`)
   rather than amber text across the title, `min-h-11`, and finding + suggestion + acknowledge
   revealed **one at a time**. Three rows, then `6 MORE WARNINGS`. Acknowledge lives inside the open
   row only, which also removes the accidental-dismissal risk of a 14 px underline.

**Tests:** an all-zero volume list renders the pill and no meters — the empty-input case the standards
require of anything taking a collection.

### Commit 6 — Actions sized for a gym

1. Adopt Gate's four house styles verbatim (F10). Extract shared `const` strings only at three or
   more callers; otherwise copy, per the one-home rule.
2. **Quest progress by stepper (F16, rule 1).** Three `min-h-14` steppers per unmet row, steps from
   the item's unit — `+1 / +5 / +10` for reps, `+100 / +250 / +500` for metres — each firing the
   existing `completeDailyQuest({ [kind]: amount })`, which already persists per entry and pays out
   only on completion (`state.ts:1214-1240`). Manual entry survives behind a `MANUAL` pill.
3. **Allocation targets (F17, rule 2).** `StatRow`'s `+` goes to `min-h-11 min-w-11`. One caller, so
   nothing else moves.
4. **Revoke is destructive (rule 6).** It resets the whole allocation, so it moves into
   `[STATUS WINDOW]`'s footer as the secondary under the allocation primary (F11, rule 3), and it
   confirms. The only new confirmation in this milestone.
5. Every remaining target reaches 44 px: acknowledge, summon rows, return/summon on shadows,
   forgiveness pills.
6. Hunter License (F9): a footer button whose `React.lazy` fires on tap behind a `useState` flag, so
   the canvas chunk is never fetched on a normal visit.

**Tests:** a stepper calls `completeDailyQuest` with that kind and amount; metre items offer metre
steps; a row becoming met keeps its rendered height; the license canvas is absent until pressed; the
allocation primary appears only when `unspentStatPoints > 0`; revoking asks first.

### Commit 7 — The System speaks, and the frame draws itself

Three shared changes, so Gate, Link and Awaken get them at the same time. That is the point: none of
this may be a Status-only treatment.

1. **The ground texture, corrected (§1.0).** The reference reads as a **blueprint** — technical
   drawing lines and scratched glass, plainly visible — not near-invisible diagonal scratches. Add a
   second static layer to `body`: a faint orthogonal grid under the existing diagonal, and judge the
   pair's alpha against the reference rather than against the old note. Vignette stays on top.
   Static `background-image`, no animation, no per-frame cost.

   The meter is rebuilt in commit 1, not here (§1.0a).
2. **Staggered entrance (F13).** `SystemWindow` takes an optional `index` and sets
   `style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}`. Several windows drawing in sequence
   is the System writing them; all fading at once is a page loading. `transform`/`opacity` only,
   zeroed by the existing reduced-motion rule.
3. **The copy pass (§1.5).** Same information, same lengths, no new components:

| Now | Becomes |
|---|---|
| `Dismiss` | `ACKNOWLEDGE` |
| `Reset allocation` | `REVOKE ALLOCATION` |
| `3 points to spend` | `ALLOCATE 3 POINTS` |
| `Share License` | `ISSUE LICENSE` |
| `Bench` / `Activate` | `RETURN` / `SUMMON` |

`domain/shadows.ts` keeps `active`/`benched`. Copy only; no formatter changes shape.

### Commit 8 — The stat block explains itself

INT drives the shadow cap, and that fact currently lives 3,000 px away in `ShadowsPanel`'s message.
Add each stat's one-line meaning as a `sublabel` caption under the five rows — five short clauses, no
new window, no tooltip machinery. Cite the domain source in a comment rather than restating it.

### Commit 9 — The frame tier, and the glow pass measured on the phone

§1.7, then the pass `system-visuals-plan.md` §10 step 8 puts last. **All routes together or not at
all** (F12).

1. **The title box and the brackets (§1.0 correction 6).** `SystemWindow`'s `<h2>` becomes a centered
   bordered box pulled up with a negative margin so it straddles the top border — the construction at
   `system-visuals-plan.md` §7, currently used only by `MessageQueue`. `SystemPanel` gains a `boxed`
   variant (a full hairline border rather than a top rule) for the vitals strip and the stat grid,
   which the reference draws as boxes inside the outer frame.
2. **The frame levels up with the hunter.** One class on `SystemWindow`, chosen by `player.rank` and
   `hunterClass`:

   | Tier | Ranks | Frame |
   |---|---|---|
   | 1 | E, D | Today's hairline `border-panel-edge` |
   | 2 | C, B | `.system-frame` — near-white hairline, inset cyan bloom, two corner brackets |
   | 3 | A, S | Tier 2 plus a brighter bracket and `--shadow-system` on the speaking window |
   | 4 | `hunterClass === 'shadow_monarch'` | Tier 3 with the accent swung to `--color-mana` |

   Tier is a token lookup, not a per-route style: Gate and Link inherit it automatically, which is
   what keeps the three routes identical. Tier 4 needs no new token — `--color-mana` exists, and
   §1.7 is why violet is the right end state.
3. Re-check `--color-ink-faint` on `--color-panel` at 4.5:1 after any tone change (§11).
4. **Measure on the real phone**: scroll framerate with `[ANALYSIS]` summoned, the new ground layer
   in, and the frame tier at its brightest. The one item reasoning cannot settle (§9.6). If it drops frames, drop the corner brackets and
   keep the near-white hairline, which is where most of the effect lives.

**Tests:** an E-rank hunter renders tier 1 and an S-rank tier 3; `shadow_monarch` renders tier 4; the
tier is derived from the projection, never stored (the log stays append-only and rank stays derived).

---

## 6. What this plan does not do

- **No new colour, font, radius or spacing token.** Every value comes from `index.css`; tier 4 reuses
  `--color-mana`. Radius stays on capsule meters and pills, per §2.1.
- **No route split and no in-page tab bar.** The summon list changes which window is open, never
  which screen you are on.
- **No domain change.** `src/domain/` is untouched by all ten commits except commit 3's one `Settings`
  field. Commit 1's `max` is an existing prop; commit 4 takes its clock as an argument; commit 7 is
  copy and CSS; commit 9 reads the projection.
- **No network dependency.** Summon state is IndexedDB, written and returned, never awaited.
  Airplane-mode behaviour is unchanged.
- **No font change**, per §1.8.

---

## 7. Verification

- `pnpm test`, `pnpm run typecheck`, `pnpm run check:render`, `pnpm run build` all clean.
- Bundle delta recorded. Expected roughly **neutral**: two small components and no new dependency,
  against the license-card chunk leaving the visit path and the overlay shell being shared with
  `MessageQueue` rather than duplicated.
- Status page height with nothing summoned, measured on the phone. Target **≤ 1,900 px**, from 7,598.
- Exactly one element on each route carries `shadow-system-strong`; never two overlays at once.
- **The three look tests, which outrank the numbers:**
  1. Screenshot the three routes side by side. `[STATUS WINDOW]`, `[THIS WEEK]` and `[SYSTEM LINK]`
     must be indistinguishable in frame, title, spacing and button treatment.
  2. Screenshot Status against §3's banned list: no chevron, no grid, no `show more`, no new radius,
     no smooth meter, no product vocabulary.
  3. Screenshot a summoned window beside a notification window. They must look like the same System
     drew both — after commit 3 they are literally the same component.
  4. Screenshot the XP bar beside the anime frame at matched width. The dark gap between outline and
     core must be visible, or commit 1's meter rebuild has not landed (§1.0a).
  5. Nothing anywhere has a rounded corner except a capsule meter or a pill — the one place the
     liked Dribbble concept and the show disagree, and the show wins (§1.9).
- **The gym pass, in the gym, between two real sets:**
  1. Log Daily Quest progress one-handed, standing, without the keyboard appearing once.
  2. Start a rest timer on Gate, switch to Status, log reps, switch back — the countdown stays visible
     throughout (F19).
  3. Leave the page open three minutes mid-session; the screen does not sleep (F18).
  4. Allocate a point with the hand holding the phone. Two attempts means the target is still small.
  5. Everything tapped between sets measures ≥ 44 px; quest steppers ≥ 56 px.
- Airplane mode: summon a window, force-reload. It reopens; nothing spins.
- **The navigation pass, on the phone, by someone who has not read the plan** — ideally someone who
  has not read the manhwa either:
  1. They find a summoned window without being told where to tap.
  2. From inside one, they get out three ways: hardware back, the `[ X ]`, the scrim.
  3. Hardware back from an overlay returns to Status, never to the previous route and never out of
     the app.
  4. With `[SHADOW ARMY]` summoned and a full roster, the close control stays on screen while the
     body scrolls.
  5. Nothing on any route is more than two taps away.
  6. The one-time System explanation reads like the System, not like a product tour, and never
     appears twice.

---

## 8. On landing

Per `CLAUDE.md`'s plan-file lifecycle:

1. Summarise what shipped in `docs/implementation-plan.md` §4.
2. Note the landing in `docs/TODO.md`.
3. `git rm docs/m10-plan.md`, repointing anything referencing it at the commit.

§1's research is the exception: **fold §1.1–§1.8 into `docs/system-visuals-plan.md`** before deleting
this file. That document is the permanent home for the reasoning behind the visual language, and the
research is worth more than the plan built on it.

---

## Sources

- [CBR — "The 'System' In Solo Leveling, Explained"](https://www.cbr.com/solo-leveling-system-explained/)
- [CBR — "How Do Solo Leveling's Quest Logs Work?"](https://www.cbr.com/solo-leveling-sung-jinwoo-quest-log-training-stats-explained/)
- [CBR — "Solo Leveling Fan Spends 70 Hours (& Counting) Building Anime-Accurate 'System'"](https://www.cbr.com/solo-leveling-anime-system-create/)
- [Thread on how the System's design changes through the story](https://x.com/SoloLevelingGuy/status/1880995183078387722?lang=en)
- [Anime Tiger — Season 2 powers and the Shadow Monarch palette](https://animetiger.com/solo-leveling-season-2-sung-jin-woo-powers-monarchs/)
- [Frorex Studio, "Awaken - Habit Tracker Mobile App UX UI" on Dribbble](https://dribbble.com/shots/25649005-Awaken-Habit-Tracker-Mobile-App-UX-UI) - supplied as a liked reference; palette and rounding deliberately not taken (S1.9)
- [Solo Leveling Wiki — The Preparation To Become Powerful](https://solo-leveling.fandom.com/wiki/The_Preparation_To_Become_Powerful)
