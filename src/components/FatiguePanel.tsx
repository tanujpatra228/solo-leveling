/**
 * The fatigue gauge: `SegmentedRing` driven by `projection.fatigue.gauge`,
 * with its band and message (docs/system-visuals-plan.md's ring construction,
 * repurposed here for its originally-planned use — docs/m5-plan.md §2).
 */
import { SegmentedRing } from './SegmentedRing'
import { SystemPanel } from './SystemPanel'
import type { FatigueBand, FatigueState } from '../domain/fatigue'

const RING_TONE: Record<FatigueBand, 'system' | 'warn' | 'danger' | 'good'> = {
  insufficient_data: 'system',
  detraining: 'system',
  undertrained: 'system',
  optimal: 'good',
  elevated: 'warn',
  danger: 'danger',
}

export function FatiguePanel({ fatigue }: { fatigue: FatigueState }) {
  return (
    <SystemPanel className="mt-3 flex items-center gap-3">
      <div className="relative size-12 shrink-0">
        <SegmentedRing pct={fatigue.gauge} tone={RING_TONE[fatigue.band]} size={48} strokeWidth={4} />
      </div>
      <p className="min-w-0 text-xs text-ink-soft">{fatigue.message}</p>
    </SystemPanel>
  )
}
