/**
 * The shadow roster: the INT-derived cap made legible (m7-plan finding F2),
 * so a shadow going dormant when the cap falls reads as an explained
 * mechanic, never a bug. Extraction and cap resolution both happen in the
 * projection (`resolveRoster`); this only lets the hunter choose who stays
 * active when requested shadows exceed the cap, rather than picking for
 * them (m7-plan commit 5).
 */
import type { RosterState } from '../domain/shadows'
import type { Exercise, Shadow } from '../domain/types'
import { RankBadge } from './RankBadge'
import { SystemPanel } from './SystemPanel'
import { SystemValue } from './SystemValue'

function exerciseName(exercises: readonly Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? id
}

function ShadowRow({
  shadow,
  exercises,
  actionLabel,
  onAction,
}: {
  shadow: Shadow
  exercises: readonly Exercise[]
  actionLabel: string
  onAction: () => void
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {shadow.name}
          {shadow.isMarshal ? (
            <span className="ml-2 font-system text-[10px] text-gold uppercase">Marshal</span>
          ) : null}
        </p>
        <p className="text-xs text-ink-faint">{exerciseName(exercises, shadow.exerciseId)}</p>
        <p className="text-xs text-ink-soft">{shadow.buff}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <RankBadge rank={shadow.rank} />
        <button type="button" onClick={onAction} className="text-xs text-ink-faint underline">
          {actionLabel}
        </button>
      </div>
    </li>
  )
}

export function ShadowsPanel({
  roster,
  exercises,
  onToggle,
}: {
  roster: RosterState
  exercises: readonly Exercise[]
  onToggle: (id: string, active: boolean) => void
}) {
  if (roster.active.length === 0 && roster.benched.length === 0) return null

  // Still requested (active: true) but bumped by the cap — distinct from a
  // shadow the hunter deliberately benched, which needs no explanation.
  const dormant = roster.benched.filter((s) => s.active)
  const dismissed = roster.benched.filter((s) => !s.active)

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">Shadow Army</p>
        <SystemValue value={roster.activeCount} max={roster.cap} size="md" />
      </div>
      <p className="text-xs text-ink-soft">{roster.message}</p>

      {roster.active.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {roster.active.map((shadow) => (
            <ShadowRow
              key={shadow.id}
              shadow={shadow}
              exercises={exercises}
              actionLabel="Bench"
              onAction={() => onToggle(shadow.id, false)}
            />
          ))}
        </ul>
      ) : null}

      {dormant.length > 0 ? (
        <div className="mt-1 flex flex-col gap-2 border-t border-ink-faint/20 pt-2">
          <p className="text-xs text-warn">
            Mana capacity is full. Bench an active shadow to bring one of these in — the System
            never chooses for you.
          </p>
          <ul className="flex flex-col gap-3">
            {dormant.map((shadow) => (
              <ShadowRow
                key={shadow.id}
                shadow={shadow}
                exercises={exercises}
                actionLabel="Bench"
                onAction={() => onToggle(shadow.id, false)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {dismissed.length > 0 ? (
        <div className="mt-1 flex flex-col gap-2 border-t border-ink-faint/20 pt-2">
          <p className="text-xs text-ink-faint">Benched</p>
          <ul className="flex flex-col gap-3">
            {dismissed.map((shadow) => (
              <ShadowRow
                key={shadow.id}
                shadow={shadow}
                exercises={exercises}
                actionLabel="Activate"
                onAction={() => onToggle(shadow.id, true)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </SystemPanel>
  )
}
