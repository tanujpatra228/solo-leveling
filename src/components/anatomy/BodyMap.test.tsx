// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BodyMap } from './BodyMap'

describe('BodyMap', () => {
  it('forces every path to the base fill when one is given', () => {
    const html = renderToStaticMarkup(<BodyMap view="front" fills={{}} baseFill="#111" baseStroke="#222" />)
    expect(html).toMatch(/path \{[^}]*fill: #111/)
  })

  it("keeps an outline-tracer id's fill at none even with a base fill set", () => {
    // anatomy-full-body-outline, trapezius-outline, etc. are boundary tracers
    // whose source SVG expects an inherited fill="none" — they contribute
    // only their stroke. Forcing a solid fill onto them turns the enclosed
    // area between their traced curves into a visible, meaningless shape
    // (see the posterior view's shoulder-to-shoulder triangle this guards
    // against).
    const html = renderToStaticMarkup(<BodyMap view="back" fills={{}} baseFill="#111" baseStroke="#222" />)
    expect(html).toMatch(/\[id\*="outline"\][^{]*\{[^}]*fill: none/)
  })

  it('does not add the outline fill:none rule when no base fill is set', () => {
    const html = renderToStaticMarkup(<BodyMap view="back" fills={{}} />)
    expect(html).not.toContain('[id*="outline"]')
  })
})
