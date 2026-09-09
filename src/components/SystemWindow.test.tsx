// @vitest-environment happy-dom
/**
 * The staggered entrance (F13, m10-plan commit 7): several windows fading in
 * with an increasing delay reads as the System writing them in sequence.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
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
