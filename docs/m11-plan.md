# M11 — The Hunter License, as the Association issues it

**Verified starting point:** `origin/main` at `332ce4e`, 753 tests passing, M10 landed and deployed.
`src/components/HunterLicenseCard.tsx` draws a 340×200 canvas, reached from the Status window's
footer button (`index.tsx:344-358`), sharing through `shareImage` with a download fallback.

---

## 1. The thesis: the License is not a System window

A frame of Jinwoo's Hunter's License was supplied 2026-09-09. The most important thing about it is
what it *is not*:

**Every other surface we have built is the System — dark, holographic, cyan, square, seen only by the
hunter. The License is the opposite of all of that.** It is a laminated plastic ID card issued by the
Hunter's Association, a mundane bureaucracy: near-white body, navy print, a serif masthead, a
portrait photo, a barcode, a gold contact chip, rounded corners, and a certification sentence in
italics. Anyone can see it. It goes in a wallet.

Our card today is a dark navy gradient with a cyan monospace masthead and a rank badge in
`--color-system` — **a System panel wearing the word "licence".** That is the defect, and it is a
conceptual one, not a styling one.

Getting this right is also the practical win. The License is **the only artifact in this app that
leaves the app.** It gets pasted into a chat, a group, a feed — onto white backgrounds, at thumbnail
size, next to other people's screenshots. A dark 340×200 PNG loses that fight. A light, printed,
official-looking card wins it.

### The rounding exception, stated so nobody "fixes" it later

`system-visuals-plan.md` §2.1 and `docs/m10-plan.md` §3 (now retired into the standards) say: square
corners, no exceptions, because rounding reads "app" and sharp reads "System".

**The License is exempt, and the exemption is the reason the rule exists.** The rule governs System
surfaces. A plastic card has a 3 mm corner radius because it lives in a pocket. Rounding it is not a
deviation from the language — it is what marks the card as *not the System*, which is precisely the
distinction §1 is built on. The dark `[HUNTER LICENSE]` window that *contains* the card stays square,
and the card sits inside it the way a photograph sits in a frame.

---

## 2. The reference, element by element

| Element | The frame | What we draw today |
|---|---|---|
| **Body** | Near-white, faint cool tint, rounded corners, thin navy keyline | `#05070f` → `#0d1526` gradient, 2 px rank-coloured stroke |
| **Masthead** | `Hunter's License` bold **serif**, navy, top-left, over a hairline rule | `HUNTER LICENSE` 11 px monospace in `#7dd3fc` |
| **Issuer** | `Hunter's Association` small bold serif, top-right | Nothing |
| **Structural blocks** | Navy angular wedges at the top-left and down the right edge, framing the card | Nothing |
| **Portrait** | Photo in a plate at the left, roughly a third of the width | Nothing |
| **License No.** | Label above a 12-digit grouped number | `ID` + 16 hex characters of `hunterId`, 10 px, bottom-left |
| **Rank** | Label plus a very large bold letter — the loudest thing on the card | A 60×32 stroked box with a 22 px letter |
| **Name** | Label plus bold name | Nothing — `Profile` has no name field |
| **Category** | A **3×3 grid of bordered slots**, eight reading `-- --`, one reading `Mage` | Nothing |
| **Chip** | Gold contact chip, bottom-left | Nothing |
| **Barcode** | Vertical bars down the right edge | Nothing |
| **Certification** | Italic sentence, centered at the foot: *"This individual has been certified to work as a hunter by the Hunter's Association."* | Nothing |
| **Stats** | **None.** A licence is identity, not a character sheet | Five stats, titles held, gates cleared, awakened date |

Four problems follow:

1. **Wrong medium.** Dark holographic where the reference is printed and light (§1).
2. **No identity.** A licence answers *who*. Ours answers *how strong* — five stat numbers and two
   counts, with no name, no issuer, no document number worth reading.
3. **The empty grid is the best idea in the reference and we have nothing like it.** Eight slots
   reading `-- --` beside one reading `Mage` tells a progression story in one glance.
4. **It shares badly.** At `devicePixelRatio` 1 the PNG is 340×200 — soft the moment anyone opens it
   full-screen, and dark-on-dark when pasted into a light chat.

---

## 3. The mapping

Every field on the reference has an honest source in our data. Nothing here invents a domain concept.

