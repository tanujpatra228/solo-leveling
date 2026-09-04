/**
 * The Awakening Test. Redirects to `/` once a profile exists — onboarding is a
 * one-time gate, not a screen a returning hunter can wander back into.
 */
import { createRoute, redirect } from '@tanstack/react-router'
import { useApp } from '../state'
import { rootRoute } from './root'

export const awakenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/awaken',
  beforeLoad: () => {
    if (useApp.getState().profile) throw redirect({ to: '/' })
  },
  component: AwakeningTestScreen,
})

function AwakeningTestScreen() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="font-system text-sm text-ink-soft">[The Awakening Test arrives in a later commit.]</p>
    </main>
  )
}
