/**
 * The Awakening Test. Redirects to `/` once a profile exists — onboarding is a
 * one-time gate, not a screen a returning hunter can wander back into.
 */
import { Link, createRoute, redirect } from '@tanstack/react-router'
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
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-system text-sm text-ink-soft">
        [The Awakening Test arrives in a later commit.]
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-ink-faint">
        Onboarding is not built yet, so there is no hunter to show a status window for. The training
        week is loaded and readable in the meantime.
      </p>
      <Link
        to="/gate"
        className="font-system text-xs tracking-[0.18em] text-system uppercase underline decoration-system-dim underline-offset-4"
      >
        See today&rsquo;s gate
      </Link>
    </main>
  )
}
