// @vitest-environment happy-dom
/**
 * The foreground sync trigger (m6-plan commit 2, F3). `finishGate`'s own
 * trigger is covered in state.test.ts, where it needs no DOM; this one is the
 * half that only exists as a `document` event listener, so it needs a real
 * mount to prove the wiring — not just that `syncNow` behaves correctly in
 * isolation.
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { wipeEverything } from '../db/repo'
import { App } from './App'
import { useApp } from './state'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the app comes to the foreground', () => {
  it('triggers a sync attempt on visibilitychange once sync is enabled', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ seq: 1, received: 0, hasMore: false, rows: { sessions: [], sets: [], bodyMetrics: [] } }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<App />)
    })
    await vi.waitFor(() => expect(useApp.getState().ready).toBe(true))

    // Boot itself is a foreground moment, but sync is still off by default —
    // this fetch call belongs to enabling it, not to mounting.
    await act(async () => {
      await useApp.getState().updateSettings({ syncEnabled: true })
    })
    fetchMock.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    await act(async () => root.unmount())
    container.remove()
  })
})
