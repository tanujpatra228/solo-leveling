/**
 * The archive, named rather than shown (m10-plan section 1.3, 4). No menu
 * grid, no chevron-to-expand — a labelled row per window, each stating its
 * own figure so a row reading `0` is honestly not worth opening (section
 * 4a.3). Tapping the open one closes it again.
 */
import type { SummonWindowId } from '../app/routes/index'
import { SystemWindow } from './SystemWindow'

export interface SummonRow {
  id: SummonWindowId
  label: string
  figure: string
  warn?: boolean
}

export function SummonList({
  rows,
  open,
  onToggle,
}: {
  rows: readonly SummonRow[]
  open: SummonWindowId | undefined
  onToggle: (id: SummonWindowId) => void
}) {
  return (
    <SystemWindow title="System">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onToggle(row.id)}
              aria-pressed={open === row.id}
              className="flex min-h-11 w-full items-center justify-between gap-2 border border-panel-edge/60 px-3 py-2 font-system text-[11px] uppercase"
            >
              <span className="text-ink">[ {row.label} ]</span>
              <span className={row.warn ? 'text-warn' : 'text-ink-faint'}>{row.figure}</span>
            </button>
          </li>
        ))}
      </ul>
    </SystemWindow>
  )
}
