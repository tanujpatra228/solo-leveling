/**
 * Titles. Achievements, named in canon style, but every one of them is earned
 * by a real training milestone rather than by opening the app.
 *
 * The catalogue is static and the evaluator is pure, so titles can be re-graded
 * from the log at any time — which matters because the log is the only truth
 * and a title is just a projection of it.
 */

export interface TitleContext {
  /** Longest unbroken set of push-ups ever logged. */
  longestUnbrokenPushups: number
  bodyweightKg: number
  /** Best estimated max per exercise id, in kilograms. */
  bestE1rm: Readonly<Record<string, number>>
  /** Best single set of pull-ups, in reps. */
  bestPullupReps: number
  currentStreak: number
  longestStreak: number
  totalSessions: number
  totalTonnageKg: number
  level: number
  distinctShadows: number
  gatesCleared: number
  redGatesCleared: number
  dailyQuestsCompleted: number
  towerFloor: number
  /** Muscles currently at or above their minimum effective volume. */
  musclesAtMev: number
}

export interface TitleDef {
  id: string
  name: string
  /** The real requirement, stated plainly so it is never mysterious. */
  description: string
  check: (ctx: TitleContext) => boolean
}

/** Ratio of estimated max to bodyweight for a given exercise. */
function ratio(ctx: TitleContext, exerciseId: string): number {
  if (ctx.bodyweightKg <= 0) return 0
  return (ctx.bestE1rm[exerciseId] ?? 0) / ctx.bodyweightKg
}

export const TITLES: readonly TitleDef[] = [
  {
    id: 'wolf-assassin',
    name: 'Wolf Assassin',
    description: 'One hundred push-ups in a single unbroken set.',
    check: (ctx) => ctx.longestUnbrokenPushups >= 100,
  },
  {
    id: 'monarch-of-iron',
    name: 'Monarch of Iron',
    description: 'Squat twice your bodyweight.',
    check: (ctx) => ratio(ctx, 'barbell-squat') >= 2,
  },
  {
    id: 'unbroken',
    name: 'Unbroken',
    description: 'A thirty-day streak.',
    check: (ctx) => ctx.longestStreak >= 30,
  },
  {
    id: 'awakened',
    name: 'Awakened',
    description: 'Complete the Awakening Test and log a first session.',
    check: (ctx) => ctx.totalSessions >= 1,
  },
  {
    id: 'first-of-many',
    name: 'First of Many',
    description: 'Clear ten gates.',
    check: (ctx) => ctx.gatesCleared >= 10,
  },
  {
    id: 'iron-lung',
    name: 'Iron Lung',
    description: 'Complete one hundred Daily Quests.',
    check: (ctx) => ctx.dailyQuestsCompleted >= 100,
  },
  {
    id: 'igris-equal',
    name: "Igris's Equal",
    description: 'Bench press one and a half times your bodyweight.',
    check: (ctx) => ratio(ctx, 'incline-barbell-press') >= 1.5 || ratio(ctx, 'bench-press') >= 1.5,
  },
  {
    id: 'shadow-sovereign',
    name: 'Shadow Sovereign',
    description: 'Extract ten distinct shadows.',
    check: (ctx) => ctx.distinctShadows >= 10,
  },
  {
    id: 'risen',
    name: 'Risen',
    description: 'Reach level ten.',
    check: (ctx) => ctx.level >= 10,
  },
  {
    id: 'national-level',
    name: 'National Level Hunter',
    description: 'Reach level twenty-five.',
    check: (ctx) => ctx.level >= 25,
  },
  {
    id: 'sovereign-of-plagues',
    name: 'Sovereign of Plagues',
    description: 'Reach level fifty.',
    check: (ctx) => ctx.level >= 50,
  },
  {
    id: 'first-flight',
    name: 'First Flight',
    description: 'A single unassisted pull-up.',
    check: (ctx) => ctx.bestPullupReps >= 1,
  },
  {
    id: 'kaisel',
    name: 'Kaisel',
    description: 'Ten pull-ups in a single set.',
    check: (ctx) => ctx.bestPullupReps >= 10,
  },
  {
    id: 'thousand-hands',
    name: 'Thousand Hands',
    description: 'One hundred sessions logged.',
    check: (ctx) => ctx.totalSessions >= 100,
  },
  {
    id: 'weight-of-the-world',
    name: 'Weight of the World',
    description: 'One million kilograms of lifetime tonnage.',
    check: (ctx) => ctx.totalTonnageKg >= 1_000_000,
  },
  {
    id: 'red-gate-survivor',
    name: 'Red Gate Survivor',
    description: 'Clear a Red Gate.',
    check: (ctx) => ctx.redGatesCleared >= 1,
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Every muscle group at or above its minimum effective volume in one week.',
    check: (ctx) => ctx.musclesAtMev >= 18,
  },
  {
    id: 'tower-tenth',
    name: 'Tenth Floor',
    description: 'Clear the tenth floor of the Demon Castle.',
    check: (ctx) => ctx.towerFloor >= 10,
  },
  {
    id: 'tower-fiftieth',
    name: 'Fiftieth Floor',
    description: 'Clear the fiftieth floor of the Demon Castle.',
    check: (ctx) => ctx.towerFloor >= 50,
  },
  {
    id: 'shadow-monarch',
    name: 'Shadow Monarch',
    description: 'Clear the hundredth floor of the Demon Castle.',
    check: (ctx) => ctx.towerFloor >= 100,
  },
  {
    id: 'deadlift-triple',
    name: 'Chain Breaker',
    description: 'Deadlift two and a half times your bodyweight.',
    check: (ctx) => ratio(ctx, 'deadlift') >= 2.5,
  },
  {
    id: 'ninety-day',
    name: 'Ninety Days Without Rest',
    description: 'A ninety-day streak.',
    check: (ctx) => ctx.longestStreak >= 90,
  },
]

/**
 * Newly earned titles only. Re-awarding is impossible by construction rather
 * than by a flag, so replaying the whole log is safe.
 */
export function evaluateTitles(ctx: TitleContext, alreadyEarned: readonly string[]): TitleDef[] {
  const earned = new Set(alreadyEarned)
  return TITLES.filter((title) => !earned.has(title.id) && title.check(ctx))
}

export function titleById(id: string): TitleDef | undefined {
  return TITLES.find((t) => t.id === id)
}
