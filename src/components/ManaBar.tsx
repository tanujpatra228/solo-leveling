/** The level bar: how far into the current level, and how far to the next. */
export interface ManaBarProps {
  level: number
  xpIntoLevel: number
  xpToNext: number
}

export function ManaBar({ level, xpIntoLevel, xpToNext }: ManaBarProps) {
  const pct = xpToNext > 0 ? Math.min(100, Math.max(0, (xpIntoLevel / xpToNext) * 100)) : 0

  return (
    <div>
      <div className="flex items-baseline justify-between font-system text-[11px] text-ink-soft">
        <span>LV {level}</span>
        <span>
          {Math.round(xpIntoLevel)} / {Math.round(xpToNext)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-void-soft">
        <div
          className="h-full rounded-full bg-gradient-to-r from-system-deep to-system-glow"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
