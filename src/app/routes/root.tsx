/**
 * The shell every route renders inside. Owns the safe-area frame and the one
 * piece of navigation there is — which stayed absent until a second real route
 * existed to navigate between.
 */
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { MessageQueue } from '../../components/MessageQueue'

const TABS = [
  { to: '/gate', label: 'Gate' },
  { to: '/', label: 'Status' },
  { to: '/link', label: 'Link' },
] as const

function RootLayout() {
  return (
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

      <MessageQueue />
    </div>
  )
}

export const rootRoute = createRootRoute({ component: RootLayout })
