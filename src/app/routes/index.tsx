/**
 * Home. Redirects to `/awaken` until a profile exists — there is nothing to
 * show a hunter who has not been awakened yet.
 *
 * The Status Window, split into the shape the other two routes already use
 * (m10-plan commit 2, F1): a stack of single-purpose `SystemWindow`s rather
 * than nine screens nested in one. The archive — Runes, Titles, Demon
 * Castle, Shadow Army, Shop, License — stays mounted inline below the head
 * for now; commit 3 moves it behind a summon list.
 */
import { createRoute, redirect } from '@tanstack/react-router'
import { Brain, Dumbbell, Flame, Footprints, HeartPulse, Radar } from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'
import { AdvisoriesPanel } from '../../components/AdvisoriesPanel'
import { DailyQuestPanel } from '../../components/DailyQuestPanel'
import { DeloadPanel } from '../../components/DeloadPanel'
import { JobChangeQuestPanel } from '../../components/JobChangeQuestPanel'
import { ManaBar } from '../../components/ManaBar'
import { RankBadge } from '../../components/RankBadge'
import { ReawakeningTestPanel } from '../../components/ReawakeningTestPanel'
import { RunesPanel } from '../../components/RunesPanel'
import { SegmentedRing } from '../../components/SegmentedRing'
import { StatRow } from '../../components/StatRow'
import { StreakPanel } from '../../components/StreakPanel'
import { SystemIcon } from '../../components/SystemIcon'
import { SystemValue } from '../../components/SystemValue'
import { SystemWindow } from '../../components/SystemWindow'
import { TitlesPanel } from '../../components/TitlesPanel'
import { VolumePanel } from '../../components/VolumePanel'
import type { FatigueBand } from '../../domain/fatigue'
import { activeQuestFor, JOB_CHANGE_LEVEL } from '../../domain/quests'
import { dayKeyStart } from '../../domain/time'
import type { DayKey, HunterClass, StatKey } from '../../domain/types'
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

// Copied rather than imported from gate.tsx, which is the only other caller
// — under three, the one-home rule (CLAUDE.md) says copy, not extract.
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function formatDayKey(key: DayKey): string {
  const date = dayKeyStart(key)
  return `${WEEKDAY[date.getDay()]} ${date.getDate()} ${date.toLocaleString('en-GB', { month: 'long' })}`
}

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

const FATIGUE_RING_TONE: Record<FatigueBand, 'system' | 'warn' | 'danger' | 'good'> = {
  insufficient_data: 'system',
  detraining: 'system',
  undertrained: 'system',
  optimal: 'good',
  elevated: 'warn',
  danger: 'danger',
}

/** What the class line says before a class exists, so "no class" is explained rather than dead-ended. */
function classLine(hunterClass: HunterClass, jobChangeDue: boolean): string {
  if (hunterClass !== 'none') return HUNTER_CLASS_LABELS[hunterClass]
  return jobChangeDue ? 'Job Change Quest available' : `No class — unlocks at level ${JOB_CHANGE_LEVEL}`
}

