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
import { PILL_BUTTON } from './buttonStyles'
import { ConfirmDialog } from './ConfirmDialog'
import { SystemWindow } from './SystemWindow'

type PendingAction = 'illness' | 'travel' | 'token' | null

export function StreakPanel({ index }: { index?: number }) {
  const streak = useApp((s) => s.streak)
  const quests = useApp((s) => s.quests)
  const restTokens = useApp((s) => s.progress.restTokens)
  const today = useApp((s) => s.today)
  const declareAbsence = useApp((s) => s.declareAbsence)
  const spendRestToken = useApp((s) => s.spendRestToken)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)

  const todaysDailyStatus = quests.find((q) => q.dayKey === today && q.type === 'daily')?.status
  const canForgiveToday = todaysDailyStatus === 'issued'

  async function declare(reason: 'illness' | 'travel') {
    if (busy) return
    setPending(null)
    setBusy(true)
    await declareAbsence(today, reason)
    setBusy(false)
  }

  async function spend() {
    if (busy || restTokens <= 0) return
    setPending(null)
    setBusy(true)
    await spendRestToken()
    setBusy(false)
  }

  return (
    <SystemWindow title="Streak" index={index}>
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
                onClick={() => setPending('illness')}
                disabled={busy}
                className={`min-h-11 border-panel-edge text-ink-faint disabled:opacity-30 ${PILL_BUTTON}`}
              >
                Ill today
              </button>
              <button
                type="button"
                onClick={() => setPending('travel')}
                disabled={busy}
                className={`min-h-11 border-panel-edge text-ink-faint disabled:opacity-30 ${PILL_BUTTON}`}
              >
                Travelling
              </button>
              <button
                type="button"
                onClick={() => setPending('token')}
                disabled={busy || restTokens <= 0}
                className={`min-h-11 border-panel-edge text-ink-faint disabled:opacity-30 ${PILL_BUTTON}`}
              >
                Spend rest token
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {pending === 'illness' || pending === 'travel' ? (
        <ConfirmDialog
          title="Declare Absence"
          message="Today's quest is marked forgiven — it will not count as a miss against your streak. There is no button in the app to undo this once confirmed."
          confirmLabel="Confirm"
          onConfirm={() => void declare(pending)}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {pending === 'token' ? (
        <ConfirmDialog
          title="Spend Rest Token"
          message={`Spend 1 of your ${restTokens} rest token${restTokens === 1 ? '' : 's'}? Today's quest is forgiven and the token is gone for good.`}
          confirmLabel="Spend token"
          onConfirm={() => void spend()}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </SystemWindow>
  )
}