| Reference field | Ours | Source |
|---|---|---|
| `Hunter's License` | `HUNTER'S LICENSE` | Literal |
| `Hunter's Association` | `THE SYSTEM` | Our issuing authority. We have no Association, and inventing one would be a second fiction to maintain |
| Portrait plate | **The level plate** — `6` very large with `LEVEL` beneath, over a blueprint hatch on navy | `player.level`. The anime's Status window draws level exactly this way, so the two surfaces rhyme |
| `License No.` | `hunterId`, first 12 characters, upper-cased, grouped in fours | `identity.hunterId` — the SHA-256 of the Hunter Secret, safe by construction. **Never the license key** |
| `Rank:` + big letter | Same, rank-coloured, the loudest glyph on the card | `player.rank`, `UNRANKED` when null |
| `Name:` | The hunter name, `HUNTER 4010` when unset | `profile.hunterName`, added in commit 0 (§7) |
| `Category:` 3×3 grid | **Class in slot 1, titles in slots 2–9**, empty slots `-- --` | `player.hunterClass` + `earnedTitleIds` (§4) |
| Gold chip | A gold foil rectangle, decorative | Nothing. Encodes nothing, by rule (§6) |
| Barcode | Vertical bars whose widths derive from `hunterId` | Deterministic, stable across renders, leaks nothing (§6) |
| Certification | *"This hunter is certified to train under the System."* plus `ISSUED <date>` | `profile.awakenedAt`; the line is omitted entirely when null |
| — | A single thin foot band: `LV 6 · STR 43 · VIT 5 · AGI 8 · INT 20 · PER 32 · 3 GATES` | Keeps every figure today's card shows, at a weight that does not fight the document |

The stat band is the one deliberate addition to the reference. A real licence carries no stats, but
ours already showed them and removing them would be a regression for a hunter who shares the card to
show progress. Subordinate, small, tabular, one line — present without pretending to be the point.

---

## 4. The Category grid is the whole design

The reference shows nine bordered slots, eight of them `-- --`. Mapped to our data:

```
Category:
┌──────────────┬──────────────┬──────────────┐
│ FIGHTER      │ Awakened     │ First Flight │
├──────────────┼──────────────┼──────────────┤
│ Unbroken     │ -- --        │ -- --        │
├──────────────┼──────────────┼──────────────┤
│ -- --        │ -- --        │ -- --        │
└──────────────┴──────────────┴──────────────┘
```

- **Slot 1 is the class**, which is what `Mage` is on the reference — a job, not an achievement.
  Before level 20 it reads `NO CLASS`.
- **Slots 2–9 are titles**, newest first, from `earnedTitleIds` through the existing `heldTitles()`.
- **Empty slots render `-- --`**, exactly as the reference does. This is not a placeholder to be
  designed away: the empty slots are the progression, and a card that fills up over months is worth
  more than one that hides what is missing.
- **With more than eight titles**, slot 9 reads `+6 MORE`. There are already 14 titles in
  `domain/titles.ts`, so this is the common case for a long-running hunter, not an edge case.
- Slot text truncates with an ellipsis at the slot width; `National Level Hunter` must not overflow
  its box.

---

## 5. Layout and palette

### Geometry

- **Ratio 1.6**, close to the reference's 1.556 and to ID-1's 1.586. Logical **384 × 240**, replacing
  340 × 200.
- Vertical band budget, top to bottom: masthead **36**, body **148**, foot **56**.
- Body splits: level plate `x 20`, width **96**; field column from `x 132` to `x 340`; the navy right
  edge band **24** wide, holding the barcode.
- Field column order: `License No.` and `Rank:` share a row, `Name:` next, `Category:` fills the rest.
- Foot: gold chip bottom-left, stat band centered above the italic certification line.
- Rounded corners **10** on the card body; a **1 px navy keyline** inside the radius so the card does
  not bleed into a white chat bubble.

### The light-card palette

`RANK_COLOR` in the current component is tuned for a near-black background. On a near-white card,
`#fcd34d` and `#7dd3fc` fall under 2:1 and are unreadable. A second table is required, not a reuse:

| Rank | Light-card ink | Treatment |
|---|---|---|
| E | Slate, ~7:1 | Plain letter |
| D | Green 700, ~4.9:1 | Plain letter |
| C | Sky 700, ~5.7:1 | Plain letter |
| B | Cyan 700, ~4.9:1 | Plain letter |
| A | Amber 700, ~4.8:1 | Letter plus a thin amber keyline around the rank field |
| S | Navy letter on a **gold foil plate** | Foil solves what amber-on-white cannot: gold at readable contrast is no longer gold |

Those ratios are estimates. **Measure each against the actual card body before shipping** — the card
is the one surface in the app a stranger reads at thumbnail size, and 4.5:1 is the floor.

The S-rank foil plate also echoes M10 commit 9's rank-driven frame tier: the higher the rank, the more
ornament the surface carries. The License should follow the same rule the windows now do — E and D
plain, C and B coloured, A keylined, S foiled.

### Type

