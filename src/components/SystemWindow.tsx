/**
 * The holographic panel. Every screen in the app is built from these, so
 * getting the one shared entrance and glow right here means nothing else has
 * to reinvent it.
 *
 * The entrance is a pure CSS animation (`--animate-system-in`, defined in
 * index.css) rather than anything JavaScript-driven, specifically so the
 * global `prefers-reduced-motion` rule already in index.css handles it for
 * free. That is not true of the Double Dungeon sequence, which branches in
 * JavaScript instead — see its own component for why.
 */
import type { PropsWithChildren, ReactNode } from 'react'
import { useFrameTier } from '../app/frameTierContext'

export interface SystemWindowProps {
  title: string
  /**
   * Reserve the strong glow for the one window that is speaking. Spending
   * `--shadow-system-strong` on every panel flattens the hierarchy into noise
   * — every other window gets the faint tier instead of none at all.
   */
  strong?: boolean
  footer?: ReactNode
  /**
   * Position in a stack of windows drawing in together (F13, m10-plan
   * commit 7) — several fading in with a staggered delay reads as the
   * System writing them in sequence; all at once reads as a page loading.
   * Capped so a long list does not end with a visibly stalled last window.
   */
  index?: number
}

/** Tier 1 keeps today's plain hairline; 2-4 layer `.system-frame` and its brightened variants (§1.7). */
const TIER_FRAME_CLASS: Record<number, string> = {
  1: 'border border-panel-edge',
  2: 'system-frame',
  3: 'system-frame system-frame-bright',
  4: 'system-frame system-frame-bright system-frame-mana',
}

/**
 * Square corners, no exceptions. One rounded window next to a sharp one is
 * two design systems, not a style choice per screen — the rounding reads as
 * "app"; sharp reads as "System" (docs/system-visuals-plan.md §6).
 */
export function SystemWindow({
  title,
  strong = false,
  footer,
  index,
  children,
}: PropsWithChildren<SystemWindowProps>) {
  const tier = useFrameTier()

  return (
    <section
      className={`animate-system-in relative rounded-none bg-panel/90 px-4 pb-4 pt-5 ${TIER_FRAME_CLASS[tier]} ${
        strong ? 'shadow-system-strong' : 'shadow-system-faint'
      }`}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 6) * 40}ms` } : undefined}
    >
      {/* The title box straddles the top border (§1.0 correction 6) rather
          than sitting inside it — the notch the reference draws, without
          fragile negative-margin arithmetic against the footer/shadow below. */}
      <h2 className="absolute -top-3 left-1/2 -translate-x-1/2 border border-ink/70 bg-panel px-3 py-1 font-system text-[11px] tracking-[0.2em] text-ink uppercase">
        [{title}]
      </h2>
      <div className="text-ink">{children}</div>
      {footer ? <div className="mt-3 border-t border-panel-edge pt-3">{footer}</div> : null}
    </section>
  )
}
