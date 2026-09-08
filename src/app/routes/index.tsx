/**
 * Home. Redirects to `/awaken` until a profile exists — there is nothing to
 * show a hunter who has not been awakened yet.
 *
 * The minimal Status Window: rank, the level bar, the five stats split into
 * their derived and allocated halves, and the streak. The full window with
 * quests, roster and fatigue detail is M5; this is the shape it grows into.
 */
import { createRoute, redirect } from '@tanstack/react-router'
import { Brain, Dumbbell, Footprints, HeartPulse, Radar } from 'lucide-react'
import { AdvisoriesPanel } from '../../components/AdvisoriesPanel'
import { DailyQuestPanel } from '../../components/DailyQuestPanel'
import { DeloadPanel } from '../../components/DeloadPanel'
import { FatiguePanel } from '../../components/FatiguePanel'
import { GoldPanel } from '../../components/GoldPanel'
import { ManaBar } from '../../components/ManaBar'
import { RankBadge } from '../../components/RankBadge'
import { RunesPanel } from '../../components/RunesPanel'
import { StatRow } from '../../components/StatRow'
import { StreakPanel } from '../../components/StreakPanel'
import { SystemPanel } from '../../components/SystemPanel'
import { SystemWindow } from '../../components/SystemWindow'
import { TitlesPanel } from '../../components/TitlesPanel'
import { TowerPanel } from '../../components/TowerPanel'
import { VolumePanel } from '../../components/VolumePanel'
import type { HunterClass, StatKey } from '../../domain/types'
import { useApp } from '../state'
import { rootRoute } from './root'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (!useApp.getState().profile) throw redirect({ to: '/awaken' })
  },
  component: HomeScreen,
})

const STAT_ORDER: readonly StatKey[] = ['STR', 'VIT', 'AGI', 'INT', 'PER']
const STAT_ICON = { STR: Dumbbell, VIT: HeartPulse, AGI: Footprints, INT: Brain, PER: Radar } as const

const HUNTER_CLASS_LABELS: Record<HunterClass, string> = {
  none: 'No class yet',
  fighter: 'Fighter',
  tanker: 'Tanker',
  assassin: 'Assassin',
  ranger: 'Ranger',
  shadow_monarch: 'Shadow Monarch',
}

function HomeScreen() {
  const projection = useApp((s) => s.projection)
  const advisories = useApp((s) => s.advisories)
  const allocatePoint = useApp((s) => s.allocatePoint)
  const resetAllocation = useApp((s) => s.resetAllocation)
  const earnedTitleIds = useApp((s) => s.earnedTitleIds)
  const gold = useApp((s) => s.progress.gold)

  if (!projection) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="font-system text-sm text-ink-soft">[Reading the Status Window.]</p>
      </main>
    )
  }

  const { player } = projection
  const unspent = player.unspentStatPoints

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <SystemWindow title="Status Window" strong>
        <div className="flex items-center justify-between gap-3">
          <RankBadge rank={player.rank} />
          <span className="font-system text-[11px] text-ink-faint uppercase">
            {HUNTER_CLASS_LABELS[player.hunterClass]}
          </span>
        </div>

        <div className="mt-3">
          <ManaBar level={player.level} xpIntoLevel={player.xpIntoLevel} xpToNext={player.xpToNext} />
        </div>

        <DailyQuestPanel />

        <StreakPanel />

        <SystemPanel className="mt-3 flex flex-col gap-2">
          {unspent > 0 ? (
            <div className="flex items-center justify-between font-system text-[11px] text-mana uppercase">
              <span>{unspent} point{unspent === 1 ? '' : 's'} to spend</span>
              <button
                type="button"
                onClick={() => void resetAllocation()}
                className="text-ink-faint underline normal-case"
              >
                Reset allocation
              </button>
            </div>
          ) : null}
          {STAT_ORDER.map((key) => (
            <StatRow
              key={key}
              icon={STAT_ICON[key]}
              label={key}
              derived={player.derived[key]}
              allocated={player.allocated[key]}
              total={player.total[key]}
              onAllocate={unspent > 0 ? () => void allocatePoint(key) : undefined}
            />
          ))}
        </SystemPanel>

        <FatiguePanel fatigue={projection.fatigue} />
        <VolumePanel volume={projection.volume} />
        <DeloadPanel deload={projection.deload} />
        <RunesPanel level={player.level} />
        <TitlesPanel titleIds={earnedTitleIds} />
        <TowerPanel
          floorCleared={projection.towerFloorCleared}
          nextFloor={projection.nextTowerFloor}
          bodyweightKg={projection.latestBodyMetric?.weightKg ?? 0}
        />
        <GoldPanel gold={gold} />
        <AdvisoriesPanel advisories={advisories} />
      </SystemWindow>
    </main>
  )
}
