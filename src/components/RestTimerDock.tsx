/**
 * The rest-timer countdown, docked above the bottom nav on every route —
 * lifted out of gate.tsx into the shell (m10-plan commit 0 / F19) so
 * switching to Status mid-rest keeps the countdown visible instead of
 * unmounting it. The sole `useRestTimer()` call that stays mounted across
 * routes, and so the sole owner of its ticking/chime/wake-lock effect —
 * see the comment at the top of `useRestTimer.ts`.
 */
import { SegmentedRing } from './SegmentedRing'
import { useRestTimer } from '../app/useRestTimer'

export function RestTimerDock() {
  const restTimer = useRestTimer()
  if (!restTimer.state) return null

  return (
    <div className="sticky bottom-14 z-30 mx-auto flex w-full max-w-md items-center gap-4 rounded-none border border-panel-edge bg-panel px-4 py-3 shadow-system">
      <div className="relative size-14 shrink-0">
        <SegmentedRing pct={restTimer.state.pct} tone={restTimer.state.remaining <= 10 ? 'warn' : 'system'} />
        <span className="absolute inset-0 grid place-items-center font-system text-xs text-system tabular-nums">
          {restTimer.state.display}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-system text-[10px] tracking-[0.18em] text-ink-faint uppercase">{restTimer.state.label}</p>
        <button
          type="button"
          onClick={restTimer.clear}
          className="mt-1 font-system text-[10px] text-ink-faint uppercase underline"
        >
          Skip rest
        </button>
      </div>
    </div>
  )
}
