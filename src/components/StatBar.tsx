/**
 * The figure is the loud element (m10-plan section 1.0, corrections 2 and
 * 4): a bright `SystemValue` on top, a thin subordinate strip underneath
 * carrying the derived-vs-allocated split real information still deserves
 * (docs/system-visuals-plan.md section 8) — just no longer competing with
 * the number for attention. Not a `SystemMeter`: that component's outline-
 * plus-core construction needs more height than this accent can spend.
 */
import { SystemValue } from './SystemValue'

export interface StatBarProps {
  label: string
  derived: number
  allocated: number
  total: number
  /** The value the split strip scales against. Defaults to headroom above the total. */
  max?: number
}

export function StatBar({ label, derived, allocated, total, max }: StatBarProps) {
  const scale = max ?? Math.max(total * 1.25, 10)
  const derivedPct = Math.min(100, Math.max(0, (derived / scale) * 100))
  const allocatedPct = Math.min(100 - derivedPct, Math.max(0, (allocated / scale) * 100))

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-system text-[10px] tracking-[0.1em] text-ink-faint uppercase">{label}:</span>
        <SystemValue value={Math.round(total)} />
      </div>
      <div className="relative h-[3px] overflow-hidden rounded-full bg-void-soft">
        <div className="absolute inset-y-0 left-0 rounded-full bg-system-dim" style={{ width: `${derivedPct}%` }} />
        <div
          className="absolute inset-y-0 rounded-full bg-mana"
          style={{ left: `${derivedPct}%`, width: `${allocatedPct}%` }}
        />
      </div>
    </div>
  )
}
