/**
 * Today's Gate.
 *
 * No session open: a read-only preview of today's routine (and the next
 * scheduled day, on a rest day) with a Start Gate action. A session open:
 * every block and item in the order the routine defines, each carrying its
 * target from the progression engine — `weightKg`, one rep target per set,
 * the plain-language `reason`, and the cue — with a thumb-sized entry form
 * for the next set. `logSet` no-ops silently with no active session, so this
 * screen must not (and does not) render entry without one.
 *
 * Supersets need no special rest rule — the seed already encodes it via
 * `restSec: 0` on the non-final item — so the only superset-specific
 * behaviour here is the visual grouping, not the rest logic.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { createRoute } from '@tanstack/react-router'
import { ChoiceGroup, type ChoiceOption } from '../../components/ChoiceGroup'
import { SegmentedRing } from '../../components/SegmentedRing'
import { SystemWindow } from '../../components/SystemWindow'
import { SystemPanel } from '../../components/SystemPanel'
import { dropSuperseded } from '../../domain/projection'
import type { NextTarget, ProgressionKind } from '../../domain/progression'
import type { SubstituteCandidate } from '../../domain/substitution'
import { addDaysToKey, dayKeyStart, dayOfWeekForKey } from '../../domain/time'
import type {
  Block,
  BlockItem,
  DayKey,
  Exercise,
  Routine,
  SessionLog,
  SetLog,
  SubstitutionReason,
} from '../../domain/types'
import { useApp } from '../state'
import { useRestTimer } from '../useRestTimer'
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

/**
 * Each kind of prescription reads differently on purpose: "no record of this
 * movement" and "reps are there but the effort is above RPE 8" are not the
 * same message and should not look the same.
 */
const KIND_TONE_CLASS: Record<ProgressionKind, string> = {
  increase_load: 'text-good',
  advance_variation: 'text-good',
  hold_add_rep: 'text-system',
  add_external_load: 'text-system',
  no_history: 'text-ink-faint',
  repeat_session: 'text-warn',
  reduce_load: 'text-warn',
  slow_the_tempo: 'text-warn',
}

function liveSessionSets(sets: readonly SetLog[], sessionId: string, exerciseId: string): SetLog[] {
  return dropSuperseded(sets.filter((s) => s.sessionId === sessionId && s.exerciseId === exerciseId)).sort(
    (a, b) => a.order - b.order,
  )
}

function TodaysGateScreen() {
  const today = useApp((s) => s.today)
  const routines = useApp((s) => s.routines)
  const exercises = useApp((s) => s.exercises)
  const isRestDay = useApp((s) => s.isRestDay)
  const activeSessionId = useApp((s) => s.activeSessionId)
  const sessions = useApp((s) => s.sessions)
  const startGate = useApp((s) => s.startGate)
  const [starting, setStarting] = useState(false)

  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const routineFor = (day: DayKey) => routines.find((r) => r.dayOfWeek === dayOfWeekForKey(day))
  const todaysRoutine = routineFor(today)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const activeRoutine = activeSession?.routineId
    ? routines.find((r) => r.id === activeSession.routineId)
    : undefined

  // `finishGate` clears activeSessionId, so a finished session and "no
  // session ever started" are otherwise indistinguishable here — without
  // this, the preview below shows Start Gate again for a gate already
  // cleared today.
  const clearedToday = todaysRoutine
    ? sessions.some(
        (s) => s.dayKey === today && s.routineId === todaysRoutine.id && s.endedAt !== null,
      )
    : false

  if (activeSession && activeRoutine) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4">
        <ActiveGateScreen routine={activeRoutine} session={activeSession} exerciseById={exerciseById} />
      </main>
    )
  }

  async function start(routineId: string) {
    if (starting) return
    setStarting(true)
    await startGate(routineId)
    setStarting(false)
  }

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
        <GateWindow
          routine={todaysRoutine}
          exerciseById={exerciseById}
          strong
          upcomingLabel={clearedToday ? 'Cleared' : undefined}
          footer={
            clearedToday ? (
              <button
                type="button"
                onClick={() => void start(todaysRoutine.id)}
                disabled={starting}
                className="w-full font-system text-[11px] text-ink-faint uppercase underline disabled:opacity-30"
              >
                Log another session today
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start(todaysRoutine.id)}
                disabled={starting}
                className="w-full rounded bg-system-deep px-5 py-3 font-system text-xs text-ink uppercase disabled:opacity-30"
              >
                Start Gate
              </button>
            )
          }
        />
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
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Read-only preview — no session open yet                            */
/* ------------------------------------------------------------------ */