- **Masthead and certification line: serif.** `Georgia, 'Times New Roman', serif` — a system stack, no
  webfont, no loading risk. The serif is what makes the card read as a document rather than a HUD.
- **Fields and numbers: the app's sans stack**, bold for values, small caps-ish letterspacing for
  labels, `tabular-nums` for the document number and the stat band.
- **No monospace anywhere on the card.** Monospace is the System's voice (`m10-plan` §1.8, folded into
  `system-visuals-plan.md`), and the System is not who issued this.

---

## 6. What must never appear on the card

The card is an image the hunter is encouraged to publish. It is the highest-risk surface in the app
for that reason, and the rules are absolute:

- **Never the license key.** It is the pairing credential. `hunterId` only — already the rule in the
  component's header comment, and it stays.
- **Never a body measurement.** No bodyweight, body fat, waist, neck or hip. `CLAUDE.md` forbids even
  *logging* a request body because it carries these; putting them in a shareable PNG is the same
  mistake with a wider audience.
- **Never sex or birth year.** Both are in `Profile`; neither belongs on a shared artifact.
- **The chip and barcode encode nothing.** They are ornament. The barcode's bar widths come from
  `hunterId`, which is already public by construction — so a reader who decodes the bars learns
  something they can already see printed above them, and nothing more. No QR code on this card, ever:
  a QR invites scanning, and the only scannable thing we have is the pairing key.
- **The hunter name is user-entered and shareable.** Never pre-fill it from anything, and never
  default it to a device or account name.

---

## 7. `Name:` — decided

`ProfileSchema` (`domain/types.ts:293-308`) has no name field, and a licence without a name is a
strange document. **Decided 2026-09-09: add an optional `hunterName`, falling back to the hunter id
when unset**, so the card is never broken and the name is never invented. Commit 0 lands it.

What that means precisely:

- `ProfileSchema` gains `hunterName: z.string().trim().min(1).max(20).optional()`. Optional, so every
  existing profile row stays valid and there is no migration.
- **20 characters**, because the card's name field is about 200 px at 13 px bold. The card truncates
  with an ellipsis regardless — a length cap is not a layout guarantee.
- **Never pre-filled.** Not from a device name, not from an account, not from anything (§6).
- Unset renders `HUNTER 4010` — the first four of `hunterId`, which is already public by
  construction.

### Where it is entered, and where it is changed

`src/app/awakening.ts` is a step machine with a step-id union, an answers object, `stepsFor`,
`validateStep` and `toProfileInput` (`awakening.ts:14-56`). A name step drops straight into it:

- `AwakeningStepId` gains `'name'`, first in `stepsFor` — it has no dependency on any other answer,
  and being named is how the Awakening should open.
- `AwakeningAnswers` gains `hunterName?: string`; `validateStep('name', …)` returns `null` even when
  blank, because the field is optional. The existing test that the flow completes with every optional
  field empty (`awakening.test.ts`) must keep passing untouched — if it needs editing, the step was
  made mandatory by mistake.
- `toProfileInput` carries it through, trimmed, omitted when empty.

**Changing it later happens in the `[HUNTER LICENSE]` window itself**, not in Link and not in a
settings screen. A hunter notices the name is wrong at the moment they look at the card, so the edit
belongs where the mistake is visible: a secondary control under the card, writing through
`repo.saveProfile`.

---

## 8. Rendering, sharing, accessibility

Four defects in the current implementation, each independent of the redesign:

1. **The shared PNG is as small as the screen.** `canvas.width = CARD_WIDTH * devicePixelRatio`
   (`HunterLicenseCard.tsx:110-113`) means a desktop share produces 384 × 240 — soft everywhere it
   lands. **Draw the share blob from an offscreen canvas at a fixed 3×** (1152 × 720) regardless of
   the display, while the on-screen preview keeps using DPR. Same draw function, different scale
   argument, which the existing `drawCard(ctx, dpr, data)` signature already allows.
2. **Fonts are not awaited.** Today's card uses `monospace`, which is always resolved, so this is
   latent rather than live. The redesign asks for a serif stack, and the first draw can land before
   the font resolves. `await document.fonts.ready` before the first paint, and redraw on change.
3. **The canvas has no text equivalent.** A `<canvas>` with no `role` and no label is invisible to a
   screen reader. Add `role="img"` and an `aria-label` built from the same field derivation the card
   draws, so the two can never disagree.
4. **`useEffect`'s dependency array lists `props.total`**, an object identity — fine today because
   `recompute()` produces a new projection each time, but it means the card redraws on every
   unrelated projection change. Depend on the derived field object from §9 instead.

---

## 9. Testability: separate the fields from the paint

