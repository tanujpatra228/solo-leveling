/**
 * The single application store: the loaded log, the projection derived from it,
 * and the actions that append to it. Standards rules 4, 5 and 7 — every action
 * writes to IndexedDB and refreshes before returning, and nothing awaits the
 * network.
 */
import { create } from 'zustand'
import * as repo from '../db/repo'
import { detectAdvisories, activeAdvisories, type Advisory } from '../domain/advisories'
import { FLAVOUR_TABLE, flavourFor } from '../domain/flavour'
import { hardSetsPerMuscle } from '../domain/volume'
import { computeStreak, type StreakState } from '../domain/streak'
import {
  activeQuestFor,
  generateDailyQuest,
  generatePenaltyQuest,
  generateRecoveryQuest,
  isDailyQuestComplete,
  mergeDailyQuestProgress,
  resolveJobChange,
  type DailyItemKind,
  type DailyQuestPayload,
} from '../domain/quests'
import { purchase, shopItemById, type ShopItemId } from '../domain/shop'
import {
  dropSuperseded,
  lastSetsForExercise,
  projectPlayer,
  type Projection,
} from '../domain/projection'
import { computeNextTarget, type NextTarget } from '../domain/progression'
import { substitutesFor, type SubstituteCandidate } from '../domain/substitution'
import { extractShadow, shouldExtract } from '../domain/shadows'
import {
  buildInstantDungeon,
  resolveDungeonBreaks,
  type DungeonBreak,
  type InstantDungeon,
  type OpenGate,
  type RedGate,
} from '../domain/gates'
import { addDaysToKey, dayOfWeekForKey, toDayKey } from '../domain/time'
import { titleById } from '../domain/titles'
import { forgetMirror as forgetMirrorOnServer, runSync } from '../sync/client'
import { identityFromLicenseKey, parsePairingPayload } from '../sync/identity'
import type { Identity } from '../sync/identity'
import type {
  BodyFatSource,
  BodyMetric,
  DayKey,
  Equipment,
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
  SubstitutionReason,
} from '../domain/types'
import type { Progress } from '../db/db'

/** A System window queued for display, in the order the events happened. */
export interface SystemMessage {
  id: string
  title: string
  body?: string
  tone: 'system' | 'good' | 'warn' | 'danger'
  /**
   * `toast` (the default) is transient and stacks; `window` is the modal
   * reference look, shown one at a time and dismissed deliberately. A modal
   * after every logged set would be miserable mid-workout, and a toast for
   * ARISE wastes the best moment in the app — see
   * docs/system-visuals-plan.md §7.
   */
  kind?: 'toast' | 'window'
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'failed' | 'offline'

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
  /** The Hunter Secret, minted on first launch and persisted from then on. */
  identity: Identity | null
  today: DayKey
  projection: Projection | null
  streak: StreakState
  advisories: Advisory[]
  dungeonBreaks: DungeonBreak[]
  messages: SystemMessage[]
  /** The session currently being logged, if any. */
  activeSessionId: string | null
  /**
   * Swaps chosen for the open session, keyed by the planned exercise's id.
   * Lives only in the store, not Dexie — the choice is good for this session
   * only (commit 9de7140). Cleared on
   * `startGate`, `finishGate` and `abandonGate`.
   */
  activeSubstitutions: Record<string, { substituteId: string; reason: SubstitutionReason }>

  /**
   * The built dungeon for the open session, when it was started via
   * `startInstantDungeon` rather than a scheduled routine — such a session
   * carries `routineId: null` (m7-plan commit 2). Store-only, like
   * `activeSubstitutions`: the dungeon is a one-off, never a programme
   * addition, so it is never written to `db.routines`.
   */
  activeInstantDungeon: InstantDungeon | null
  /**
   * The open session's Red Gate, when it was started via `enterRedGate`.
   * Also carries `routineId: null`. Resolved (not "finished") by
   * `resolveRedGate`, which is deliberately a separate action from
   * `finishGate` — a Red Gate's pass/fail evaluation and its own reward
   * (`Progress.redGatesCleared`) are not the ordinary gate-clear bonus.
   */
  activeRedGate: { redGate: RedGate; exerciseId: string; targetWeightKg?: number } | null

  /**
   * `idle` before the first attempt this session; `syncing` while a request
   * is in flight; `ok`/`failed`/`offline` after the most recent attempt.
   * Never blocks anything — see `syncNow` (F3).
   */
  syncStatus: SyncStatus
  lastSyncedAt: number | null

