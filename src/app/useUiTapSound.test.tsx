// @vitest-environment happy-dom
/**
 * The delegated click listener (root.tsx mounts this once for the whole
 * app) rather than an onClick prop per button — these tests are what stand
 * in for "every button gets sound": they assert the delegation itself,
 * not any one screen's markup.
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { wipeEverything } from '../db/repo'
import { useApp } from './state'
import { useUiTapSound } from './useUiTapSound'

const capabilitiesMocks = vi.hoisted(() => ({ playTapTone: vi.fn(), vibrate: vi.fn() }))
vi.mock('../platform/capabilities', () => capabilitiesMocks)
const { playTapTone, vibrate } = capabilitiesMocks

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Harness() {
  useUiTapSound()
  return (
    <div>
      <button type="button">Tap me</button>
      <button type="button" disabled>
        Disabled
      </button>
      <a href="/gate">Go</a>
      <input type="text" />
      <span>Not interactive</span>
    </div>
  )
}

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
  playTapTone.mockClear()
  vibrate.mockClear()
})

describe('useUiTapSound', () => {
  it('plays a tap tone and a light haptic when a button is clicked', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<Harness />))

    await act(async () => container.querySelector('button')!.click())

    expect(playTapTone).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(10)

    await act(async () => root.unmount())
  })

  it('fires for a link too, not just a button', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<Harness />))

    await act(async () => container.querySelector('a')!.click())

    expect(playTapTone).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })

  it('never fires for a disabled button or a non-interactive element', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<Harness />))

    await act(async () => container.querySelector<HTMLButtonElement>('button[disabled]')!.click())
    await act(async () => container.querySelector<HTMLSpanElement>('span')!.click())
    await act(async () => container.querySelector<HTMLInputElement>('input')!.click())

    expect(playTapTone).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('respects soundEnabled and hapticsEnabled independently', async () => {
    await useApp.getState().updateSettings({ soundEnabled: false, hapticsEnabled: true })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<Harness />))

    await act(async () => container.querySelector('button')!.click())

    expect(playTapTone).not.toHaveBeenCalled()
    expect(vibrate).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })
})
