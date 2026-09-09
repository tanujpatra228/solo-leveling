// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SystemValue } from './SystemValue'

describe('SystemValue (m10-plan commit 1)', () => {
  it('renders the figure alone at lg, with no /max suffix', () => {
    const html = renderToStaticMarkup(<SystemValue value={42} />)
    expect(html).toContain('42')
    expect(html).not.toContain('text-ink-faint')
    expect(html).toContain('text-2xl')
  })

  it('renders the /max pair, the max dimmer than the figure', () => {
    const html = renderToStaticMarkup(<SystemValue value={3} max={5} />)
    expect(html).toContain('>3<')
    expect(html).toContain('/5')
    expect(html).toContain('text-ink-faint')
  })

  it('renders a unit suffix when given one', () => {
    const html = renderToStaticMarkup(<SystemValue value={2500} unit="m" />)
    expect(html).toContain('2500')
    expect(html).toContain('m')
  })

  it('md size is smaller than the lg default, for inline summon-row figures', () => {
    const lg = renderToStaticMarkup(<SystemValue value={1} />)
    const md = renderToStaticMarkup(<SystemValue value={1} size="md" />)
    expect(lg).toContain('text-2xl')
    expect(md).not.toContain('text-2xl')
    expect(md).toContain('text-base')
  })
})
