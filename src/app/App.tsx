/**
 * The boot gate. `load()` seeds the exercise library, six routines and the
 * standards table on a first launch and runs two projection passes, so the
 * router does not mount until `ready` — routing into an empty store would
 * flash an "Unranked, level 1" hunter for a frame even on a returning device.
 */
import { useEffect } from 'react'
import { RouterProvider } from '@tanstack/react-router'
import { BootScreen } from '../components/BootScreen'
import { UpdatePrompt } from '../components/UpdatePrompt'
import { router } from './router'
import { useApp } from './state'

export function App() {
  const ready = useApp((s) => s.ready)

  useEffect(() => {
    void useApp.getState().load()
  }, [])

  if (!ready) return <BootScreen />

  return (
    <>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </>
  )
}
