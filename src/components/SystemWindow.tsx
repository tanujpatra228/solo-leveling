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
  return (
    <section
      className={`animate-system-in rounded-none border border-panel-edge bg-panel/90 p-4 ${
        strong ? 'shadow-system-strong' : 'shadow-system-faint'
      }`}
      style={index !== undefined ? { animationDelay: `${Math.min(index, 6) * 40}ms` } : undefined}
    >
      <h2 className="font-system text-xs tracking-wide text-system uppercase">[{title}]</h2>
      <div className="mt-3 text-ink">{children}</div>
      {footer ? <div className="mt-3 border-t border-panel-edge pt-3">{footer}</div> : null}
    </section>
  )
}
