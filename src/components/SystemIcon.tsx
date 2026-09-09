/**
 * The one place that knows about the icon library. Every icon in the app goes
 * through this wrapper, which is what makes swapping the library later a
 * one-file change (see docs/system-visuals-plan.md §3).
 *
 * `strokeWidth={2.5}` is never overridden per call. The reference frame
 * (m10-plan section 1.0, correction 3) draws thick strokes and solid fills —
 * the earlier 1.5px reading "holographic" was a guess this app made before
 * anyone had compared it directly against the show. Something that needs to
 * look heavier gets a larger `size` or `solid`, not a thicker stroke.
 */
import type { LucideIcon } from 'lucide-react'

const TONE: Record<string, string> = {
  system: 'text-system',
  ink: 'text-ink',
  good: 'text-good',
  warn: 'text-warn',
  danger: 'text-danger',
  mana: 'text-mana',
  faint: 'text-ink-faint',
}

const GLOW: Record<'none' | 'faint' | 'strong', string | undefined> = {
  none: undefined,
  faint: 'var(--drop-icon)',
  strong: 'var(--drop-icon-strong)',
}

export interface SystemIconProps {
  icon: LucideIcon
  tone?: keyof typeof TONE
  size?: number
  glow?: 'none' | 'faint' | 'strong'
  /** Filled rather than outlined — the chunky-mark reading the reference draws. */
  solid?: boolean
  /** Omit when a visible text label already names this icon. */
  label?: string
}

export function SystemIcon({
  icon: Icon,
  tone = 'system',
  size = 20,
  glow = 'faint',
  solid = false,
  label,
}: SystemIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={2.5}
      fill={solid ? 'currentColor' : 'none'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={TONE[tone]}
      style={{ filter: GLOW[glow] }}
    />
  )
}