function HomeScreen() {
  const today = useApp((s) => s.today)
  const projection = useApp((s) => s.projection)
  const quests = useApp((s) => s.quests)
  const streak = useApp((s) => s.streak)
  const advisories = useApp((s) => s.advisories)
  const allocatePoint = useApp((s) => s.allocatePoint)
  const resetAllocation = useApp((s) => s.resetAllocation)
  const earnedTitleIds = useApp((s) => s.earnedTitleIds)
  const exercises = useApp((s) => s.exercises)
  const setShadowActive = useApp((s) => s.setShadowActive)
  const identity = useApp((s) => s.identity)
  const gatesCleared = useApp((s) => s.progress.gatesCleared)
  const profile = useApp((s) => s.profile)

  // Reserves the glow for the one window that is speaking
  // (docs/system-visuals-plan.md section 8) — derived here, not in
  // `recompute()`, because no other route needs it (standards rule 16).
  const speaking = useMemo(() => {
    if (!projection) return null
    if (projection.deload.due) return 'deload'
    if (projection.reawakeningDue) return 'reawakening'
    if (quests.some((q) => q.type === 'job_change' && q.status === 'issued')) return 'jobchange'
    const dailyQuest = activeQuestFor(quests, today, 'daily')
    if (dailyQuest && dailyQuest.status !== 'complete') return 'dailyquest'
    if (projection.roster.benched.some((s) => s.active)) return 'shadows'
    return 'status'
  }, [projection, quests, today])

  if (!projection) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="font-system text-sm text-ink-soft">[Reading the Status Window.]</p>
      </main>
    )
  }

  const { player } = projection
  const unspent = player.unspentStatPoints
  const statMax = Math.max(...STAT_ORDER.map((key) => player.total[key]), 10) * 1.15
  const fatigueReading = projection.fatigue.band === 'insufficient_data' ? '—' : projection.fatigue.gauge

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <header className="px-1">
        <p className="font-system text-[11px] tracking-[0.2em] text-ink-faint uppercase">{formatDayKey(today)}</p>
      </header>

      <SystemWindow title="Status Window" strong={speaking === 'status'}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <RankBadge rank={player.rank} />
            <span className="font-system text-[11px] text-ink-faint uppercase">
              {classLine(player.hunterClass, projection.jobChangeDue)}
            </span>
          </div>

          {/*
            The vitals strip (m10-plan section 1.0): level, streak and
            fatigue as three glanceable fields, not the 48px fatigue gauge
            this used to own its own panel for. The full streak detail (rest
            tokens, forgiveness) stays its own window below — this is just
            the number.
          */}
          <div className="grid grid-cols-3 gap-2 border border-panel-edge/60">
            <div className="flex flex-col justify-center gap-1 p-2.5">
              <ManaBar level={player.level} xpIntoLevel={player.xpIntoLevel} xpToNext={player.xpToNext} />
            </div>
            <div className="flex flex-col justify-center gap-1 border-x border-panel-edge/60 p-2.5">
              <div className="flex items-center gap-1.5">
                <SystemIcon icon={Flame} tone="warn" size={16} />
                <SystemValue value={streak.current} size="md" />
              </div>
              <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">
                Streak
                {streak.longest > streak.current ? ` · best ${streak.longest}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 p-2.5">
              <SegmentedRing pct={projection.fatigue.gauge} tone={FATIGUE_RING_TONE[projection.fatigue.band]} size={22} strokeWidth={3} />
              <div className="flex flex-col">
                <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">Fatigue</span>
                <SystemValue value={fatigueReading} size="md" />
              </div>
            </div>
          </div>

          {/* The two-column stat grid (m10-plan section 1.0 correction 4) —
              no meters at all in the reference; the split strip StatBar
              still carries is deliberately subordinate to the figure. */}
          <div className="grid grid-cols-2 gap-2">
            {STAT_ORDER.map((key) => (
              <StatRow
                key={key}
                icon={STAT_ICON[key]}
                label={key}
                derived={player.derived[key]}
                allocated={player.allocated[key]}
                total={player.total[key]}
                max={statMax}
                onAllocate={unspent > 0 ? () => void allocatePoint(key) : undefined}
              />
            ))}
            <div className="flex items-center justify-between gap-2 border border-panel-edge/60 p-2.5">
              <span className="font-system text-[9px] leading-tight tracking-[0.08em] text-ink-faint uppercase">
                Available
                <br />
                Ability
                <br />
                Points:
              </span>
              <div className="flex flex-col items-end gap-1">
                <SystemValue value={unspent} />
                {unspent > 0 ? (
                  <button
                    type="button"
                    onClick={() => void resetAllocation()}
                    className="font-system text-[9px] text-ink-faint uppercase underline"
                  >
                    Reset allocation
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </SystemWindow>

      <DailyQuestPanel strong={speaking === 'dailyquest'} />
      <DeloadPanel deload={projection.deload} strong={speaking === 'deload'} />
      <ReawakeningTestPanel strong={speaking === 'reawakening'} />
      <JobChangeQuestPanel strong={speaking === 'jobchange'} />
      <StreakPanel />

      <VolumePanel volume={projection.volume} />
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
    </main>
  )
}
