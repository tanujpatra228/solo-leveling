// @vitest-environment happy-dom
/**
 * Route mount tests — standards rule 14. One per route, in the state a user
 * actually reaches it in, asserting the screen renders rather than crashes.
 *
 * These assert on the absence of TanStack Router's CatchBoundary, not on a
 * thrown error, because the router catches a render crash and swaps in its own
 * "Something went wrong!" screen. A test that only checked for a throw would
 * pass green while the app showed the red error box in production, which is
 * exactly what happened with the React #185 crash on /gate.
 *
 * Deliberately no assertions about text, layout, or styling: rule 14.
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { wipeEverything } from '../../db/repo'
import { dayOfWeekForKey } from '../../domain/time'
import { useApp } from '../state'
import { clearRestTimer, startRestTimer } from '../useRestTimer'
import { awakenRoute } from './awaken'
import { gateRoute } from './gate'
import { indexRoute } from './index'
import { linkRoute } from './link'
import { rootRoute } from './root'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Built once: a route may only be attached to its parent a single time.
const routeTree = rootRoute.addChildren([indexRoute, awakenRoute, gateRoute, linkRoute])

/** Mounts the app at `path` and returns what it rendered. */
async function mountAt(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<RouterProvider router={router} />)
  })
  const html = container.innerHTML

  await act(async () => root.unmount())
  container.remove()
  return html
}

/** Fails on the router's error screen, and on a route that rendered nothing. */
function expectRendered(html: string): void {
  expect(html).not.toContain('Something went wrong')
  expect(html.length).toBeGreaterThan(0)
}

/** Like `mountAt`, but keeps the container mounted so a test can click into it. */
async function mountInteractive(path: string): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<RouterProvider router={router} />)
  })

  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

async function click(element: Element | null | undefined): Promise<void> {
  if (!element) throw new Error('nothing to click — the button this test expected is not in the tree')
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

async function awaken(): Promise<void> {
  await useApp.getState().completeAwakening({
    profile: {
      sex: 'male',
      birthYear: 1998,
      heightCm: 178,
      unitPref: 'metric',
      trainingYears: 2,
      equipmentAccess: ['barbell', 'dumbbell', 'machine'],
    },
    bodyweightKg: 72,
  })
}

beforeEach(async () => {
  await wipeEverything({ forgetIdentity: true })
  await useApp.getState().load()
})

describe('every route mounts', () => {
  it('/awaken renders for a hunter with no profile', async () => {
    expectRendered(await mountAt('/awaken'))
  })

  it('/ renders the status window once a profile exists', async () => {
    await awaken()
    expectRendered(await mountAt('/'))
  })

  it('/gate renders the preview with no session open', async () => {
    await awaken()
    expectRendered(await mountAt('/gate'))
  })

  /**
   * The regression test for the #185 crash. `ActiveGateScreen` only mounts once
   * a session is open, which is why every other route stayed green while /gate
   * was a blank screen in production.
   */
  it('/gate renders the live session with a gate open', async () => {
    await awaken()

    const routine = useApp.getState().routines[0]
    if (!routine) throw new Error('seed produced no routines')
    await useApp.getState().startGate(routine.id)
    expect(useApp.getState().activeSessionId).not.toBeNull()

    expectRendered(await mountAt('/gate'))
  })

  it('/link renders the License Key screen, sync off by default (m6-plan commit 4)', async () => {
    await awaken()
    expectRendered(await mountAt('/link'))
  })
})

describe('the swap sheet (commit 6b2b0eb, rule 14)', () => {
  it('opens from a block\'s Swap button and lists ranked candidates without crashing', async () => {
    await useApp.getState().completeAwakening({
      profile: {
        sex: 'male',
        birthYear: 1998,
        heightCm: 178,
        unitPref: 'metric',
        trainingYears: 2,
        // Full-ish access, so Cable Crunch's block has real answers to show.
        equipmentAccess: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'pullup_bar', 'bench'],
      },
      bodyweightKg: 72,
    })
    await useApp.getState().startGate('saturday-cardio-abs')

    const { container, unmount } = await mountInteractive('/gate')
    const swapButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Swap')
    await click(swapButton)

    expectRendered(container.innerHTML)
    // Every candidate row carries its tier badge; a rendered, non-empty sheet
    // has at least one, distinguishing this from the empty-result state below.
    // (Bottom-nav tabs are also <li>s, so counting those would prove nothing.)
    expect(container.textContent).toContain('Tier ')

    await unmount()
  })

  it('shows the empty-result state, rather than crashing, for a block with genuinely no answer', async () => {
    await useApp.getState().completeAwakening({
      profile: {
        sex: 'male',
        birthYear: 1998,
        heightCm: 178,
        unitPref: 'metric',
        trainingYears: 2,
        // Bodyweight-only: Pull-ups' block has no answer at all — see the
        // exception list in substitution.test.ts's coverage guarantee.
        equipmentAccess: ['bodyweight'],
      },
      bodyweightKg: 72,
    })
    await useApp.getState().startGate('tuesday-back-biceps')

    const { container, unmount } = await mountInteractive('/gate')
    const swapButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Swap')
    await click(swapButton)

    expectRendered(container.innerHTML)
    expect(container.textContent).not.toContain('Tier ')

    await unmount()
  })
})

describe('QR scanning on /link (m6-plan commit 5, rule 14)', () => {
  it('opens the scanner from Scan a key and degrades to a message with no camera, rather than crashing', async () => {
    await awaken()

    const { container, unmount } = await mountInteractive('/link')
    const scanButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Scan a key',
    )
    await click(scanButton)

    // happy-dom has no navigator.mediaDevices, so openRearCamera resolves to
    // null — the real "no camera on this device" path, not a mocked one.
    await vi.waitFor(() => expect(container.textContent).toContain('No camera available'))
    expectRendered(container.innerHTML)

    await unmount()
  })
})

describe('the rest-timer dock lives in the shell (m10-plan commit 0, F19)', () => {
  afterEach(() => clearRestTimer())

  it('renders on the Status route while a timer started elsewhere is running', async () => {
    await awaken()
    startRestTimer(90, 'Back Squat')

    const { container, unmount } = await mountInteractive('/')
    expectRendered(container.innerHTML)
    expect(container.textContent).toContain('Skip rest')

    await unmount()
  })

  it('renders nothing when idle', async () => {
    await awaken()

    const { container, unmount } = await mountInteractive('/')
    expect(container.textContent).not.toContain('Skip rest')

    await unmount()
  })
})

describe('a gate already cleared today does not re-offer Start Gate', () => {
  it('shows Cleared on revisit instead of Start Gate again', async () => {
    await awaken()

    const today = useApp.getState().today
    const todaysRoutine = useApp
      .getState()
      .routines.find((r) => r.dayOfWeek === dayOfWeekForKey(today))
    if (!todaysRoutine) throw new Error('seed produced no routine for today — pick a different fake date')

    await useApp.getState().startGate(todaysRoutine.id)
    await useApp.getState().finishGate()
    expect(useApp.getState().activeSessionId).toBeNull()

    const { container, unmount } = await mountInteractive('/gate')
    expectRendered(container.innerHTML)
    expect(container.textContent).toContain('Cleared')
    expect(container.textContent).not.toContain('Start Gate')

    await unmount()
  })
})
