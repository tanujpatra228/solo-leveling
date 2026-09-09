// @vitest-environment happy-dom
/**
 * `DailyQuestWindow` is pure props-in, so its rendering rules (m10-plan
 * commit 4: the penalty line, the complete state, the deadline ring's tone)
 * are tested directly against fixtures rather than through the store — the
 * ring's fraction comes from an injected clock, never `Date.now()`.
 *
 * `DailyQuestPanel` itself stays a thin connected wrapper (standards F6
 * precedent) — one smoke test that a rest day with no quest issued renders
 * nothing, through the real store.
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { wipeEverything } from '../db/repo'
import type { DailyQuestPayload } from '../domain/quests'
import { useApp } from '../app/state'
import { DailyQuestPanel, DailyQuestWindow } from './DailyQuestPanel'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TODAY = '2026-03-06'
const ROLLOVER = new Date(2026, 2, 6, 4, 0).getTime()

const BASE_QUEST: DailyQuestPayload = {
  dayKey: TODAY,
  items: [
    { kind: 'pushups', label: 'Push-ups', target: 50, unit: 'reps' },
    { kind: 'run', label: 'Run', target: 2000, unit: 'metres' },
  ],
  xpReward: 150,
  goldReward: 25,
  announcement: '[Daily Quest has arrived.]',
  progress: {},
}

describe('DailyQuestWindow (m10-plan commit 4)', () => {
  it('states the stake while the quest is incomplete', () => {
    const html = renderToStaticMarkup(
      <DailyQuestWindow quest={BASE_QUEST} today={TODAY} now={ROLLOVER} onAdd={() => {}} />,
    )
    expect(html).toContain('Failure to comply with the system may result in a penalty.')
    expect(html).toContain('Push-ups')
  })

  it('collapses to the cleared state and drops the stake once every task is met', () => {
    const complete: DailyQuestPayload = { ...BASE_QUEST, progress: { pushups: 50, run: 2000 } }
    const html = renderToStaticMarkup(
      <DailyQuestWindow quest={complete} today={TODAY} now={ROLLOVER} onAdd={() => {}} />,
    )
    expect(html).toContain('Daily Quest cleared.')
    expect(html).not.toContain('Failure to comply')
    expect(html).not.toContain('Goal')
  })

  it('drives the deadline ring from the injected now, not the ambient clock', () => {
    // 12 segments lit right at rollover — the full day remains.
    const freshAtRollover = renderToStaticMarkup(
      <DailyQuestWindow quest={BASE_QUEST} today={TODAY} now={ROLLOVER} onAdd={() => {}} />,
    )
    // Halfway through the day, only half the segments should still be lit.
    const halfDayLater = renderToStaticMarkup(
      <DailyQuestWindow quest={BASE_QUEST} today={TODAY} now={ROLLOVER + 12 * 60 * 60 * 1000} onAdd={() => {}} />,
    )
    const litCount = (html: string) => html.match(/var\(--color-system\)/g)?.length ?? 0
    expect(litCount(freshAtRollover)).toBeGreaterThan(litCount(halfDayLater))
  })
})

describe('DailyQuestRow steppers (m10-plan commit 6, F16)', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('offers rep steps for a reps item and metre steps for a metres item, no keyboard needed', async () => {
    await act(async () =>
      root.render(<DailyQuestWindow quest={BASE_QUEST} today={TODAY} now={ROLLOVER} onAdd={() => {}} />),
    )
    expect(container.textContent).toContain('+1')
    expect(container.textContent).toContain('+5')
    expect(container.textContent).toContain('+10')
    expect(container.textContent).toContain('+100m')
    expect(container.textContent).toContain('+250m')
    expect(container.textContent).toContain('+500m')
    // The manual fallback is present but the number input stays hidden by default.
    expect(container.textContent).toContain('Manual')
    expect(container.querySelector('input')).toBeNull()

    await act(async () => root.unmount())
    container.remove()
  })

  it('a stepper tap calls onAdd with that item kind and the step amount', async () => {
    const calls: Array<[string, number]> = []
    await act(async () =>
      root.render(
        <DailyQuestWindow
          quest={BASE_QUEST}
          today={TODAY}
          now={ROLLOVER}
          onAdd={(kind, amount) => calls.push([kind, amount])}
        />,
      ),
    )
    const fivePushups = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '+5')!
    await act(async () => fivePushups.click())
    expect(calls).toEqual([['pushups', 5]])

    await act(async () => root.unmount())
    container.remove()
  })

  it('reveals the manual number input only after the MANUAL pill is tapped', async () => {
    await act(async () =>
      root.render(<DailyQuestWindow quest={BASE_QUEST} today={TODAY} now={ROLLOVER} onAdd={() => {}} />),
    )
    const manualPill = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Manual')!
    await act(async () => manualPill.click())
    expect(container.querySelector('input')).not.toBeNull()

    await act(async () => root.unmount())
    container.remove()
  })
})

describe('DailyQuestPanel (m10-plan commit 4)', () => {
  beforeEach(async () => {
    await wipeEverything({ forgetIdentity: true })
    await useApp.getState().load()
  })

  it('renders nothing before the Awakening Test issues a quest', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<DailyQuestPanel />))
    expect(container.innerHTML).toBe('')

    await act(async () => root.unmount())
    container.remove()
  })
})
