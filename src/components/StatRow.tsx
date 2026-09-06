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
      {/*
        `StatBar`'s root is itself a flex row, so as a plain flex *item* here
        it shrinks to fit its own content instead of filling what's left —
        and its meter div has no in-flow children (the fill bars are
        absolutely positioned), so that content is ~0 wide. Left unfixed,
        the whole row stops dead a third of the way across the card with
        empty space after it. `min-w-0 flex-1` forces it to take the rest of
        the row, which is what lets its internal meter's own `flex-1` mean
        anything.
      */}
      <div className="min-w-0 flex-1">
        <StatBar {...bar} />
      </div>
    </div>
  )
}
