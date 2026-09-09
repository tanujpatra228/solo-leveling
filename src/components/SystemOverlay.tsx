/**
 * The System's window, drawn over the scene (m10-plan section 1.3): a flat
 * `bg-void/80` scrim (no `backdrop-filter` — the most expensive thing a
 * mid-range Android can be asked for, section 9.3) behind a `.system-frame`
 * box. Extracted out of `MessageQueue`'s notification window (m10-plan
 * commit 3) so a summoned archive panel and a System notification are
 * provably the same construction, not two that can drift apart.
 *
 * Exit 1 (hardware/gesture back) is the caller's job — it comes for free
 * once the caller's own visibility is driven by a router search param or
 * similar, per F14. This component only owns exits 2 and 3: the `[ X ]`
 * close control and a scrim tap, plus Escape for a keyboard/desktop user.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { SystemIcon, type SystemIconProps } from './SystemIcon'

export interface SystemOverlayProps {
  /** A short chrome label — "Notification", "Runes" — not the content's own heading. */
  title: string
  icon: LucideIcon
  iconTone?: SystemIconProps['tone']
  onClose: () => void
  children: ReactNode
}

export function SystemOverlay({ title, icon, iconTone = 'system', onClose, children }: SystemOverlayProps) {
  const titleId = useRef(`system-overlay-title-${Math.random().toString(36).slice(2)}`).current
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  // Focus the close control on open, return focus to whatever had it on
  // close (docs/system-visuals-plan.md §9.5) — a window that traps focus
  // without giving it back strands a keyboard or screen-reader user.
  // `preventScroll` on both: this overlay is `fixed inset-0` and already
  // covers the viewport, but focusing an element inside it still made the
  // page underneath jump to the top on a real Android device — the default
  // scroll-into-view behaviour finding nothing to gain from the fixed
  // element and scrolling the document instead.
  useEffect(() => {
    returnFocusRef.current = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-void/80 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="system-frame animate-system-in relative flex max-h-[85dvh] w-full max-w-md flex-col bg-panel"
      >
        {/* Fixed while the body scrolls (m10-plan §4a) — a tall roster must
            never push the close control off screen. */}
        <div className="flex shrink-0 items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center border border-ink/70 bg-panel">
              <SystemIcon icon={icon} tone={iconTone} size={18} glow="strong" />
            </span>
            <span
              id={titleId}
              className="truncate border border-ink/70 bg-panel px-4 py-2 font-system text-xs tracking-[0.3em] text-ink uppercase"
            >
              {title}
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid min-h-11 min-w-11 shrink-0 place-items-center border border-ink-faint"
          >
            <SystemIcon icon={X} tone="ink" size={16} glow="none" label="Close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </section>
    </div>
  )
}
