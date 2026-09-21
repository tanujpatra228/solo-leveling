// @vitest-environment happy-dom
/**
 * `SystemMessageWindow` is pure props-in, so the ARISE portrait — shown only
 * when a message carries `shadow` (state.ts) — is tested directly against a
 * fixture rather than through the store, same precedent as
 * `DailyQuestWindow` in `DailyQuestPanel.test.tsx`.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SystemMessage } from '../app/state'
import { SystemMessageWindow } from './MessageQueue'

const BASE: SystemMessage = { id: 'm1', title: 'ARISE.', tone: 'system', kind: 'window' }

describe('SystemMessageWindow', () => {
  it('shows the shadow\'s own portrait on an ARISE announcement', () => {
    const html = renderToStaticMarkup(
      <SystemMessageWindow message={{ ...BASE, shadow: { name: 'Igris', rank: 'S' } }} onDismiss={() => {}} />,
    )
    expect(html).toContain('alt="Igris"')
  })

  it('falls back to the rank-tinted emblem for a shadow with no portrait on file', () => {
    const html = renderToStaticMarkup(
      <SystemMessageWindow message={{ ...BASE, shadow: { name: 'Vulcan', rank: 'B' } }} onDismiss={() => {}} />,
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('>V<')
  })

  it('renders no portrait at all for an ordinary message', () => {
    const html = renderToStaticMarkup(<SystemMessageWindow message={BASE} onDismiss={() => {}} />)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('rounded-full')
  })
})
