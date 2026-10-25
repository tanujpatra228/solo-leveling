// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useApp } from '../app/state'
import { buildTrainingLog, EMPTY_TRAINING_LOG } from '../domain/trainingCalendar'
import type { DayKey } from '../domain/types'
import { TrainingCalendar, formatElapsed } from './TrainingCalendar'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MON_TO_SAT = [1, 2, 3, 4, 5, 6]

function seed(trainedDays: readonly DayKey[], today: DayKey): void {
  useApp.setState({
    today,
    trainingLog: buildTrainingLog({
      sessions: trainedDays.map((d) => ({ session: { dayKey: d }, gateRank: 'C' as const })),
      routineWeekdays: MON_TO_SAT,
      today,
    }),
  })
}

let container: HTMLDivElement
let unmount: () => Promise<void>

async function mount(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(<TrainingCalendar />))
  unmount = async () => {
    await act(async () => root.unmount())
    container.remove()
  }
}

async function click(label: string): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) throw new Error(`no "${label}" button`)
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
const cellLabels = () => Array.from(container.querySelectorAll('li[aria-label]')).map((li) => li.getAttribute('aria-label'))

beforeEach(() => {
  useApp.setState({ trainingLog: EMPTY_TRAINING_LOG })
})

afterEach(async () => {
  await unmount()
})

describe('TrainingCalendar', () => {
  it('mounts on an empty history, says so, and has no other month to go to', async () => {
    seed([], '2026-10-25')
    await mount()

    expect(container.textContent).toContain('No gate cleared yet')
    expect(button('Previous month').disabled).toBe(true)
    expect(button('Next month').disabled).toBe(true)
    expect(cellLabels().some((label) => label?.includes('gate cleared'))).toBe(false)
  })

  it('walks back to the month of the first gate and stops there, then forward to the current month', async () => {
    seed(['2026-08-03', '2026-09-07', '2026-10-05'], '2026-10-14')
    await mount()

    // Opens on the current month.
    expect(cellLabels()).toContain('Monday 5 October: gate cleared')
    expect(button('Next month').disabled).toBe(true)
    expect(button('Previous month').disabled).toBe(false)

    await click('Previous month')
    expect(cellLabels()).toContain('Monday 7 September: gate cleared')
    expect(cellLabels()).not.toContain('Monday 5 October: gate cleared')

    await click('Previous month')
    expect(cellLabels()).toContain('Monday 3 August: gate cleared')
    expect(button('Previous month').disabled).toBe(true)
    expect(button('Next month').disabled).toBe(false)

    await click('Next month')
    await click('Next month')
    expect(cellLabels()).toContain('Monday 5 October: gate cleared')
    expect(button('Next month').disabled).toBe(true)
  })

  it('tells a rest day, a missed day, a trained rest day and the days before the first gate apart', async () => {
    // First gate Mon 5 Oct. Trained Mon 5 and Sun 11 (a rest day). Today Wed 14.
    seed(['2026-10-05', '2026-10-11'], '2026-10-14')
    await mount()
    const labels = cellLabels()

    expect(labels).toContain('Monday 5 October: gate cleared')
    expect(labels).toContain('Sunday 11 October: gate cleared') // trained on a rest day
    expect(labels).toContain('Tuesday 6 October: not cleared')
    expect(labels).toContain('Wednesday 14 October: not cleared yet')
    expect(labels).toContain('Thursday 15 October: upcoming')
    expect(labels).toContain('Sunday 18 October: rest day')
    // Before the first gate there was nothing to miss, and nothing to say.
    expect(labels).toContain('Friday 2 October')
  })

  it('shows the totals and how long the hunter has been training', async () => {
    // Mon 3 Aug to Sun 25 Oct, inclusive, is 12 weeks: 2 months, 3 weeks, 2 days.
    seed(['2026-08-03', '2026-08-04', '2026-08-12', '2026-10-05'], '2026-10-25')
    await mount()
    const text = container.textContent ?? ''

    expect(text).toContain('Training for 2 months, 3 weeks, 2 days')
    expect(text).toContain('Since 3 Aug 2026')
    // 4 days across 3 Monday-anchored weeks (3 Aug, 10 Aug, 5 Oct) in 2 months.
    expect(text).toMatch(/4\s*Days trained/)
    expect(text).toMatch(/3\s*Weeks trained/)
    expect(text).toMatch(/2\s*Months trained/)
  })
})

describe('formatElapsed', () => {
  it('names only the units that are not zero', () => {
    expect(formatElapsed({ months: 2, weeks: 3, days: 2, totalDays: 84 })).toBe('2 months, 3 weeks, 2 days')
    expect(formatElapsed({ months: 0, weeks: 1, days: 0, totalDays: 7 })).toBe('1 week')
    expect(formatElapsed({ months: 1, weeks: 0, days: 0, totalDays: 31 })).toBe('1 month')
    expect(formatElapsed({ months: 0, weeks: 0, days: 1, totalDays: 1 })).toBe('1 day')
  })
})
