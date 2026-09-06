/**
 * The boot gate. `load()` seeds the exercise library, six routines and the
 * standards table on a first launch and runs two projection passes, so the
 * router does not mount until `ready` — routing into an empty store would
 * flash an "Unranked, level 1" hunter for a frame even on a returning device.
 *
 * The Double Dungeon runs after `ready` and before the router, gated on
 * `Progress.doubleDungeonSeenAt` rather than on profile presence, so it never
 * plays over the boot spinner and never replays on a reload mid-onboarding.
 */
import { useEffect } from 'react'
import { RouterProvider } from '@tanstack/react-router'
import { BootScreen } from '../components/BootScreen'
import { DoubleDungeon } from '../components/DoubleDungeon'
import { UpdatePrompt } from '../components/UpdatePrompt'
import { router } from './router'
import { useApp } from './state'

export function App() {
  const ready = useApp((s) => s.ready)
  const doubleDungeonSeenAt = useApp((s) => s.progress.doubleDungeonSeenAt)

  useEffect(() => {
    void useApp.getState().load()
  }, [])

  // The other active trigger (F3, the other is after `finishGate`). Fires
  // once the app is usable, and again every time it comes back to the
  // foreground — never on a timer, and `syncNow` itself no-ops with sync
  // disabled or no in-flight run already coalescing this one.
  useEffect(() => {
    if (!ready) return
    useApp.getState().syncNow()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') useApp.getState().syncNow()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [ready])

  if (!ready) return <BootScreen />
  if (doubleDungeonSeenAt === null) return <DoubleDungeon />

  return (
    <>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </>
  )
}
