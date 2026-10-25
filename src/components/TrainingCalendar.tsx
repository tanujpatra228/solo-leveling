/**
 * The training calendar: every day a gate was cleared, month by month, and the
 * totals that a streak resets away. Reads `trainingLog`, which the store builds
 * once in `recompute()`; this only lays one month out.
 *
 * A day that was scheduled and not cleared is shown plainly rather than in red.
 * The page records what was done, and the gaps speak for themselves. Rest days
 * are dimmed so a Sunday never looks like a missed gate.
 */
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { dayKeyStart } from '../domain/time'
import {
  monthBounds,
  monthGrid,
  shiftMonth,
  type CalendarCell,
  type Elapsed,
} from '../domain/trainingCalendar'
import { SystemIcon } from './SystemIcon'
import { SystemPanel } from './SystemPanel'
import { SystemValue } from './SystemValue'

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

/** "3 months, 1 week, 2 days" — only the units that are not zero. */
export function formatElapsed(elapsed: Elapsed): string {
  const parts: string[] = []
  if (elapsed.months > 0) parts.push(plural(elapsed.months, 'month'))
  if (elapsed.weeks > 0) parts.push(plural(elapsed.weeks, 'week'))
  if (elapsed.days > 0) parts.push(plural(elapsed.days, 'day'))
  return parts.length > 0 ? parts.join(', ') : '0 days'
}

function describeCell(cell: CalendarCell): string {
  const date = dayKeyStart(cell.dayKey!)
  const name = `${date.toLocaleString('en-GB', { weekday: 'long' })} ${date.getDate()} ${date.toLocaleString('en-GB', { month: 'long' })}`
  if (cell.trained) return `${name}: gate cleared`
  if (cell.beforeStart) return name
  if (!cell.scheduled) return `${name}: rest day`
  if (cell.isFuture) return `${name}: upcoming`
  return cell.isToday ? `${name}: not cleared yet` : `${name}: not cleared`
}

function cellClass(cell: CalendarCell): string {
  const base = 'flex aspect-square flex-col items-center justify-center gap-0.5 font-body text-xs tabular-nums'
  const today = cell.isToday ? ' ring-1 ring-system' : ''
  if (cell.trained) return `${base} border border-system bg-system-deep/40 text-ink${today}`
  if (cell.beforeStart) return `${base} text-ink-faint/50${today}`
  if (!cell.scheduled) return `${base} text-ink-faint/60${today}`
  if (cell.isFuture) return `${base} border border-panel-edge/30 text-ink-faint${today}`
  return `${base} border border-panel-edge/60 text-ink-soft${today}`
}

export function TrainingCalendar() {
  const log = useApp((s) => s.trainingLog)
  const today = useApp((s) => s.today)
  const [viewed, setViewed] = useState(() => today.slice(0, 7))

  const { earliest, latest } = monthBounds(log, today)
  // Clamped on every render rather than only when navigating, so a month that
  // falls outside the bounds (the hunter's first gate moved, midnight passed)
  // can never be the one on screen.
  const shown = viewed < earliest ? earliest : viewed > latest ? latest : viewed

  const grid = useMemo(() => monthGrid(log, shown, today), [log, shown, today])
  const monthDays = grid.flat().filter((cell) => cell.trained).length
  const monthLabel = dayKeyStart(`${shown}-01`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-4">
      <SystemPanel boxed className="grid grid-cols-3 gap-2">
        <Total value={log.daysTrained} label="Days trained" />
        <div className="border-x border-panel-edge/60">
          <Total value={log.weeksTrained} label="Weeks trained" />
        </div>
        <Total value={log.monthsTrained} label="Months trained" />
      </SystemPanel>

      {log.elapsed && log.firstDayKey ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink">Training for {formatElapsed(log.elapsed)}</p>
          <p className="text-xs text-ink-faint">
            Since{' '}
            {dayKeyStart(log.firstDayKey).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">No gate cleared yet. The first one starts the count.</p>
      )}

      <SystemPanel className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            disabled={shown <= earliest}
            onClick={() => setViewed(shiftMonth(shown, -1))}
            className="flex min-h-11 min-w-11 items-center justify-center border border-panel-edge/60 disabled:opacity-30"
          >
            <SystemIcon icon={ChevronLeft} size={16} glow="none" />
          </button>
          <div className="text-center">
            <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">{monthLabel}</p>
            <p className="font-system text-[10px] text-ink-faint uppercase">
              {plural(monthDays, 'day')} this month
            </p>
          </div>
          <button
            type="button"
            aria-label="Next month"
            disabled={shown >= latest}
            onClick={() => setViewed(shiftMonth(shown, 1))}
            className="flex min-h-11 min-w-11 items-center justify-center border border-panel-edge/60 disabled:opacity-30"
          >
            <SystemIcon icon={ChevronRight} size={16} glow="none" />
          </button>
        </div>

        <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center font-system text-[10px] text-ink-faint">
          {WEEKDAY_HEADERS.map((letter, i) => (
            <span key={i}>{letter}</span>
          ))}
        </div>

        <ol className="grid grid-cols-7 gap-1">
          {grid.flat().map((cell, i) =>
            cell.dayKey === null ? (
              <li key={i} aria-hidden="true" />
            ) : (
              <li key={cell.dayKey} aria-label={describeCell(cell)} className={cellClass(cell)}>
                <span aria-hidden="true">{Number(cell.dayKey.slice(8))}</span>
                {cell.trained ? <SystemIcon icon={Check} size={12} glow="none" /> : null}
              </li>
            ),
          )}
        </ol>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-system text-[10px] text-ink-faint uppercase">
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 border border-system bg-system-deep/40" />
            Gate cleared
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 border border-panel-edge/60" />
            Not cleared
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 text-ink-faint/60">–</span>
            Rest day
          </li>
        </ul>
      </SystemPanel>
    </div>
  )
}

function Total({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col justify-center gap-1 p-2.5">
      <SystemValue value={value} size="md" />
      <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">{label}</span>
    </div>
  )
}