  load: () => Promise<void>
  /** Reads every table and re-derives the projection from it. */
  refresh: () => Promise<void>
  /**
   * Re-derives the projection from whatever is already in the store, with no
   * database read. What `logSet` and `correctSet` call after appending in
   * memory, since re-reading thirteen Dexie tables on every set logged is the
   * difference between a responsive rest timer and a stutter.
   */
  recompute: () => void
  /**
   * Whether the programme schedules anything on a day. Derived from the
   * routines rather than stored, so adding a Sunday routine later makes Sunday
   * a training day with no other change.
   */
  isRestDay: (day: DayKey) => boolean
  /**
   * Issues whatever the System owes for today: the Daily Quest, a Penalty
   * Quest for an unfinished yesterday, and a Recovery Quest on a workload
   * spike. Idempotent, so it is safe to call on every load.
   */
  ensureQuestsForToday: () => Promise<void>
  /**
   * Shows the bodyweightFactor tonnage correction exactly once, comparing the
   * level under the old full-bodyweight measurement against the corrected
   * one. Gated on `Progress.bodyweightFactorAnnouncedAt`, in the same shape
   * as `doubleDungeonSeenAt`. See commit 5ce8d44.
   */
  announceBodyweightFactorRegradeIfNeeded: () => Promise<void>
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
  /**
   * Builds an Instant Dungeon from whatever equipment is on hand and opens a
   * session against it — no routine, no schedule (m7-plan commit 2).
   */
  startInstantDungeon: (available: Equipment[], bodyweightKg?: number) => Promise<string>
  /**
   * Opens a session for one Red Gate attempt. `exerciseId` is the target of
   * `redGate`'s description, since `RedGate` itself only carries the name.
   * `targetWeightKg` is kept here rather than on `RedGate`, since that type
   * only ever needed it to compose the description string before now —
   * judging a PR attempt needs the number itself, structured.
   */
  enterRedGate: (
    redGate: RedGate,
    exerciseId: string,
    options?: { targetWeightKg?: number; bodyweightKg?: number },
  ) => Promise<string>
  /**
   * Ends the open Red Gate session and judges it: an AMRAP finisher clears on
   * any completed set, a PR attempt clears only at or above its target
   * weight. Pays `Progress.redGatesCleared` on success and nothing at all on
   * failure — the ordinary set XP already flows through the regular
   * projection regardless, since the lift itself was still real work.
   */
  resolveRedGate: () => Promise<void>
  logSet: (input: {
    exerciseId: string
    weight: number
    reps: number
    rpe?: number
    seconds?: number
    metres?: number
    isWarmup?: boolean
    substitutedFor?: string
    substitutionReason?: SubstitutionReason
  }) => Promise<void>
  /**
   * Records that `substituteId` is standing in for `plannedId` for the rest
   * of the open session. Synchronous and in-memory only — see
   * `activeSubstitutions`. Does not itself write a `SetLog`; `logSet` still
   * needs `substitutedFor`/`substitutionReason` passed explicitly when the
   * caller logs against the substitute.
   */
  substituteExercise: (plannedId: string, substituteId: string, reason: SubstitutionReason) => void
  /** Reverts a block to its prescribed exercise for the rest of the session. */
  clearSubstitution: (plannedId: string) => void
  correctSet: (
    setId: string,
    patch: { weight?: number; reps?: number; rpe?: number; isWarmup?: boolean },
  ) => Promise<void>
  finishGate: () => Promise<void>
  /**
   * Discards the open session outright rather than finishing it — for a gate
   * opened by mistake, or a stuck row left behind by an earlier crash. See
   * `repo.abandonSession`.
   */
  abandonGate: () => Promise<void>

  /**
   * One target per exercise, computed once here rather than per call, so screens
   * select a stable reference instead of a fresh object. Standards rule 13.
   */
  targetsByExerciseId: Record<string, NextTarget>
  targetFor: (exerciseId: string) => NextTarget | null

  /**
   * Ranked swap candidates per exercise in today's routine, computed once
   * here for the same reason as `targetsByExerciseId` — it is derived from
   * three slices (exercises, profile, routine) plus session state, so a
   * component reading it must select this stable map rather than call
   * `substitutesFor` itself (rule 13). Uses each exercise's own equipment as
   * the default block; a hunter marking a second station occupied narrows
   * this list further, client-side, in the swap sheet itself.
   */
  substitutesByExerciseId: Record<string, SubstituteCandidate[]>

  /**
   * Merges `progressByKind` into today's recorded progress (additively —
   * entering 40 then 60 more totals 100, not 60) and completes the quest
   * once every item has met its target. Safe to call with no argument just
   * to re-check completion. Progress is entered by the hunter; nothing here
   * ever infers it from sets logged inside a gate (F2).
   */
  completeDailyQuest: (progressByKind?: Partial<Record<DailyItemKind, number>>) => Promise<void>
  todaysDailyQuest: () => DailyQuestPayload | null
  /**
   * Replaces today's Daily Quest with a freshly generated one. The old row
   * stays — marked `supersedes` on the new one, not deleted or reassigned
   * (m7b-plan F3) — so it is simply no longer the active row, and generates
   * no penalty for being "unfinished". Ungated here; the Shop (m7b-plan
   * commit 5/6) is what will charge gold for calling this.
   */
  rerollDailyQuest: () => Promise<void>

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

  /**
   * Records a new measurement and announces what changed since the last one
   * (m7b-plan commit 7) — a prompt to re-measure, not a recalculation (F4):
   * rank and every other derived figure already recompute on every call.
   */
  completeReawakeningTest: (input: {
    weightKg: number
    waistCm?: number
    neckCm?: number
    hipCm?: number
    bodyFatPct?: number
    bodyFatSource?: BodyFatSource
  }) => Promise<void>

  setShadowActive: (id: string, active: boolean) => Promise<void>
  /** The issued-but-not-completed Job Change Quest row, if one exists. */
  activeJobChangeQuest: () => QuestLog | null
  completeJobChangeQuest: () => Promise<void>
  /**
   * Buys one item from the System Shop. A no-op with a toast, not a thrown
   * error, when gold is short or (for a Quest Reroll) there is nothing open
   * to reroll — gold is deducted only once the purchase can actually apply.
   */
  purchaseShopItem: (id: ShopItemId) => Promise<void>
  dismissAdvisory: (id: string) => Promise<void>
  declareAbsence: (dayKey: DayKey, reason: 'illness' | 'travel') => Promise<void>
  spendRestToken: () => Promise<boolean>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  markDeload: () => Promise<void>
  /** Fires the one-time "how the summon windows work" notification, per hunter, ever. */
  announceSystemIntroIfNeeded: () => Promise<void>

