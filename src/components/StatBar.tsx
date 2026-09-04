/**
 * Two segments, not one. `PlayerState` carries `derived`, `allocated` and
 * `total` for each stat; a single bar would throw away the distinction
 * between what training earned and what the hunter assigned by hand. The
 * split is the information.
 */
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
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-void-soft">
        <div className="absolute inset-y-0 left-0 bg-system-dim" style={{ width: `${derivedPct}%` }} />
        <div
          className="absolute inset-y-0 bg-mana"
          style={{ left: `${derivedPct}%`, width: `${allocatedPct}%` }}
        />
      </div>
      <span className="w-6 text-right font-system text-[11px] text-ink">{Math.round(total)}</span>
    </div>
  )
}
