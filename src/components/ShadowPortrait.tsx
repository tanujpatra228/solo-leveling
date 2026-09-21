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
    return (
      <img
        src={art}
        alt={name}
        loading="lazy"
        className={`${size === 'lg' ? 'max-h-48 max-w-[80%]' : 'max-h-[96%] max-w-[92%]'} object-contain ${muted ? 'grayscale' : ''}`}
        style={size === 'lg' && !muted ? { filter: `drop-shadow(0 0 18px ${RANK_GLOW[rank]})` } : undefined}
      />
    )
  }

  const tone = RANK_TONE[rank]
  const emblemSize = size === 'lg' ? 'size-24 text-3xl' : 'size-14 text-lg'
  return <div className={`grid place-items-center rounded-full border-2 font-system font-bold ${tone} ${emblemSize}`}>{name.charAt(0)}</div>
}
