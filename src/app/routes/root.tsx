/**
 * The shell every route renders inside. Owns the safe-area frame and the one
 * piece of navigation there is — which stayed absent until a second real route
 * existed to navigate between.
 */
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { MessageQueue } from '../../components/MessageQueue'
import { RestTimerDock } from '../../components/RestTimerDock'
import { frameTierFor } from '../../domain/frameTier'
import { FrameTierContext } from '../frameTierContext'
import { useApp } from '../state'
import { useSessionWakeLock } from '../useSessionWakeLock'
import { useUiTapSound } from '../useUiTapSound'

const TABS = [
  { to: '/gate', label: 'Gate' },
  { to: '/', label: 'Status' },
  { to: '/link', label: 'Link' },
] as const

function RootLayout() {
  useSessionWakeLock()
  useUiTapSound()

  // A token lookup, not a per-route style (§1.7, m10-plan commit 9): every
  // `SystemWindow` under this provider picks up the tier for free, so Gate
  // and Link level up right alongside Status rather than needing their own
  // wiring.
  const rank = useApp((s) => s.projection?.player.rank ?? null)
  const hunterClass = useApp((s) => s.projection?.player.hunterClass ?? 'none')
  const frameTier = frameTierFor(rank, hunterClass)

  return (
    <FrameTierContext.Provider value={frameTier}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>

        {/* Bottom-anchored, because this is used one-handed at arm's length. */}
        <nav className="sticky bottom-0 border-t border-panel-edge bg-void/95 backdrop-blur">
          <ul className="flex">
            {TABS.map((tab) => (
              <li key={tab.to} className="flex-1">
                <Link
                  to={tab.to}
                  className="block py-3 text-center font-system text-[11px] tracking-[0.18em] uppercase text-ink-faint"
                  activeProps={{ className: 'block py-3 text-center font-system text-[11px] tracking-[0.18em] uppercase text-system' }}
                  activeOptions={{ exact: true }}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <RestTimerDock />
        <MessageQueue />
      </div>
    </FrameTierContext.Provider>
  )
}

export const rootRoute = createRootRoute({ component: RootLayout })
