/**
 * The deload prompt, shown only when `projection.deload.due` (docs/m5-plan.md
 * §2). `markDeload` already exists as a store action with no UI.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import type { DeloadVerdict } from '../domain/deload'
import { SystemPanel } from './SystemPanel'

export function DeloadPanel({ deload }: { deload: DeloadVerdict }) {
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
    <SystemPanel className="mt-3 flex flex-col gap-2 text-warn">
      <p className="font-system text-[11px] tracking-[0.12em] uppercase">{deload.headline}</p>
      <p className="text-xs text-ink-soft">{deload.detail}</p>
      <p className="text-xs text-ink-soft">{deload.prescription}</p>
      <button
        type="button"
        onClick={() => void acknowledge()}
        disabled={busy}
        className="self-start rounded border border-warn/60 px-3 py-1.5 font-system text-[10px] text-warn uppercase disabled:opacity-30"
      >
        Mark deload done
      </button>
    </SystemPanel>
  )
}
