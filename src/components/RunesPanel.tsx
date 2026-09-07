/**
 * Runes and Skills unlocked so far — real intensity techniques gated by
 * level, per `domain/runes.ts` (m7-plan commit 3). Read-only: which movement
 * gets which rune is decided in the gate screen, not here.
 */
import { unlockedRunes } from '../domain/runes'
import { SystemPanel } from './SystemPanel'

export function RunesPanel({ level }: { level: number }) {
  const runes = unlockedRunes(level)
  if (runes.length === 0) return null

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">Runes</p>
      <ul className="flex flex-col gap-2">
        {runes.map((rune) => (
          <li key={rune.id}>
            <p className="text-sm font-medium text-ink">
              {rune.runeName} <span className="text-xs font-normal text-ink-faint">— {rune.name}</span>
            </p>
            <p className="text-xs text-ink-soft">{rune.description}</p>
          </li>
        ))}
      </ul>
    </SystemPanel>
  )
}