interface GateWindowProps {
  routine: Routine
  exerciseById: Map<string, Exercise>
  strong?: boolean
  upcomingLabel?: string
  footer?: ReactNode
}

function GateWindow({ routine, exerciseById, strong, upcomingLabel, footer }: GateWindowProps) {
  const workingSets = routine.blocks.flatMap((b) => b.items).reduce((total, item) => total + item.sets, 0)

  return (
    <SystemWindow
      title={upcomingLabel ? `${upcomingLabel} — ${routine.name}` : routine.name}
      strong={strong}
      footer={
        <div className="flex flex-col gap-3">
          <p className="font-system text-[11px] text-ink-faint">
            Rank {routine.gateRank} · {workingSets} working sets · {routine.blocks.length} blocks
          </p>
          {footer}
        </div>
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

function BlockRows({ block, exerciseById }: { block: Block; exerciseById: Map<string, Exercise> }) {
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
                <span className="min-w-0 text-sm font-medium text-ink">{exercise?.name ?? item.exerciseId}</span>
                <span className="shrink-0 font-system text-xs whitespace-nowrap text-ink-soft tabular-nums">
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

/* ------------------------------------------------------------------ */
/* Live session                                                        */
/* ------------------------------------------------------------------ */

function ActiveGateScreen({
  routine,
  session,
  exerciseById,
}: {
  routine: Routine
  session: SessionLog
  exerciseById: Map<string, Exercise>
}) {
  const finishGate = useApp((s) => s.finishGate)
  const abandonGate = useApp((s) => s.abandonGate)
  const [finishing, setFinishing] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const restTimer = useRestTimer()

  async function finish() {
    if (finishing) return
    restTimer.clear()
    setFinishing(true)
    await finishGate()
    setFinishing(false)
  }

  async function abandon() {
    if (abandoning) return
    if (!window.confirm('Discard this gate? Anything logged in it is deleted, not just left unfinished.')) {
      return
    }
    restTimer.clear()
    setAbandoning(true)
    await abandonGate()
    setAbandoning(false)
  }

  return (
    <>
      <SystemWindow
        title={routine.name}
        strong
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing || abandoning}
              className="w-full rounded bg-system-deep px-5 py-3 font-system text-xs text-ink uppercase disabled:opacity-30"
            >
              Finish Gate
            </button>
            <button
              type="button"
              onClick={() => void abandon()}
              disabled={finishing || abandoning}
              className="w-full font-system text-[11px] text-ink-faint uppercase underline disabled:opacity-30"
            >
              Abandon gate
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {routine.blocks.map((block, index) => (
            <SystemPanel key={index}>
              {block.type === 'superset' ? (
                <p className="mb-2 font-system text-[10px] tracking-[0.16em] text-system-dim uppercase">
                  Superset · alternating
                </p>
              ) : null}
              <div
                className={
                  block.type === 'superset'
                    ? 'flex flex-col gap-4 border-l-2 border-system-dim pl-3'
                    : 'flex flex-col gap-4'
                }
              >
                {block.items.map((item) => {
                  const exercise = exerciseById.get(item.exerciseId)
                  if (!exercise) return null
                  return (
                    <ActiveBlockItem
                      key={item.exerciseId}
                      sessionId={session.id}
                      item={item}
                      exercise={exercise}
                      exerciseById={exerciseById}
                      onSetLogged={(loggedExercise) => restTimer.start(item.restSec, loggedExercise.name)}
                    />
                  )
                })}
              </div>
            </SystemPanel>
          ))}
        </div>
      </SystemWindow>

      {restTimer.state ? (
        <div className="sticky bottom-14 z-30 mx-auto flex w-full max-w-md items-center gap-4 rounded-none border border-panel-edge bg-panel px-4 py-3 shadow-system">
          <div className="relative size-14 shrink-0">
            <SegmentedRing pct={restTimer.state.pct} tone={restTimer.state.remaining <= 10 ? 'warn' : 'system'} />
            <span className="absolute inset-0 grid place-items-center font-system text-xs text-system tabular-nums">
              {restTimer.state.display}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-system text-[10px] tracking-[0.18em] text-ink-faint uppercase">
              {restTimer.state.label}
            </p>
            <button
              type="button"
              onClick={restTimer.clear}
              className="mt-1 font-system text-[10px] text-ink-faint uppercase underline"
            >
              Skip rest
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ActiveBlockItem({
  sessionId,
  item,
  exercise,
  exerciseById,
  onSetLogged,
}: {
  sessionId: string
  item: BlockItem
  exercise: Exercise
  exerciseById: Map<string, Exercise>
  onSetLogged: (loggedExercise: Exercise) => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // Select the maps, never a call through targetFor or a fresh substitutesFor
  // call. Whether a store method returns a stable reference is knowledge held
  // in another file and one edit away from being false again — rule 13.
  const targetsByExerciseId = useApp((s) => s.targetsByExerciseId)
  const substitutesByExerciseId = useApp((s) => s.substitutesByExerciseId)
  const activeSubstitutions = useApp((s) => s.activeSubstitutions)
  const substituteExercise = useApp((s) => s.substituteExercise)
  const clearSubstitution = useApp((s) => s.clearSubstitution)
  const sets = useApp((s) => s.sets)

  const activeSub = activeSubstitutions[item.exerciseId]
  // A block never blocks on an unresolvable id — the store only ever stamps
  // this from a real candidate — but falling back to the planned exercise
  // keeps the screen rendering if that assumption is ever wrong.
  const effectiveExercise = activeSub ? (exerciseById.get(activeSub.substituteId) ?? exercise) : exercise

  const target = targetsByExerciseId[effectiveExercise.id] ?? null
  const logged = useMemo(
    () => liveSessionSets(sets, sessionId, effectiveExercise.id),
    [sets, sessionId, effectiveExercise.id],
  )

  if (!target) return null

  const remaining = item.sets - logged.length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-medium text-ink">
          {effectiveExercise.name}
          {activeSub ? (
            <span className="ml-1 font-system text-[10px] text-system-dim uppercase"> · swapped</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-system text-xs text-ink-soft tabular-nums">
            {logged.length}/{item.sets} sets
          </span>
          <button
            type="button"
            onClick={() => setSheetOpen((open) => !open)}
            className="rounded-full border border-panel-edge px-2 py-1 font-system text-[10px] text-ink-faint uppercase"
          >
            Swap
          </button>
        </span>
      </div>

      {sheetOpen ? (
        <SwapSheet
          plannedExercise={exercise}
          activeSub={activeSub}
          candidates={substitutesByExerciseId[item.exerciseId] ?? []}
          onChoose={(substituteId, reason) => {
            substituteExercise(item.exerciseId, substituteId, reason)
            setSheetOpen(false)
          }}
          onRevert={() => {
            clearSubstitution(item.exerciseId)
            setSheetOpen(false)
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      <p className={`text-xs ${KIND_TONE_CLASS[target.kind]}`}>{target.reason}</p>
      {target.cue ? <p className="text-[11px] text-ink-soft/80">{target.cue}</p> : null}

      {logged.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {logged.map((set) => (
            <LoggedSetRow key={set.id} set={set} />
          ))}
        </ul>
      ) : null}

      {remaining > 0 ? (
        <SetEntryRow
          exercise={effectiveExercise}
          setIndex={logged.length}
          target={target}
          substitutedFor={activeSub ? item.exerciseId : undefined}
          substitutionReason={activeSub?.reason}
          onLogged={() => onSetLogged(effectiveExercise)}
        />
      ) : (
        <p className="font-system text-[11px] text-good uppercase">Done</p>
      )}
    </div>
  )
}

const REASON_OPTIONS: ChoiceOption<SubstitutionReason>[] = [
  { value: 'occupied', label: 'Occupied' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'injury', label: 'Injury' },
  { value: 'preference', label: 'Preference' },
]

/**
 * Opened from every block, per commit 6b2b0eb (docs/TODO.md). Assumes
 * the planned exercise's own equipment is the problem (`candidates` already
 * excludes it — see `substitutesByExerciseId`), so the common case is two
 * taps: Swap, then pick. "Also occupied" narrows further client-side, since
 * the base ranking already did the one query that matters.
 */
function SwapSheet({
  plannedExercise,
  activeSub,
  candidates,
  onChoose,
  onRevert,
  onClose,
}: {
  plannedExercise: Exercise
  activeSub: { substituteId: string; reason: SubstitutionReason } | undefined
  candidates: SubstituteCandidate[]
  onChoose: (substituteId: string, reason: SubstitutionReason) => void
  onRevert: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState<SubstitutionReason[]>(['occupied'])
  const [alsoBlocked, setAlsoBlocked] = useState<string[]>([])

  const equipmentOptions = useMemo(() => {
    const tags = new Set<string>()
    for (const candidate of candidates) {
      for (const eq of candidate.exercise.equipment) tags.add(eq)
    }
    return Array.from(tags)
      .sort()
      .map((eq) => ({ value: eq, label: eq.replace('_', ' ') }))
  }, [candidates])

  const visible = candidates.filter((c) => !c.exercise.equipment.some((eq) => alsoBlocked.includes(eq)))

  return (
    <div className="flex flex-col gap-3 rounded border border-panel-edge/70 bg-void-soft/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 font-system text-[11px] tracking-[0.12em] text-ink-faint uppercase">
          Swap {plannedExercise.name}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 font-system text-[10px] text-ink-faint uppercase underline"
        >
          Close
        </button>
      </div>

      {activeSub ? (
        <button
          type="button"
          onClick={onRevert}
          className="rounded border border-panel-edge px-3 py-2 text-left text-xs text-ink-soft"
        >
          Revert to {plannedExercise.name} — the prescribed movement
        </button>
      ) : null}

      <ChoiceGroup<SubstitutionReason>
        label="Why"
        options={REASON_OPTIONS}
        value={reason}
        onChange={setReason}
      />

      {equipmentOptions.length > 0 ? (
        <ChoiceGroup<string>
          label="Also occupied"
          options={equipmentOptions}
          value={alsoBlocked}
          onChange={setAlsoBlocked}
          multi
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="text-xs text-ink-faint">
          Nothing else fits your gym right now. Close this and keep going as prescribed, or come back once
          something frees up.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((candidate) => (
            <li key={candidate.exercise.id}>
              <button
                type="button"
                onClick={() => onChoose(candidate.exercise.id, reason[0] ?? 'occupied')}
                className="w-full rounded border border-panel-edge px-3 py-2 text-left"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium text-ink">{candidate.exercise.name}</span>
                  <span className="shrink-0 font-system text-[10px] text-ink-faint uppercase">
                    Tier {candidate.tier}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-soft/80">{candidate.why}</span>
                <span className="mt-1 block font-system text-[10px] text-ink-faint">
                  {candidate.exercise.equipment.join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => ({ value: String(v), label: String(v) }))

function SetEntryRow({
  exercise,
  setIndex,
  target,
  substitutedFor,
  substitutionReason,
  onLogged,
}: {
  exercise: Exercise
  setIndex: number
  target: NextTarget
  substitutedFor?: string
  substitutionReason?: SubstitutionReason
  onLogged: () => void
}) {
  const logSet = useApp((s) => s.logSet)

  // Per M3-D4: fields branch on the exercise's unit, with one exception — a
  // reps-unit exercise still needs a weight field once the engine says to
  // hang load off the body (`add_external_load`), or the prescription can't
  // be followed.
  const needsWeight = exercise.unit === 'kg' || target.kind === 'add_external_load' || target.weightKg > 0
  const needsReps = exercise.unit === 'kg' || exercise.unit === 'reps'
  const needsSeconds = exercise.unit === 'time' || exercise.unit === 'distance'
  const needsMetres = exercise.unit === 'distance'

  const [weight, setWeight] = useState(() => (target.weightKg > 0 ? String(target.weightKg) : ''))
  const [reps, setReps] = useState(() => String(target.repTargets[setIndex] ?? exercise.repRange[0]))
  const [seconds, setSeconds] = useState('')
  const [metres, setMetres] = useState('')
  const [rpe, setRpe] = useState<string[]>([])
  const [isWarmup, setIsWarmup] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    await logSet({
      exerciseId: exercise.id,
      weight: needsWeight && weight !== '' ? Number(weight) : 0,
      reps: needsReps && reps !== '' ? Number(reps) : 0,
      seconds: needsSeconds && seconds !== '' ? Number(seconds) : undefined,
      metres: needsMetres && metres !== '' ? Number(metres) : undefined,
      rpe: rpe[0] ? Number(rpe[0]) : undefined,
      isWarmup,
      substitutedFor,
      substitutionReason,
    })
    setSubmitting(false)
    onLogged()
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-2 rounded border border-panel-edge/70 p-2">
      {/*
        @container + @xs:flex-row: fields sit in a row only once this card
        actually has room for one (Tailwind's `xs` container breakpoint,
        20rem). Below that — a phone narrow enough, or a superset item's
        indentation eating into the width — they stack instead of forcing
        the row wider than its container. min-w-0 on each field is the other
        half of the same fix: a flex child's default min-width is its content
        size, and a number input's content size does not shrink on its own.
      */}
      <div className="flex min-w-0 flex-col gap-2 @xs:flex-row">
        {needsWeight ? (
          <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
            <span className="font-system text-[10px] text-ink-faint uppercase">kg</span>
            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-2 text-base text-ink"
            />
          </label>
        ) : null}
        {needsReps ? (
          <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
            <span className="font-system text-[10px] text-ink-faint uppercase">reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-2 text-base text-ink"
            />
          </label>
        ) : null}
        {needsSeconds ? (
          <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
            <span className="font-system text-[10px] text-ink-faint uppercase">sec</span>
            <input
              type="number"
              inputMode="numeric"
              value={seconds}
              onChange={(event) => setSeconds(event.target.value)}
              className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-2 text-base text-ink"
            />
          </label>
        ) : null}
        {needsMetres ? (
          <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
            <span className="font-system text-[10px] text-ink-faint uppercase">m</span>
            <input
              type="number"
              inputMode="decimal"
              value={metres}
              onChange={(event) => setMetres(event.target.value)}
              className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-2 text-base text-ink"
            />
          </label>
        ) : null}
      </div>

      <ChoiceGroup<string> label="RPE" options={RPE_OPTIONS} value={rpe} onChange={setRpe} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsWarmup((w) => !w)}
          aria-pressed={isWarmup}
          className={`rounded-full border px-3 py-1 font-system text-[10px] uppercase ${
            isWarmup ? 'border-system bg-system-deep/30 text-ink' : 'border-panel-edge text-ink-faint'
          }`}
        >
          Warmup
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="rounded bg-system-deep px-4 py-2 font-system text-xs text-ink uppercase disabled:opacity-30"
        >
          Log Set
        </button>
      </div>
    </div>
  )
}

/**
 * A logged set, correctable in place. The log itself never edits: saving
 * appends a new row that supersedes this one (`repo.correctSet`), so the
 * original survives underneath and only the replacement is ever shown.
 */
function LoggedSetRow({ set }: { set: SetLog }) {
  const correctSet = useApp((s) => s.correctSet)
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(() => String(set.weight))
  const [reps, setReps] = useState(() => String(set.reps))
  const [rpe, setRpe] = useState<string[]>(() => (set.rpe ? [String(set.rpe)] : []))
  const [isWarmup, setIsWarmup] = useState(set.isWarmup)
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 font-system text-xs text-ink-soft tabular-nums">
        <span className="min-w-0">
          {set.weight > 0 ? `${set.weight} kg × ` : ''}
          {set.reps} reps
          {set.rpe ? ` @ RPE ${set.rpe}` : ''}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {set.isWarmup ? <span className="text-ink-faint normal-case">warmup</span> : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-ink-faint normal-case underline"
          >
            correct
          </button>
        </span>
      </li>
    )
  }

  async function save() {
    if (saving) return
    setSaving(true)
    await correctSet(set.id, {
      weight: weight !== '' ? Number(weight) : undefined,
      reps: reps !== '' ? Number(reps) : undefined,
      rpe: rpe[0] ? Number(rpe[0]) : undefined,
      isWarmup,
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <li className="@container flex min-w-0 flex-col gap-2 rounded border border-panel-edge/70 p-2 normal-case">
      <div className="flex min-w-0 flex-col gap-2 @xs:flex-row">
        <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
          <span className="font-system text-[10px] text-ink-faint uppercase">kg</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.5}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-2 text-base text-ink"
          />
        </label>
        <label className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
          <span className="font-system text-[10px] text-ink-faint uppercase">reps</span>
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-2 text-base text-ink"
          />
        </label>
      </div>

      <ChoiceGroup<string> label="RPE" options={RPE_OPTIONS} value={rpe} onChange={setRpe} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsWarmup((w) => !w)}
          aria-pressed={isWarmup}
          className={`rounded-full border px-3 py-1 font-system text-[10px] uppercase ${
            isWarmup ? 'border-system bg-system-deep/30 text-ink' : 'border-panel-edge text-ink-faint'
          }`}
        >
          Warmup
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="font-system text-xs text-ink-faint uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded bg-system-deep px-4 py-2 font-system text-xs text-ink uppercase disabled:opacity-30"
          >
            Save
          </button>
        </div>
      </div>
    </li>
  )
}
