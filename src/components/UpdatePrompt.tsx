/**
 * `registerType: 'prompt'` means the service worker never takes over on its
 * own — a silent reload mid-set would lose it. This is the affordance that
 * asks instead, and it is the only thing standing between a shipped fix and a
 * hunter who never sees it.
 */
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-panel-edge bg-panel px-4 py-3 text-sm shadow-system">
      <span className="text-ink">A System update is ready.</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded px-2 py-1 text-ink-soft"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded bg-system-deep px-3 py-1 font-medium text-ink"
        >
          Update
        </button>
      </div>
    </div>
  )
}
