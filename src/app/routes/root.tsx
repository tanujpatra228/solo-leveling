/**
 * The shell every route renders inside: the safe-area frame, the message
 * queue overlay, and a connectivity indicator. No nav — with only Home and the
 * Awakening Test existing, and the two redirecting into each other based on
 * whether a profile exists, there is nothing yet to navigate between.
 */
import { useEffect, useState } from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { MessageQueue } from '../../components/MessageQueue'
import { onConnectivityChange } from '../../platform/capabilities'

function ConnectivityBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => onConnectivityChange(setOnline), [])

  if (online) return null
  return (
    <div className="bg-void-soft px-3 py-1 text-center font-system text-[11px] text-warn">
      Offline. The mirror will catch up later.
    </div>
  )
}

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <ConnectivityBanner />
      <Outlet />
      <MessageQueue />
    </div>
  )
}

export const rootRoute = createRootRoute({ component: RootLayout })
