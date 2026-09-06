/**
 * One `SystemMeter` per muscle against its landmark, worst deficit first —
 * `projection.volume` is already sorted that way (docs/m5-plan.md §2).
 */
import { SystemMeter, type MeterTone } from './SystemMeter'
import { SystemPanel } from './SystemPanel'
import type { MuscleVolume, VolumeVerdict } from '../domain/volume'

const VERDICT_TONE: Record<VolumeVerdict, MeterTone> = {
  none: 'warn',
  below_mv: 'warn',
  maintaining: 'system-dim',
  below_mev: 'warn',
  optimal: 'good',
  above_mav: 'warn',
  over_mrv: 'danger',
}

export function VolumePanel({ volume }: { volume: readonly MuscleVolume[] }) {
  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <p className="font-system text-[11px] text-ink-faint uppercase">Weekly volume</p>
      {volume.map((entry) => (
        <div key={entry.muscle} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate font-system text-[11px] text-ink-soft capitalize">
            {entry.muscle.replace(/_/g, ' ')}
          </span>
          <div className="min-w-0 flex-1">
            <SystemMeter segments={[{ pct: entry.fill * 100, tone: VERDICT_TONE[entry.verdict] }]} height={6} />
          </div>
          <span className="w-8 shrink-0 text-right font-system text-[10px] text-ink-faint tabular-nums">
            {entry.sets}
          </span>
        </div>
      ))}
    </SystemPanel>
  )
}
