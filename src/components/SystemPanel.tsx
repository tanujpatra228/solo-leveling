/**
 * A section inside a `SystemWindow`. Deliberately not a card: it carries no
 * background or shadow of its own, just a hairline edge, so nesting these
 * inside a window does not stack up glow that belongs to the outer panel.
 *
 * `boxed` swaps the top rule for a full hairline border (m10-plan commit 9,
 * §1.0 correction 6) — the vitals strip and the stat grid read as boxes
 * inside the outer frame in the reference, not another divider in a list.
 */
import type { PropsWithChildren } from 'react'

export function SystemPanel({
  children,
  className = '',
  boxed = false,
}: PropsWithChildren<{ className?: string; boxed?: boolean }>) {
  return (
    <div
      className={
        boxed
          ? `border border-panel-edge/60 ${className}`
          : `border-t border-panel-edge/70 pt-3 first:border-t-0 first:pt-0 ${className}`
      }
    >
      {children}
    </div>
  )
}
