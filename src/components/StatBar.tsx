/**
 * Two segments, not one. `PlayerState` carries `derived`, `allocated` and
 * `total` for each stat; a single bar would throw away the distinction
 * between what training earned and what the hunter assigned by hand. The
 * split is the information.
 */
import { SystemMeter } from './SystemMeter'

export interface StatBarProps {
  label: string
  derived: number
  allocated: number
  total: number
  /** The value that fills the bar. Defaults to headroom above the total. */
  max?: number
}

export function StatBar({ label, derived, allocated, total, max }: StatBarProps) {
  const scale = max ?? Math.max(total * 1.25, 10)
  const derivedPct = Math.min(100, Math.max(0, (derived / scale) * 100))
  const allocatedPct = Math.min(100 - derivedPct, Math.max(0, (allocated / scale) * 100))

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-system text-[11px] text-ink-soft">{label}</span>
      <div className="flex-1">
        <SystemMeter
          segments={[
            { pct: derivedPct, tone: 'system-dim' },
            { pct: allocatedPct, tone: 'mana' },
          ]}
          height={8}
        />
      </div>
      <span className="w-6 text-right font-system text-[11px] text-ink">{Math.round(total)}</span>
    </div>
  )
}
