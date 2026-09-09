// @vitest-environment happy-dom
/**
 * The rebuild's whole point (m10-plan section 1.0a): one core line per
 * segment, coloured from that segment's own tone rather than a fixed cyan —
 * a `warn` meter's core used to render pale cyan regardless of tone.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SystemMeter } from './SystemMeter'

describe('SystemMeter, rebuilt (m10-plan commit 1)', () => {
  it('renders one core element per segment', () => {
    const html = renderToStaticMarkup(
      <SystemMeter
        segments={[
          { pct: 40, tone: 'system' },
          { pct: 30, tone: 'mana' },
        ]}
      />,
    )
    expect(html.match(/shadow-meter/g)?.length).toBe(2)
  })

  it("takes each segment's core colour from its own tone, not a fixed cyan", () => {
    const html = renderToStaticMarkup(<SystemMeter segments={[{ pct: 50, tone: 'warn' }]} />)
    expect(html).toContain('var(--color-warn)')
    expect(html).not.toContain('var(--color-system-glow)')
  })

  it('keeps a fixed 2px core regardless of height, per the fix in section 1.0a', () => {
    const short = renderToStaticMarkup(<SystemMeter segments={[{ pct: 50, tone: 'good' }]} height={8} />)
    const tall = renderToStaticMarkup(<SystemMeter segments={[{ pct: 50, tone: 'good' }]} height={20} />)
    expect(short).toContain('h-[2px]')
    expect(tall).toContain('h-[2px]')
  })
})
