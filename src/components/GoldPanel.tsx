/**
 * Gold, shown honestly: it has been accruing since M3 with nothing to spend
 * it on. The System Shop is a design problem, not a presentation one, and
 * is deliberately M7b rather than invented under milestone pressure
 * (m7-plan finding F1) — so this says what the number is for rather than
 * displaying it bare.
 */
import { SystemPanel } from './SystemPanel'

export function GoldPanel({ gold }: { gold: number }) {
  return (
    <SystemPanel className="mt-3 flex items-center justify-between gap-3">
      <div>
        <p className="font-system text-[11px] tracking-[0.12em] text-gold uppercase">Gold</p>
        <p className="mt-0.5 text-xs text-ink-faint">Paid by gates and Daily Quests. No Shop yet to spend it in.</p>
      </div>
      <p className="shrink-0 font-system text-lg text-gold tabular-nums">{gold}</p>
    </SystemPanel>
  )
}
