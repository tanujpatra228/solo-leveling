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
 *
 * `startRestTimer`/`clearRestTimer` are exported as plain functions, not
 * hook methods, so a caller that only needs to start or clear a rest — Gate,
 * logging a set — never runs its own copy of the ticking/chime/wake-lock
 * effect below. `RestTimerDock` (root.tsx, m10-plan commit 0) is the one
 * `useRestTimer()` call that stays mounted across every route, so it is the
 * single owner of that effect; a second owner would chime and vibrate twice
 * for the same countdown.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createWakeLock } from '../platform/capabilities'
import { playSystemChime, vibrate } from '../platform/capabilities'
import { elapsedPct, formatRemaining, isChimeDue, remainingSeconds } from './rest-timer'

const REST_KEY = 'solo-leveling:rest'
const REST_EVENT = 'rest-changed'
const restEvents = new EventTarget()

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

/** Callable from anywhere; notifies every mounted `useRestTimer`. */
export function startRestTimer(seconds: number, label: string): void {
  if (seconds <= 0) return
  const next: StoredRest = { endsAt: Date.now() + seconds * 1000, label, totalSec: seconds }
  writeStoredRest(next)
  restEvents.dispatchEvent(new Event(REST_EVENT))
}

export function clearRestTimer(): void {
  writeStoredRest(null)
  restEvents.dispatchEvent(new Event(REST_EVENT))
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

  useEffect(() => {
    const sync = () => setRest(readStoredRest())
    restEvents.addEventListener(REST_EVENT, sync)
    return () => restEvents.removeEventListener(REST_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!rest) {
      void wakeLock.current.release()
      return
    }

    chimed.current = false

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

  const start = useCallback(startRestTimer, [])
  const clear = useCallback(clearRestTimer, [])

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
