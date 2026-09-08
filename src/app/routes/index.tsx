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
import { lazy, Suspense } from 'react'
import { AdvisoriesPanel } from '../../components/AdvisoriesPanel'
import { DailyQuestPanel } from '../../components/DailyQuestPanel'
import { DeloadPanel } from '../../components/DeloadPanel'
import { FatiguePanel } from '../../components/FatiguePanel'
import { JobChangeQuestPanel } from '../../components/JobChangeQuestPanel'
import { ManaBar } from '../../components/ManaBar'
import { RankBadge } from '../../components/RankBadge'
import { ReawakeningTestPanel } from '../../components/ReawakeningTestPanel'
import { RunesPanel } from '../../components/RunesPanel'
import { StatRow } from '../../components/StatRow'
import { StreakPanel } from '../../components/StreakPanel'
import { SystemPanel } from '../../components/SystemPanel'
import { SystemWindow } from '../../components/SystemWindow'
import { TitlesPanel } from '../../components/TitlesPanel'
import { VolumePanel } from '../../components/VolumePanel'
import { JOB_CHANGE_LEVEL } from '../../domain/quests'
import type { HunterClass, StatKey } from '../../domain/types'
import { useApp } from '../state'
import { rootRoute } from './root'

// None of these three sit on the path to logging a set (m7-plan F5), so they
// ship in their own chunks rather than growing the bundle every hunter pays
// for on first paint.
const ShadowsPanel = lazy(() =>
  import('../../components/ShadowsPanel').then((m) => ({ default: m.ShadowsPanel })),
)
const TowerPanel = lazy(() => import('../../components/TowerPanel').then((m) => ({ default: m.TowerPanel })))
const HunterLicenseCard = lazy(() =>
  import('../../components/HunterLicenseCard').then((m) => ({ default: m.HunterLicenseCard })),
)
const ShopPanel = lazy(() => import('../../components/ShopPanel').then((m) => ({ default: m.ShopPanel })))

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

/** What the class line says before a class exists, so "no class" is explained rather than dead-ended. */
function classLine(hunterClass: HunterClass, jobChangeDue: boolean): string {
  if (hunterClass !== 'none') return HUNTER_CLASS_LABELS[hunterClass]
  return jobChangeDue ? 'Job Change Quest available' : `No class — unlocks at level ${JOB_CHANGE_LEVEL}`
}

function HomeScreen() {
  const projection = useApp((s) => s.projection)
  const advisories = useApp((s) => s.advisories)
  const allocatePoint = useApp((s) => s.allocatePoint)
  const resetAllocation = useApp((s) => s.resetAllocation)
  const earnedTitleIds = useApp((s) => s.earnedTitleIds)
  const exercises = useApp((s) => s.exercises)
  const setShadowActive = useApp((s) => s.setShadowActive)
  const identity = useApp((s) => s.identity)
  const gatesCleared = useApp((s) => s.progress.gatesCleared)
  const profile = useApp((s) => s.profile)

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
            {classLine(player.hunterClass, projection.jobChangeDue)}
          </span>
        </div>

        <div className="mt-3">
          <ManaBar level={player.level} xpIntoLevel={player.xpIntoLevel} xpToNext={player.xpToNext} />
        </div>

        <DailyQuestPanel />
        <JobChangeQuestPanel />
        <ReawakeningTestPanel />

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
        <Suspense fallback={null}>
          <ShadowsPanel
            roster={projection.roster}
            exercises={exercises}
            onToggle={(id, active) => void setShadowActive(id, active)}
          />
          <TowerPanel
            floorCleared={projection.towerFloorCleared}
            nextFloor={projection.nextTowerFloor}
            bodyweightKg={projection.latestBodyMetric?.weightKg ?? 0}
          />
        </Suspense>
        <Suspense fallback={null}>
          <ShopPanel />
        </Suspense>
        {identity ? (
          <Suspense fallback={null}>
            <HunterLicenseCard
              hunterId={identity.hunterId}
              rank={player.rank}
              level={player.level}
              hunterClassLabel={HUNTER_CLASS_LABELS[player.hunterClass]}
              total={player.total}
              titlesHeld={earnedTitleIds.length}
              gatesCleared={gatesCleared}
              awakenedAt={profile?.awakenedAt ?? null}
            />
          </Suspense>
        ) : null}
        <AdvisoriesPanel advisories={advisories} />
      </SystemWindow>
    </main>
  )
}
