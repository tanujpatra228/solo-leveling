/**
 * The projection: everything the hunter sees, derived from the log on every
 * call and never stored. Standards rules 1 and 4. Two consequences worth
 * knowing — a change to the XP constants is a recalculation, not a migration,
 * and `PlayerState` is therefore never synced between devices.
 */
import { bestE1rm, countHardSets, epley, isHardSet, tonnage, workIntervalMinutes } from './e1rm'
import { computeFatigue, tonnagePerDay, type FatigueState } from './fatigue'
import { checkDeload, type DeloadVerdict } from './deload'
import { gateDifficulty, resolveBosses, resolveRepRecords } from './gates'
import { computeOverallRank, rankBarbellLift, rankPullupByReps, standardsTableFor, type LiftRank, type OverallRank } from './rank'
import { activeShadowCap, deriveStats, questBiasFromAllocation, unspentPoints, type DerivedStatsInput, type QuestBias } from './stats'
import { addStats, ZERO_STATS } from './stats'
import { GATE_CLEAR_BONUS, XP_DAILY_QUEST, computeSessionXp, levelFromTotalXp } from './xp'
import { isJobChangeDue, type JobChangeResult } from './quests'
import { resolveRoster, selectMarshals, type RosterState } from './shadows'
import { evaluateTitles, type TitleDef } from './titles'
import { unlockedRunes, type RuneDef } from './runes'
import { highestClearedFloor, nextUnclearedFloor, type TowerFloor } from './tower'
import { weeklyVolumeReport, type MuscleVolume } from './volume'
import { ageFromBirthYear, dayKeyRange, dayOfWeekForKey, rollingWindow, weekStartKey } from './time'
import type {
  BodyMetric,
  DayKey,
  Rank,
  Exercise,
  PlayerState,
  Profile,
  QuestLog,
  Routine,
  SessionLog,
  SetLog,
  Shadow,
  StatBlock,
} from './types'

export interface ProjectionInput {
  today: DayKey
  /** Epoch milliseconds, for anything that needs an instant rather than a day. */
  now: number
  profile: Profile | null
  exercises: readonly Exercise[]
  routines: readonly Routine[]
  /** All sessions, any order. */
  sessions: readonly SessionLog[]
  /** All sets, any order. */
  sets: readonly SetLog[]
  bodyMetrics: readonly BodyMetric[]
  quests: readonly QuestLog[]
  shadows: readonly Shadow[]
  allocated: StatBlock
  earnedTitleIds: readonly string[]
  gatesCleared: number
  redGatesCleared: number
  towerFloorCleared: number
  gold: number
  restTokens: number
  lastDeloadDayKey: string | null
  trainingStartDayKey: string | null
  longestStreak: number
  currentStreak: number
}

export interface SessionSummary {
  session: SessionLog
  tonnageKg: number
  hardSets: number
  /** Exercises that set a new record in this session. */
  prExerciseIds: string[]
  xp: number
  /** Null when nothing but warmups were logged — not when the session had no
   *  routine. An Instant Dungeon Key or a Red Gate still earns a real rank. */
  gateRank: Rank | null
}

export interface Projection {
  player: PlayerState
  fatigue: FatigueState
  rank: OverallRank
  volume: MuscleVolume[]
  deload: DeloadVerdict
  roster: RosterState
  newTitles: TitleDef[]
  unlockedRunes: RuneDef[]
  nextTowerFloor: TowerFloor | null
  towerFloorCleared: number
  questBias: QuestBias
  /** All-time best estimated max per exercise id. */
  bestE1rmByExercise: Map<string, number>
  /** Best single-set reps per exercise id, for bodyweight ladders and titles. */
  bestRepsByExercise: Map<string, number>
  totalTonnageKg: number
  totalSessions: number
  sessionSummaries: SessionSummary[]
  latestBodyMetric: BodyMetric | null
  /** Cap on active shadows, from INT as mana capacity. */
  shadowCap: number
  /**
   * The strongest lifts, which are the ones eligible for a named marshal
   * shadow. Exposed so the extraction flow does not have to recompute it.
   */
  marshals: { exerciseId: string; score: number; rank: Rank }[]
  age: number | null
  /** Whether the Job Change Quest is available to offer right now (m7b-plan commit 1/2). */
  jobChangeDue: boolean
}

