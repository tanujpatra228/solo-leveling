// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ManaBar } from './ManaBar'

describe('ManaBar (m10-plan commit 1)', () => {
  it('shows the remaining figure, not the raw xpIntoLevel/xpToNext pair', () => {
    const html = renderToStaticMarkup(<ManaBar level={6} xpIntoLevel={60} xpToNext={300} />)
    expect(html).toContain('LV 6')
    expect(html).toContain('240 XP to LV 7')
  })

  it('keeps xpIntoLevel/xpToNext in the aria-label for anyone reading it as a fraction', () => {
    const html = renderToStaticMarkup(<ManaBar level={6} xpIntoLevel={60} xpToNext={300} />)
    expect(html).toContain('aria-label="Level 6, 60 of 300 XP into the next level"')
  })

  it('never shows a negative remainder once xpIntoLevel reaches xpToNext', () => {
    const html = renderToStaticMarkup(<ManaBar level={6} xpIntoLevel={300} xpToNext={300} />)
    expect(html).toContain('0 XP to LV 7')
  })
})
