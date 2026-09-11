// @vitest-environment happy-dom
/**
 * The Status Window footer (m10-plan commit 6, F11/F17): the allocation
 * primary only earns its place while there are points to spend, and revoking
 * the whole allocation — the only destructive action this milestone adds —
 * confirms before it fires, via a `ConfirmDialog` rather than the browser's
 * native `confirm()` (see `ConfirmDialog.tsx`).
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusFooter } from './index'

function click(container: HTMLDivElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text)!
  return act(async () => button.click())
}

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('StatusFooter', () => {
  it('shows the allocation primary and revoke only while points are unspent', async () => {
    await act(async () => root.render(<StatusFooter unspent={0} onRevoke={() => {}} onShowLicense={() => {}} />))
    expect(container.textContent).not.toContain('Allocate')
    expect(container.textContent).not.toContain('Revoke allocation')

    await act(async () => root.render(<StatusFooter unspent={3} onRevoke={() => {}} onShowLicense={() => {}} />))
    expect(container.textContent).toContain('Allocate 3 points')
    expect(container.textContent).toContain('Revoke allocation')
  })

  it('always offers the Hunter License reveal, regardless of unspent points', async () => {
    await act(async () => root.render(<StatusFooter unspent={0} onRevoke={() => {}} onShowLicense={() => {}} />))
    expect(container.textContent).toContain('Hunter License')
  })

  it('asks for confirmation before revoking, and does nothing if declined', async () => {
    const onRevoke = vi.fn()
    await act(async () => root.render(<StatusFooter unspent={3} onRevoke={onRevoke} onShowLicense={() => {}} />))

    await click(container, 'Revoke allocation')
    expect(container.textContent).toContain('Revoke Allocation')
    expect(onRevoke).not.toHaveBeenCalled()

    await click(container, 'Cancel')
    expect(onRevoke).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('This cannot be undone')
  })

  it('revokes once confirmed', async () => {
    const onRevoke = vi.fn()
    await act(async () => root.render(<StatusFooter unspent={3} onRevoke={onRevoke} onShowLicense={() => {}} />))

    await click(container, 'Revoke allocation')
    await click(container, 'Revoke')

    expect(onRevoke).toHaveBeenCalledOnce()
  })
})
