/**
 * The shadow roster: the INT-derived cap made legible (m7-plan finding F2),
 * so a shadow going dormant when the cap falls reads as an explained
 * mechanic, never a bug. Extraction and cap resolution both happen in the
 * projection (`resolveRoster`); this only lets the hunter choose who stays
 * active when requested shadows exceed the cap, rather than picking for
 * them (m7-plan commit 5).
 *
 * Active capacity renders as a card carousel, four slots (2x2) per page,
 * paged out to the next multiple of four above the current cap — a slot
 * past the cap reads as locked, with the INT it still needs, rather than
 * capacity simply not existing yet. Benched shadows (dormant or returned)
 * sit in their own list below: they never occupy a paginated slot, since
 * that would conflate "not enough mana" with "chose not to."
 */
import { useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Plus, RotateCw } from 'lucide-react'
import { intRequiredForSlot } from '../domain/stats'
import type { RosterState } from '../domain/shadows'
import type { Exercise, Shadow } from '../domain/types'
import { HelpButton } from './HelpButton'
import { RANK_TONE, ShadowPortrait } from './ShadowPortrait'
import { SystemPanel } from './SystemPanel'
import { SystemValue } from './SystemValue'

const SLOTS_PER_PAGE = 4

function exerciseName(exercises: readonly Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? id
}

/**
 * One roster slot's state: an active shadow, capacity the hunter has but
 * hasn't filled, or capacity still past the INT cap. `requiredInt` on a
 * locked slot is `intRequiredForSlot`'s answer for that slot's own index —
 * the card states its own requirement rather than the caller re-deriving it.
 */
export type RosterSlot =
  | { kind: 'filled'; shadow: Shadow }
  | { kind: 'empty' }
  | { kind: 'locked'; requiredInt: number }

/**
 * The full paginated slot list: `roster.active` fills slots first, capacity
 * up to `roster.cap` with nothing in it reads as `empty`, and everything
 * past the cap reads as `locked` up to the next page boundary. An empty
 * roster still gets `SLOTS_PER_PAGE` slots (page one is never zero-length).
 */
