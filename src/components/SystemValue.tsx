/**
 * The reference's value pair, read straight off the Status frame (m10-plan
 * section 1.0): the figure is roughly 3x its own label and its own max.
 * Equal sizes are what flatten a screen of numbers into one grey read.
 *
 * `size="md"` covers the smaller inline pairs — a summon row's figure does
 * not need 24px — but `lg` is the default, because the reference's default
 * is loud.
 */
export interface SystemValueProps {
  value: number | string
  max?: number | string
  unit?: string
  size?: 'lg' | 'md'
}

const FIGURE_SIZE: Record<'lg' | 'md', string> = {
  lg: 'text-2xl',
  md: 'text-base',
}

export function SystemValue({ value, max, unit, size = 'lg' }: SystemValueProps) {
  return (
    <span className="font-body font-semibold tabular-nums text-ink">
      <span className={`${FIGURE_SIZE[size]} leading-none`}>{value}</span>
      {max !== undefined ? <span className="text-xs text-ink-faint">/{max}</span> : null}
      {unit ? <span className="text-xs text-ink-faint"> {unit}</span> : null}
    </span>
  )
}