  /**
   * Fire-and-forget: never returns a promise a caller awaits, so a component
   * can never accidentally block on the network (F3, rule "no feature awaits
   * the network"). A run already in flight absorbs this call rather than
   * starting a second (M6 commit 1's coalescing test). Triggers are app
   * foreground, after `finishGate`, and this manual call — never per set.
   */
  syncNow: () => void
  /**
   * Deletes this hunter's rows on the mirror. The local log is never touched
   * — see `forgetMirror` in `sync/client.ts` and F4's warning-first framing
   * on the License Key screen. Returns whether the server confirmed it.
   */
  forgetMirror: () => Promise<boolean>
  /**
   * Adopts a Hunter Secret scanned from another device's License Key QR
   * (M6 commit 5), replacing this device's own identity. The training log
   * already on this device is untouched — it is not wiped, and once sync
   * runs it becomes part of the paired hunter's mirrored history alongside
   * it, which is the point of pairing two devices to one hunter.
   */
  pairWithScannedKey: (rawPayload: string) => Promise<{ ok: boolean; message: string }>
}

function messageId(): string {
  return crypto.randomUUID()
}

const SUBSTITUTION_REASON_LABEL: Record<SubstitutionReason, string> = {
  occupied: 'station occupied',
  unavailable: 'unavailable',
  injury: 'injury',
  preference: 'preference',
}

/**
 * "N of M blocks as prescribed", plus one line per substitution made this
 * session. The System should never quietly re-describe what the hunter did —
 * see commit 4d6f484. Reads the log itself
 * (`SetLog.substitutedFor`) rather than `activeSubstitutions`, which is
 * already cleared by the time `finishGate` gets here.
 */