export function buildRosterSlots(roster: RosterState): RosterSlot[] {
  const totalSlots = Math.max(SLOTS_PER_PAGE, Math.ceil(roster.cap / SLOTS_PER_PAGE) * SLOTS_PER_PAGE)
  const slots: RosterSlot[] = []
  for (let index = 0; index < totalSlots; index += 1) {
    const shadow = roster.active[index]
    if (shadow) {
      slots.push({ kind: 'filled', shadow })
    } else if (index < roster.cap) {
      slots.push({ kind: 'empty' })
    } else {
      slots.push({ kind: 'locked', requiredInt: intRequiredForSlot(index) })
    }
  }
  return slots
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

// Both faces need the vendor-prefixed property alongside the standard one —
// iOS Safari (including the in-app WebView this PWA runs in) still ignores
// unprefixed backface-visibility/transform-style on some versions, and a
// missing prefix there shows both faces superimposed instead of flipping.
//
// Deliberately no `overflow-hidden` here (found on a real device: the back
// face flipped to but rendered with none of its content visible — name,
// exercise, buff and the Return/Summon button all gone, not just clipped).
// `overflow: hidden` on the same element as `backface-visibility: hidden`
// is a known breaker of the 3D compositing context on mobile WebKit/Blink:
// it can make the browser flatten the transform, at which point its own
// face-culling logic gets confused about which face is "front" and hides
// both. Neither face needs it anyway — the portrait is already bounded by
// `object-contain`, and the back's text just flows inside the card.
const FACE = '[backface-visibility:hidden] [-webkit-backface-visibility:hidden] absolute inset-0'

/**
 * The card's front is the portrait alone — name, exercise and buff live on
 * the back, reached by tapping the card. A 3D flip rather than a swap:
 * mid-turn the card visibly has two sides, which is what sells it as a
 * card rather than a toggle.
 */
function ShadowCard({
  shadow,
  exercises,
  actionLabel,
  onAction,
  benched = false,
}: {
  shadow: Shadow
  exercises: readonly Exercise[]
  actionLabel: string
  onAction: () => void
  benched?: boolean
}) {
  const tone = RANK_TONE[shadow.rank]
  // Full-strength on every card at once read as too loud — halved just for
  // the card's own outer edge; the rank chip and marshal tag stay
  // full-strength, since those are small and meant to be read, not felt.
  const cardBorder = `${tone.split(' ')[0]}/50`
  const [flipped, setFlipped] = useState(false)
  const labelId = useId()

  function toggleFlip() {
    setFlipped((f) => !f)
  }

  return (
    // Benched dimming lives here, outside the perspective/transform context,
    // not on the flipping element itself — found on a real device: a
    // benched card's back face rendered blank (no Summon button) exactly
    // like the overflow-hidden bug above, because `opacity` on an element
    // that also carries a 3D transform forces its own compositing layer,
    // which breaks backface-visibility the same way. This way the flip
    // fully resolves in its own layer first, and only the finished result
    // gets dimmed.
    <div className={`[-webkit-perspective:800px] [perspective:800px] ${benched ? 'opacity-55' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-labelledby={labelId}
        onClick={toggleFlip}
        onKeyDown={(e) => {
          // The nested Return/Summon button turns its own Enter/Space into a
          // click that stops there (see its handler below), but the keydown
          // itself still bubbles here first — without this guard, focusing
          // that button and pressing Enter would flip the card *and* fire
          // the action.
          if (e.target !== e.currentTarget) return
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          toggleFlip()
        }}
        className={`relative aspect-[3/4] cursor-pointer [-webkit-transform-style:preserve-3d] [transform-style:preserve-3d] transition-transform duration-500 ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        <span id={labelId} className="sr-only">
          {shadow.name}, {shadow.rank} rank{shadow.isMarshal ? ', marshal' : ''}. Tap to {flipped ? 'show portrait' : 'show details'}.
        </span>

        {/* Front: portrait only, plus a faint corner glyph — with nothing
            else on this face, there is no other cue that it is tappable. */}
        <div className={`flex items-end justify-center border bg-panel ${cardBorder} ${FACE}`}>
          <RotateCw size={12} strokeWidth={1.75} className="absolute top-1.5 right-1.5 text-ink-faint/70" />
          <ShadowPortrait name={shadow.name} rank={shadow.rank} muted={benched} />
        </div>

        {/* Back: everything else, pre-rotated so it lands right-reading once flipped. */}
        <div className={`flex flex-col border bg-void-soft p-2 [transform:rotateY(180deg)] ${cardBorder} ${FACE}`}>
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-semibold text-ink">{shadow.name}</p>
            <span className={`shrink-0 border bg-void/70 px-1.5 py-0.5 font-system text-[9px] tracking-[0.06em] uppercase ${tone}`}>
              {shadow.rank}
            </span>
          </div>
          {shadow.isMarshal ? <p className="font-system text-[8px] tracking-[0.08em] text-gold uppercase">Marshal</p> : null}
          <p className="mt-0.5 font-system text-[8px] tracking-[0.05em] text-ink-faint uppercase">
            {exerciseName(exercises, shadow.exerciseId)}
          </p>
          <p className="mt-0.5 flex-1 text-[10px] text-ink-soft">{shadow.buff}</p>
          <div className="mt-1 border-t border-panel-edge pt-1 text-right">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAction()
              }}
              className="min-h-7 font-system text-[9px] tracking-[0.08em] text-ink-faint uppercase underline"
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// A locked/empty slot, an occupied card and a flipped card must all end up
// the exact same height, or a row stretches to its tallest member and
// leaves dead space under everything shorter in it (found on a real
// device). `aspect-[3/4]` on one shared outer box, the same way
// `ShadowCard`'s flip container carries it, is what actually guarantees
// that — two stacked boxes (an icon area plus an appended text area, the
// previous shape here) each get their own height and the sum is never
// pinned to anything.
function LockedSlot({ requiredInt, totalInt, slotNumber }: { requiredInt: number; totalInt: number; slotNumber: number }) {
  return (
    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-0.5 border border-dashed border-panel-edge p-2 text-center text-ink-faint">
      <Lock size={22} strokeWidth={1.6} />
      <p className="mt-1 font-system text-[10px] tracking-[0.1em] uppercase">Locked</p>
      <p className="font-system text-[8px] uppercase">Slot {slotNumber}</p>
      <p className="mt-0.5 font-body text-sm font-semibold text-ink tabular-nums">
        {totalInt}
        <span className="text-xs text-ink-faint">/{requiredInt}</span>
      </p>
      <p className="font-system text-[8px] tracking-[0.06em] uppercase">INT to unlock</p>
    </div>
  )
}

function EmptySlot() {
  return (
    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 border border-dashed border-system/40 text-center">
      <Plus size={22} strokeWidth={1.6} className="text-system-dim" />
      <p className="font-system text-[10px] tracking-[0.1em] text-system uppercase">Empty</p>
      <p className="text-[10px] text-ink-soft">Ready for a shadow</p>
    </div>
  )
}

/**
 * Four slots per page (`SLOTS_PER_PAGE`), swipe or arrow between pages. A
 * single page renders as a plain grid — no dots, no scroll container, for
 * the common case where the whole roster still fits one page.
 */
function SlotCarousel({
  slots,
  exercises,
  onToggle,
  totalInt,
}: {
  slots: readonly RosterSlot[]
  exercises: readonly Exercise[]
  onToggle: (id: string, active: boolean) => void
  totalInt: number
}) {
  const pages = chunk(slots, SLOTS_PER_PAGE)
  const trackRef = useRef<HTMLDivElement>(null)
  const [pageIndex, setPageIndex] = useState(0)

  function renderSlot(slot: RosterSlot, slotNumber: number) {
    if (slot.kind === 'filled') {
      return (
        <ShadowCard
          shadow={slot.shadow}
          exercises={exercises}
          actionLabel="Return"
          onAction={() => onToggle(slot.shadow.id, false)}
        />
      )
    }
    if (slot.kind === 'locked') {
      return <LockedSlot requiredInt={slot.requiredInt} totalInt={totalInt} slotNumber={slotNumber} />
    }
    return <EmptySlot />
  }

  if (pages.length <= 1) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot, i) => (
          <div key={i}>{renderSlot(slot, i + 1)}</div>
        ))}
      </div>
    )
  }

  function goTo(index: number) {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const clamped = Math.max(0, Math.min(pages.length - 1, index))
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' })
  }

  function onScroll() {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    setPageIndex(Math.round(track.scrollLeft / track.clientWidth))
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, pageIdx) => (
          <div key={pageIdx} className="grid w-full shrink-0 snap-start grid-cols-2 gap-2 px-px">
            {page.map((slot, i) => (
              <div key={i}>{renderSlot(slot, pageIdx * SLOTS_PER_PAGE + i + 1)}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goTo(pageIndex - 1)}
          disabled={pageIndex === 0}
          aria-label="Previous page"
          className="grid min-h-8 min-w-8 place-items-center border border-panel-edge text-ink-faint disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex gap-1.5">
          {pages.map((_, i) => (
            <span key={i} className={`size-1.5 rounded-full ${i === pageIndex ? 'bg-system-glow' : 'bg-panel-edge'}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(pageIndex + 1)}
          disabled={pageIndex === pages.length - 1}
          aria-label="Next page"
          className="grid min-h-8 min-w-8 place-items-center border border-panel-edge text-ink-faint disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export function ShadowsPanel({
  roster,
  exercises,
  totalInt,
  onToggle,
  onHelp,
}: {
  roster: RosterState
  exercises: readonly Exercise[]
  totalInt: number
  onToggle: (id: string, active: boolean) => void
  onHelp: () => void
}) {
  if (roster.active.length === 0 && roster.benched.length === 0) return null

  // Still requested (active: true) but bumped by the cap — distinct from a
  // shadow the hunter deliberately benched, which needs no explanation.
  const dormant = roster.benched.filter((s) => s.active)
  const dismissed = roster.benched.filter((s) => !s.active)
  const slots = buildRosterSlots(roster)

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">Shadow Army</p>
        <div className="flex items-center gap-1">
          <SystemValue value={roster.activeCount} max={roster.cap} size="md" />
          <HelpButton topicTitle="Shadow Army" onClick={onHelp} />
        </div>
      </div>
      <p className="text-xs text-ink-soft">{roster.message}</p>

      <SlotCarousel slots={slots} exercises={exercises} onToggle={onToggle} totalInt={totalInt} />

      {dormant.length > 0 ? (
        <div className="mt-1 flex flex-col gap-2 border-t border-ink-faint/20 pt-2">
          <p className="text-xs text-warn">
            Mana capacity is full. Return an active shadow to bring one of these in — the System
            never chooses for you.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {dormant.map((shadow) => (
              <ShadowCard
                key={shadow.id}
                shadow={shadow}
                exercises={exercises}
                actionLabel="Return"
                onAction={() => onToggle(shadow.id, false)}
                benched
              />
            ))}
          </div>
        </div>
      ) : null}

      {dismissed.length > 0 ? (
        <div className="mt-1 flex flex-col gap-2 border-t border-ink-faint/20 pt-2">
          <p className="text-xs text-ink-faint">Returned</p>
          <div className="grid grid-cols-2 gap-2">
            {dismissed.map((shadow) => (
              <ShadowCard
                key={shadow.id}
                shadow={shadow}
                exercises={exercises}
                actionLabel="Summon"
                onAction={() => onToggle(shadow.id, true)}
                benched
              />
            ))}
          </div>
        </div>
      ) : null}
    </SystemPanel>
  )
}
