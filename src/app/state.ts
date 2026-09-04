/**
 * The single application store.
 *
 * It holds the loaded log, the projection derived from it, and the actions that
 * append to it. Components read from here and never touch the database.
 *
 * Every action writes to IndexedDB first and then refreshes the projection, so
 * the interface is always showing something that has actually been persisted.
 * Nothing here awaits the network.
 */
import { create } from 'zustand'
import * as repo from '../db/repo'
import { detectAdvisories, activeAdvisories, type Advisory } from '../domain/advisories'
import { hardSetsPerMuscle } from '../domain/volume'
import { computeStreak, type StreakState } from '../domain/streak'
import {
  generateDailyQuest,
  generatePenaltyQuest,
  generateRecoveryQuest,
  type DailyItemKind,
  type DailyQuest,
} from '../domain/quests'
import {
  lastSetsForExercise,
  projectPlayer,
  type Projection,
} from '../domain/projection'
import { computeNextTarget, type NextTarget } from '../domain/progression'
import { extractShadow, shouldExtract } from '../domain/shadows'
import { resolveDungeonBreaks, type DungeonBreak, type OpenGate } from '../domain/gates'
import { addDaysToKey, dayOfWeekForKey, toDayKey } from '../domain/time'
import { titleById } from '../domain/titles'
import type {
  BodyFatSource,
  BodyMetric,
  DayKey,
  Exercise,
  Profile,
  QuestLog,
  Routine,
  SessionLog,
  SetLog,
  Settings,
  Shadow,
  StatBlock,
  StatKey,
} from '../domain/types'
import type { Progress } from '../db/db'

/** A System window queued for display, in the order the events happened. */
export interface SystemMessage {
  id: string
  title: string
  body?: string
  tone: 'system' | 'good' | 'warn' | 'danger'
}

interface LoadedData {
  profile: Profile | null
  settings: Settings
  exercises: Exercise[]
  routines: Routine[]
  sessions: SessionLog[]
  sets: SetLog[]
  bodyMetrics: BodyMetric[]
  quests: QuestLog[]
  shadows: Shadow[]
  allocated: StatBlock
  progress: Progress
  earnedTitleIds: string[]
  absences: DayKey[]
}

export interface AppState extends LoadedData {
  ready: boolean
  today: DayKey
  projection: Projection | null
  streak: StreakState
  advisories: Advisory[]
  dungeonBreaks: DungeonBreak[]
  messages: SystemMessage[]
  /** The session currently being logged, if any. */
  activeSessionId: string | null

  load: () => Promise<void>
  refresh: () => Promise<void>
  /**
   * Issues whatever the System owes for today: the Daily Quest, a Penalty
   * Quest for an unfinished yesterday, and a Recovery Quest on a workload
   * spike. Idempotent, so it is safe to call on every load.
   */
  ensureQuestsForToday: () => Promise<void>
  dismissMessage: (id: string) => void
  pushMessage: (message: Omit<SystemMessage, 'id'>) => void

  completeAwakening: (input: {
    profile: Omit<Profile, 'id' | 'createdAt' | 'awakenedAt'>
    bodyweightKg: number
    optional?: {
      waistCm?: number
      neckCm?: number
      hipCm?: number
      bodyFatPct?: number
      bodyFatSource?: BodyFatSource
    }
  }) => Promise<void>

  startGate: (routineId: string | null, bodyweightKg?: number) => Promise<string>
  logSet: (input: {
    exerciseId: string
    weight: number
    reps: number
    rpe?: number
    seconds?: number
    metres?: number
    isWarmup?: boolean
  }) => Promise<void>
  correctSet: (setId: string, patch: { weight?: number; reps?: number; rpe?: number }) => Promise<void>
  finishGate: () => Promise<void>

  targetFor: (exerciseId: string) => NextTarget | null

  completeDailyQuest: (progressByKind?: Partial<Record<DailyItemKind, number>>) => Promise<void>
  todaysDailyQuest: () => DailyQuest | null

  allocatePoint: (stat: StatKey) => Promise<void>
  resetAllocation: () => Promise<void>

  addBodyMetric: (input: {
    weightKg: number
    waistCm?: number
    neckCm?: number
    hipCm?: number
    bodyFatPct?: number
    bodyFatSource?: BodyFatSource
  }) => Promise<void>

