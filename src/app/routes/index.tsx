/**
 * Home. Redirects to `/awaken` until a profile exists — there is nothing to
 * show a hunter who has not been awakened yet.
 */
import { createRoute, redirect } from '@tanstack/react-router'
import { useApp } from '../state'
import { rootRoute } from './root'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (!useApp.getState().profile) throw redirect({ to: '/awaken' })
  },
  component: HomeScreen,
})

function HomeScreen() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="font-system text-sm text-ink-soft">[Status Window arrives in a later commit.]</p>
    </main>
  )
}
