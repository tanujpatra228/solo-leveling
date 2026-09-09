/**
 * The deload prompt, shown only when `projection.deload.due`, wired to the
 * `markDeload` store action.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import type { DeloadVerdict } from '../domain/deload'
import { SystemWindow } from './SystemWindow'

export function DeloadPanel({ deload, strong = false }: { deload: DeloadVerdict; strong?: boolean }) {
  const markDeload = useApp((s) => s.markDeload)
  const [busy, setBusy] = useState(false)

  if (!deload.due) return null

  async function acknowledge() {
    if (busy) return
    setBusy(true)
    await markDeload()
    setBusy(false)
  }

  return (
    <SystemWindow
      title={deload.headline}
      strong={strong}
      footer={
        <button
          type="button"
          onClick={() => void acknowledge()}
          disabled={busy}
          className="w-full rounded border border-warn/60 px-5 py-3 font-system text-xs text-warn uppercase disabled:opacity-30"
        >
          Mark deload done
        </button>
      }
    >
      <div className="flex flex-col gap-2 text-center text-warn">
        <p className="text-xs text-ink-soft">{deload.detail}</p>
        <p className="text-xs text-ink-soft">{deload.prescription}</p>
      </div>
    </SystemWindow>
  )
}
