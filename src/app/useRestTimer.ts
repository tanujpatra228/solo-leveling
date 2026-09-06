/**
 * The rest timer, wired to a screen. Everything that decides *what* to show
 * lives in `rest-timer.ts` and takes no ambient clock; this hook only
 * re-renders on a tick and on `visibilitychange`, and holds the Screen Wake
 * Lock for as long as a rest is running.
 *
 * State lives in `sessionStorage`, not the append-only log and not Dexie: a
 * rest period is transient interface state, not something that happened to
 * the hunter's training, and its entire useful life is a few minutes. A
 * reload in the same tab should not lose it; the tab closing should.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createWakeLock } from '../platform/capabilities'
import { playSystemChime, vibrate } from '../platform/capabilities'
import { elapsedPct, formatRemaining, isChimeDue, remainingSeconds } from './rest-timer'

const REST_KEY = 'solo-leveling:rest'

interface StoredRest {
  endsAt: number
  label: string
  totalSec: number
}

function readStoredRest(): StoredRest | null {
  try {
    const raw = sessionStorage.getItem(REST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredRest>
    if (
      typeof parsed.endsAt !== 'number' ||
      typeof parsed.label !== 'string' ||
      typeof parsed.totalSec !== 'number'
    ) {
      return null
    }
    return { endsAt: parsed.endsAt, label: parsed.label, totalSec: parsed.totalSec }
  } catch {
    return null
  }
}

function writeStoredRest(rest: StoredRest | null): void {
  try {
    if (rest) sessionStorage.setItem(REST_KEY, JSON.stringify(rest))
    else sessionStorage.removeItem(REST_KEY)
  } catch {
    // A locked-down sessionStorage just means the timer won't survive a
    // reload — not worth surfacing as an error.
  }
}

export interface RestTimerDisplay {
  label: string
  remaining: number
  display: string
  /** 0-100, feeds the countdown ring — 0 at the start, 100 when time's up. */
  pct: number
}

export interface RestTimer {
  state: RestTimerDisplay | null
  start: (seconds: number, label: string) => void
  clear: () => void
}

export function useRestTimer(): RestTimer {
  const [rest, setRest] = useState<StoredRest | null>(() => readStoredRest())
  const [, forceTick] = useState(0)
  const wakeLock = useRef(createWakeLock())
  const chimed = useRef(false)

  const clear = useCallback(() => {
    chimed.current = false
    setRest(null)
    writeStoredRest(null)
    void wakeLock.current.release()
  }, [])

  const start = useCallback((seconds: number, label: string) => {
    if (seconds <= 0) return
    chimed.current = false
    const next: StoredRest = { endsAt: Date.now() + seconds * 1000, label, totalSec: seconds }
    setRest(next)
    writeStoredRest(next)
    void wakeLock.current.acquire()
  }, [])

  useEffect(() => {
    if (!rest) return

    // The wake lock releases itself whenever the page hides, and does not
    // re-acquire on its own — every tick call here (interval or visibility)
    // asks again, which is a no-op once already held.
    const tick = () => {
      forceTick((t) => t + 1)
      if (!chimed.current && isChimeDue(Date.now(), rest.endsAt)) {
        chimed.current = true
        playSystemChime()
        vibrate([80, 60, 80])
      }
      if (document.visibilityState === 'visible') void wakeLock.current.acquire()
    }

    tick()
    const interval = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [rest])

  useEffect(() => {
    return () => void wakeLock.current.release()
  }, [])

  if (!rest) return { state: null, start, clear }

  const remaining = remainingSeconds(Date.now(), rest.endsAt)
  return {
    state: {
      label: rest.label,
      remaining,
      display: formatRemaining(remaining),
      pct: elapsedPct(remaining, rest.totalSec),
    },
    start,
    clear,
  }
}
