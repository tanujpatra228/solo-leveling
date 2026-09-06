/**
 * The capsule meter: an outline plus a lit core. A flat gradient reads as
 * *coloured*; an outline with a brighter centre line reads as *emitting*, and
 * that difference is most of the aesthetic (docs/system-visuals-plan.md §6).
 *
 * Segments are laid left to right in the order given — one segment is the
 * `solid` variant (XP, HP), two is `split` (derived vs allocated). The
 * segmented fatigue dial is a different shape entirely and lives in its own
 * component.
 */
export type MeterTone = 'system' | 'system-dim' | 'system-deep' | 'mana' | 'good' | 'warn' | 'danger'

export interface MeterSegment {
  /** 0-100. Callers clamp; this component only lays segments out. */
  pct: number
  tone: MeterTone
}

export interface SystemMeterProps {
  segments: MeterSegment[]
  height?: number
}

function fillFor(tone: MeterTone): string {
  return (
    `linear-gradient(to bottom, ` +
    `color-mix(in oklab, var(--color-${tone}) 60%, transparent) 0%, ` +
    `var(--color-system-glow) 46%, ` +
    `var(--color-system-glow) 54%, ` +
    `color-mix(in oklab, var(--color-${tone}) 60%, transparent) 100%)`
  )
}

export function SystemMeter({ segments, height = 10 }: SystemMeterProps) {
  let offset = 0

  return (
    <div
      className="relative overflow-hidden rounded-full bg-void-soft ring-1 ring-panel-edge ring-inset"
      style={{ height }}
    >
      {segments.map((segment, index) => {
        const left = offset
        offset += segment.pct
        return (
          <div
            key={index}
            className="shadow-meter absolute inset-y-0 rounded-full"
            style={{ left: `${left}%`, width: `${segment.pct}%`, backgroundImage: fillFor(segment.tone) }}
          />
        )
      })}
    </div>
  )
}
