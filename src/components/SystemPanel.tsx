/**
 * A section inside a `SystemWindow`. Deliberately not a card: it carries no
 * background or shadow of its own, just a hairline edge, so nesting these
 * inside a window does not stack up glow that belongs to the outer panel.
 */
import type { PropsWithChildren } from 'react'

export function SystemPanel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`border-t border-panel-edge/70 pt-3 first:border-t-0 first:pt-0 ${className}`}>
      {children}
    </div>
  )
}
