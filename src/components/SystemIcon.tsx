/**
 * The one place that knows about the icon library. Every icon in the app goes
 * through this wrapper, which is what makes swapping the library later a
 * one-file change (see docs/system-visuals-plan.md §3).
 *
 * `strokeWidth={1.5}` is never overridden per call — lucide ships 2 by
 * default, and 2 reads chunky and app-like rather than holographic. Something
 * that needs to look heavier gets a larger `size`, not a thicker stroke.
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
  /** Omit when a visible text label already names this icon. */
  label?: string
}

export function SystemIcon({ icon: Icon, tone = 'system', size = 20, glow = 'faint', label }: SystemIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={1.5}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={TONE[tone]}
      style={{ filter: GLOW[glow] }}
    />
  )
}
