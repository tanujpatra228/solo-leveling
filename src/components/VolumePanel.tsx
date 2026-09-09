/**
 * One `SystemMeter` per trained muscle against its landmark, worst deficit
 * first — `projection.volume` is already sorted that way. Untrained muscles
 * (F6, m10-plan commit 5) collapse into one named line rather than seven
 * empty tracks nobody reads.
 */
import { useMemo } from 'react'
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
  const trained = useMemo(() => volume.filter((entry) => entry.sets > 0), [volume])
  const untrained = useMemo(() => volume.filter((entry) => entry.sets === 0), [volume])

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <p className="font-system text-[11px] text-ink-faint uppercase">Weekly volume</p>
      {trained.length > 0 ? (
        <>
          <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint/80 uppercase">Trained</p>
          {trained.map((entry) => (
            <VolumeRow key={entry.muscle} entry={entry} />
          ))}
        </>
      ) : null}
      {untrained.length > 0 ? (
        <p className="w-fit rounded-full border border-panel-edge/60 px-2 py-1 font-system text-[10px] tracking-[0.06em] text-ink-faint/70 uppercase">
          Untrained — {untrained.map((entry) => entry.muscle.replace(/_/g, ' ')).join(', ')}
        </p>
      ) : null}
    </SystemPanel>
  )
}

function VolumeRow({ entry }: { entry: MuscleVolume }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate font-system text-[11px] text-ink-soft capitalize">
        {entry.muscle.replace(/_/g, ' ')}
      </span>
      <div className="min-w-0 flex-1">
        <SystemMeter segments={[{ pct: entry.fill * 100, tone: VERDICT_TONE[entry.verdict] }]} height={8} />
      </div>
      <span className="w-8 shrink-0 text-right font-system text-[10px] text-ink-faint tabular-nums">
        {entry.sets}
      </span>
    </div>
  )
}
