// @vitest-environment happy-dom
/**
 * `buildRosterSlots` is pure props-in — the paging and lock-threshold rules
 * are tested directly against `RosterState` fixtures. `ShadowsPanel` itself
 * gets one smoke test per real state (empty, and a populated roster) through
 * `renderToStaticMarkup`, per the precedent in `DailyQuestPanel.test.tsx`.
 * The flip card's click wiring needs a real DOM (`createRoot`/`act`, per
 * `StatusFooter.test.tsx`'s precedent) since it's about event propagation,
 * not markup.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RosterState } from '../domain/shadows'
import type { Shadow } from '../domain/types'
import { ShadowsPanel, buildRosterSlots } from './ShadowsPanel'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function shadow(partial: Partial<Shadow> & { id: string }): Shadow {
  return {
    id: partial.id,
    exerciseId: partial.exerciseId ?? 'barbell-squat',
    name: partial.name ?? 'Kaisel',
    rank: partial.rank ?? 'C',
    extractedAt: partial.extractedAt ?? 0,
    buff: partial.buff ?? 'buff',
    buffKind: partial.buffKind ?? 'xp_bonus',
    buffMagnitude: partial.buffMagnitude ?? 0.02,
    isMarshal: partial.isMarshal ?? false,
    active: partial.active ?? true,
  }
}

function roster(partial: Partial<RosterState>): RosterState {
  return {
    cap: 1,
    activeCount: 0,
    active: [],
    benched: [],
    overCap: false,
    message: '',
    ...partial,
  }
}

describe('buildRosterSlots', () => {
  it('pages a cap of 1 into one page: an empty slot and 3 locked ones', () => {
    const slots = buildRosterSlots(roster({ cap: 1, active: [] }))
    expect(slots).toHaveLength(4)
    expect(slots[0]).toEqual({ kind: 'empty' })
    expect(slots[1]).toEqual({ kind: 'locked', requiredInt: 20 })
    expect(slots[2]).toEqual({ kind: 'locked', requiredInt: 40 })
    expect(slots[3]).toEqual({ kind: 'locked', requiredInt: 60 })
  })

  it('fills every slot with no locked or empty ones when the cap lands on a page boundary', () => {
    const active = [1, 2, 3, 4].map((n) => shadow({ id: `s${n}` }))
    const slots = buildRosterSlots(roster({ cap: 4, activeCount: 4, active }))
    expect(slots).toHaveLength(4)
    expect(slots.every((s) => s.kind === 'filled')).toBe(true)
  })

  it('spills into a second page once the cap is not a multiple of 4, locking the rest of it', () => {
    // Cap 5: the exact numbers from the live app (5 active shadows, INT 82).
    const active = [1, 2, 3, 4, 5].map((n) => shadow({ id: `s${n}` }))
    const slots = buildRosterSlots(roster({ cap: 5, activeCount: 5, active }))
    expect(slots).toHaveLength(8)
    expect(slots.slice(0, 5).every((s) => s.kind === 'filled')).toBe(true)
    expect(slots[5]).toEqual({ kind: 'locked', requiredInt: 100 })
    expect(slots[6]).toEqual({ kind: 'locked', requiredInt: 120 })
    expect(slots[7]).toEqual({ kind: 'locked', requiredInt: 140 })
  })

  it('reads unfilled capacity under the cap as empty, not locked', () => {
    // Cap 4 but only 2 shadows active — the hunter has room, nothing occupies it.
    const active = [1, 2].map((n) => shadow({ id: `s${n}` }))
    const slots = buildRosterSlots(roster({ cap: 4, activeCount: 2, active }))
    expect(slots[0]?.kind).toBe('filled')
    expect(slots[1]?.kind).toBe('filled')
    expect(slots[2]).toEqual({ kind: 'empty' })
    expect(slots[3]).toEqual({ kind: 'empty' })
  })
})

describe('ShadowsPanel', () => {
  it('renders nothing for a roster with no shadows at all', () => {
    const html = renderToStaticMarkup(
      <ShadowsPanel roster={roster({})} exercises={[]} totalInt={0} onToggle={() => {}} onHelp={() => {}} />,
    )
    expect(html).toBe('')
  })

  it('states each locked slot\'s own INT requirement against the current total', () => {
    const active = [1, 2, 3, 4, 5].map((n) => shadow({ id: `s${n}` }))
    const html = renderToStaticMarkup(
      <ShadowsPanel
        roster={roster({ cap: 5, activeCount: 5, active })}
        exercises={[]}
        totalInt={82}
        onToggle={() => {}}
        onHelp={() => {}}
      />,
    )
    expect(html).toContain('82')
    expect(html).toContain('/100')
    expect(html).toContain('/120')
    expect(html).toContain('/140')
  })

  it('falls back to an initial-letter emblem for a shadow with no portrait on file', () => {
    const active = [shadow({ id: 's1', name: 'Vulcan', rank: 'B' })]
    const html = renderToStaticMarkup(
      <ShadowsPanel
        roster={roster({ cap: 1, activeCount: 1, active })}
        exercises={[]}
        totalInt={0}
        onToggle={() => {}}
        onHelp={() => {}}
      />,
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('>V<')
  })
})

describe('ShadowCard flip', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('starts unflipped, and tapping the card flips it', async () => {
    const active = [shadow({ id: 's1', name: 'Vulcan', rank: 'B' })]
    await act(async () =>
      root.render(
        <ShadowsPanel
          roster={roster({ cap: 1, activeCount: 1, active })}
          exercises={[]}
          totalInt={0}
          onToggle={() => {}}
          onHelp={() => {}}
        />,
      ),
    )
    const card = container.querySelector('[role="button"]') as HTMLElement
    expect(card.getAttribute('aria-pressed')).toBe('false')

    await act(async () => card.click())
    expect(card.getAttribute('aria-pressed')).toBe('true')
  })

  it('tapping the Return button acts on the shadow without also flipping the card', async () => {
    const active = [shadow({ id: 's1', name: 'Vulcan', rank: 'B' })]
    let toggled: [string, boolean] | null = null
    await act(async () =>
      root.render(
        <ShadowsPanel
          roster={roster({ cap: 1, activeCount: 1, active })}
          exercises={[]}
          totalInt={0}
          onToggle={(id, next) => {
            toggled = [id, next]
          }}
          onHelp={() => {}}
        />,
      ),
    )
    const card = container.querySelector('[role="button"]') as HTMLElement
    const returnButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Return')!

    await act(async () => returnButton.click())

    expect(toggled).toEqual(['s1', false])
    expect(card.getAttribute('aria-pressed')).toBe('false')
  })
})
