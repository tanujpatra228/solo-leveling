# The System's visual language — icons, meters, glow

Bringing the status window and the notification queue closer to the reference: glowing hairline
frames, capsule meters with a lit core, a consistent icon set, and a System that announces itself
one window at a time. Written 2026-09-06, for M5 (the game layer).

Sections 6 and 7 carry the construction detail. Two of the findings here — the contrast ramp in
section 5 and the notification defects in section 7 — are bugs that stand on their own and should
ship before any restyling.

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

### The one exception to "no border radius," and why it proves the rule

The Hunter License card (`HunterLicenseCard.tsx`, m11-plan) has rounded corners, a near-white body
and a serif masthead — every rule above, inverted. That is deliberate, not an oversight a future pass
should "fix": **item 1's sharp frame is what makes a surface read as the System**, and the License is
the one artifact in the app that is explicitly *not* the System. It is a laminated ID card the
Hunter's Association issued — the only thing in this app meant to leave it, pasted into a chat or a
feed at thumbnail size. A plastic card has rounded corners because it lives in a pocket; drawing it
sharp and dark would make it read as another System window, which is exactly the confusion the
redesign existed to fix. The dark `[HUNTER LICENSE]` window that contains the card stays square, the
same as every other window — the exception is the card's own drawn surface, not its frame, and it is
the reason the square-corner rule exists rather than a hole in it.

## 3. Icons: use a library, restyle it

No icon library is installed. **Decided 2026-09-06: `lucide-react`**, for a specific reason — it
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

## 6. The construction, component by component

### `SystemIcon` — the restyling layer

Every icon goes through it, which is what makes swapping the library later a one-file change.

```tsx
export function SystemIcon({ icon: Icon, tone = 'system', size = 20, glow = 'faint', label }: {
  icon: LucideIcon
  tone?: keyof typeof TONE
  size?: number
  glow?: 'none' | 'faint' | 'strong'
  /** Omit when a visible text label already names this. */
  label?: string
}) {
  return (
    <Icon
      size={size}
      strokeWidth={1.5}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`${TONE[tone]} ${GLOW[glow]}`}
    />
  )
}
```

`strokeWidth={1.5}` is the single most important line. Lucide ships 2 by default, and 2 reads
chunky and app-like rather than holographic. It is never overridden per call — something that needs
to look heavier gets a larger `size`.

Icons to use: Dumbbell (STR), HeartPulse (VIT), Footprints (AGI), Brain (INT), Radar (PER), Plus
(HP), FlaskConical (MP), Flame (streak), Trophy, Swords, AlertCircle.

### `SystemMeter` — outline plus lit core

The piece that carries the look. A flat gradient reads as *coloured*; an outline with a brighter
centre line reads as *emitting*, and that difference is most of the aesthetic.

```tsx
<div className="relative h-2.5 overflow-hidden rounded-full bg-void-soft ring-1 ring-panel-edge ring-inset">
  <div
    className="absolute inset-y-0 left-0 rounded-full shadow-[var(--shadow-meter)]"
    style={{ width: `${clamped}%`, backgroundImage: fillFor(tone) }}
  />
</div>
```

The core is a vertical gradient, bright in the middle and falling off at both edges:

```ts
const fillFor = (tone: string) => `linear-gradient(
  to bottom,
  color-mix(in oklab, var(--color-${tone}) 60%, transparent) 0%,
  var(--color-system-glow) 46%,
  var(--color-system-glow) 54%,
  color-mix(in oklab, var(--color-${tone}) 60%, transparent) 100%
)`
```

Variants: `solid` (XP, HP), `split` (a second segment for derived vs allocated), `segmented` (the
fatigue dial). `ManaBar` and `StatBar` keep their exact names and props and become thin wrappers,
so nothing calling them changes and that commit is reviewable on its own.

### `SegmentedRing` — the fatigue dial

Twelve arcs on a circle, `stroke-dasharray` per segment, rotated `-90deg` so it starts at twelve
o'clock. Lit segments take `--color-system` with the meter glow, unlit take `--color-panel-edge`,
and the tone shifts to warn and danger across the fatigue bands that already exist. Driven by
`projection.fatigue.gauge`, which is already computed 0-100 — no domain work.

### `StatRow` and the frame

Two-column grid: icon, label, value. The value is a size pair rather than a slash at one size — a
large bright current against a smaller, dimmer max.

The sharp frame is a `sharp` variant on `SystemWindow`, not a new component: `rounded-none` plus
`--shadow-system-faint`. The current rounding is most of what makes it read as an app rather than
a System.

### The ground texture, last

Faint diagonal scratches over the vignette the body already has:

```css
repeating-linear-gradient(115deg, transparent 0 22px, rgb(125 211 252 / 0.012) 22px 23px)
```

Keep the alpha near-invisible. At 0.02 it reads as a dirty screen; at 0.012 it reads as texture.

## 7. The notification queue

Two defects first, both visible in a real screenshot and neither cosmetic.

**`bg-panel/95` lets content bleed through.** A gate-screen capture showed the rest-day paragraph
legible *through* a notification sitting on top of it. Two texts in the same pixels means neither
reads. The reference is fully opaque over a scrim for exactly this reason.

**Every message renders at once.** `finishGate` can queue a gate clear, one message per PR, one per
extracted shadow and one per title — five or more windows stacked over each other and over the app.
Two already overlap; five would bury the screen.

### Two tiers

A modal after every logged set would be miserable mid-workout, and a toast for ARISE wastes the best
moment in the app. So `SystemMessage` gains one field:

```ts
kind?: 'toast' | 'window'   // default 'toast'
```

