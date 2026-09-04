import { createRouter } from '@tanstack/react-router'
import { awakenRoute } from './routes/awaken'
import { gateRoute } from './routes/gate'
import { indexRoute } from './routes/index'
import { rootRoute } from './routes/root'

const routeTree = rootRoute.addChildren([indexRoute, awakenRoute, gateRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
