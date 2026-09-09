/**
 * Home. Redirects to `/awaken` until a profile exists — there is nothing to
 * show a hunter who has not been awakened yet.
 *
 * The Status Window: a stack of single-purpose `SystemWindow`s for what's
 * read daily (m10-plan commit 2), plus a summon list for the archive —
 * Analysis, Shadow Army, Demon Castle, System Shop, Runes, Titles — which
 * opens as a `SystemOverlay` over the page rather than growing it (m10-plan
 * commit 3, F14). Which window is open lives in the URL (`?window=`), not in
 * `Settings`, so the hardware back button closes it for free.
 */
import { createRoute, redirect } from '@tanstack/react-router'
import {
  Award,
  Brain,
  Building2,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Radar,
  ShoppingBag,
  Users,
  Wand2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AdvisoriesPanel } from '../../components/AdvisoriesPanel'
import { DailyQuestPanel } from '../../components/DailyQuestPanel'
import { DeloadPanel } from '../../components/DeloadPanel'
import { FatiguePanel } from '../../components/FatiguePanel'
import { JobChangeQuestPanel } from '../../components/JobChangeQuestPanel'
import { ManaBar } from '../../components/ManaBar'
import { RankBadge } from '../../components/RankBadge'
import { ReawakeningTestPanel } from '../../components/ReawakeningTestPanel'
import { RunesPanel } from '../../components/RunesPanel'
import { SegmentedRing } from '../../components/SegmentedRing'
import { StatRow } from '../../components/StatRow'
import { StreakPanel } from '../../components/StreakPanel'
import { SummonList, type SummonRow } from '../../components/SummonList'
import { PILL_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../components/buttonStyles'
import { SystemIcon } from '../../components/SystemIcon'
import { SystemOverlay } from '../../components/SystemOverlay'
import { SystemPanel } from '../../components/SystemPanel'
import { SystemValue } from '../../components/SystemValue'
import { SystemWindow } from '../../components/SystemWindow'
import { TitlesPanel } from '../../components/TitlesPanel'
import { VolumePanel } from '../../components/VolumePanel'
import type { FatigueBand } from '../../domain/fatigue'
import { activeQuestFor, JOB_CHANGE_LEVEL } from '../../domain/quests'
import { unlockedRunes } from '../../domain/runes'
import { dayKeyStart } from '../../domain/time'
import { TOWER_FLOORS } from '../../domain/tower'
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

export type SummonWindowId = 'analysis' | 'army' | 'castle' | 'shop' | 'runes' | 'titles'
const SUMMON_WINDOW_IDS: readonly SummonWindowId[] = ['analysis', 'army', 'castle', 'shop', 'runes', 'titles']

function isSummonWindowId(value: unknown): value is SummonWindowId {
  return typeof value === 'string' && (SUMMON_WINDOW_IDS as readonly string[]).includes(value)
}

export interface IndexSearch {
  window?: SummonWindowId
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // An unrecognised value (a stale link, a hand-edited URL) normalises to no
  // window open rather than rendering a broken overlay (F14).
  // A bare `{}` here does not clear an unrecognised value — TanStack merges
  // a route's validated search onto its parent's raw (unvalidated) search
  // rather than replacing it, so an omitted key leaves the parent's still
  // in place. `window: undefined` is what actually overwrites it.
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    window: isSummonWindowId(search.window) ? search.window : undefined,
  }),
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

// One clause per stat (m10-plan commit 8) — what each is derived from. See
// domain/stats.ts's deriveStr/deriveVit/deriveAgi/deriveInt/deriveP for the
// arithmetic and reasoning; this only names the source, not the formula.
const STAT_MEANING: Record<StatKey, string> = {
  STR: 'From published strength standards',
  VIT: 'From tonnage moved and streak kept',
  AGI: 'From conditioning and bodyweight reps',
  INT: 'From programme adherence — caps active shadows',
  PER: 'From how closely effort gets logged',
}

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

