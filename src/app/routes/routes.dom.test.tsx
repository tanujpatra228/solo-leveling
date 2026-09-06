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
import { beforeEach, describe, expect, it } from 'vitest'
import { wipeEverything } from '../../db/repo'
import { useApp } from '../state'
import { awakenRoute } from './awaken'
import { gateRoute } from './gate'
import { indexRoute } from './index'
import { rootRoute } from './root'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Built once: a route may only be attached to its parent a single time.
const routeTree = rootRoute.addChildren([indexRoute, awakenRoute, gateRoute])

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
})
