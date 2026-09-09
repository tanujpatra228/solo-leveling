// @vitest-environment happy-dom
/**
 * `startRestTimer`/`clearRestTimer` are plain functions so a caller (Gate)
 * never runs its own copy of the ticking/chime/wake-lock effect; the sole
 * `useRestTimer()` owner (`RestTimerDock`, mounted once in root.tsx) still
 * has to pick up a rest started from anywhere else. This is the test for
 * that cross-instance sync, plus the wake-lock lifecycle the dock owns.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearRestTimer, startRestTimer, useRestTimer, type RestTimer } from './useRestTimer'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface FakeSentinel {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

function installFakeWakeLock(): { requests: number; releases: number } {
  const calls = { requests: 0, releases: 0 }
  const fake = {
    request: async (_type: 'screen'): Promise<FakeSentinel> => {
      calls.requests += 1
      const listeners: Array<() => void> = []
      const sentinel: FakeSentinel = {
        released: false,
        release: async () => {
          if (sentinel.released) return
          sentinel.released = true
          calls.releases += 1
          listeners.forEach((l) => l())
        },
        addEventListener: (_t, listener) => listeners.push(listener),
      }
      return sentinel
    },
  }
  ;(navigator as unknown as { wakeLock: typeof fake }).wakeLock = fake
  return calls
}

let latest: RestTimer | null = null
function Probe() {
  latest = useRestTimer()
  return null
}

async function mount(): Promise<{ unmount: () => Promise<void> }> {
  latest = null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<Probe />)
  })
  return {
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

beforeEach(() => clearRestTimer())
afterEach(() => {
  clearRestTimer()
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
})

describe('useRestTimer, split ownership (m10-plan commit 0)', () => {
  it('a mounted hook instance picks up a rest started outside React entirely', async () => {
    const { unmount } = await mount()
    expect(latest?.state).toBeNull()

    await act(async () => {
      startRestTimer(90, 'Back Squat')
    })

    expect(latest?.state?.label).toBe('Back Squat')
    await unmount()
  })

  it('a mounted hook instance clears when cleared from outside React', async () => {
    startRestTimer(90, 'Back Squat')
    const { unmount } = await mount()
    expect(latest?.state?.label).toBe('Back Squat')

    await act(async () => {
      clearRestTimer()
    })
    expect(latest?.state).toBeNull()
    await unmount()
  })

  it('acquires the wake lock while a rest is running and releases it on clear', async () => {
    const calls = installFakeWakeLock()
    const { unmount } = await mount()

    await act(async () => {
      startRestTimer(90, 'Back Squat')
    })
    expect(calls.requests).toBeGreaterThan(0)

    await act(async () => {
      clearRestTimer()
    })
    expect(calls.releases).toBeGreaterThan(0)

    await unmount()
  })
})
