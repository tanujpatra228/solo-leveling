/**
 * Keeps the screen on for the whole of a live session, not only while a rest
 * timer is running (m10-plan commit 0 / F18: `keepScreenAwake` was stored,
 * defaulted true, and read nowhere). Mounted once in root.tsx so it holds
 * across a route change — checking the Daily Quest on Status mid-session
 * must not let the screen sleep.
 */
import { useEffect, useRef } from 'react'
import { createWakeLock } from '../platform/capabilities'
import { useApp } from './state'

export function useSessionWakeLock(): void {
  const activeSessionId = useApp((s) => s.activeSessionId)
  const keepScreenAwake = useApp((s) => s.settings.keepScreenAwake)
  const wakeLock = useRef(createWakeLock())
  const shouldHold = activeSessionId !== null && keepScreenAwake

  useEffect(() => {
    if (!shouldHold) {
      void wakeLock.current.release()
      return
    }

    // Mirrors useRestTimer.ts: the lock releases itself when the page hides
    // and does not re-acquire on its own — ask again on every foreground.
    const reacquire = () => {
      if (document.visibilityState === 'visible') void wakeLock.current.acquire()
    }
    reacquire()
    document.addEventListener('visibilitychange', reacquire)
    return () => document.removeEventListener('visibilitychange', reacquire)
  }, [shouldHold])

  useEffect(() => {
    return () => void wakeLock.current.release()
  }, [])
}
