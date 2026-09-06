/**
 * Icon plus `StatBar`, kept as a separate wrapper rather than a `StatBar`
 * prop so `StatBar` itself stays prop-compatible with every existing caller
 * (docs/system-visuals-plan.md §6, §11).
 */
import type { LucideIcon } from 'lucide-react'
import { SystemIcon } from './SystemIcon'
import { StatBar, type StatBarProps } from './StatBar'

export function StatRow({ icon, ...bar }: StatBarProps & { icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2">
      <SystemIcon icon={icon} size={16} />
      <StatBar {...bar} />
    </div>
  )
}
