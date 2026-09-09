// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Advisory } from '../domain/advisories'
import { wipeEverything } from '../db/repo'
import { useApp } from '../app/state'
import { AdvisoriesPanel } from './AdvisoriesPanel'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function advisory(overrides: Partial<Advisory>): Advisory {
  return {
    id: 'a1',
    severity: 'gap',
    title: 'No hinge pattern',
    finding: 'Nothing in the week loads a hinge.',
    why: 'The posterior chain goes untrained.',
    suggestion: 'Add a Romanian deadlift.',
    ...overrides,
  }
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function mount(advisories: readonly Advisory[]) {
  await act(async () => root.render(<AdvisoriesPanel advisories={advisories} />))
}

describe('AdvisoriesPanel (m10-plan commit 5)', () => {
  it('renders nothing for an empty list', async () => {
    await mount([])
    expect(container.innerHTML).toBe('')
  })

  it('shows the title only, with no finding or suggestion, until tapped open', async () => {
    await mount([advisory({})])
    expect(container.textContent).toContain('No hinge pattern')
    expect(container.textContent).not.toContain('Add a Romanian deadlift.')
  })

  it('reveals finding, suggestion and dismiss only on the tapped row', async () => {
    await mount([advisory({})])
    const button = container.querySelector('button')!
    await act(async () => button.click())
    expect(container.textContent).toContain('Nothing in the week loads a hinge.')
    expect(container.textContent).toContain('Add a Romanian deadlift.')
    expect(container.textContent).toContain('Acknowledge')
  })

  it('caps the visible list at three and collapses the rest behind a count', async () => {
    const many = Array.from({ length: 5 }, (_, i) => advisory({ id: `a${i}`, title: `Advisory ${i}` }))
    await mount(many)
    expect(container.textContent).toContain('Advisory 0')
    expect(container.textContent).toContain('Advisory 2')
    expect(container.textContent).not.toContain('Advisory 3')
    expect(container.textContent).toContain('2 more warnings')
  })
})
