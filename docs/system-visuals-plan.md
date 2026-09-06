# The System's visual language — icons, meters, glow

Bringing the status window closer to the reference: glowing hairline frames, capsule meters with a
lit core, and a consistent icon set. Written 2026-09-06, for M5 (the game layer).

## 1. What already exists

More than the reference implies. `src/index.css` has a real token system — void/panel/ink ramps,
`--color-system` and its dim/deep/glow variants, `--shadow-system` and `--shadow-system-strong`,
`--font-system`, an entrance animation, and a global `prefers-reduced-motion` rule. `SystemWindow`,
`SystemPanel` and `RankBadge` already carry the frame vocabulary.

Two gaps:

- **The meters are flat.** `ManaBar` is a rounded track with a gradient fill; `StatBar` is a
  two-segment version of the same. Neither has the reference's outline-plus-lit-core construction,
  and each hand-rolls its own geometry rather than sharing a primitive.
- **There are no icons at all.** Not one. Every label in the app is a word.

## 2. Decomposing the reference

The look is five techniques, not a style anyone needs to freehand:

1. **Sharp hairline frames.** Rectangular, 1px, no border radius on the outer container — the
   rounding in the app today reads softer and more "app", less "System".
2. **Capsule meters with a double stroke.** An outer 1px outline, an inset track, and a fill whose
   centre line is brighter than its edges. The lit core is what makes it read as emitting rather
   than being coloured.
3. **Value typography as a pair.** A large bright current value against a smaller, dimmer max —
   `100`/`100`, not `100/100` at one size.
4. **Thin, monochrome, glowing icons.** Roughly 1.5px stroke on a 24px grid, rounded caps, single
   colour, with the glow doing the work.
5. **A textured ground.** Near-black with faint diagonal scratches and a top vignette. The body
   already has the vignette; the scratches are missing.

## 3. Icons: use a library, restyle it

No icon library is installed. The recommendation is **`lucide-react`**, for a specific reason: it
exposes `strokeWidth` and inherits `currentColor`, which are exactly the two knobs this aesthetic
needs. Its 24px stroke grid is already the reference's geometry.

Covers what the app needs — Dumbbell (STR), HeartPulse (VIT), Footprints (AGI), Brain (INT),
Radar (PER), Plus (HP), FlaskConical (MP), Flame (streak), Trophy, Swords, ChevronRight, X.

Hand-author the three it cannot do in the right style: the **segmented fatigue ring**, the **rank
badge**, and the **gate diamond**. These are identity marks rather than pictograms and should not
look borrowed.

**The important point: the look does not come from the paths.** It comes from a single
`<SystemIcon>` wrapper applying size, stroke width, tone and glow. Any competent stroke library
would do; the restyling layer is the actual work. That also means swapping the library later is a
one-file change.

### The budget question, answered honestly

The current bundle is **195,708 bytes gzipped**. That is already at the "200 KB" line the M2 plan
invented, which M4 finding H2 correctly identifies as a number borrowed from the wrong kind of app —
and M4 commit 3 is re-deriving it from measured install time anyway.

Ten tree-shaken lucide icons should add roughly 3–5 KB gzipped. That is almost certainly fine, but
it must be **measured, not assumed**, and the measurement should land after M4 commit 3 so it is
judged against a real budget rather than an invented one.

If it comes in worse than expected, the fallback is a hand-authored SVG sprite: twelve inline icons
is about 2 KB with no runtime at all. Do not add the library on faith.

## 4. The glow is a performance risk, and it is the whole aesthetic

This is the part most likely to go wrong on the target device — a mid-range Android in a dim gym.

`filter: drop-shadow()` on SVG and wide-blur `box-shadow` are GPU-expensive, and the reference wants
both on nearly every element. A status window with eight glowing icons and six glowing meters can
drop frames while scrolling on hardware that renders the current flat version fine.

Rules to build under:

- **Never animate `filter` or `box-shadow`.** Animate `opacity` or `transform` on a pre-composited
  glow layer instead.
- **Prefer `box-shadow` on a static element** over `drop-shadow` on an SVG where both would work.
- **Cap simultaneous glow.** The strong shadow belongs on the focused window, not on every panel.
  Add a faint tier so most elements can glow cheaply.
- **Measure on the real phone**, not a desktop browser. This is the one item in the plan that cannot
  be verified by reasoning.

`prefers-reduced-motion` is already handled globally. Glow is not motion, so it needs its own
reduction path for anyone who finds it hard to read.

## 5. A contrast defect, found while reading the tokens

`--color-ink-faint: #5b7093` on `--color-panel: #0d1526` is a contrast ratio of about **3.6:1**.
WCAG AA wants 4.5:1 for normal text, and this token is used at `text-[10px]` and `text-[11px]`
throughout the gate screen — well below the large-text exemption.

This is not a compliance footnote. The app is read at arm's length, in a dim room, by someone out of
breath between sets. Adding glow around low-contrast text will make it worse, not better, because
bloom reduces edge definition.

Lift `--color-ink-faint` to around `#7b90b3` (roughly 5.2:1) and re-check the ramp. Do this
**before** the glow work, so the glow is tuned against legible text rather than compensating for
illegible text.

## 6. What to build

| Component | Purpose |
|---|---|
| `SystemIcon` | The restyling wrapper: size, stroke, tone, glow tier. Every icon goes through it. |
| `SystemMeter` | The capsule primitive. Variants: `solid` (HP/XP), `split` (derived vs allocated), `segmented` (fatigue). Replaces the geometry duplicated in `ManaBar` and `StatBar`. |
| `SegmentedRing` | The fatigue dial. Custom SVG, driven by `fatigue.gauge` (0–100), which already exists. |
| `StatRow` | Icon, label, value — the two-column grid in the reference. |
| `SystemFrame` | The sharp hairline frame, as a variant of `SystemWindow` rather than a new component. |

`ManaBar` and `StatBar` keep their names and props and become thin wrappers over `SystemMeter`, so
nothing calling them has to change.

## 7. Tokens to add

Only what has a caller (rule 16):

- `--shadow-system-faint` — the cheap tier, for elements that should glow without costing.
- `--shadow-icon` — a tuned `drop-shadow` for stroke icons, which need less blur than panels.
- Meter tokens: track, fill, and the lit core, so the three variants cannot drift apart.

`--color-mana` (purple) already exists and is used for allocated stat points. The reference's MP bar
is blue, but repurposing the token would break the existing derived-vs-allocated distinction, which
carries real information. Keep them separate.

## 8. Sequence

1. **Fix the contrast ramp.** Independent, and everything else is tuned against it.
2. **`SystemMeter`**, with `ManaBar` and `StatBar` rewritten over it. No visual change beyond the
   new construction, so it can be reviewed on its own.
3. **`lucide-react` plus `SystemIcon`**, with the bundle delta measured and written down.
4. **The three custom marks** — fatigue ring, rank badge, gate diamond.
5. **`StatRow` and the status window layout.**
6. **The ground texture and the glow pass**, last, measured on the phone.

## 9. Verification

- `--color-ink-faint` on `--color-panel` measures at least 4.5:1.
- `ManaBar` and `StatBar` render identically to before the `SystemMeter` rewrite, by their existing
  callers, with no prop changes.
- The bundle delta from `lucide-react` is measured and recorded, and judged against M4 commit 3's
  budget rather than the invented 200 KB.
- Every route still mounts (rule 14), including the status window with the new components.
- Scrolling the status window holds 60fps on the actual phone with all glow enabled.
- With `prefers-reduced-motion`, nothing animates; with the glow reduction, every value stays
  readable.
