/**
 * The Daily Quest, with per-item progress entered by hand — never inferred
 * from logged sets inside a gate. 40 sit-ups inside a gate are not the Daily
 * Quest's sit-ups unless the hunter says so (F2).
 *
 * Renders nothing once there is no quest for today, which is the honest
 * state on a rest day — the System asks for nothing and shows nothing.
 *
 * Selects the raw `quests` slice and derives locally rather than calling
 * `todaysDailyQuest()` (the store method of the same name) inside the
 * selector — `check:render` (rule 13) forbids a selector calling any store
 * method outright, since it cannot verify per-method reference stability.
 */
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { activeQuestFor, type DailyQuestItem, type DailyQuestPayload } from '../domain/quests'
import { SystemMeter } from './SystemMeter'
import { SystemValue } from './SystemValue'
import { SystemWindow } from './SystemWindow'

/**
 * Owns its own `SystemWindow` rather than being wrapped in one by its
 * caller, so a rest day (no quest issued) renders nothing at all — not an
 * empty bordered window with nothing under it.
 */
export function DailyQuestPanel({ strong = false }: { strong?: boolean }) {
  const quests = useApp((s) => s.quests)
  const today = useApp((s) => s.today)
  const completeDailyQuest = useApp((s) => s.completeDailyQuest)

  const quest = useMemo(() => {
    const row = activeQuestFor(quests, today, 'daily')
    return (row?.payload as DailyQuestPayload | undefined) ?? null
  }, [quests, today])

  if (!quest) return null

  return (
    <SystemWindow title="Daily Quest" strong={strong}>
      <div className="flex flex-col gap-3">
        <p className="font-system text-[11px] text-ink-faint uppercase">
          {quest.xpReward} xp · {quest.goldReward} gold
        </p>
        {quest.items.map((item) => (
          <DailyQuestRow
            key={item.kind}
            item={item}
            done={quest.progress[item.kind] ?? 0}
            onAdd={(amount) => void completeDailyQuest({ [item.kind]: amount })}
          />
        ))}
      </div>
    </SystemWindow>
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
  const [entry, setEntry] = useState('')
  const pct = Math.min(100, (done / item.target) * 100)
  const met = done >= item.target

  function submit() {
    const amount = Number(entry)
    if (!Number.isFinite(amount) || amount <= 0) return
    onAdd(amount)
    setEntry('')
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="font-system text-[11px] text-ink-faint uppercase">{item.label}</span>
        <SystemValue value={done} max={item.target} unit={item.unit === 'metres' ? 'm' : undefined} size="md" />
      </div>
      <SystemMeter segments={[{ pct, tone: met ? 'good' : 'system' }]} height={10} />
      {met ? null : (
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            placeholder={item.unit === 'metres' ? 'metres just done' : 'reps just done'}
            className="w-full min-w-0 rounded border border-panel-edge bg-void-soft px-2 py-1.5 text-sm text-ink"
          />
          <button
            type="button"
            onClick={submit}
            className="shrink-0 rounded bg-system-deep px-3 py-1.5 font-system text-[10px] text-ink uppercase"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