  setShadowActive: (id: string, active: boolean) => Promise<void>
  dismissAdvisory: (id: string) => Promise<void>
  declareAbsence: (dayKey: DayKey, reason: 'illness' | 'travel') => Promise<void>
  spendRestToken: () => Promise<boolean>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  markDeload: () => Promise<void>
}

function messageId(): string {
  return crypto.randomUUID()
}

async function loadAll(): Promise<LoadedData> {
  const [
    profile,
    settings,
    exercises,
    routines,
    sessions,
    sets,
    bodyMetrics,
    quests,
    shadows,
    allocated,
    progress,
    titles,
    absences,
  ] = await Promise.all([
    repo.getProfile(),
    repo.getSettings(),
    repo.getExercises(),
    repo.getRoutines(),
    repo.getSessions(),
    repo.getSets(),
    repo.getBodyMetrics(),
    repo.getQuests(),
    repo.getShadows(),
    repo.getAllocation(),
    repo.getProgress(),
    repo.getTitles(),
    repo.getAbsences(),
  ])

  return {
    profile,
    settings,
    exercises,
    routines,
    sessions,
    sets,
    bodyMetrics,
    quests,
    shadows,
    allocated,
    progress,
    earnedTitleIds: titles.map((t) => t.id),
    absences: absences.map((a) => a.dayKey),
  }
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  today: toDayKey(Date.now()),
  profile: null,
  settings: {
    id: 'settings',
    updatedAt: 0,
    soundEnabled: true,
    hapticsEnabled: true,
    keepScreenAwake: true,
    pushEnabled: false,
    syncEnabled: false,
    dismissedAdvisories: [],
  },
  exercises: [],
  routines: [],
  sessions: [],
  sets: [],
  bodyMetrics: [],
  quests: [],
  shadows: [],
  allocated: { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 },
  progress: {
    id: 'state',
    towerFloorCleared: 0,
    gatesCleared: 0,
    redGatesCleared: 0,
    dailyQuestsCompleted: 0,
    gold: 0,
    restTokens: 2,
    restTokensMonth: '',
    lastDeloadDayKey: null,
    trainingStartDayKey: null,
    updatedAt: 0,
  },
  earnedTitleIds: [],
  absences: [],
  projection: null,
  streak: { current: 0, longest: 0, forgivenDays: [], todayPending: true },
  advisories: [],
  dungeonBreaks: [],
  messages: [],
  activeSessionId: null,

  pushMessage(message) {
    set((state) => ({ messages: [...state.messages, { ...message, id: messageId() }] }))
  },

  dismissMessage(id) {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }))
  },

  async load() {
    await repo.ensureSeeded()
    await get().refresh()

    const state = get()
    // Rest tokens replenish on the first of the month. Done on load rather than
    // by a timer, because the app is not running when the month turns over.
    const month = state.today.slice(0, 7)
    if (state.progress.restTokensMonth !== month) {
      await repo.updateProgress({ restTokens: 2, restTokensMonth: month })
    }

    if (state.profile) await get().ensureQuestsForToday()
    await get().refresh()
    set({ ready: true })
  },

  async refresh() {
    const data = await loadAll()
    const today = toDayKey(Date.now())
    const streak = computeStreak(data.quests, today, data.absences)

    const projection = projectPlayer({
      today,
      now: Date.now(),
      profile: data.profile,
      exercises: data.exercises,
      routines: data.routines,
      sessions: data.sessions,
      sets: data.sets,
      bodyMetrics: data.bodyMetrics,
      quests: data.quests,
      shadows: data.shadows,
      allocated: data.allocated,
      earnedTitleIds: data.earnedTitleIds,
      gatesCleared: data.progress.gatesCleared,
      redGatesCleared: data.progress.redGatesCleared,
      towerFloorCleared: data.progress.towerFloorCleared,
      gold: data.progress.gold,
      restTokens: data.progress.restTokens,
      lastDeloadDayKey: data.progress.lastDeloadDayKey,
      trainingStartDayKey: data.progress.trainingStartDayKey,
      longestStreak: streak.longest,
      currentStreak: streak.current,
    })

    const exerciseById = new Map(data.exercises.map((e) => [e.id, e]))
    const resolveExercise = (id: string) => exerciseById.get(id)

    const weekSets = data.sessions
      .filter((s) => s.dayKey >= addDaysToKey(today, -6))
      .flatMap((s) => data.sets.filter((set) => set.sessionId === s.id))

    const allAdvisories = detectAdvisories({
      routines: data.routines,
      resolveExercise,
      weeklySetsByMuscle: hardSetsPerMuscle(weekSets, resolveExercise),
    })

    // A gate stays open for the canon seven days. Sessions logged against a
    // routine close it; anything still open past the window has broken.
    const openGates: OpenGate[] = []
    for (let i = 1; i <= 14; i += 1) {
      const dayKey = addDaysToKey(today, -i)
      const routine = data.routines.find((r) => r.dayOfWeek === dayOfWeekForKey(dayKey))
      if (!routine) continue
      const cleared = data.sessions.some(
        (s) => s.dayKey === dayKey && s.routineId === routine.id && s.endedAt !== null,
      )
      if (!cleared) openGates.push({ routineId: routine.id, openedDayKey: dayKey, rank: routine.gateRank })
    }

    const activeSession = data.sessions.find((s) => s.endedAt === null) ?? null

    set({
      ...data,
      today,
      projection,
      streak,
      advisories: activeAdvisories(allAdvisories, data.settings.dismissedAdvisories),
      dungeonBreaks: resolveDungeonBreaks(openGates, today),
      activeSessionId: activeSession?.id ?? null,
    })
  },

  /**
   * Issues whatever the System owes for today. Idempotent: called on every
   * load, and it only ever fills in what is missing.
   */
  async ensureQuestsForToday() {
    const state = get()
    const today = state.today
    const existing = state.quests.filter((q) => q.dayKey === today)
    const level = state.projection?.player.level ?? 1

    if (!existing.some((q) => q.type === 'daily')) {
      const quest = generateDailyQuest({ dayKey: today, level, allocated: state.allocated })
      await repo.putQuest({
        id: `daily-${today}`,
        dayKey: today,
        type: 'daily',
        status: 'issued',
        issuedAt: Date.now(),
        expiresAt: null,
        payload: quest,
      })
      get().pushMessage({ title: '[Daily Quest has arrived.]', tone: 'system' })
    }

    // Yesterday's unfinished daily becomes today's penalty, and yesterday's row
    // is marked so the streak calculation can see what happened.
    const yesterday = addDaysToKey(today, -1)
    const yesterdayDaily = state.quests.find((q) => q.dayKey === yesterday && q.type === 'daily')
    if (
      yesterdayDaily &&
      yesterdayDaily.status === 'issued' &&
      !existing.some((q) => q.type === 'penalty')
    ) {
      const forgiven = state.absences.includes(yesterday)
      if (forgiven) {
        await repo.setQuestStatus(yesterdayDaily.id, 'forgiven')
      } else if (state.progress.restTokens > 0) {
        await repo.setQuestStatus(yesterdayDaily.id, 'forgiven')
        await repo.updateProgress({ restTokens: state.progress.restTokens - 1 })
        get().pushMessage({
          title: '[A rest token has been spent.]',
          body: 'Yesterday is forgiven and your streak holds. Nothing has been taken away.',
          tone: 'warn',
        })
      } else {
        await repo.setQuestStatus(yesterdayDaily.id, 'failed')
        const penalty = generatePenaltyQuest({
          missed: yesterdayDaily.payload as DailyQuest,
          completed: {},
        })
        if (penalty) {
          await repo.putQuest({
            id: `penalty-${today}`,
            dayKey: today,
            type: 'penalty',
            status: 'issued',
            issuedAt: Date.now(),
            expiresAt: null,
            payload: penalty,
          })
          get().pushMessage({
            title: penalty.announcement,
            body: penalty.reassurance,
            tone: 'danger',
          })
        }
      }
    }

    // A workload spike suppresses the gate and issues recovery instead.
    const fatigue = state.projection?.fatigue
    if (fatigue?.needsRecoveryQuest && !existing.some((q) => q.type === 'recovery')) {
      const recovery = generateRecoveryQuest(today, fatigue.acwr ?? 0)
      await repo.putQuest({
        id: `recovery-${today}`,
        dayKey: today,
        type: 'recovery',
        status: 'issued',
        issuedAt: Date.now(),
        expiresAt: null,
        payload: recovery,
      })
      get().pushMessage({ title: recovery.announcement, body: recovery.detail, tone: 'warn' })
    }
  },

  async completeAwakening({ profile, bodyweightKg, optional }) {
    const now = Date.now()
    await repo.saveProfile({ ...profile, id: 'profile', createdAt: now, awakenedAt: now })
    await repo.addBodyMetric({ weightKg: bodyweightKg, ...optional })
    await get().refresh()
    await get().ensureQuestsForToday()
    await get().refresh()

    get().pushMessage({
      title: '[Congratulations. You have acquired the qualification to be a Player.]',
      body: 'Your rank is E. Everything from here is measured, not given.',
      tone: 'system',
    })
  },

  async startGate(routineId, bodyweightKg) {
    const session = await repo.startSession({ routineId, bodyweightKg })
    await get().refresh()
    return session.id
  },

  async logSet(input) {
    const state = get()
    const sessionId = state.activeSessionId
    if (!sessionId) return

    const existing = state.sets.filter((s) => s.sessionId === sessionId)
    await repo.addSet({
      sessionId,
      exerciseId: input.exerciseId,
      order: existing.length,
      weight: input.weight,
      reps: input.reps,
      rpe: input.rpe,
      seconds: input.seconds,
      metres: input.metres,
      isWarmup: input.isWarmup ?? false,
    })
    await get().refresh()
  },

  async correctSet(setId, patch) {
    await repo.correctSet(setId, patch)
    await get().refresh()
  },

  /**
   * Ends the session and resolves everything that follows from it: records,
   * shadow extraction, titles, gold, and the gate clear count.
   */
  async finishGate() {
    const before = get()
    const sessionId = before.activeSessionId
    if (!sessionId) return

    const session = before.sessions.find((s) => s.id === sessionId)
    await repo.endSession(sessionId)
    await get().refresh()

    const after = get()
    const projection = after.projection
    if (!projection) return

    const summary = projection.sessionSummaries.find((s) => s.session.id === sessionId)
    if (!summary) return

    if (session?.routineId) {
      await repo.updateProgress({
        gatesCleared: after.progress.gatesCleared + 1,
        gold: after.progress.gold + 25,
      })
      get().pushMessage({
        title: `[Gate cleared. Rank ${summary.gateRank ?? 'E'}.]`,
        body: `${Math.round(summary.tonnageKg)} kg moved across ${summary.hardSets} hard sets. ${Math.round(summary.xp)} experience gained.`,
        tone: 'good',
      })
    }

    for (const exerciseId of summary.prExerciseIds) {
      const exercise = after.exercises.find((e) => e.id === exerciseId)
      get().pushMessage({
        title: '[Boss slain.]',
        body: `New record on ${exercise?.name ?? exerciseId}.`,
        tone: 'good',
      })
    }

    /* ---- shadow extraction, on crossing a tier on the standards ---- */
    const marshalIds = projection.marshals.map((m) => m.exerciseId)
    for (const lift of projection.rank.perLift) {
      const exercise = after.exercises.find((e) => e.standardLift === lift.lift)
      if (!exercise) continue

      const alreadyHeld = after.shadows.filter((s) => s.exerciseId === exercise.id)
      const highestHeld = alreadyHeld.reduce(
        (max, s) => Math.max(max, ['E', 'D', 'C', 'B', 'A', 'S'].indexOf(s.rank)),
        -1,
      )
      if (!shouldExtract(lift.score, highestHeld < 0 ? 0 : highestHeld)) continue
      if (lift.score < 1) continue

      const marshalIndex = marshalIds.indexOf(exercise.id)
      const shadow = extractShadow({
        trigger: {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          score: lift.score,
          rank: lift.rank,
        },
        extractedAt: Date.now(),
        isMarshal: marshalIndex >= 0,
        marshalIndex: Math.max(0, marshalIndex),
      })
      await repo.addShadow(shadow)
      get().pushMessage({
        title: 'ARISE.',
        body: `${shadow.name}, ${shadow.rank}-rank, extracted from ${exercise.name}. ${shadow.buff}`,
        tone: 'system',
      })
    }

    /* ---- titles ---- */
    for (const title of projection.newTitles) {
      await repo.addTitle({
        id: title.id,
        name: title.name,
        description: title.description,
        earnedAt: Date.now(),
      })
      get().pushMessage({
        title: `[Title acquired: ${title.name}]`,
        body: title.description,
        tone: 'good',
      })
    }

    await get().refresh()
  },

  targetFor(exerciseId) {
    const state = get()
    const exercise = state.exercises.find((e) => e.id === exerciseId)
    if (!exercise) return null

    const routine = state.routines.find((r) => r.dayOfWeek === dayOfWeekForKey(state.today))
    const plannedSets =
      routine?.blocks
        .flatMap((b) => b.items)
        .find((item) => item.exerciseId === exerciseId)?.sets ?? 3

    return computeNextTarget(exercise, plannedSets, {
      lastSets: lastSetsForExercise(exerciseId, state.sessions, state.sets),
      age: state.projection?.age ?? undefined,
      equipmentAccess: state.profile?.equipmentAccess,
      resolveExercise: (id) => state.exercises.find((e) => e.id === id),
    })
  },

  todaysDailyQuest() {
    const state = get()
    const row = state.quests.find((q) => q.dayKey === state.today && q.type === 'daily')
    return (row?.payload as DailyQuest | undefined) ?? null
  },

  async completeDailyQuest() {
    const state = get()
    const row = state.quests.find((q) => q.dayKey === state.today && q.type === 'daily')
    if (!row || row.status === 'complete') return

    await repo.setQuestStatus(row.id, 'complete')
    await repo.updateProgress({
      dailyQuestsCompleted: state.progress.dailyQuestsCompleted + 1,
      gold: state.progress.gold + 25,
    })

    // Any penalty owed today is discharged by clearing the day's work.
    const penalty = state.quests.find((q) => q.dayKey === state.today && q.type === 'penalty')
    if (penalty && penalty.status === 'issued') await repo.setQuestStatus(penalty.id, 'complete')

    await get().refresh()
    get().pushMessage({
      title: '[Daily Quest complete.]',
      body: `Streak ${get().streak.current}. 150 experience and 25 gold gained.`,
      tone: 'good',
    })
  },

  async allocatePoint(stat) {
    const state = get()
    if ((state.projection?.player.unspentStatPoints ?? 0) <= 0) return
    const next = { ...state.allocated, [stat]: state.allocated[stat] + 1 }
    await repo.saveAllocation(next)
    await get().refresh()
  },

  async resetAllocation() {
    await repo.saveAllocation({ STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 })
    await get().refresh()
  },

  async addBodyMetric(input) {
    await repo.addBodyMetric(input)
    await get().refresh()
  },

  async setShadowActive(id, active) {
    await repo.setShadowActive(id, active)
    await get().refresh()
  },

  async dismissAdvisory(id) {
    const state = get()
    await repo.saveSettings({
      dismissedAdvisories: [...state.settings.dismissedAdvisories, id],
    })
    await get().refresh()
  },

  async declareAbsence(dayKey, reason) {
    await repo.declareAbsence(dayKey, reason)
    const row = get().quests.find((q) => q.dayKey === dayKey && q.type === 'daily')
    if (row && row.status !== 'complete') await repo.setQuestStatus(row.id, 'forgiven')
    await get().refresh()
  },

  async spendRestToken() {
    const state = get()
    if (state.progress.restTokens <= 0) return false
    await repo.updateProgress({ restTokens: state.progress.restTokens - 1 })
    const row = state.quests.find((q) => q.dayKey === state.today && q.type === 'daily')
    if (row && row.status !== 'complete') await repo.setQuestStatus(row.id, 'forgiven')
    await get().refresh()
    return true
  },

  async updateSettings(patch) {
    await repo.saveSettings(patch)
    await get().refresh()
  },

  async markDeload() {
    await repo.updateProgress({ lastDeloadDayKey: get().today })
    await get().refresh()
    get().pushMessage({
      title: '[Deload recorded.]',
      body: 'The System will not ask again for five weeks.',
      tone: 'system',
    })
  },
}))

/** Titles the hunter holds, resolved to their definitions for display. */
export function heldTitles(ids: readonly string[]) {
  return ids.map((id) => titleById(id)).filter((t): t is NonNullable<typeof t> => t !== undefined)
}