const SUMMON_ICON: Record<SummonWindowId, LucideIcon> = {
  analysis: AlertTriangle,
  army: Users,
  castle: Building2,
  shop: ShoppingBag,
  runes: Wand2,
  titles: Award,
}

const SUMMON_TITLE: Record<SummonWindowId, string> = {
  analysis: 'Analysis',
  army: 'Shadow Army',
  castle: 'Demon Castle',
  shop: 'System Shop',
  runes: 'Runes',
  titles: 'Titles',
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
  const gold = useApp((s) => s.progress.gold)
  const profile = useApp((s) => s.profile)
  const renameHunter = useApp((s) => s.renameHunter)
  const announceSystemIntroIfNeeded = useApp((s) => s.announceSystemIntroIfNeeded)
  // A notification takes the one overlay slot over a summoned window rather
  // than stacking under it (m10-plan §1.3) — the summon stays closed (in the
  // URL) and simply stops rendering while one is up, resuming once it clears.
  const windowMessagePending = useApp((s) => s.messages.some((m) => m.kind === 'window'))

  // The canvas chunk (F9, m10-plan commit 6) is never fetched on a normal
  // visit — React.lazy only resolves once this flips true, behind the
  // footer button, not on mount.
  const [showLicense, setShowLicense] = useState(false)

  const { window: openWindow } = indexRoute.useSearch()
  const navigate = indexRoute.useNavigate()

  useEffect(() => {
    void announceSystemIntroIfNeeded()
  }, [announceSystemIntroIfNeeded])

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

  // `resetScroll: false` on both — TanStack Router scrolls the window to
  // (0, 0) on every navigation by default, search-param-only ones included,
  // which threw the page under a summoned window back to the top on every
  // open and close (found on device). This is separate from the SystemOverlay
  // focus() fix (92a6382): that one covered the close button stealing scroll
  // on its own, this one is the router itself.
  function toggleSummon(id: SummonWindowId) {
    void navigate({ search: openWindow === id ? {} : { window: id }, resetScroll: false })
  }
  function closeSummon() {
    void navigate({ search: {}, resetScroll: false })
  }

  const summonRows: SummonRow[] = [
    { id: 'analysis', label: 'Analysis', figure: `${advisories.length} warnings`, warn: advisories.length > 0 },
    { id: 'army', label: 'Shadow Army', figure: `${projection.roster.activeCount}/${projection.roster.cap}` },
    { id: 'castle', label: 'Demon Castle', figure: `${projection.towerFloorCleared}/${TOWER_FLOORS.length}` },
    { id: 'shop', label: 'System Shop', figure: `${gold} gold` },
    { id: 'runes', label: 'Runes', figure: `${unlockedRunes(player.level).length}` },
    { id: 'titles', label: 'Titles', figure: `${earnedTitleIds.length}` },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-4">
      <header className="px-1">
        <p className="font-system text-[11px] tracking-[0.2em] text-ink-faint uppercase">{formatDayKey(today)}</p>
      </header>

      <SystemWindow
        title="Status Window"
        strong={speaking === 'status'}
        index={0}
        footer={
          <StatusFooter
            unspent={unspent}
            onRevoke={() => void resetAllocation()}
            onShowLicense={() => setShowLicense(true)}
          />
        }
      >
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
          <SystemPanel boxed className="grid grid-cols-3 gap-2">
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
              <SegmentedRing
                pct={projection.fatigue.gauge}
                tone={FATIGUE_RING_TONE[projection.fatigue.band]}
                size={22}
                strokeWidth={3}
              />
              <div className="flex flex-col">
                <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">Fatigue</span>
                <SystemValue value={fatigueReading} size="md" />
              </div>
            </div>
          </SystemPanel>

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
                caption={STAT_MEANING[key]}
                onAllocate={unspent > 0 ? () => void allocatePoint(key) : undefined}
              />
            ))}
            <SystemPanel boxed className="flex items-center justify-between gap-2 p-2.5">
              <span className="font-system text-[9px] leading-tight tracking-[0.08em] text-ink-faint uppercase">
                Available
                <br />
                Ability
                <br />
                Points:
              </span>
              <div className="flex flex-col items-end gap-1">
                <SystemValue value={unspent} />
              </div>
            </SystemPanel>
          </div>
        </div>
      </SystemWindow>

      <DailyQuestPanel strong={speaking === 'dailyquest'} index={1} />
      <DeloadPanel deload={projection.deload} strong={speaking === 'deload'} index={2} />
      <ReawakeningTestPanel strong={speaking === 'reawakening'} index={3} />
      <JobChangeQuestPanel strong={speaking === 'jobchange'} index={4} />
      <StreakPanel index={5} />

      <SummonList rows={summonRows} open={openWindow} onToggle={toggleSummon} index={6} />

      {/* Not in the summon list (F9) — a share action reached from the Status
          footer's "Hunter License" button, so the canvas chunk is fetched
          only once tapped, never on a normal visit (m10-plan commit 6). */}
      {identity && showLicense ? (
        <Suspense fallback={null}>
          <HunterLicenseCard
            hunterId={identity.hunterId}
            hunterName={profile?.hunterName}
            rank={player.rank}
            level={player.level}
            hunterClass={player.hunterClass}
            total={player.total}
            earnedTitleIds={earnedTitleIds}
            gatesCleared={gatesCleared}
            awakenedAt={profile?.awakenedAt ?? null}
            onRename={(name) => void renameHunter(name)}
          />
        </Suspense>
      ) : null}

      {openWindow && !windowMessagePending ? (
        <SystemOverlay title={SUMMON_TITLE[openWindow]} icon={SUMMON_ICON[openWindow]} onClose={closeSummon}>
          {openWindow === 'analysis' ? (
            <div className="flex flex-col gap-3">
              <FatiguePanel fatigue={projection.fatigue} />
              <VolumePanel volume={projection.volume} />
              <AdvisoriesPanel advisories={advisories} />
            </div>
          ) : null}
          {openWindow === 'runes' ? <RunesPanel level={player.level} /> : null}
          {openWindow === 'titles' ? <TitlesPanel titleIds={earnedTitleIds} /> : null}
          {openWindow === 'army' ? (
            <Suspense fallback={null}>
              <ShadowsPanel
                roster={projection.roster}
                exercises={exercises}
                onToggle={(id, active) => void setShadowActive(id, active)}
              />
            </Suspense>
          ) : null}
          {openWindow === 'castle' ? (
            <Suspense fallback={null}>
              <TowerPanel
                floorCleared={projection.towerFloorCleared}
                nextFloor={projection.nextTowerFloor}
                bodyweightKg={projection.latestBodyMetric?.weightKg ?? 0}
              />
            </Suspense>
          ) : null}
          {openWindow === 'shop' ? (
            <Suspense fallback={null}>
              <ShopPanel />
            </Suspense>
          ) : null}
        </SystemOverlay>
      ) : null}
    </main>
  )
}

/**
 * The Status Window's footer (F11, rule 3): every action lives here rather
 * than inline in the body. Revoke resets the whole allocation, so it is the
 * one confirmation this milestone adds (rule 6).
 */
export function StatusFooter({
  unspent,
  onRevoke,
  onShowLicense,
}: {
  unspent: number
  onRevoke: () => void
  onShowLicense: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {unspent > 0 ? (
        <>
          <div className={PRIMARY_BUTTON}>
            Allocate {unspent} point{unspent === 1 ? '' : 's'}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Revoke all allocated stat points? This cannot be undone.')) onRevoke()
            }}
            className={SECONDARY_BUTTON}
          >
            Revoke allocation
          </button>
        </>
      ) : null}
      <button type="button" onClick={onShowLicense} className={`min-h-11 border-panel-edge text-ink-faint ${PILL_BUTTON}`}>
        Hunter License
      </button>
    </div>
  )
}
