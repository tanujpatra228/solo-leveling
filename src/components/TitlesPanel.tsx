/**
 * Titles held so far, with the real requirement each one names — a title
 * never stays mysterious about what it took (m7-plan commit 3).
 */
import { heldTitles } from '../app/state'
import { SystemPanel } from './SystemPanel'

export function TitlesPanel({ titleIds }: { titleIds: readonly string[] }) {
  const titles = heldTitles(titleIds)
  if (titles.length === 0) return null

  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">Titles</p>
      <ul className="flex flex-col gap-2">
        {titles.map((title) => (
          <li key={title.id}>
            <p className="text-sm font-medium text-ink">{title.name}</p>
            <p className="text-xs text-ink-soft">{title.description}</p>
          </li>
        ))}
      </ul>
    </SystemPanel>
  )
}
