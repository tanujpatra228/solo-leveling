/**
 * The capsule meter, rebuilt to the reference frame (m10-plan section 1.0a):
 * a near-white outline, a dark inset gap, a dim body under the filled
 * portion, and a thin bright core line floating inside it. The previous
 * build was a solid-alpha fill touching a dark outline — a coloured bar, not
 * an emitting one — because a proportional core collapses to sub-pixel at
 * small heights. The core here is a fixed 2px regardless of `height`, which
 * is why every caller passing `height < 8` moved up when this landed.
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

export function SystemMeter({ segments, height = 12 }: SystemMeterProps) {
  let offset = 0
  return (
    // Near-white outline with the cyan arriving as glow. Reversing those two is
    // what makes HUD styling look cheap (docs/system-visuals-plan.md section 7).
    <div className="relative rounded-full border border-ink/45" style={{ height }}>
      {/* The inset gap. Without it the core touches the outline and the whole
          thing collapses back into one solid bar (m10-plan section 1.0a). */}
      <div className="absolute inset-[2px] overflow-hidden rounded-full">
        {segments.map((segment, index) => {
          const left = offset
          offset += segment.pct
          return (
            <div key={index} className="absolute inset-y-0" style={{ left: `${left}%`, width: `${segment.pct}%` }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `color-mix(in oklab, var(--color-${segment.tone}) 22%, transparent)` }}
              />
              {/* Fixed 2px, never a percentage: a proportional core is the bug
                  being fixed, and it vanishes at the 6px volume-row height. */}
              <div
                className="shadow-meter absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                style={{ background: `var(--color-${segment.tone})` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
