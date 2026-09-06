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
import { DailyQuestPanel } from '../../components/DailyQuestPanel'
import { ManaBar } from '../../components/ManaBar'
import { RankBadge } from '../../components/RankBadge'
import { StatRow } from '../../components/StatRow'
import { SystemPanel } from '../../components/SystemPanel'
import { SystemWindow } from '../../components/SystemWindow'
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
  const streak = useApp((s) => s.streak)

  if (!projection) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="font-system text-sm text-ink-soft">[Reading the Status Window.]</p>
      </main>
    )
  }

  const { player } = projection

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

        <SystemPanel className="mt-3 flex flex-col gap-2">
          {STAT_ORDER.map((key) => (
            <StatRow
              key={key}
              icon={STAT_ICON[key]}
              label={key}
              derived={player.derived[key]}
              allocated={player.allocated[key]}
              total={player.total[key]}
            />
          ))}
        </SystemPanel>

        <SystemPanel className="mt-3 flex items-center justify-between font-system text-[11px] text-ink-soft">
          <span>
            Streak {streak.current}
            {streak.longest > streak.current ? ` · best ${streak.longest}` : ''}
          </span>
          <span>{player.gold} gold</span>
        </SystemPanel>
      </SystemWindow>
    </main>
  )
}
