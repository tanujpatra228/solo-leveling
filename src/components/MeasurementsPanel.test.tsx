// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useApp } from '../app/state'
import type { BodyMetric, Profile, UnitPref } from '../domain/types'
import { MeasurementsPanel, formatAgo } from './MeasurementsPanel'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const at = (day: string) => Date.parse(`${day}T12:00:00`)

const profile = (unitPref: UnitPref): Profile => ({
  id: 'profile',
  sex: 'male',
  birthYear: 1995,
  heightCm: 178,
  unitPref,
  trainingYears: 3,
  equipmentAccess: ['barbell'],
  createdAt: at('2026-08-03'),
  awakenedAt: at('2026-08-03'),
})

// The Awakening Test, then a re-measure that left neck, hip and body fat blank.
const awakening: BodyMetric = {
  id: 'a',
  dayKey: '2026-08-03',
  recordedAt: at('2026-08-03'),
  weightKg: 82,
  waistCm: 90,
  neckCm: 38,
  bodyFatPct: 20,
  bodyFatSource: 'calipers',
}
const reawakening: BodyMetric = {
  id: 'b',
  dayKey: '2026-10-12',
  recordedAt: at('2026-10-12'),
  weightKg: 79.5,
  waistCm: 86,
}

let container: HTMLDivElement
let unmount: () => Promise<void>

async function mount(state: { bodyMetrics: BodyMetric[]; unitPref?: UnitPref }): Promise<string> {
  useApp.setState({ today: '2026-10-25', profile: profile(state.unitPref ?? 'metric'), bodyMetrics: state.bodyMetrics })
  container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(<MeasurementsPanel />))
  unmount = async () => {
    await act(async () => root.unmount())
    container.remove()
  }
  return container.textContent ?? ''
}

beforeEach(() => {
  useApp.setState({ bodyMetrics: [], profile: null })
})

afterEach(async () => {
  await unmount()
})

describe('MeasurementsPanel', () => {
  it('shows the latest reading of each measurement, in metric', async () => {
    const text = await mount({ bodyMetrics: [awakening, reawakening] })

    expect(text).toContain('79.5 kg')
    expect(text).toContain('86 cm') // waist, from the later test
    expect(text).toContain('38 cm') // neck, only ever logged at the Awakening
    expect(text).toContain('20%')
    expect(text).toContain('Skinfold calipers')
    expect(text).toContain('178 cm') // height, from the profile
  })

  it('gives every measurement its own date, so a skipped neck keeps the Awakening date', async () => {
    const text = await mount({ bodyMetrics: [awakening, reawakening] })

    expect(text).toContain('Logged 12 Oct 2026 (13 days ago)') // weight and waist
    expect(text).toContain('Logged 3 Aug 2026 (2 months ago)') // neck and body fat
    expect(text).toContain('Logged at your Awakening, 3 Aug 2026') // height
  })

  it('says what changed since the reading before, and only where there was one', async () => {
    const text = await mount({ bodyMetrics: [awakening, reawakening] })

    expect(text).toContain('-2.5 kg since 3 Aug 2026')
    expect(text).toContain('-4 cm since 3 Aug 2026')
    // Neck was logged once, so there is nothing to compare it with.
    expect(text.match(/since 3 Aug 2026/g)).toHaveLength(2)
  })

  it('marks a measurement that was never logged rather than hiding it', async () => {
    const text = await mount({ bodyMetrics: [awakening, reawakening] })
    expect(text).toContain('Not logged') // hip
    expect(text.match(/Not logged/g)).toHaveLength(1)
  })

  it('converts to pounds and inches for an imperial hunter, including the change', async () => {
    const text = await mount({ bodyMetrics: [awakening, reawakening], unitPref: 'imperial' })

    expect(text).toContain('175.3 lb') // 79.5 kg
    expect(text).toContain('33.9 in') // 86 cm
    expect(text).toContain(`5' 10"`) // 178 cm
    expect(text).toContain('-5.5 lb since 3 Aug 2026') // 2.5 kg
    expect(text).toContain('-1.6 in since 3 Aug 2026') // 4 cm
    expect(text).not.toContain(' kg')
  })

  it('reports no change when the difference rounds to nothing', async () => {
    const same: BodyMetric = { ...reawakening, weightKg: 82, waistCm: 90 }
    const text = await mount({ bodyMetrics: [awakening, same] })
    expect(text).toContain('No change since 3 Aug 2026')
  })

  it('with nothing logged, says so, marks every measurement, and still shows height', async () => {
    const text = await mount({ bodyMetrics: [] })

    expect(text).toContain('Nothing logged yet.')
    expect(text.match(/Not logged/g)).toHaveLength(5)
    expect(text).toContain('178 cm')
  })
})

describe('formatAgo', () => {
  it('reads in days, then weeks, then months', () => {
    expect(formatAgo(0)).toBe('today')
    expect(formatAgo(-3)).toBe('today')
    expect(formatAgo(1)).toBe('yesterday')
    expect(formatAgo(5)).toBe('5 days ago')
    expect(formatAgo(13)).toBe('13 days ago')
    expect(formatAgo(14)).toBe('2 weeks ago')
    expect(formatAgo(59)).toBe('8 weeks ago')
    expect(formatAgo(60)).toBe('2 months ago')
    expect(formatAgo(83)).toBe('2 months ago')
    expect(formatAgo(365)).toBe('12 months ago')
  })
})