`drawCard` is 70 lines of canvas calls and is untested, which is defensible — jsdom has no 2D
context, and asserting pixels is not worth the harness. But everything *decided* before painting is
testable, and none of it is currently separable.

Extract `src/domain/license.ts`:

```ts
export interface LicenseFields {
  documentNumber: string        // "4010 5813 2519"
  rankLetter: string            // "S" | "UNRANKED"
  name: string
  categorySlots: readonly string[]   // exactly 9, "-- --" for empty
  statBand: string
  issuedAt: number | null       // formatted by the component, not here
}
export function licenseFields(input: LicenseInput): LicenseFields
```

Pure, no locale, no clock, no React — the date is returned as a timestamp and formatted in the
component, because locale formatting belongs in a formatter and not in `src/domain/` (`CLAUDE.md`).

Tests this makes possible, and which the standards require:

- **Empty input**: no titles and no class → nine slots, all `-- --`.
- **Rank `null` states its answer explicitly** → `UNRANKED`, never falling through to `E`.
- Fourteen titles → eight titles plus `+6 MORE` in slot 9.
- `awakenedAt === null` → the certification line is omitted, not rendered with `Invalid Date`.
- A short `hunterId` does not throw on `slice`.
- The `aria-label` and the drawn card come from one call, so they cannot drift.

---

## 10. The commits

### Commit 0 — The hunter's name

`ProfileSchema.hunterName`, the `'name'` step in the Awakening machine, and the rename control under
the card (§7). Ships before any drawing changes and stands alone: with it landed, today's dark card
simply gains a name.

**Tests:** `stepsFor` puts `'name'` first and the flow still completes with it blank; a 21-character
name fails the schema; a whitespace-only name is treated as unset; `toProfileInput` omits the field
rather than storing an empty string; renaming persists through `repo.saveProfile` and survives a
`refresh()`.

### Commit 1 — `domain/license.ts` and its tests

Pure field and slot derivation, plus the tests in §9. `HunterLicenseCard` adopts it and keeps drawing
its current dark card, so this commit is behaviour-preserving and reviews on its own.

### Commit 2 — The card becomes a document

Geometry to 384 × 240, light body with the navy keyline and rounded corners, the navy structural
wedges and right-edge band, the serif masthead and `THE SYSTEM` issuer, the level plate, and the
`License No.` / `Rank:` / `Name:` field column with the light-card palette from §5. The dark
`[HUNTER LICENSE]` window around it does not change.

### Commit 3 — The Category grid

Nine slots, class in slot 1, titles after, `-- --` for empty, `+N MORE` in slot 9 when over eight,
ellipsis truncation at the slot width.

### Commit 4 — Chip, barcode, certification, stat band

The ornament and the foot. Each item is small; the commit is one because they share the foot's layout
budget and would otherwise be four passes over the same 56 px.

### Commit 5 — Share fidelity and accessibility

Fixed 3× offscreen render for the blob, `document.fonts.ready` before first paint, `role="img"` plus
the `aria-label` from `licenseFields`, and the dependency-array fix from §8.4.

---

## 11. Verification

- `pnpm test`, `pnpm run typecheck`, `pnpm run check:render`, `pnpm run build` clean.
- Bundle: the card is already its own lazy chunk and must stay one. Delta recorded; expected small.
- **Every rank's letter measures ≥ 4.5:1 against the card body**, checked with a contrast tool, not
  by eye — including S on its foil plate.
- **The share test, which is the point of the card:** share it into a real chat on the phone. It must
  be legible at thumbnail size, sharp when opened, and must not disappear into a white background.
- Screenshot the card beside the reference frame. It should read as the same *kind of object* — a
  document — without being a copy.
- Screenshot the card inside its dark window. The card must read as an artifact sitting in a System
  frame, not as a panel that forgot the theme.
- **The privacy read:** open the shared PNG and confirm nothing in §6 appears on it. Do this by
  looking at the image, not by reading the code.
- A hunter with zero titles and no class shares a card that looks deliberate, not broken.
- A hunter who skipped the name step shares a card reading `HUNTER 4010` that also looks deliberate.
- A 20-character name does not collide with the `Rank:` field or overflow its box.
- The name is empty on a fresh profile, and nothing in the app ever guessed at it.
- A screen reader announces the card's `aria-label` with the same figures the card draws.

---

## 12. On landing

Per `CLAUDE.md`'s plan-file lifecycle: summarise in `docs/implementation-plan.md` §4, note the landing
in `docs/TODO.md`, then `git rm docs/m11-plan.md`.

§1's thesis — that the License is deliberately *not* a System surface, and why that earns the rounding
exception — belongs in `docs/system-visuals-plan.md` before this file is deleted. It is the one place
the app's square-corner rule has a principled exception, and a future agent will otherwise "fix" it.
