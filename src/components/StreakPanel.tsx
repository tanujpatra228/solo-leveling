/**
 * The streak, rest tokens, and the forgiveness controls over the store
 * actions that already exist (`declareAbsence`, `spendRestToken`) — no new
 * domain work, just wiring.
 *
 * The controls show only while today's own daily-quest row is still
 * `issued`. `streak.todayPending` looks like the right flag but isn't: it
 * means "not complete, missed, or rest", which a *forgiven* today still
 * satisfies — gating on it would leave the buttons showing right after
 * declaring illness, since forgiving today doesn't change `todayPending`.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import { SystemWindow } from './SystemWindow'

export function StreakPanel() {
  const streak = useApp((s) => s.streak)
  const quests = useApp((s) => s.quests)
  const restTokens = useApp((s) => s.progress.restTokens)
  const today = useApp((s) => s.today)
  const declareAbsence = useApp((s) => s.declareAbsence)
  const spendRestToken = useApp((s) => s.spendRestToken)
  const [busy, setBusy] = useState(false)

  const todaysDailyStatus = quests.find((q) => q.dayKey === today && q.type === 'daily')?.status
  const canForgiveToday = todaysDailyStatus === 'issued'

  async function declare(reason: 'illness' | 'travel') {
    if (busy) return
    setBusy(true)
    await declareAbsence(today, reason)
    setBusy(false)
  }

  async function spend() {
    if (busy || restTokens <= 0) return
    setBusy(true)
    await spendRestToken()
    setBusy(false)
  }

  return (
    <SystemWindow title="Streak">
      <div className="flex flex-col gap-2">
        <p className="font-system text-[11px] text-ink-soft">
          Streak {streak.current}
          {streak.longest > streak.current ? ` · best ${streak.longest}` : ''}
        </p>

        {canForgiveToday ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-system text-[10px] text-ink-faint uppercase">
              {restTokens} rest token{restTokens === 1 ? '' : 's'}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void declare('illness')}
                disabled={busy}
                className="rounded-full border border-panel-edge px-2 py-1 font-system text-[10px] text-ink-faint uppercase disabled:opacity-30"
              >
                Ill today
              </button>
              <button
                type="button"
                onClick={() => void declare('travel')}
                disabled={busy}
                className="rounded-full border border-panel-edge px-2 py-1 font-system text-[10px] text-ink-faint uppercase disabled:opacity-30"
              >
                Travelling
              </button>
              <button
                type="button"
                onClick={() => void spend()}
                disabled={busy || restTokens <= 0}
                className="rounded-full border border-panel-edge px-2 py-1 font-system text-[10px] text-ink-faint uppercase disabled:opacity-30"
              >
                Spend rest token
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </SystemWindow>
  )
}
