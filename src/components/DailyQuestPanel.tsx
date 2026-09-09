/**
 * The Daily Quest, with per-item progress entered by hand — never inferred
 * from logged sets inside a gate. 40 sit-ups inside a gate are not the Daily
 * Quest's sit-ups unless the hunter says so (F2).
 *
 * Renders nothing once there is no quest for today, which is the honest
 * state on a rest day — the System asks for nothing and shows nothing.
 *
 * `DailyQuestWindow` is the presentational half, taking `now` as a prop
 * rather than reading `Date.now()` itself, so the deadline ring's fraction is
 * testable against an injected clock (m10-plan commit 4) without seeding the
 * store. `DailyQuestPanel` is the thin connected wrapper — it selects the raw
 * `quests` slice and derives locally rather than calling `todaysDailyQuest()`
 * (the store method of the same name) inside the selector, since
 * `check:render` (rule 13) forbids a selector calling any store method
 * outright, as it cannot verify per-method reference stability.
 */
import { CheckSquare, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../app/state'
import {
  activeQuestFor,
  isDailyQuestComplete,
  type DailyItemKind,
  type DailyQuestItem,
  type DailyQuestPayload,
} from '../domain/quests'
import { dayFractionRemainingPct, deadlineRingTone } from '../domain/time'
import type { DayKey } from '../domain/types'
import { PILL_BUTTON } from './buttonStyles'
import { SegmentedRing } from './SegmentedRing'
import { SystemIcon } from './SystemIcon'
import { SystemMeter } from './SystemMeter'
import { SystemValue } from './SystemValue'
import { SystemWindow } from './SystemWindow'

/** §1.5: quoted System voice, not an invented warning. */
const PENALTY_LINE = 'Failure to comply with the system may result in a penalty.'

/** Shared so a task row keeps the same footprint whether it is met or not (gym rule 4). */
const ROW_HEIGHT = 'min-h-[132px]'

/** Gym rule 1: no keyboard between sets. Manual entry survives behind a MANUAL pill for anything off these steps. */
const STEP_AMOUNTS: Record<'reps' | 'metres', readonly number[]> = {
  reps: [1, 5, 10],
  metres: [100, 250, 500],
}

export function DailyQuestPanel({ strong = false }: { strong?: boolean }) {
  const quests = useApp((s) => s.quests)
  const today = useApp((s) => s.today)
  const completeDailyQuest = useApp((s) => s.completeDailyQuest)

  const quest = useMemo(() => {
    const row = activeQuestFor(quests, today, 'daily')
    return (row?.payload as DailyQuestPayload | undefined) ?? null
  }, [quests, today])

  // A day-scale ring does not need per-second ticks the way the few-minute
  // rest timer does — a minute of drift on a 24-hour ring is invisible.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  if (!quest) return null

  return (
    <DailyQuestWindow
      quest={quest}
      today={today}
      now={now}
      strong={strong}
      onAdd={(kind, amount) => void completeDailyQuest({ [kind]: amount })}
    />
  )
}

export function DailyQuestWindow({
  quest,
  today,
  now,
  strong = false,
  onAdd,
}: {
  quest: DailyQuestPayload
  today: DayKey
  now: number
  strong?: boolean
  onAdd: (kind: DailyItemKind, amount: number) => void
}) {
  const complete = isDailyQuestComplete(quest, quest.progress)
  const deadlinePct = dayFractionRemainingPct(today, now)
  const deadlineTone = deadlineRingTone(today, now)

  const outstanding = quest.items.filter((item) => (quest.progress[item.kind] ?? 0) < item.target)
  const cleared = quest.items.filter((item) => (quest.progress[item.kind] ?? 0) >= item.target)

  return (
    <SystemWindow title="Daily Quest" strong={strong}>
      <div className="flex items-center gap-4">
        <SegmentedRing pct={deadlinePct} tone={deadlineTone} size={44} strokeWidth={4} />
        <div className="min-w-0 flex-1">
          {complete ? (
            <p className="font-body text-sm font-semibold text-good">Daily Quest cleared.</p>
          ) : (
            <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint uppercase">Reward</p>
          )}
          <div className="mt-2 flex items-baseline gap-3">
            <SystemValue value={`+${quest.xpReward}`} unit="XP" size="md" />
            <SystemValue value={`+${quest.goldReward}`} unit="GOLD" size="md" />
          </div>
        </div>
      </div>

      {complete ? null : (
        <>
          <p className="mt-3 font-body text-xs text-warn">{PENALTY_LINE}</p>
          <div className="mt-3 flex flex-col gap-3">
            {outstanding.length > 0 ? (
              <>
                <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint uppercase">Goal</p>
                {outstanding.map((item) => (
                  <DailyQuestRow
                    key={item.kind}
                    item={item}
                    done={quest.progress[item.kind] ?? 0}
                    onAdd={(amount) => onAdd(item.kind, amount)}
                  />
                ))}
              </>
            ) : null}
            {cleared.length > 0 ? (
              <>
                <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint/60 uppercase">Cleared</p>
                {cleared.map((item) => (
                  <DailyQuestClearedRow key={item.kind} item={item} done={quest.progress[item.kind] ?? 0} />
                ))}
              </>
            ) : null}
          </div>
        </>
      )}
    </SystemWindow>
  )
}

function BracketedTaskValue({ done, item }: { done: number; item: DailyQuestItem }) {
  return (
    <span className="flex items-baseline font-body text-ink">
      <span>[</span>
      <SystemValue value={done} max={item.target} unit={item.unit === 'metres' ? 'm' : undefined} size="md" />
      <span>]</span>
    </span>
  )
}

function DailyQuestRow({
  item,
  done,
  onAdd,
}: {
  item: DailyQuestItem
  done: number
  onAdd: (amount: number) => void
}) {
  const [manual, setManual] = useState(false)
  const [entry, setEntry] = useState('')
  const pct = Math.min(100, (done / item.target) * 100)
  const unitSuffix = item.unit === 'metres' ? 'm' : ''

  function submit() {
    const amount = Number(entry)
    if (!Number.isFinite(amount) || amount <= 0) return
    onAdd(amount)
    setEntry('')
  }

  return (
    <div className={`flex flex-col gap-2 ${ROW_HEIGHT}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-system text-[11px] text-ink-faint uppercase">{item.label}</span>
        <div className="flex items-center gap-2">
          <BracketedTaskValue done={done} item={item} />
          <SystemIcon icon={Square} tone="faint" size={16} glow="none" label={`${item.label} outstanding`} />
        </div>
      </div>
      <SystemMeter segments={[{ pct, tone: 'system' }]} height={10} />
      {manual ? (
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            placeholder={item.unit === 'metres' ? 'metres just done' : 'reps just done'}
            className="min-h-14 w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={submit}
            className="min-h-14 shrink-0 rounded bg-system-deep px-3 font-system text-[10px] text-ink uppercase"
          >
            Add
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {STEP_AMOUNTS[item.unit].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onAdd(amount)}
              className="min-h-14 flex-1 rounded border border-panel-edge bg-void-soft font-body text-xs font-semibold text-ink"
            >
              +{amount}
              {unitSuffix}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setManual(true)}
            className={`min-h-14 shrink-0 border-panel-edge text-ink-faint ${PILL_BUTTON}`}
          >
            Manual
          </button>
        </div>
      )}
    </div>
  )
}

function DailyQuestClearedRow({ item, done }: { item: DailyQuestItem; done: number }) {
  return (
    <div className={`flex flex-col justify-center gap-1 ${ROW_HEIGHT}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-system text-[11px] text-ink-faint/70 uppercase">{item.label}</span>
        <div className="flex items-center gap-2">
          <BracketedTaskValue done={done} item={item} />
          <SystemIcon icon={CheckSquare} tone="good" size={16} glow="none" label={`${item.label} met`} />
        </div>
      </div>
    </div>
  )
}
