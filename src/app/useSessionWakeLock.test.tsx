// @vitest-environment happy-dom
/**
 * F18: `keepScreenAwake` was stored, defaulted true, and read nowhere. This
 * is the read side — a fake `navigator.wakeLock` proves the hook actually
 * calls `request`/`release` rather than merely compiling.
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { wipeEverything } from '../db/repo'
import { useApp } from './state'
import { useSessionWakeLock } from './useSessionWakeLock'

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

function Probe() {
  useSessionWakeLock()
  return null
}

async function mount(): Promise<{ unmount: () => Promise<void> }> {
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

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
})

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
})

describe('useSessionWakeLock (m10-plan commit 0, F18)', () => {
  it('acquires the lock once a session is active and the setting is on', async () => {
    const calls = installFakeWakeLock()
    useApp.setState({ activeSessionId: null })

    const { unmount } = await mount()
    expect(calls.requests).toBe(0)

    await act(async () => {
      useApp.setState({ activeSessionId: 'session-1' })
    })
    expect(calls.requests).toBe(1)

    await unmount()
  })

  it('releases the lock when the session ends', async () => {
    const calls = installFakeWakeLock()
    useApp.setState({ activeSessionId: 'session-1' })

    const { unmount } = await mount()
    expect(calls.requests).toBe(1)

    await act(async () => {
      useApp.setState({ activeSessionId: null })
    })
    expect(calls.releases).toBe(1)

    await unmount()
  })

  it('never acquires while keepScreenAwake is off, even mid-session', async () => {
    const calls = installFakeWakeLock()
    useApp.setState((s) => ({ activeSessionId: 'session-1', settings: { ...s.settings, keepScreenAwake: false } }))

    const { unmount } = await mount()
    expect(calls.requests).toBe(0)

    await unmount()
  })

  it('releases on unmount so a stray lock never outlives the shell', async () => {
    const calls = installFakeWakeLock()
    useApp.setState({ activeSessionId: 'session-1' })

    const { unmount } = await mount()
    expect(calls.requests).toBe(1)

    await unmount()
    expect(calls.releases).toBe(1)
  })
})
