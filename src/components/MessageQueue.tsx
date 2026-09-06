/**
 * Renders `state.messages` as two tiers (docs/system-visuals-plan.md §7).
 * Toasts are transient, non-blocking, stack but cap at three, and
 * auto-dismiss so a burst of them never buries the screen. Windows are the
 * reference look — opaque over a scrim, one at a time, dismissed
 * deliberately — because a modal after every logged set would be miserable
 * mid-workout, and a toast for ARISE would waste the best moment in the app.
 *
 * A chime and a haptic buzz fire once per message id, gated on the settings
 * the hunter controls — never on every render, and never for a message that
 * was already here on mount.
 */
import { useEffect, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { useApp, type SystemMessage } from '../app/state'
import { playSystemChime, vibrate } from '../platform/capabilities'
import { SystemIcon } from './SystemIcon'

const TONE_BORDER: Record<SystemMessage['tone'], string> = {
  system: 'border-panel-edge',
  good: 'border-good/60',
  warn: 'border-warn/60',
  danger: 'border-danger/60',
}

const TOAST_LIFETIME_MS = 6000
const MAX_TOASTS = 3

export function MessageQueue() {
  const messages = useApp((s) => s.messages)
  const dismissMessage = useApp((s) => s.dismissMessage)
  const soundEnabled = useApp((s) => s.settings.soundEnabled)
  const hapticsEnabled = useApp((s) => s.settings.hapticsEnabled)
  const announced = useRef(new Set<string>())

  useEffect(() => {
    for (const message of messages) {
      if (announced.current.has(message.id)) continue
      announced.current.add(message.id)
      if (soundEnabled) playSystemChime()
      if (hapticsEnabled) vibrate(40)
    }
  }, [messages, soundEnabled, hapticsEnabled])

  // Most-recent-three rather than first-three: an older toast that has not
  // dismissed itself yet should not block a newer one from being seen.
  const toasts = messages.filter((m) => (m.kind ?? 'toast') === 'toast').slice(-MAX_TOASTS)
  // Windows show one at a time — the System never talks over itself — so a
  // `finishGate` that queues five never covers the screen.
  const windowMessage = messages.find((m) => m.kind === 'window') ?? null

  return (
    <>
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col gap-2 p-3">
          {toasts.map((message) => (
            <Toast key={message.id} message={message} onDismiss={() => dismissMessage(message.id)} />
          ))}
        </div>
      ) : null}
      {windowMessage ? (
        <SystemMessageWindow message={windowMessage} onDismiss={() => dismissMessage(windowMessage.id)} />
      ) : null}
    </>
  )
}

function Toast({ message, onDismiss }: { message: SystemMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_LIFETIME_MS)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role="status"
      className={`animate-system-in shadow-system-faint pointer-events-auto border bg-panel p-3 ${TONE_BORDER[message.tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-system text-xs text-system">{message.title}</p>
          {message.body ? <p className="mt-1 text-sm text-ink-soft">{message.body}</p> : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="font-system text-xs text-ink-faint"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function SystemMessageWindow({ message, onDismiss }: { message: SystemMessage; onDismiss: () => void }) {
  const titleId = `system-window-title-${message.id}`
  const dismissRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  // Focus the dismiss control on open, return focus to whatever had it on
  // close (rule 5, docs/system-visuals-plan.md §9) — a window that traps
  // focus without giving it back strands a keyboard or screen-reader user.
  useEffect(() => {
    returnFocusRef.current = document.activeElement
    dismissRef.current?.focus()
    return () => {
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    // Flat bg-void/80, not backdrop-filter — a full-screen blur is one of the
    // most expensive things a mid-range Android can be asked for, and this
    // separates just as well for free (rule 3).
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/80 p-6">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-system-in system-frame relative w-full max-w-md bg-panel px-6 py-8 text-center"
      >
        <div className="-mt-12 mb-8 flex items-center justify-center gap-3">
          <span className="grid size-11 place-items-center border border-ink/70 bg-panel">
            <SystemIcon icon={AlertCircle} tone={message.tone} size={22} glow="strong" />
          </span>
          <span className="border border-ink/70 bg-panel px-6 py-2 font-system text-sm tracking-[0.35em] text-ink uppercase">
            Notification
          </span>
        </div>
        <p id={titleId} className="text-lg font-semibold text-ink italic">
          {message.title}
        </p>
        {message.body ? <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">{message.body}</p> : null}
        <button
          ref={dismissRef}
          type="button"
          onClick={onDismiss}
          className="mt-6 border border-ink-faint px-6 py-2 font-system text-xs tracking-[0.2em] text-ink uppercase"
        >
          Acknowledge
        </button>
      </section>
    </div>
  )
}
