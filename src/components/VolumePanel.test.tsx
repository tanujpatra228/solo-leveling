// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MuscleVolume } from '../domain/volume'
import { VolumePanel } from './VolumePanel'

function entry(overrides: Partial<MuscleVolume>): MuscleVolume {
  return {
    muscle: 'chest',
    sets: 0,
    landmark: { mv: 4, mev: 10, mav: [12, 20], mrv: 22 },
    verdict: 'none',
    fill: 0,
    message: '',
    ...overrides,
  }
}

describe('VolumePanel (m10-plan commit 5)', () => {
  it('renders the untrained line with no meters when every muscle is at zero sets', () => {
    const html = renderToStaticMarkup(
      <VolumePanel volume={[entry({ muscle: 'chest' }), entry({ muscle: 'lats' })]} />,
    )
    expect(html).toContain('Untrained')
    expect(html).toContain('chest')
    expect(html).toContain('lats')
    expect(html).not.toContain('Trained')
    expect(html).not.toContain('border-ink/45') // SystemMeter's wrapper class — absent, only the pill renders
  })

  it('renders an empty list with no meters and no untrained line', () => {
    const html = renderToStaticMarkup(<VolumePanel volume={[]} />)
    expect(html).not.toContain('Trained')
    expect(html).not.toContain('Untrained')
  })

  it('splits trained meters from a collapsed untrained line', () => {
    const html = renderToStaticMarkup(
      <VolumePanel
        volume={[
          entry({ muscle: 'chest', sets: 12, verdict: 'optimal', fill: 0.6 }),
          entry({ muscle: 'lats', sets: 0 }),
        ]}
      />,
    )
    expect(html).toContain('Trained')
    expect(html).toContain('chest')
    expect(html).toContain('Untrained')
    expect(html).toContain('lats')
  })
})
