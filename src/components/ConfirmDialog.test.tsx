// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

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

function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text)!
  return act(async () => button.click())
}

describe('ConfirmDialog', () => {
  it('shows the title, message and custom button labels', async () => {
    await act(async () =>
      root.render(
        <ConfirmDialog
          title="Spend Rest Token"
          message="1 of 2 tokens, gone for good."
          confirmLabel="Spend token"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      ),
    )
    expect(container.textContent).toContain('Spend Rest Token')
    expect(container.textContent).toContain('1 of 2 tokens, gone for good.')
    expect(container.textContent).toContain('Spend token')
  })

  it('fires onConfirm, not onCancel, when the confirm button is pressed', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    await act(async () =>
      root.render(
        <ConfirmDialog
          title="Abandon Gate"
          message="Deleted, not left unfinished."
          confirmLabel="Abandon"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      ),
    )
    await click('Abandon')
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel, not onConfirm, when Cancel is pressed', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    await act(async () =>
      root.render(
        <ConfirmDialog
          title="Abandon Gate"
          message="Deleted, not left unfinished."
          confirmLabel="Abandon"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      ),
    )
    await click('Cancel')
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
