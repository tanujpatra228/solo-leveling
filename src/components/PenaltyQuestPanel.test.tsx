// @vitest-environment happy-dom
/**
 * `progress` on a stored Penalty Quest row is new — a row issued by the code
 * before it has no such field. Found on a real device: the hunter's own
 * already-issued penalty crashed the whole Status page the moment this
 * panel's code first loaded, because `PenaltyQuestWindow` read
 * `quest.progress[item.kind]` straight off the stored payload. These tests
 * are the regression: a legacy row must render as "nothing done yet", never
 * throw.
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { putQuest, wipeEverything } from '../db/repo'
import { useApp } from '../app/state'
import { PenaltyQuestPanel } from './PenaltyQuestPanel'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
})

describe('PenaltyQuestPanel', () => {
  it('renders nothing with no penalty quest outstanding', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<PenaltyQuestPanel />))
    expect(container.innerHTML).toBe('')

    await act(async () => root.unmount())
    container.remove()
  })

  it('does not crash on a penalty row issued before `progress` existed, and reads it as nothing done', async () => {
    const today = useApp.getState().today
    // The exact shape `state.ts` wrote before the fix — no `progress` key.
    await putQuest({
      id: `penalty-${today}`,
      dayKey: today,
      type: 'penalty',
      status: 'issued',
      issuedAt: Date.now(),
      expiresAt: null,
      payload: {
        dayKey: today,
        items: [{ kind: 'run', label: 'Run', target: 3000, unit: 'metres' }],
        announcement: '[A Penalty Quest has been issued.]',
        reassurance: 'Nothing has been taken away.',
      },
    })
    await useApp.getState().refresh()

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await expect(act(async () => root.render(<PenaltyQuestPanel />))).resolves.not.toThrow()
    expect(container.textContent).toContain('Outstanding')
    expect(container.textContent).toContain('Run')
    expect(container.textContent).toContain('0')

    await act(async () => root.unmount())
    container.remove()
  })
})
