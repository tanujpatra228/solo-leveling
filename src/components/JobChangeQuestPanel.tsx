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
import { SystemWindow } from './SystemWindow'

const MS_PER_DAY = 86_400_000

export function JobChangeQuestPanel({ strong = false }: { strong?: boolean }) {
  const quests = useApp((s) => s.quests)
  const completeJobChangeQuest = useApp((s) => s.completeJobChangeQuest)

  const quest = useMemo(
    () => quests.find((q) => q.type === 'job_change' && q.status === 'issued') ?? null,
    [quests],
  )

  if (!quest) return null

  const day = Math.max(0, Math.floor((Date.now() - quest.issuedAt) / MS_PER_DAY)) + 1

  return (
    <SystemWindow
      title="Job Change Quest"
      strong={strong}
      footer={
        <button
          type="button"
          onClick={() => void completeJobChangeQuest()}
          className="w-full rounded bg-system-deep px-5 py-3 font-system text-xs text-ink uppercase"
        >
          Take the Job Change Quest
        </button>
      }
    >
      <p className="text-center text-xs text-ink-soft">
        A benchmark week. Train as you have been — the stat distribution you have built picks your
        class the moment you take the test. Day {day}.
      </p>
    </SystemWindow>
  )
}
