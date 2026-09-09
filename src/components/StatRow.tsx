/**
 * One cell in the Status Window's two-column stat grid (m10-plan section
 * 1.0 correction 4): icon beside the label, `StatBar` filling the rest, the
 * allocate control (only while there are points to spend) tucked under the
 * split strip so it never crowds the figure.
 */
import type { LucideIcon } from 'lucide-react'
import { SystemIcon } from './SystemIcon'
import { StatBar, type StatBarProps } from './StatBar'

export interface StatRowProps extends StatBarProps {
  icon: LucideIcon
  /** Present only while there are unspent points to spend, per caller. */
  onAllocate?: () => void
}

export function StatRow({ icon, onAllocate, ...bar }: StatRowProps) {
  return (
    <div className="flex flex-col gap-1.5 border border-panel-edge/60 p-2.5">
      <div className="flex items-start gap-2">
        <SystemIcon icon={icon} size={16} />
        <StatBar {...bar} />
      </div>
      {onAllocate ? (
        <button
          type="button"
          onClick={onAllocate}
          aria-label={`Allocate a point to ${bar.label}`}
          className="flex min-h-11 min-w-11 items-center justify-center self-end rounded-full border border-panel-edge font-system text-xs text-mana"
        >
          +
        </button>
      ) : null}
    </div>
  )
}
