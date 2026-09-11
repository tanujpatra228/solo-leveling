// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HelpModal } from './HelpModal'

const TOPIC = { title: 'Test Topic', body: ['First line.', 'Second line.'] }

describe('HelpModal', () => {
  it('renders the topic title and every body line as its own paragraph, not an inline expansion', () => {
    const html = renderToStaticMarkup(<HelpModal topic={TOPIC} onClose={() => {}} />)
    expect(html).toContain('Test Topic')
    expect(html).toContain('First line.')
    expect(html).toContain('Second line.')
    // A `SystemOverlay`, not the old `<details>` disclosure — no <details> tag.
    expect(html).not.toContain('<details')
  })
})
