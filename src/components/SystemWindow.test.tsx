// @vitest-environment happy-dom
/**
 * The staggered entrance (F13, m10-plan commit 7): several windows fading in
 * with an increasing delay reads as the System writing them in sequence.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FrameTierContext } from '../app/frameTierContext'
import { SystemWindow } from './SystemWindow'

describe('SystemWindow index (m10-plan commit 7)', () => {
  it('carries no animation-delay when index is omitted', () => {
    const html = renderToStaticMarkup(<SystemWindow title="Status">hi</SystemWindow>)
    expect(html).not.toContain('animation-delay')
  })

  it('delays later windows more than earlier ones', () => {
    const first = renderToStaticMarkup(
      <SystemWindow title="Status" index={0}>
        hi
      </SystemWindow>,
    )
    const third = renderToStaticMarkup(
      <SystemWindow title="Status" index={3}>
        hi
      </SystemWindow>,
    )
    expect(first).toContain('animation-delay:0ms')
    expect(third).toContain('animation-delay:120ms')
  })

  it('caps the delay so a long stack does not end visibly stalled', () => {
    const far = renderToStaticMarkup(
      <SystemWindow title="Status" index={50}>
        hi
      </SystemWindow>,
    )
    expect(far).toContain('animation-delay:240ms')
  })
})

describe('SystemWindow title box (found on a real device after m10-plan commit 9)', () => {
  it('never wraps a long title to a second line', () => {
    // A wrapped two-line badge roughly doubles its own height, which was
    // half of a real-device overlap onto a neighbouring window's content —
    // see the mt-3 test below for the other half.
    const html = renderToStaticMarkup(<SystemWindow title="Pair a second device">hi</SystemWindow>)
    expect(html).toContain('whitespace-nowrap')
  })

  it('carries its own top margin, so a stack of windows always clears the title box poking above it', () => {
    const html = renderToStaticMarkup(<SystemWindow title="Status">hi</SystemWindow>)
    expect(html).toContain('mt-3')
  })
})

describe('SystemWindow frame tier (m10-plan commit 9)', () => {
  it('renders the plain hairline with no provider mounted (tier 1 default)', () => {
    const html = renderToStaticMarkup(<SystemWindow title="Status">hi</SystemWindow>)
    expect(html).not.toContain('system-frame')
  })

  it('picks up a higher tier from context without the caller passing anything', () => {
    const html = renderToStaticMarkup(
      <FrameTierContext.Provider value={3}>
        <SystemWindow title="Status">hi</SystemWindow>
      </FrameTierContext.Provider>,
    )
    expect(html).toContain('system-frame')
    expect(html).toContain('system-frame-bright')
    expect(html).not.toContain('system-frame-mana')
  })

  it('swings the accent to mana at tier 4 (Shadow Monarch)', () => {
    const html = renderToStaticMarkup(
      <FrameTierContext.Provider value={4}>
        <SystemWindow title="Status">hi</SystemWindow>
      </FrameTierContext.Provider>,
    )
    expect(html).toContain('system-frame-mana')
  })
})
