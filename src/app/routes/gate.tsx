/**
 * Today's Gate, read-only.
 *
 * The programme on the phone before logging exists: what today asks for, in
 * the order the routine defines it, with the rest each item wants and the cue
 * attached to it. Nothing here writes, so it needs no profile and no session —
 * it reads the seeded week, which is already built and tested.
 *
 * Supersets need no special rule. The seed encodes the convention in the data:
 * `restSec: 0` on the non-final item means go straight over to the next
 * exercise, and the real rest sits on the last one.
 */
import { createRoute } from '@tanstack/react-router'
import { SystemWindow } from '../../components/SystemWindow'
import { SystemPanel } from '../../components/SystemPanel'
import { addDaysToKey, dayKeyStart, dayOfWeekForKey } from '../../domain/time'
import type { Block, DayKey, Exercise, Routine } from '../../domain/types'
import { useApp } from '../state'
import { rootRoute } from './root'

export const gateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gate',
  component: TodaysGateScreen,
})

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatDayKey(key: DayKey): string {
  const date = dayKeyStart(key)
  return `${WEEKDAY[date.getDay()]} ${date.getDate()} ${date.toLocaleString('en-GB', { month: 'long' })}`
}

/** Rest in the shape a person reads it: "2m 30s", not "150 seconds". */
function formatRest(seconds: number): string {
  if (seconds === 0) return 'straight over'
  if (seconds < 60) return `${seconds}s rest`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes}m rest` : `${minutes}m ${remainder}s rest`
}

function TodaysGateScreen() {
  const today = useApp((s) => s.today)
  const routines = useApp((s) => s.routines)
  const exercises = useApp((s) => s.exercises)
  const isRestDay = useApp((s) => s.isRestDay)

  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const routineFor = (day: DayKey) =>
    routines.find((r) => r.dayOfWeek === dayOfWeekForKey(day))

  const todaysRoutine = routineFor(today)

  /* ---- the next scheduled day, so a rest day still tells you what is coming ---- */
  let nextDay: DayKey | null = null
  let nextRoutine: Routine | undefined
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDaysToKey(today, offset)
    const found = routineFor(candidate)
    if (found) {
      nextDay = candidate
      nextRoutine = found
      break
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <header className="px-1">
        <p className="font-system text-[11px] tracking-[0.2em] text-ink-faint uppercase">
          {formatDayKey(today)}
        </p>
      </header>

      {todaysRoutine ? (
        <GateWindow routine={todaysRoutine} exerciseById={exerciseById} strong />
      ) : (
        <SystemWindow title="Rest Day" strong>
          <p className="text-sm text-ink-soft">
            {isRestDay(today)
              ? 'Nothing is scheduled today. The System asks for nothing, takes nothing away, and your streak holds.'
              : 'No gate is assigned to today.'}
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Recovery is when the work you already did becomes strength. Eat, sleep, and come back.
          </p>
        </SystemWindow>
      )}

      {nextDay && nextRoutine ? (
        <GateWindow
          routine={nextRoutine}
          exerciseById={exerciseById}
          upcomingLabel={todaysRoutine ? 'Next' : formatDayKey(nextDay)}
        />
      ) : null}

      <p className="px-1 pb-2 font-system text-[10px] leading-relaxed text-ink-faint">
        Read-only preview. Set logging, targets and the rest timer arrive in the next milestone.
      </p>
    </main>
  )
}

interface GateWindowProps {
  routine: Routine
  exerciseById: Map<string, Exercise>
  strong?: boolean
  upcomingLabel?: string
}

function GateWindow({ routine, exerciseById, strong, upcomingLabel }: GateWindowProps) {
  const workingSets = routine.blocks
    .flatMap((b) => b.items)
    .reduce((total, item) => total + item.sets, 0)

  return (
    <SystemWindow
      title={upcomingLabel ? `${upcomingLabel} — ${routine.name}` : routine.name}
      strong={strong}
      footer={
        <p className="font-system text-[11px] text-ink-faint">
          Rank {routine.gateRank} · {workingSets} working sets · {routine.blocks.length} blocks
        </p>
      }
    >
      <div className="flex flex-col gap-3">
        {routine.blocks.map((block, index) => (
          <SystemPanel key={index}>
            <BlockRows block={block} exerciseById={exerciseById} />
          </SystemPanel>
        ))}
      </div>
    </SystemWindow>
  )
}

function BlockRows({
  block,
  exerciseById,
}: {
  block: Block
  exerciseById: Map<string, Exercise>
}) {
  const isSuperset = block.type === 'superset'

  return (
    <div className={isSuperset ? 'border-l-2 border-system-dim pl-3' : ''}>
      {isSuperset ? (
        <p className="mb-2 font-system text-[10px] tracking-[0.16em] text-system-dim uppercase">
          Superset · alternating
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {block.items.map((item) => {
          const exercise = exerciseById.get(item.exerciseId)
          return (
            <li key={item.exerciseId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">
                  {exercise?.name ?? item.exerciseId}
                </span>
                <span className="font-system text-xs whitespace-nowrap text-ink-soft tabular-nums">
                  {item.sets} × {item.repRange[0]}–{item.repRange[1]}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="font-system text-[10px] text-ink-faint">
                  {exercise?.unit === 'kg' ? 'loaded' : (exercise?.unit ?? 'reps')}
                </span>
                <span
                  className={`font-system text-[10px] tabular-nums ${
                    item.restSec === 0 ? 'text-system-dim' : 'text-ink-faint'
                  }`}
                >
                  {formatRest(item.restSec)}
                </span>
              </div>
              {exercise?.cue ? (
                <p className="mt-1 text-[11px] leading-snug text-ink-soft/80">{exercise.cue}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
