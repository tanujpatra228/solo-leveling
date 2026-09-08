/**
 * The Job Change Quest surface: appears once level 20 is reached (m7b-plan
 * commit 1/2), frames itself as a benchmark week, and lets the hunter take
 * it whenever ready — completion reads whatever stat distribution stands at
 * that moment, not a snapshot from when the quest arrived (m7b-plan F6).
 *
 * Selects the raw `quests` slice and derives locally, per rule 13 — a
 * selector must never call a store method (`activeJobChangeQuest`, same
 * name as the derivation below, is for call sites outside a selector).
 */
import { useMemo } from 'react'
import { useApp } from '../app/state'
import { SystemPanel } from './SystemPanel'

const MS_PER_DAY = 86_400_000

export function JobChangeQuestPanel() {
  const quests = useApp((s) => s.quests)
  const completeJobChangeQuest = useApp((s) => s.completeJobChangeQuest)

  const quest = useMemo(
    () => quests.find((q) => q.type === 'job_change' && q.status === 'issued') ?? null,
    [quests],
  )

  if (!quest) return null

  const day = Math.max(0, Math.floor((Date.now() - quest.issuedAt) / MS_PER_DAY)) + 1

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <p className="font-system text-[11px] tracking-[0.12em] text-mana uppercase">Job Change Quest</p>
      <p className="text-xs text-ink-soft">
        A benchmark week. Train as you have been — the stat distribution you have built picks your
        class the moment you take the test. Day {day}.
      </p>
      <button
        type="button"
        onClick={() => void completeJobChangeQuest()}
        className="self-start rounded bg-system-deep px-3 py-1.5 font-system text-[10px] text-ink uppercase"
      >
        Take the Job Change Quest
      </button>
    </SystemPanel>
  )
}
