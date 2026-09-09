/**
 * The dismissible advisory list, wired to the `dismissAdvisory` store action.
 * `state.advisories` is already the active (undismissed) list, computed in
 * `recompute()`.
 *
 * Title-only rows with severity read as a left edge rule rather than amber
 * text across the whole title (F7, m10-plan commit 5) — finding, suggestion
 * and the dismiss control reveal only inside the row a hunter has tapped
 * open, which also removes the accidental-dismissal risk a bare underline
 * carried. Anything past the first three collapses behind a count rather
 * than nine advisories fully expanded at the bottom of the page.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import type { Advisory, AdvisorySeverity } from '../domain/advisories'
import { SystemPanel } from './SystemPanel'

const SEVERITY_EDGE: Record<AdvisorySeverity, string> = {
  note: 'border-ink-faint/40',
  gap: 'border-warn',
  imbalance: 'border-warn',
}

const VISIBLE_CAP = 3

export function AdvisoriesPanel({ advisories }: { advisories: readonly Advisory[] }) {
  const dismissAdvisory = useApp((s) => s.dismissAdvisory)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  if (advisories.length === 0) return null

  const visible = showAll ? advisories : advisories.slice(0, VISIBLE_CAP)
  const hiddenCount = advisories.length - visible.length

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      {visible.map((advisory) => (
        <AdvisoryRow
          key={advisory.id}
          advisory={advisory}
          open={openId === advisory.id}
          onToggle={() => setOpenId((current) => (current === advisory.id ? null : advisory.id))}
          onDismiss={() => void dismissAdvisory(advisory.id)}
        />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="min-h-11 text-left font-system text-[10px] tracking-[0.1em] text-ink-faint uppercase"
        >
          {hiddenCount} more warning{hiddenCount === 1 ? '' : 's'}
        </button>
      ) : null}
    </SystemPanel>
  )
}

function AdvisoryRow({
  advisory,
  open,
  onToggle,
  onDismiss,
}: {
  advisory: Advisory
  open: boolean
  onToggle: () => void
  onDismiss: () => void
}) {
  return (
    <div className={`flex flex-col border-l-2 pl-2 ${SEVERITY_EDGE[advisory.severity]}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 items-center text-left font-system text-[11px] tracking-[0.1em] text-ink-soft uppercase"
      >
        {advisory.title}
      </button>
      {open ? (
        <div className="flex flex-col gap-2 pb-2">
          <p className="text-xs text-ink-soft">{advisory.finding}</p>
          <p className="text-[11px] text-ink-soft/80">{advisory.suggestion}</p>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 w-fit shrink-0 font-system text-[10px] text-ink-faint uppercase"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  )
}