/** Groups sets by their session, once, so nothing else has to scan them. */
function groupSetsBySession(sets: readonly SetLog[]): Map<string, SetLog[]> {
  const bySession = new Map<string, SetLog[]>()
  for (const set of sets) {
    const list = bySession.get(set.sessionId)
    if (list) list.push(set)
    else bySession.set(set.sessionId, [set])
  }
  for (const list of bySession.values()) list.sort((a, b) => a.order - b.order)
  return bySession
}

/**
 * Corrections are new rows that supersede old ones, so a superseded set must
 * not also be counted. Resolving that here means every downstream calculation
 * sees the corrected history and nothing else has to know the rule.
 */
export function dropSuperseded(sets: readonly SetLog[]): SetLog[] {
  const superseded = new Set<string>()
  for (const set of sets) {
    if (set.supersedes) superseded.add(set.supersedes)
  }
  return sets.filter((set) => !superseded.has(set.id))
}

export function projectPlayer(input: ProjectionInput): Projection {
  const exerciseById = new Map(input.exercises.map((e) => [e.id, e]))
  const resolveExercise = (id: string) => exerciseById.get(id)
  const usesBodyweight = (id: string) => exerciseById.get(id)?.usesBodyweight ?? false
  // The fraction of bodyweight the movement actually moves, 0 when it does not
  // use bodyweight at all — see e1rm.ts `tonnage`. Kept distinct from
  // `usesBodyweight` above, which stays a plain boolean for the rep-count
  // stats below that only need "is this a bodyweight movement", not "how much".
  const bodyweightFactor = (id: string) => {
    const exercise = exerciseById.get(id)
    return exercise?.usesBodyweight ? exercise.bodyweightFactor : 0
  }

  const liveSets = dropSuperseded(input.sets)
  const setsBySession = groupSetsBySession(liveSets)

  // A session only counts toward XP, tonnage, records, gate rank and the
  // derived-stats window below once it has actually finished. An open session
  // is real work in progress — logged sets still show immediately on the gate
  // screen, which reads the raw log directly — but paying it out here before
  // Finish Gate would mean opening a session banks a gate-clear bonus (and,
  // with an empty plan, a phantom rank — see gateDifficulty) before a single
  // set is logged, and a session cut short would be credited as though it had
  // been finished, which is exactly backwards.
  const endedSessions = input.sessions.filter((s) => s.endedAt !== null)
  const sessionsChronological = [...endedSessions].sort((a, b) => a.startedAt - b.startedAt)
  // The anchor fatigue's four-week gate and the deload check both need: the
  // stored value if the hunter already has one, else the first session ever
  // logged, so a fresh install with unsynced history still gets a real date.
  const trainingStartDayKey = input.trainingStartDayKey ?? sessionsChronological[0]?.dayKey ?? null

  /* ---- walk the log forward once, accumulating XP and records ---- */
  const runningBestE1rm = new Map<string, number>()
  const bestRepsByExercise = new Map<string, number>()
  const summaries: SessionSummary[] = []
  let totalTonnageKg = 0
  let totalXp = 0

  // Built up as the walk proceeds, so each session's fatigue multiplier can be
  // read from the history that existed at the time without re-summing the whole
  // log on every iteration.
  const runningTonnageByDay = new Map<DayKey, number>()

  for (const session of sessionsChronological) {
    const sessionSets = setsBySession.get(session.id) ?? []
    const sessionTonnage = tonnage(sessionSets, {
      bodyweightKg: session.bodyweightKg,
      bodyweightFactor,
    })
    totalTonnageKg += sessionTonnage

    // Records are resolved against the running best rather than the final best,
    // so replaying the log credits a record on the day it was actually set.
    const bosses = resolveBosses(sessionSets, (id) => runningBestE1rm.get(id) ?? 0)
    const prExerciseIds: string[] = []
    for (const boss of bosses) {
      if (boss.killed) prExerciseIds.push(boss.exerciseId)
      const previous = runningBestE1rm.get(boss.exerciseId) ?? 0
      if (boss.e1rmKg > previous) runningBestE1rm.set(boss.exerciseId, boss.e1rmKg)
    }

    // The rep-count equivalent, for bodyweight movements resolveBosses can
    // never credit (weight 0 always estimates a 1RM of 0) — read against the
    // running best *before* the loop below updates it, same as the e1RM
    // bosses above (F4).
    const repRecords = resolveRepRecords(sessionSets, usesBodyweight, (id) => bestRepsByExercise.get(id) ?? 0)
    for (const record of repRecords) {
      if (record.killed && !prExerciseIds.includes(record.exerciseId)) prExerciseIds.push(record.exerciseId)
    }

    for (const set of sessionSets) {
      if (set.isWarmup) continue
      const previousReps = bestRepsByExercise.get(set.exerciseId) ?? 0
      if (set.reps > previousReps) bestRepsByExercise.set(set.exerciseId, set.reps)
    }

    // The gate rank is recomputed from what was actually performed, so a session
    // cut short is not paid as though it had been finished. Independent of
    // whether a routine matched `session.routineId` — an Instant Dungeon Key
    // or a Red Gate carries `routineId: null` and still did real work
    // (M7 finding, commit 2). `gateDifficulty` already returns null for an
    // empty plan, which is the only case that means "no session at all".
    const gateRank = gateDifficulty(
      sessionSets
        .filter((s) => !s.isWarmup)
        .map((s) => ({
          exerciseId: s.exerciseId,
          sets: 1,
          reps: s.reps,
          // A bodyweight set's own weight is often 0, and gateDifficulty
          // reading that raw would score a bodyweight block as free work.
          weightKg:
            s.weight +
            (session.bodyweightKg !== undefined ? session.bodyweightKg * bodyweightFactor(s.exerciseId) : 0),
          e1rmKg: runningBestE1rm.get(s.exerciseId) ?? 0,
          workMinutes: (s.seconds ?? 0) / 60,
        })),
    ).rank

    // Includes work-interval sets (a treadmill block counts as one hard set
    // here, for the finish-gate summary's "N hard sets" line). XP must not
    // count them twice, so computeSessionXp below is fed the rep-based count
    // separately and prices the interval through workMinutes instead.
    const hardSets = countHardSets(sessionSets)
    const repHardSets = countHardSets(sessionSets.filter((s) => s.reps > 0))
    const workMinutes = workIntervalMinutes(sessionSets)

    // XP is banked at the fatigue multiplier that applied on the day, so the
    // multiplier is read per session rather than applied once at the end.
    runningTonnageByDay.set(
      session.dayKey,
      (runningTonnageByDay.get(session.dayKey) ?? 0) + sessionTonnage,
    )
    const fatigueThen = computeFatigue(runningTonnageByDay, session.dayKey, trainingStartDayKey)

    const xp = computeSessionXp({
      tonnageKg: sessionTonnage,
      hardSets: repHardSets,
      workMinutes,
      exercisePRs: prExerciseIds.length,
      gateRank,
      fatigueMultiplier: fatigueThen.xpMultiplier,
    }).total

    totalXp += xp
    summaries.push({
      session,
      tonnageKg: sessionTonnage,
      hardSets,
      prExerciseIds,
      xp,
      gateRank,
    })
  }

  /* ---- completed daily quests also pay XP ---- */
  const dailyQuestsCompleted = input.quests.filter(
    (q) => q.type === 'daily' && q.status === 'complete',
  ).length
  totalXp += dailyQuestsCompleted * XP_DAILY_QUEST

  const level = levelFromTotalXp(totalXp)

  /* ---- fatigue as of today ---- */
  const tonnageByDay = tonnagePerDay(
    input.sessions,
    (id) => setsBySession.get(id) ?? [],
    bodyweightFactor,
  )
  const fatigue = computeFatigue(tonnageByDay, input.today, trainingStartDayKey)

  /* ---- the 28-day window that feeds the derived stats ---- */
  const window28 = new Set(rollingWindow(input.today, 28))
  const sessionsIn28 = endedSessions.filter((s) => window28.has(s.dayKey))
  const setsIn28 = sessionsIn28.flatMap((s) => setsBySession.get(s.id) ?? [])
  const workingSetsIn28 = setsIn28.filter((s) => !s.isWarmup)

  const latestBodyMetric =
    [...input.bodyMetrics].sort((a, b) => b.recordedAt - a.recordedAt)[0] ?? null
  const bodyweightKg =
    latestBodyMetric?.weightKg ??
    [...input.sessions].reverse().find((s) => s.bodyweightKg !== undefined)?.bodyweightKg ??
    0

  /* ---- rank, from the published standards ---- */
  const table = input.profile ? standardsTableFor(input.profile) : null
  const perLift: LiftRank[] = []
  // Kept in step with `perLift`, because a lift rank knows which published table
  // it came from but not which exercise in this library produced it.
  const standardLiftExerciseIds: string[] = []
  if (table && bodyweightKg > 0) {
    for (const exercise of input.exercises) {
      if (!exercise.standardLift) continue
      if (exercise.standardLift === 'pullup') {
        const reps = bestRepsByExercise.get(exercise.id) ?? 0
        if (reps > 0) {
          perLift.push(rankPullupByReps(table, bodyweightKg, reps))
          standardLiftExerciseIds.push(exercise.id)
        }
        continue
      }
      const best = runningBestE1rm.get(exercise.id) ?? 0
      if (best > 0) {
        perLift.push(rankBarbellLift(exercise.standardLift, table, bodyweightKg, best))
        standardLiftExerciseIds.push(exercise.id)
      }
    }
  }
  const rank = computeOverallRank(perLift, {
    table,
    trainingYears: input.profile?.trainingYears ?? 0,
  })

  /* ---- derived stats over the window ---- */
  const cardioMinutes28 = workingSetsIn28.reduce(
    (sum, s) => sum + (s.seconds ?? 0) / 60,
    0,
  )
  const bodyweightReps28 = workingSetsIn28.reduce(
    (sum, s) => sum + (usesBodyweight(s.exerciseId) ? s.reps : 0),
    0,
  )
  const rpeValues = new Set(
    workingSetsIn28.filter((s) => s.rpe !== undefined).map((s) => s.rpe!),
  )
  // Sessions the split called for over the window, which is what adherence is
  // measured against.
  const trainingDayNumbers = new Set(input.routines.map((r) => r.dayOfWeek))
  const plannedSessions28 = rollingWindow(input.today, 28).filter((key) =>
    trainingDayNumbers.has(dayOfWeekForKey(key)),
  ).length

  const statsInput: DerivedStatsInput = {
    standardScores: perLift.map((l) => l.score),
    tonnage28Kg: setsIn28.reduce(
      (sum, s) => sum + (s.isWarmup ? 0 : s.weight * s.reps),
      0,
    ),
    currentStreak: input.currentStreak,
    cardioMinutes28,
    bodyweightReps28,
    setsLogged28: workingSetsIn28.length,
    setsWithRpe28: workingSetsIn28.filter((s) => s.rpe !== undefined).length,
    distinctRpeValues28: rpeValues.size,
    sessionsLogged28: sessionsIn28.length,
    sessionsWithBodyweight28: sessionsIn28.filter((s) => s.bodyweightKg !== undefined).length,
    plannedSessions28,
    completedPlannedSessions28: Math.min(sessionsIn28.length, plannedSessions28),
  }

  const derived = deriveStats(statsInput)
  const total = addStats(derived, input.allocated)
  const unspent = unspentPoints(level.statPointsEarned, input.allocated)

  /* ---- weekly volume, for the current training week only ---- */
  const weekStart = weekStartKey(input.today)
  const weekDays = new Set(dayKeyRange(weekStart, input.today))
  const weekSets = input.sessions
    .filter((s) => weekDays.has(s.dayKey))
    .flatMap((s) => setsBySession.get(s.id) ?? [])
  const volume = weeklyVolumeReport(weekSets, resolveExercise)

  /* ---- deload ---- */
  const recentE1rm = summaries
    .slice(-4)
    .map((summary) => bestE1rm(setsBySession.get(summary.session.id) ?? []))
    .filter((value) => value > 0)
  const deload = checkDeload({
    today: input.today,
    lastDeloadDayKey: input.lastDeloadDayKey,
    trainingStartDayKey,
    acwr: fatigue.acwr,
    recentE1rmBySession: recentE1rm,
  })

  /* ---- shadows ---- */
  const roster = resolveRoster(input.shadows, total.INT)

  /* ---- titles ---- */
  const musclesAtMev = volume.filter(
    (row) => row.sets >= row.landmark.mev && row.landmark.mev > 0,
  ).length
  const newTitles = evaluateTitles(
    {
      longestUnbrokenPushups: Math.max(
        bestRepsByExercise.get('pushups') ?? 0,
        bestRepsByExercise.get('incline-pushups') ?? 0,
        bestRepsByExercise.get('diamond-pushups') ?? 0,
      ),
      bodyweightKg,
      bestE1rm: Object.fromEntries(runningBestE1rm),
      bestPullupReps: bestRepsByExercise.get('pull-ups') ?? 0,
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      totalSessions: input.sessions.length,
      totalTonnageKg,
      level: level.level,
      distinctShadows: input.shadows.length,
      gatesCleared: input.gatesCleared,
      redGatesCleared: input.redGatesCleared,
      dailyQuestsCompleted,
      towerFloor: input.towerFloorCleared,
      musclesAtMev,
    },
    input.earnedTitleIds,
  )

  /* ---- hunter class, from the completed Job Change Quest (m7b-plan F6) ---- */
  // The row is the fact; `hunterClass` is never stored, so a corrected quest
  // re-grades the class the same way every other derived figure re-grades.
  const completedJobChange = input.quests.find((q) => q.type === 'job_change' && q.status === 'complete')
  const hunterClass = completedJobChange ? (completedJobChange.payload as JobChangeResult).class : 'none'

  /* ---- the tower ---- */
  const towerContext = {
    bodyweightKg,
    bestE1rm: Object.fromEntries(runningBestE1rm),
    bestReps: Object.fromEntries(bestRepsByExercise),
    longestStreak: input.longestStreak,
    bestWeeklySessions: 0,
    consecutiveFullWeeks: 0,
    totalTonnageKg,
    level: level.level,
  }

  const player: PlayerState = {
    level: level.level,
    xp: totalXp,
    xpIntoLevel: level.xpIntoLevel,
    xpToNext: level.xpToNext,
    derived,
    allocated: input.allocated,
    total,
    unspentStatPoints: unspent,
    fatigue: fatigue.gauge,
    fatigueMultiplier: fatigue.xpMultiplier,
    rank: rank.rank,
    hunterClass,
    gold: input.gold,
    streak: input.currentStreak,
    longestStreak: input.longestStreak,
    restTokens: input.restTokens,
  }

  return {
    player,
    fatigue,
    rank,
    volume,
    deload,
    roster,
    newTitles,
    unlockedRunes: unlockedRunes(level.level),
    nextTowerFloor: nextUnclearedFloor(towerContext),
    towerFloorCleared: highestClearedFloor(towerContext),
    questBias: questBiasFromAllocation(input.allocated),
    bestE1rmByExercise: runningBestE1rm,
    bestRepsByExercise,
    totalTonnageKg,
    totalSessions: input.sessions.length,
    sessionSummaries: summaries,
    latestBodyMetric,
    shadowCap: activeShadowCap(total.INT),
    marshals: selectMarshals(new Map(perLift.map((l, i) => [standardLiftExerciseIds[i] ?? l.lift, l.score]))),
    age: input.profile ? ageFromBirthYear(input.profile.birthYear, input.now) : null,
    jobChangeDue: isJobChangeDue(level.level, completedJobChange !== undefined),
  }
}

