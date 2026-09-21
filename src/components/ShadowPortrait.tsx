/**
 * A shadow's art, or a rank-tinted initial emblem when no portrait is on
 * file yet (`shadowArt.ts`) — the one place this fallback is drawn, shared
 * between the roster card (`ShadowsPanel`) and the ARISE reveal
 * (`MessageQueue`) so the two can never draw it differently.
 */
import type { Rank } from '../domain/types'
import { SHADOW_ART } from './shadowArt'

export const RANK_TONE: Record<Rank, string> = {
  E: 'border-ink-faint text-ink-faint',
  D: 'border-good text-good',
  C: 'border-system text-system',
  B: 'border-system-glow text-system-glow',
  A: 'border-warn text-warn',
  S: 'border-gold text-gold',
}

/**
 * Full-strength on every card in a 2x2 grid at once reads as too loud — this
 * is the card's own outer edge at half that. Written out per rank rather
 * than derived from RANK_TONE at runtime (`RANK_TONE[rank].split(' ')[0] +
 * '/50'`): Tailwind's build only generates CSS for class names it can find
 * as literal text while scanning source files, so a class name assembled by
 * string concatenation at runtime is invisible to it and silently emits no
 * rule at all — found on a real device as a plain white border, `currentColor`
 * filling in for the color utility that never got generated.
 */
export const RANK_CARD_BORDER: Record<Rank, string> = {
  E: 'border-ink-faint/50',
  D: 'border-good/50',
  C: 'border-system/50',
  B: 'border-system-glow/50',
  A: 'border-warn/50',
  S: 'border-gold/50',
}

const RANK_GLOW: Record<Rank, string> = {
  E: 'var(--color-ink-faint)',
  D: 'var(--color-good)',
  C: 'var(--color-system)',
  B: 'var(--color-system-glow)',
  A: 'var(--color-warn)',
  S: 'var(--color-gold)',
}

export function ShadowPortrait({
  name,
  rank,
  size = 'sm',
  muted = false,
}: {
  name: string
  rank: Rank
  /** `sm` fits a roster card's art frame; `lg` is the ARISE reveal's larger, glowing moment. */
  size?: 'sm' | 'lg'
  /** Benched: desaturated, same treatment the card's own dimming applies to everything else in it. */
  muted?: boolean
}) {
  const art = SHADOW_ART[name]

  if (art) {
    // `sm` (the roster card) fills its frame edge to edge — object-cover,
    // cropping rather than letterboxing, since the front face is the whole
    // card now and a margin around the art there just reads as wasted
    // space. `lg` (the ARISE reveal) stays object-contain: a full-body
    // reveal shot is the point there, and cropping it would cut the
    // character off.
    const sizing = size === 'lg' ? 'max-h-48 max-w-[80%] object-contain' : 'absolute inset-0 size-full object-cover'
    return (
      <img
        src={art}
        alt={name}
        loading="lazy"
        className={`${sizing} ${muted ? 'grayscale' : ''}`}
        style={size === 'lg' && !muted ? { filter: `drop-shadow(0 0 18px ${RANK_GLOW[rank]})` } : undefined}
      />
    )
  }

  const tone = RANK_TONE[rank]
  const emblemSize = size === 'lg' ? 'size-24 text-3xl' : 'size-14 text-lg'
  return <div className={`grid place-items-center rounded-full border-2 font-system font-bold ${tone} ${emblemSize}`}>{name.charAt(0)}</div>
}
