/**
 * The Demon Castle: a hundred deterministic floors (`domain/tower.ts`), shown
 * as the highest cleared and what the next one asks for. Boss floors are
 * Monarchs by canon name — floor 100's is the same fight the Shadow Monarch
 * title (TitlesPanel, m7-plan commit 3) is named after (m7-plan commit 4).
 */
import { describeRequirement, TOWER_FLOORS, type TowerFloor } from '../domain/tower'
import { HelpButton } from './HelpButton'
import { SystemPanel } from './SystemPanel'
import { SystemValue } from './SystemValue'

export function TowerPanel({
  floorCleared,
  nextFloor,
  bodyweightKg,
  onHelp,
}: {
  floorCleared: number
  nextFloor: TowerFloor | null
  bodyweightKg: number
  onHelp: () => void
}) {
  return (
    <SystemPanel className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">Demon Castle</p>
        <div className="flex items-center gap-1">
          <SystemValue value={floorCleared} max={TOWER_FLOORS.length} size="md" />
          <HelpButton topicTitle="Demon Castle" onClick={onHelp} />
        </div>
      </div>
      {nextFloor ? (
        <div>
          <p className="text-sm font-medium text-ink">
            {nextFloor.isBoss ? `${nextFloor.name} — Floor ${nextFloor.floor}` : nextFloor.name}
            {nextFloor.isBoss ? (
              <span className="ml-2 font-system text-[10px] text-danger uppercase">Monarch</span>
            ) : null}
          </p>
          <p className="text-xs text-ink-soft">{describeRequirement(nextFloor.requirement, bodyweightKg)}</p>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">Every floor cleared. The castle has nothing left to ask.</p>
      )}
    </SystemPanel>
  )
}