function summarizeSubstitutions(routineId: string, sessionId: string, state: AppState): string {
  const routine = state.routines.find((r) => r.id === routineId)
  if (!routine) return ''

  const totalBlocks = routine.blocks.flatMap((b) => b.items).length
  const substitutions = new Map<string, { substituteId: string; reason: SubstitutionReason }>()
  for (const set of state.sets) {
    if (set.sessionId !== sessionId || !set.substitutedFor) continue
    substitutions.set(set.substitutedFor, {
      substituteId: set.exerciseId,
      reason: set.substitutionReason ?? 'occupied',
    })
  }
  if (substitutions.size === 0) return ''

  const asPrescribed = totalBlocks - substitutions.size
  const nameFor = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? id
  const lines = Array.from(substitutions.entries()).map(
    ([plannedId, sub]) =>
      `${nameFor(plannedId)} → ${nameFor(sub.substituteId)}, ${SUBSTITUTION_REASON_LABEL[sub.reason]}.`,
  )
  return `${asPrescribed} of ${totalBlocks} blocks as prescribed. ${lines.join(' ')}`
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

const SYNC_BACKOFF_BASE_MS = 2_000
const SYNC_MAX_BACKOFF_MS = 5 * 60_000
/** After this many straight failures, the controller stops scheduling its own
 *  retries and waits for a fresh trigger (foreground, Finish Gate, or the
 *  manual button) rather than retrying forever (F3, F5). */
const SYNC_MAX_AUTO_RETRIES = 6

/**
 * Coalescing and backoff for `syncNow`, factored out of the store's action
 * body because both need state that must survive across calls but must
 * never itself be React/Zustand state — a retry timer handle is not
 * something any component should be able to read or diff against.
 */
function createSyncController(get: () => AppState, set: (patch: Partial<AppState>) => void): () => void {
  let inFlight: Promise<void> | null = null
  let failureStreak = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function run(isAutoRetry: boolean): void {
    const state = get()
    if (!state.settings.syncEnabled || !state.identity || inFlight) return

    // A fresh trigger (not the controller's own scheduled retry) always gets
    // a full run and a full new backoff budget — otherwise tapping the
    // manual button after the controller had given up would inherit a stale
    // streak and refuse to schedule anything on the next failure.
    if (!isAutoRetry) {
      failureStreak = 0
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    const identity = state.identity
    set({ syncStatus: 'syncing' })

    inFlight = (async () => {
      try {
        const outcome = await runSync(identity)
        if (outcome.ok) {
          failureStreak = 0
          set({ syncStatus: 'ok', lastSyncedAt: Date.now() })
          return
        }
        if (outcome.message?.startsWith('Offline')) {
          set({ syncStatus: 'offline' })
          return
        }

        set({ syncStatus: 'failed' })
        failureStreak += 1
        if (failureStreak < SYNC_MAX_AUTO_RETRIES) {
          const delay = Math.min(SYNC_BACKOFF_BASE_MS * 2 ** (failureStreak - 1), SYNC_MAX_BACKOFF_MS)
          retryTimer = setTimeout(() => {
            retryTimer = null
            run(true)
          }, delay)
        }
      } finally {
        inFlight = null
      }
    })()
  }

  return () => run(false)
}

export const useApp = create<AppState>((set, get) => ({
  syncNow: createSyncController(get, set),

  ready: false,
  identity: null,
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
    systemIntroSeen: false,
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
    doubleDungeonSeenAt: null,
    bodyweightFactorAnnouncedAt: null,
    updatedAt: 0,
  },
  earnedTitleIds: [],
  absences: [],
  projection: null,
  streak: { current: 0, longest: 0, forgivenDays: [], todayPending: true, todayIsRest: false },
  advisories: [],
  dungeonBreaks: [],
  messages: [],
  activeSessionId: null,
  activeSubstitutions: {},
  activeInstantDungeon: null,
  activeRedGate: null,
  substitutesByExerciseId: {},
  targetsByExerciseId: {},
  syncStatus: 'idle',
  lastSyncedAt: null,

  pushMessage(message) {
    set((state) => ({ messages: [...state.messages, { ...message, id: messageId() }] }))
  },

  dismissMessage(id) {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }))
  },

  async load() {
    // Mints the Hunter Secret on a first launch. No network consequence:
    // syncEnabled defaults to false, so this contacts nothing.
    const identity = await repo.ensureIdentity()
    const syncState = await repo.getSyncState()
    set({ identity, lastSyncedAt: syncState.lastSyncedAt })

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
    await get().announceBodyweightFactorRegradeIfNeeded()
    set({ ready: true })
  },

  async refresh() {
    const data = await loadAll()
    set(data)
    get().recompute()
  },

  isRestDay(day) {
    const routines = get().routines
    if (routines.length === 0) return false
    return !routines.some((r) => r.dayOfWeek === dayOfWeekForKey(day))
  },

  recompute() {
    const state = get()
    const today = toDayKey(Date.now())
    const isRestDay = get().isRestDay
    const streak = computeStreak(state.quests, today, state.absences, isRestDay)

    const projection = projectPlayer({
      today,
      now: Date.now(),
      profile: state.profile,
      exercises: state.exercises,
      routines: state.routines,
      sessions: state.sessions,
      sets: state.sets,
      bodyMetrics: state.bodyMetrics,
      quests: state.quests,
      shadows: state.shadows,
      allocated: state.allocated,
      earnedTitleIds: state.earnedTitleIds,
      gatesCleared: state.progress.gatesCleared,
      redGatesCleared: state.progress.redGatesCleared,
      towerFloorCleared: state.progress.towerFloorCleared,
      gold: state.progress.gold,
      restTokens: state.progress.restTokens,
      lastDeloadDayKey: state.progress.lastDeloadDayKey,
      trainingStartDayKey: state.progress.trainingStartDayKey,
      longestStreak: streak.longest,
      currentStreak: streak.current,
    })

    const exerciseById = new Map(state.exercises.map((e) => [e.id, e]))
    const resolveExercise = (id: string) => exerciseById.get(id)

    // One pass over the sets, indexed by session, replaces filtering all
    // ~20,000 sets once per session in the trailing week.
    const setsBySession = new Map<string, SetLog[]>()
    for (const s of state.sets) {
      const bucket = setsBySession.get(s.sessionId)
      if (bucket) bucket.push(s)
      else setsBySession.set(s.sessionId, [s])
    }

    const weekSets = state.sessions
      .filter((s) => s.dayKey >= addDaysToKey(today, -6))
      .flatMap((s) => setsBySession.get(s.id) ?? [])

    const allAdvisories = detectAdvisories({
      routines: state.routines,
      resolveExercise,
      weeklySetsByMuscle: hardSetsPerMuscle(weekSets, resolveExercise),
    })

    // A gate stays open for the canon seven days. Sessions logged against a
    // routine close it; anything still open past the window has broken. One
    // pass over sessions builds the cleared-gate index, replacing a scan of
    // every session for each of the fourteen candidate days.
    const clearedGates = new Set<string>()
    for (const s of state.sessions) {
      if (s.endedAt !== null && s.routineId) clearedGates.add(`${s.dayKey}:${s.routineId}`)
    }
    const openGates: OpenGate[] = []
    for (let i = 1; i <= 14; i += 1) {
      const dayKey = addDaysToKey(today, -i)
      const routine = state.routines.find((r) => r.dayOfWeek === dayOfWeekForKey(dayKey))
      if (!routine) continue
      if (!clearedGates.has(`${dayKey}:${routine.id}`)) {
        openGates.push({ routineId: routine.id, openedDayKey: dayKey, rank: routine.gateRank })
      }
    }

    const activeSession = state.sessions.find((s) => s.endedAt === null) ?? null

    // A session's targets belong to the routine it was started against, not
    // today's date — the two disagree whenever a session crosses the 04:00
    // rollover. Only fall back to the day-of-week lookup when there is no
    // active session, or the active one has no routine (Instant Dungeon Key).
    const targetRoutine = activeSession?.routineId
      ? state.routines.find((r) => r.id === activeSession.routineId)
      : state.routines.find((r) => r.dayOfWeek === dayOfWeekForKey(today))

    // Computed once here rather than on demand by `targetFor`: every call
    // site reads the same object for the same exercise until the next
    // recompute, which is what keeps the selector Object.is-stable across
    // renders (see the AppState doc comment on targetFor).
    const targetsByExerciseId: Record<string, NextTarget> = {}
    for (const exercise of state.exercises) {
      const blockItem = targetRoutine?.blocks
        .flatMap((b) => b.items)
        .find((item) => item.exerciseId === exercise.id)

      targetsByExerciseId[exercise.id] = computeNextTarget(exercise, blockItem?.sets ?? 3, {
        lastSets: lastSetsForExercise(exercise.id, state.sessions, state.sets),
        age: projection.age ?? undefined,
        equipmentAccess: state.profile?.equipmentAccess,
        resolveExercise,
        repRangeOverride: blockItem?.repRange,
      })
    }

    // Ranked against each exercise's own equipment as the default block —
    // the common case (see commit d07154c) — so the swap sheet
    // needs no store round-trip to narrow further; it filters this list
    // client-side when a second piece of equipment is also occupied.
    const substitutesByExerciseId: Record<string, SubstituteCandidate[]> = {}
    for (const exercise of state.exercises) {
      substitutesByExerciseId[exercise.id] = substitutesFor(exercise, {
        exercises: state.exercises,
        equipmentAccess: state.profile?.equipmentAccess ?? [],
        routine: targetRoutine ?? null,
      })
    }

    set({
      today,
      projection,
      streak,
      advisories: activeAdvisories(allAdvisories, state.settings.dismissedAdvisories),
      dungeonBreaks: resolveDungeonBreaks(openGates, today),
      activeSessionId: activeSession?.id ?? null,
      targetsByExerciseId,
      substitutesByExerciseId,
    })

    // `recompute` is the one choke point every XP-changing action passes
    // through — `refresh` calls it, and `logSet`/`correctSet` call it
    // directly — so this is the single place a level change can be caught,
    // regardless of which action caused it. Guarded on
    // a previous projection existing, so the very first computation (app
    // boot, or before a profile exists) never reads as "leveled up".
    const previousLevel = state.projection?.player.level ?? null
    if (previousLevel !== null && projection.player.level > previousLevel) {
      get().pushMessage({
        title: `[Level up. LV ${projection.player.level}.]`,
        body: flavourFor(
          FLAVOUR_TABLE,
          'level_up',
          String(projection.player.level),
          'New stat points are waiting to be spent.',
        ),
        tone: 'good',
        kind: 'window',
      })
    }
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

    // Nothing is owed on a day the programme never scheduled. Issuing a quest
    // the hunter cannot clear would turn a planned rest day into tomorrow's
    // penalty, which is the opposite of what a rest day is for.
    if (!get().isRestDay(today) && !existing.some((q) => q.type === 'daily')) {
      const quest = generateDailyQuest({ dayKey: today, level, allocated: state.allocated })
      await repo.putQuest({
        id: `daily-${today}`,
        dayKey: today,
        type: 'daily',
        status: 'issued',
        issuedAt: Date.now(),
        expiresAt: null,
        payload: { ...quest, progress: {} },
      })
      get().pushMessage({
        title: flavourFor(FLAVOUR_TABLE, 'daily_quest_arrived', today, '[Daily Quest has arrived.]'),
        tone: 'system',
      })
    }

    // Yesterday's unfinished daily becomes today's penalty, and yesterday's row
    // is marked so the streak calculation can see what happened.
    const yesterday = addDaysToKey(today, -1)
    // The active row, not just any row for the day — a rerolled-away quest
    // (m7b-plan F3) must not generate a penalty for the one it replaced.
    const yesterdayDaily = activeQuestFor(state.quests, yesterday, 'daily')
    if (
      yesterdayDaily &&
      yesterdayDaily.status === 'issued' &&
      !existing.some((q) => q.type === 'penalty')
    ) {
      // A rest day is forgiven without spending anything: the hunter did not
      // miss it, the System never asked.
      const forgiven = state.absences.includes(yesterday) || get().isRestDay(yesterday)
      if (forgiven) {
        await repo.setQuestStatus(yesterdayDaily.id, 'forgiven')
      } else if (state.progress.restTokens > 0) {
        await repo.setQuestStatus(yesterdayDaily.id, 'forgiven')
        await repo.updateProgress({ restTokens: state.progress.restTokens - 1 })
        get().pushMessage({
          title: '[A rest token has been spent.]',
          body: flavourFor(
            FLAVOUR_TABLE,
            'rest_token_spent',
            yesterday,
            'Yesterday is forgiven and your streak holds. Nothing has been taken away.',
          ),
          tone: 'warn',
        })
      } else {
        await repo.setQuestStatus(yesterdayDaily.id, 'failed')
        const missedPayload = yesterdayDaily.payload as DailyQuestPayload
        const penalty = generatePenaltyQuest({
          missed: missedPayload,
          completed: missedPayload.progress,
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

    // Level-triggered rather than day-keyed, and issued exactly once — a row
    // existing at all (issued or complete) means never again (m7b-plan F6).
    if (state.projection?.jobChangeDue && !state.quests.some((q) => q.type === 'job_change')) {
      await repo.putQuest({
        id: 'job-change',
        dayKey: today,
        type: 'job_change',
        status: 'issued',
        issuedAt: Date.now(),
        expiresAt: null,
        payload: null,
      })
      get().pushMessage({
        title: '[The Job Change Quest has arrived.]',
        body: 'A benchmark week. Train as you have been — your stat distribution, read whenever you take the test, picks your class.',
        tone: 'system',
        kind: 'window',
      })
    }
  },

  async announceBodyweightFactorRegradeIfNeeded() {
    const state = get()
    if (state.progress.bodyweightFactorAnnouncedAt !== null) return

    // Nothing to regrade before a profile exists — mark it seen silently so a
    // hunter who awakens after this ships never sees a comparison against
    // history that never happened.
    if (!state.profile || !state.projection) {
      await repo.updateProgress({ bodyweightFactorAnnouncedAt: Date.now() })
      await get().refresh()
      return
    }

    const today = state.today
    // The old behaviour, reconstructed: every bodyweight exercise added the
    // hunter's full mass, because bodyweightFactor did not exist yet.
    const legacyExercises = state.exercises.map((exercise) =>
      exercise.usesBodyweight ? { ...exercise, bodyweightFactor: 1 } : exercise,
    )
    const before = projectPlayer({
      today,
      now: Date.now(),
      profile: state.profile,
      exercises: legacyExercises,
      routines: state.routines,
      sessions: state.sessions,
      sets: state.sets,
      bodyMetrics: state.bodyMetrics,
      quests: state.quests,
      shadows: state.shadows,
      allocated: state.allocated,
      earnedTitleIds: state.earnedTitleIds,
      gatesCleared: state.progress.gatesCleared,
      redGatesCleared: state.progress.redGatesCleared,
      towerFloorCleared: state.progress.towerFloorCleared,
      gold: state.progress.gold,
      restTokens: state.progress.restTokens,
      lastDeloadDayKey: state.progress.lastDeloadDayKey,
      trainingStartDayKey: state.progress.trainingStartDayKey,
      longestStreak: state.streak.longest,
      currentStreak: state.streak.current,
    })
    const after = state.projection

    await repo.updateProgress({ bodyweightFactorAnnouncedAt: Date.now() })
    await get().refresh()

    const body =
      before.player.level === after.player.level
        ? `Total experience has been recalculated; your level holds at ${after.player.level}.`
        : `Level ${before.player.level} is now level ${after.player.level}.`

    get().pushMessage({
      title: '[The System has corrected a measurement.]',
      body: `Bodyweight movements were being measured at their full mass rather than the fraction they actually move. ${body}`,
      tone: 'system',
    })
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
    // Tonnage for every usesBodyweight exercise is fed straight from this
    // number (projection.ts), so an unset bodyweight understates XP silently
    // rather than erroring. Default from the most recent body-metric entry
    // here, in the one place it cannot be forgotten by a call site.
    const resolved = bodyweightKg ?? get().projection?.latestBodyMetric?.weightKg ?? undefined
    const session = await repo.startSession({ routineId, bodyweightKg: resolved })
    // A swap chosen mid-session belongs to that session alone (§5 commit 6);
    // starting a new one must not carry a stale choice into it. Likewise a
    // stale Instant Dungeon or Red Gate reference from whatever the previous
    // session was.
    set({ activeSubstitutions: {}, activeInstantDungeon: null, activeRedGate: null })
    await get().refresh()
    return session.id
  },

  async startInstantDungeon(available, bodyweightKg) {
    const dungeon = buildInstantDungeon({ available, library: get().exercises })
    const resolved = bodyweightKg ?? get().projection?.latestBodyMetric?.weightKg ?? undefined
    const session = await repo.startSession({ routineId: null, bodyweightKg: resolved })
    set({ activeSubstitutions: {}, activeInstantDungeon: dungeon, activeRedGate: null })
    await get().refresh()
    return session.id
  },

  async enterRedGate(redGate, exerciseId, options) {
    const resolved = options?.bodyweightKg ?? get().projection?.latestBodyMetric?.weightKg ?? undefined
    const session = await repo.startSession({ routineId: null, bodyweightKg: resolved })
    set({
      activeSubstitutions: {},
      activeInstantDungeon: null,
      activeRedGate: { redGate, exerciseId, targetWeightKg: options?.targetWeightKg },
    })
    await get().refresh()
    return session.id
  },

  async resolveRedGate() {
    const before = get()
    const sessionId = before.activeSessionId
    const active = before.activeRedGate
    if (!sessionId || !active) return

    await repo.endSession(sessionId)
    set({ activeRedGate: null })
    await get().refresh()

    const after = get()
    const loggedSets = dropSuperseded(
      after.sets.filter((s) => s.sessionId === sessionId && s.exerciseId === active.exerciseId && !s.isWarmup),
    )
    const bestWeightKg = loggedSets.reduce((max, s) => Math.max(max, s.weight), 0)

    // An AMRAP finisher has no numeric target — the attempt itself is the
    // record, so any completed set clears it. A PR attempt is binary: the
    // target weight or nothing, which is the "no partial credit" canon rule.
    const cleared =
      loggedSets.length === 0
        ? false
        : active.redGate.kind === 'amrap_finisher'
          ? true
          : bestWeightKg >= (active.targetWeightKg ?? Number.POSITIVE_INFINITY)

    if (cleared) {
      await repo.updateProgress({ redGatesCleared: after.progress.redGatesCleared + 1 })
      await get().refresh()
      get().pushMessage({
        title: flavourFor(FLAVOUR_TABLE, 'red_gate_cleared', sessionId, '[Red Gate cleared.]'),
        body: 'The gate closes behind you. The record stands.',
        tone: 'good',
        kind: 'window',
      })
    } else {
      get().pushMessage({
        title: flavourFor(FLAVOUR_TABLE, 'red_gate_failed', sessionId, '[Red Gate failed.]'),
        body: 'Nothing has been taken away. The gate closes and pays out nothing.',
        tone: 'warn',
        kind: 'window',
      })
    }
  },

  substituteExercise(plannedId, substituteId, reason) {
    set((s) => ({
      activeSubstitutions: { ...s.activeSubstitutions, [plannedId]: { substituteId, reason } },
    }))
  },

  clearSubstitution(plannedId) {
    set((s) => {
      const next = { ...s.activeSubstitutions }
      delete next[plannedId]
      return { activeSubstitutions: next }
    })
  },

  async logSet(input) {
    const state = get()
    const sessionId = state.activeSessionId
    if (!sessionId) return

    // The log is append-only, so a corrected set leaves both its original and
    // its replacement in `state.sets` at the same order. Counting live
    // (non-superseded) rows and taking one past the highest survives that;
    // `existing.length` would double-count the superseded row and skip a slot.
    const live = dropSuperseded(state.sets.filter((s) => s.sessionId === sessionId))
    const nextOrder = live.reduce((max, s) => Math.max(max, s.order + 1), 0)
    const created = await repo.addSet({
      sessionId,
      exerciseId: input.exerciseId,
      order: nextOrder,
      weight: input.weight,
      reps: input.reps,
      rpe: input.rpe,
      seconds: input.seconds,
      metres: input.metres,
      isWarmup: input.isWarmup ?? false,
      substitutedFor: input.substitutedFor,
      substitutionReason: input.substitutionReason,
    })
    // Appended in memory rather than re-read: repo.addSet already returns the
    // row it wrote, so nothing here touches IndexedDB again.
    set((s) => ({ sets: [...s.sets, created] }))
    get().recompute()
  },

  async correctSet(setId, patch) {
    const replacement = await repo.correctSet(setId, patch)
    if (replacement) set((s) => ({ sets: [...s.sets, replacement] }))
    get().recompute()
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
    set({ activeSubstitutions: {}, activeInstantDungeon: null })
    await repo.endSession(sessionId)
    await get().refresh()

    const after = get()
    const projection = after.projection
    if (!projection) return

    const summary = projection.sessionSummaries.find((s) => s.session.id === sessionId)
    if (!summary) return

    // Gated on a real rank rather than `session.routineId`, so an Instant
    // Dungeon (routineId: null, m7-plan commit 2) pays the same gate-clear
    // bonus a scheduled routine does — `gateDifficulty` already returns null
    // for no planned work, which is the "no session at all" case this was
    // always meant to exclude.
    if (summary.gateRank !== null) {
      await repo.updateProgress({
        gatesCleared: after.progress.gatesCleared + 1,
        gold: after.progress.gold + 25,
      })
      const substitutionLine = session?.routineId
        ? summarizeSubstitutions(session.routineId, sessionId, after)
        : ''
      get().pushMessage({
        title: `[Gate cleared. Rank ${summary.gateRank}.]`,
        body: `${Math.round(summary.tonnageKg)} kg moved across ${summary.hardSets} hard sets. ${Math.round(summary.xp)} experience gained.${substitutionLine ? ` ${substitutionLine}` : ''}`,
        tone: 'good',
        kind: 'window',
      })
    }

    for (const exerciseId of summary.prExerciseIds) {
      const exercise = after.exercises.find((e) => e.id === exerciseId)
      get().pushMessage({
        title: flavourFor(FLAVOUR_TABLE, 'boss_slain', `${sessionId}-${exerciseId}`, '[Boss slain.]'),
        body: `New record on ${exercise?.name ?? exerciseId}.`,
        tone: 'good',
        kind: 'window',
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
        kind: 'window',
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
        kind: 'window',
      })
    }

    // Level-triggered rather than day-keyed (m7b-plan commit 3), so a gate
    // that crosses level 20 must offer it now rather than waiting for the
    // next app load, unlike the day-keyed quests ensureQuestsForToday
    // otherwise only re-checks at boot.
    await get().ensureQuestsForToday()
    await get().refresh()
    // One of the two active triggers (F3, the other is app foreground). Not
    // awaited: a finished gate must show its summary at once, not after a
    // network round trip.
    get().syncNow()
  },

  async abandonGate() {
    const sessionId = get().activeSessionId
    if (!sessionId) return
    set({ activeSubstitutions: {}, activeInstantDungeon: null, activeRedGate: null })
    await repo.abandonSession(sessionId)
    await get().refresh()
  },

  targetFor(exerciseId) {
    return get().targetsByExerciseId[exerciseId] ?? null
  },

  todaysDailyQuest() {
    const state = get()
    const row = activeQuestFor(state.quests, state.today, 'daily')
    return (row?.payload as DailyQuestPayload | undefined) ?? null
  },

  async completeDailyQuest(progressByKind) {
    const state = get()
    const row = activeQuestFor(state.quests, state.today, 'daily')
    if (!row || row.status === 'complete') return

    const payload = row.payload as DailyQuestPayload
    const progress = progressByKind ? mergeDailyQuestProgress(payload.progress, progressByKind) : payload.progress

    if (!isDailyQuestComplete(payload, progress)) {
      // Not there yet — persist what was entered so it survives a reload,
      // without paying anything out early.
      await repo.putQuest({ ...row, payload: { ...payload, progress } })
      await get().refresh()
      return
    }

    await repo.putQuest({ ...row, status: 'complete', payload: { ...payload, progress } })
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
      kind: 'window',
    })
  },

  async rerollDailyQuest() {
    const state = get()
    const current = activeQuestFor(state.quests, state.today, 'daily')
    if (!current || current.status === 'complete') return

    const level = state.projection?.player.level ?? 1
    const quest = generateDailyQuest({ dayKey: state.today, level, allocated: state.allocated })
    await repo.putQuest({
      id: `daily-${state.today}-reroll-${Date.now()}`,
      dayKey: state.today,
      type: 'daily',
      status: 'issued',
      issuedAt: Date.now(),
      expiresAt: null,
      payload: { ...quest, progress: {} },
      supersedes: current.id,
    })
    await get().refresh()
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

  async completeReawakeningTest(input) {
    const before = get().projection?.latestBodyMetric ?? null
    await repo.addBodyMetric(input)
    await get().refresh()

    const lines: string[] = []
    if (before) {
      const weightDelta = input.weightKg - before.weightKg
      lines.push(`Bodyweight ${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`)
      if (before.waistCm !== undefined && input.waistCm !== undefined) {
        const waistDelta = input.waistCm - before.waistCm
        lines.push(`waist ${waistDelta >= 0 ? '+' : ''}${waistDelta.toFixed(1)} cm`)
      }
    }

    get().pushMessage({
      title: '[Reawakening Test complete.]',
      body:
        lines.length > 0
          ? `${lines.join(', ')} since the last measurement. Rank and every other derived figure already reflect it.`
          : 'First measurement recorded. Nothing to compare it against yet.',
      tone: 'system',
      kind: 'window',
    })
  },

  async setShadowActive(id, active) {
    await repo.setShadowActive(id, active)
    await get().refresh()
  },

  activeJobChangeQuest() {
    return get().quests.find((q) => q.type === 'job_change' && q.status === 'issued') ?? null
  },

  async completeJobChangeQuest() {
    const state = get()
    const row = state.activeJobChangeQuest()
    const total = state.projection?.player.total
    if (!row || !total) return
    const result = resolveJobChange(total)
    await repo.putQuest({ ...row, status: 'complete', payload: result })
    await get().refresh()
    const className = result.class.charAt(0).toUpperCase() + result.class.slice(1)
    get().pushMessage({
      title: `[Job Change complete. You are now a ${className}.]`,
      body: 'The stat distribution you trained into has spoken. This is not a cap — it is a description of who you have already become.',
      tone: 'good',
      kind: 'window',
    })
  },

  async purchaseShopItem(id) {
    const state = get()
    const item = shopItemById(id)
    if (!item) return

    // A Quest Reroll must be affordable to *apply*, not just to pay for —
    // charging gold for a reroll that turns out to be a no-op (nothing
    // open today, or today's quest already complete) would be a sink with
    // nothing behind it.
    if (item.id === 'quest_reroll') {
      const current = activeQuestFor(state.quests, state.today, 'daily')
      if (!current || current.status === 'complete') {
        get().pushMessage({
          title: '[Nothing to reroll.]',
          body: 'There is no open Daily Quest today.',
          tone: 'warn',
        })
        return
      }
    }

    const result = purchase(state.progress.gold, item)
    if (!result.ok) {
      get().pushMessage({
        title: '[Not enough gold.]',
        body: `${item.name} costs ${item.priceGold} gold.`,
        tone: 'warn',
      })
      return
    }

    await repo.updateProgress({ gold: result.goldAfter })
    if (item.id === 'rest_token') {
      await repo.updateProgress({ restTokens: get().progress.restTokens + 1 })
      await get().refresh()
    } else {
      await get().rerollDailyQuest()
    }

    get().pushMessage({
      title: `[${item.name} purchased.]`,
      body: item.description,
      tone: 'good',
    })
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

  async announceSystemIntroIfNeeded() {
    if (get().settings.systemIntroSeen) return
    // Set optimistically before the await: StrictMode double-invokes this
    // effect in dev, and without this the second call's read of
    // `settings.systemIntroSeen` would still see `false`.
    set((state) => ({ settings: { ...state.settings, systemIntroSeen: true } }))
    await get().updateSettings({ systemIntroSeen: true })
    get().pushMessage({
      title: '[The System is designed to assist the development of the Player.]',
      body: 'Open a window to review your progress.',
      tone: 'system',
      kind: 'window',
    })
  },

  async markDeload() {
    const today = get().today
    await repo.updateProgress({ lastDeloadDayKey: today })
    await get().refresh()
    get().pushMessage({
      title: '[Deload recorded.]',
      body: flavourFor(FLAVOUR_TABLE, 'deload_recorded', today, 'The System will not ask again for five weeks.'),
      tone: 'system',
    })
  },

  async forgetMirror() {
    const identity = get().identity
    if (!identity) return false
    const ok = await forgetMirrorOnServer(identity)
    if (ok) set({ lastSyncedAt: null, syncStatus: 'idle' })
    return ok
  },

  async pairWithScannedKey(rawPayload) {
    const key = parsePairingPayload(rawPayload)
    if (!key) return { ok: false, message: 'That QR code is not a Hunter License Key.' }

    const identity = await identityFromLicenseKey(key)
    if (!identity) return { ok: false, message: 'That key is not formatted correctly.' }

    await repo.adoptIdentity(identity.secret)
    // The old cursor belongs to whichever hunter this device synced as
    // before. Scoped to a hunter that no longer applies, it would make the
    // first sync under the new identity skip rows this device has never
    // actually seen.
    await repo.saveSyncState({
      lastServerSeq: 0,
      lastSyncedAt: null,
      hunterId: identity.hunterId,
      lastError: null,
    })
    set({ identity, lastSyncedAt: null, syncStatus: 'idle' })
    return {
      ok: true,
      message: 'Paired. Turn sync on to bring this hunter’s mirrored history to this device.',
    }
  },
}))

/** Titles the hunter holds, resolved to their definitions for display. */
export function heldTitles(ids: readonly string[]) {
  return ids.map((id) => titleById(id)).filter((t): t is NonNullable<typeof t> => t !== undefined)
}
