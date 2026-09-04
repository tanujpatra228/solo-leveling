/**
 * The shell every route renders inside. Owns nothing route-specific — just the
 * safe-area frame, which is why it stays this small until a second real route
 * exists to navigate between.
 */
import { Outlet, createRootRoute } from '@tanstack/react-router'

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <Outlet />
    </div>
  )
}

export const rootRoute = createRootRoute({ component: RootLayout })
