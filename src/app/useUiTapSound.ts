/**
 * Game-style click feedback for the whole app: a soft tap tone plus a light
 * haptic buzz on every button and link, mounted once in root.tsx rather than
 * wired into every component's onClick. One delegated capture-phase listener
 * means coverage never drifts as screens are added — a new button gets the
 * sound for free, the same way a new `<a>` gets the browser's own :active
 * state for free.
 *
 * Deliberately skips inputs, textareas and selects — a tone per keystroke on
 * the weight/reps fields would be noise, not feedback — and skips disabled
 * controls, which is also why this checks the resolved control rather than
 * `event.target` directly.
 */
import { useEffect } from 'react'
import { playTapTone, vibrate } from '../platform/capabilities'
import { useApp } from './state'

const TAP_SELECTOR = 'button, a[href], [role="button"], [role="tab"]'

export function useUiTapSound() {
  const soundEnabled = useApp((s) => s.settings.soundEnabled)
  const hapticsEnabled = useApp((s) => s.settings.hapticsEnabled)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest(TAP_SELECTOR)
      if (!control) return
      if (control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return

      if (soundEnabled) playTapTone()
      if (hapticsEnabled) vibrate(10)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [soundEnabled, hapticsEnabled])
}
