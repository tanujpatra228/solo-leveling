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
   * `--shadow-system-strong` on every panel flattens the hierarchy into noise.
   */
  strong?: boolean
  /**
   * Squared corners and a faint glow rather than rounded-lg. The rounding
   * elsewhere reads as "app"; sharp reads as "System"
   * (docs/system-visuals-plan.md §6).
   */
  sharp?: boolean
  footer?: ReactNode
}

export function SystemWindow({
  title,
  strong = false,
  sharp = false,
  footer,
  children,
}: PropsWithChildren<SystemWindowProps>) {
  return (
    <section
      className={`animate-system-in border border-panel-edge bg-panel/90 p-4 ${sharp ? 'rounded-none' : 'rounded-lg'} ${
        strong ? 'shadow-system-strong' : sharp ? 'shadow-system-faint' : 'shadow-system'
      }`}
    >
      <h2 className="font-system text-xs tracking-wide text-system uppercase">[{title}]</h2>
      <div className="mt-3 text-ink">{children}</div>
      {footer ? <div className="mt-3 border-t border-panel-edge pt-3">{footer}</div> : null}
    </section>
  )
}
