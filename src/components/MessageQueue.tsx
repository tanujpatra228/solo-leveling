/**
 * Renders `state.messages` in the order the events happened, each dismissible.
 * A chime and a haptic buzz fire once per message id, gated on the settings
 * the hunter controls — never on every render, and never for a message that
 * was already here on mount.
 */
import { useEffect, useRef } from 'react'
import { useApp, type SystemMessage } from '../app/state'
import { playSystemChime, vibrate } from '../platform/capabilities'

const TONE_STYLES: Record<SystemMessage['tone'], string> = {
  system: 'border-panel-edge',
  good: 'border-good/60',
  warn: 'border-warn/60',
  danger: 'border-danger/60',
}

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

  if (messages.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col gap-2 p-3">
      {messages.map((message) => (
        <div
          key={message.id}
          role="status"
          className={`animate-system-in pointer-events-auto rounded-lg border bg-panel/95 p-3 shadow-system ${TONE_STYLES[message.tone]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-system text-xs text-system">{message.title}</p>
              {message.body ? <p className="mt-1 text-sm text-ink-soft">{message.body}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismissMessage(message.id)}
              aria-label="Dismiss"
              className="font-system text-xs text-ink-faint"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
