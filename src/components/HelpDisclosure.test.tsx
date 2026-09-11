// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HelpDisclosure } from './HelpDisclosure'

const TOPIC = {
  title: 'Test Topic',
  body: ['First line.', 'Second line.'],
}

describe('HelpDisclosure', () => {
  it('renders every body line', () => {
    const html = renderToStaticMarkup(<HelpDisclosure topic={TOPIC} />)
    expect(html).toContain('First line.')
    expect(html).toContain('Second line.')
  })

  it('starts closed, not forcing the copy onto the screen unasked', () => {
    const html = renderToStaticMarkup(<HelpDisclosure topic={TOPIC} />)
    expect(html).not.toContain(' open')
  })

  it('labels the toggle with the topic title for a screen-reader user', () => {
    const html = renderToStaticMarkup(<HelpDisclosure topic={TOPIC} />)
    expect(html).toContain('aria-label="What is Test Topic?"')
  })
})
