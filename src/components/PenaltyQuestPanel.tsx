/**
 * The Penalty Quest — yesterday's unfinished Daily Quest, carried forward at
 * a surcharge (`domain/quests.ts`'s `generatePenaltyQuest`). Previously
 * computed, announced once as a message that scrolled away in six seconds,
 * and then silently discharged the moment an unrelated fresh Daily Quest was
 * completed — meaning the surcharge was never actually owed by anything
 * (found on a real device: the hunter had no way to see or act on it after
 * the notification vanished). This panel is that missing surface: it renders
 * only while a penalty is outstanding, and clears only on its own progress,
 * through `completePenaltyQuest` — never as a side effect of the regular
 * Daily Quest.
 *
 * Reuses the Daily Quest's row/stepper components rather than duplicating
 * them — a penalty item and a daily item are logged the same way, by hand,
 * never inferred from a set logged inside a gate (F2).
 */
import { useMemo } from 'react'
import { useApp } from '../app/state'
import { activeQuestFor, isDailyQuestComplete, type DailyItemKind, type PenaltyQuestPayload } from '../domain/quests'
import { DailyQuestClearedRow, DailyQuestRow } from './DailyQuestPanel'
import { SystemWindow } from './SystemWindow'

export function PenaltyQuestPanel({ strong = false, index }: { strong?: boolean; index?: number }) {
  const quests = useApp((s) => s.quests)
  const today = useApp((s) => s.today)
  const completePenaltyQuest = useApp((s) => s.completePenaltyQuest)

  const quest = useMemo(() => {
    const row = activeQuestFor(quests, today, 'penalty')
    return (row?.payload as PenaltyQuestPayload | undefined) ?? null
  }, [quests, today])

  if (!quest) return null

  return (
    <PenaltyQuestWindow
      quest={quest}
      strong={strong}
      index={index}
      onAdd={(kind, amount) => void completePenaltyQuest({ [kind]: amount })}
    />
  )
}

export function PenaltyQuestWindow({
  quest,
  strong = false,
  index,
  onAdd,
}: {
  quest: PenaltyQuestPayload
  strong?: boolean
  index?: number
  onAdd: (kind: DailyItemKind, amount: number) => void
}) {
  const complete = isDailyQuestComplete(quest, quest.progress)
  const outstanding = quest.items.filter((item) => (quest.progress[item.kind] ?? 0) < item.target)
  const cleared = quest.items.filter((item) => (quest.progress[item.kind] ?? 0) >= item.target)

  return (
    <SystemWindow title="Penalty Quest" strong={strong} index={index}>
      {complete ? (
        <p className="font-body text-sm font-semibold text-good">Penalty Quest cleared. Nothing further owed.</p>
      ) : (
        <>
          <p className="font-body text-xs text-danger">{quest.reassurance}</p>
          <div className="mt-3 flex flex-col gap-3">
            {outstanding.length > 0 ? (
              <>
                <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint uppercase">Outstanding</p>
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