- **Toast** — transient, non-blocking, auto-dismissing after ~6s, stacked but capped at three.
  Daily quest arrived, rest token spent.
- **Window** — the reference. Opaque, scrimmed, **one at a time**, dismissed deliberately. Gate
  cleared, title acquired, shadow extracted, level up. `finishGate`'s call sites opt in.

No other domain change: `title` is already the bracketed payload and `body` already the
explanation, which is exactly the reference's hierarchy.

`MessageQueue` becomes a router — toasts stacked and capped, and `windows[0]` alone. Showing one
window at a time is both the fix for the overlap and the right feel: the System never talks over
itself.

### The window itself

The header is two separate bordered boxes — an icon square and a letterspaced title box — pulled up
with a negative margin so they straddle the top border. That overlap *is* the notch in the
reference; the border is never actually cut.

```tsx
<div className="fixed inset-0 z-50 grid place-items-center bg-void/80 p-6">
  <section role="alertdialog" aria-modal="true" aria-labelledby={id}
           className="animate-system-in system-frame relative w-full max-w-md bg-panel px-6 py-8 text-center">
    <div className="-mt-12 mb-8 flex items-center justify-center gap-3">
      <span className="grid size-11 place-items-center border border-ink/70 bg-panel">
        <SystemIcon icon={AlertCircle} tone="ink" size={22} glow="strong" />
      </span>
      <span className="border border-ink/70 bg-panel px-6 py-2 font-system text-sm tracking-[0.35em] text-ink uppercase">
        Notification
      </span>
    </div>
    <p id={id} className="text-lg font-semibold text-ink italic">{message.title}</p>
    {message.body ? <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">{message.body}</p> : null}
  </section>
</div>
```

### The broken frame

The reference's border is hairline **near-white**, with the cyan arriving as glow rather than as
border colour. Getting that backwards is what makes HUD styling look cheap. Corner brackets on two
opposite corners approximate the cut-ins; four starts to look like a crosshair.

```css
.system-frame {
  border: 1px solid rgb(219 234 254 / 0.55);
  box-shadow: var(--shadow-system), inset 0 0 40px -20px var(--color-system);
}
.system-frame::before, .system-frame::after {
  content: ''; position: absolute; width: 18px; height: 18px;
  border: 2px solid var(--color-system-glow);
  filter: drop-shadow(0 0 4px var(--color-system));
}
.system-frame::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.system-frame::after { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }
```

## 8. Tokens to add

Only what has a caller (rule 16):

```css
--shadow-system-faint: 0 0 0 1px rgb(56 189 248 / 0.18), 0 0 12px -6px rgb(56 189 248 / 0.30);
--shadow-meter:        0 0 8px -1px rgb(56 189 248 / 0.55);
--drop-icon:           drop-shadow(0 0 3px currentColor);
--drop-icon-strong:    drop-shadow(0 0 6px currentColor);
```

`--shadow-system` and `--shadow-system-strong` stay unchanged. The rule is faint by default, strong
only on the window that is speaking.

`--color-mana` (purple) already exists and marks allocated stat points. The reference's MP bar is
blue, but repurposing the token would destroy the derived-vs-allocated distinction, which carries
real information. Keep them separate.

## 9. Rules this has to be built under

1. **Never animate `filter` or `box-shadow`.** Animate `opacity` or `transform` on a pre-composited
   layer. This is the most likely source of jank.
2. **`box-shadow` on static elements; `drop-shadow` only on icons**, where the area is small.
3. **No `backdrop-filter` on the notification scrim.** A full-screen blur is one of the most
   expensive things a mid-range Android can be asked for, and a flat `bg-void/80` separates just as
   well for free.
4. **Icons are decorative.** `aria-hidden` whenever visible text already names the thing, or every
   stat gets announced twice.
5. **The modal needs Escape and focus management** — focus to the dismiss control on open, returned
   on close. `role="alertdialog"` announces itself, so toasts keep `role="status"` and the window
   does not, or screen readers read it twice.
6. **Measure on the phone.** This is the one item reasoning cannot settle.

## 10. Sequence

1. **Fix the contrast ramp.** Independent, and everything else is tuned against it.
2. **Fix the notification bugs** — opaque background, cap the stack, auto-dismiss toasts. Ships
   alone as a bug fix, before any restyling.
3. **`SystemMeter`**, with `ManaBar` and `StatBar` rewritten over it. No visual change beyond the
   new construction, so it reviews on its own.
4. **`lucide-react` plus `SystemIcon`**, with the bundle delta measured and written down.
5. **The notification window tier** and the frame CSS, which depend on `SystemIcon`.
6. **The three custom marks** — fatigue ring, rank badge, gate diamond.
7. **`StatRow` and the status window layout.**
8. **The ground texture and the glow pass**, last, measured on the phone.

## 11. Verification

- `--color-ink-faint` on `--color-panel` measures at least 4.5:1.
- No notification is translucent over live content, and no more than three toasts render at once.
- Exactly one notification window shows at a time, and `finishGate` queuing five messages never
  covers the screen.
- `ManaBar` and `StatBar` render identically to before the `SystemMeter` rewrite, by their existing
  callers, with no prop changes.
- The bundle delta from `lucide-react` is measured and recorded, and judged against M4 commit 3's
  budget rather than the invented 200 KB.
- The notification window traps focus, dismisses on Escape, and returns focus on close.
- Every route still mounts (rule 14), including the status window and a window-tier notification.
- Scrolling the status window holds 60fps on the actual phone with all glow enabled.
- With `prefers-reduced-motion`, nothing animates; with the glow reduction, every value stays
  readable.
