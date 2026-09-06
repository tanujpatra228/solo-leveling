/**
 * The dismissible advisory list already in the store — `dismissAdvisory` has
 * no UI yet (docs/m5-plan.md §2). `state.advisories` is already the active
 * (undismissed) list, computed in `recompute()`.
 */
import { useApp } from '../app/state'
import type { Advisory, AdvisorySeverity } from '../domain/advisories'
import { SystemPanel } from './SystemPanel'

const SEVERITY_TONE: Record<AdvisorySeverity, string> = {
  note: 'text-ink-soft',
  gap: 'text-warn',
  imbalance: 'text-warn',
}

export function AdvisoriesPanel({ advisories }: { advisories: readonly Advisory[] }) {
  const dismissAdvisory = useApp((s) => s.dismissAdvisory)

  if (advisories.length === 0) return null

  return (
    <SystemPanel className="mt-3 flex flex-col gap-3">
      {advisories.map((advisory) => (
        <div key={advisory.id} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`font-system text-[11px] tracking-[0.1em] uppercase ${SEVERITY_TONE[advisory.severity]}`}>
              {advisory.title}
            </p>
            <button
              type="button"
              onClick={() => void dismissAdvisory(advisory.id)}
              className="shrink-0 font-system text-[10px] text-ink-faint uppercase underline"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-ink-soft">{advisory.finding}</p>
          <p className="text-[11px] text-ink-soft/80">{advisory.suggestion}</p>
        </div>
      ))}
    </SystemPanel>
  )
}