/** An empty projection, for the first render before anything is logged. */
export function emptyProjectionInput(today: DayKey, now: number): ProjectionInput {
  return {
    today,
    now,
    profile: null,
    exercises: [],
    routines: [],
    sessions: [],
    sets: [],
    bodyMetrics: [],
    quests: [],
    shadows: [],
    allocated: ZERO_STATS,
    earnedTitleIds: [],
    gatesCleared: 0,
    redGatesCleared: 0,
    towerFloorCleared: 0,
    gold: 0,
    restTokens: 2,
    lastDeloadDayKey: null,
    trainingStartDayKey: null,
    longestStreak: 0,
    currentStreak: 0,
  }
}

/**
 * The most recent working sets of one exercise, which is exactly what the
 * progression decision needs. Returns the sets from the latest session that
 * contained the exercise, not the latest sets across sessions.
 */
export function lastSetsForExercise(
  exerciseId: string,
  sessions: readonly SessionLog[],
  sets: readonly SetLog[],
): SetLog[] {
  const live = dropSuperseded(sets)
  const byExercise = live.filter((s) => s.exerciseId === exerciseId && !s.isWarmup)
  if (byExercise.length === 0) return []

  const sessionStart = new Map(sessions.map((s) => [s.id, s.startedAt]))
  let latestSessionId: string | null = null
  let latestStart = -1
  for (const set of byExercise) {
    const start = sessionStart.get(set.sessionId) ?? set.completedAt
    if (start > latestStart) {
      latestStart = start
      latestSessionId = set.sessionId
    }
  }

  return byExercise
    .filter((s) => s.sessionId === latestSessionId)
    .sort((a, b) => a.order - b.order)
}

/** Sets logged for an exercise, used for the exercise history screen. */
export function historyForExercise(
  exerciseId: string,
  sets: readonly SetLog[],
): { e1rmKg: number; set: SetLog }[] {
  return dropSuperseded(sets)
    .filter((s) => s.exerciseId === exerciseId && !s.isWarmup && isHardSet(s))
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((set) => ({ set, e1rmKg: epley(set.weight, set.reps) }))
}

/** Gate clear bonus for a rank, re-exported so the UI can show what a gate pays. */
export { GATE_CLEAR_BONUS }
