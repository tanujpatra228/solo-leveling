import { SystemMeter } from './SystemMeter'
import { SystemValue } from './SystemValue'

/** The level bar: how far into the current level, and how far to the next. */
export interface ManaBarProps {
  level: number
  xpIntoLevel: number
  xpToNext: number
}

export function ManaBar({ level, xpIntoLevel, xpToNext }: ManaBarProps) {
  const pct = xpToNext > 0 ? Math.min(100, Math.max(0, (xpIntoLevel / xpToNext) * 100)) : 0
  const remaining = Math.max(0, Math.round(xpToNext) - Math.round(xpIntoLevel))

  return (
    <div
      className="flex flex-col gap-1"
      aria-label={`Level ${level}, ${Math.round(xpIntoLevel)} of ${Math.round(xpToNext)} XP into the next level`}
    >
      <div className="flex items-baseline justify-between">
        <SystemValue value={`LV ${level}`} size="md" />
        <span className="font-system text-[10px] tracking-[0.12em] text-ink-faint uppercase">
          {remaining} XP to LV {level + 1}
        </span>
      </div>
      <div className="mt-1">
        <SystemMeter segments={[{ pct, tone: 'system' }]} />
      </div>
    </div>
  )
}
