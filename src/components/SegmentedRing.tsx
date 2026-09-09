/**
 * Twelve arcs on a circle, lit clockwise from twelve o'clock. Built for the
 * fatigue gauge (docs/system-visuals-plan.md §6) and reused for the rest
 * timer's countdown (`RestTimerDock`) — the same shape reads just as well
 * driven by elapsed/total as a timer ring that fills as time runs out.
 *
 * A static glow on the wrapper, not a per-segment `drop-shadow` — twelve
 * filtered strokes is exactly the "glowing icons on a scrolling screen"
 * jank risk the plan's rule 1/2 warn about, and this re-renders every tick.
 */
export interface SegmentedRingProps {
  /** 0-100. Rounds down to whole lit segments — not sub-segment interpolated. */
  pct: number
  tone?: 'system' | 'warn' | 'danger' | 'good'
  size?: number
  segments?: number
  strokeWidth?: number
}

export function SegmentedRing({
  pct,
  tone = 'system',
  size = 56,
  segments = 12,
  strokeWidth = 5,
}: SegmentedRingProps) {
  const clamped = Math.min(100, Math.max(0, pct))
  const litCount = Math.min(segments, Math.floor((clamped / 100) * segments))
  const radius = size / 2 - strokeWidth
  const circumference = 2 * Math.PI * radius
  const gap = circumference * 0.08
  const segLength = Math.max(0, circumference / segments - gap)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shadow-meter -rotate-90 rounded-full"
      role="presentation"
    >
      {Array.from({ length: segments }, (_, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={i < litCount ? `var(--color-${tone})` : 'var(--color-panel-edge)'}
          strokeWidth={strokeWidth}
          strokeDasharray={`${segLength} ${circumference - segLength}`}
          strokeDashoffset={-((i * circumference) / segments)}
        />
      ))}
    </svg>
  )
}
