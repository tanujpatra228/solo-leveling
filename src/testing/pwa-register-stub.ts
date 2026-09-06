/**
 * Stands in for `virtual:pwa-register/react` under Vitest, where vite-plugin-pwa
 * never runs. Aliased in vitest.config.ts — the only place a test needs to
 * mount `UpdatePrompt` (or anything importing it, like `App`) rather than
 * route around it.
 */
import { useState } from 'react'

export function useRegisterSW(): {
  needRefresh: [boolean, (value: boolean) => void]
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
} {
  const [needRefresh, setNeedRefresh] = useState(false)
  return { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker: async () => {} }
}
