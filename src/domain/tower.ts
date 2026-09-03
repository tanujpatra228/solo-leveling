/**
 * The Demon Castle: a hundred floors, each one a benchmark to clear. This is
 * long-term content, meant to still have something left in it after a year.
 *
 * Every floor is generated deterministically from the floor number, so floor 47
 * is always the same benchmark on every device and after every reinstall. No
 * randomness and no stored table to drift out of sync.
 *
 * Difficulty rises monotonically. Floor 1 is clearable in the first week and
 * floor 100 sits at roughly a two-and-a-half times bodyweight squat, which is
 * elite territory on the published standards.
 */

export type FloorRequirement =
  | { kind: 'e1rm_bodyweight_ratio'; exerciseId: string; exerciseName: string; ratio: number }
  | { kind: 'reps'; exerciseId: string; exerciseName: string; reps: number }
  | { kind: 'streak'; days: number }
  | { kind: 'weekly_sessions'; sessions: number; weeks: number }
  | { kind: 'total_tonnage'; kg: number }
  | { kind: 'level'; level: number }

export interface TowerFloor {
  floor: number
  name: string
  requirement: FloorRequirement
  rewardGold: number
  rewardXp: number
  isBoss: boolean
}

export interface TowerContext {
  bodyweightKg: number
  bestE1rm: Readonly<Record<string, number>>
  bestReps: Readonly<Record<string, number>>
  longestStreak: number
  /** Highest number of sessions completed in a week, and over how many weeks it held. */
  bestWeeklySessions: number
  consecutiveFullWeeks: number
  totalTonnageKg: number
  level: number
}

/** Boss floors land on every tenth floor and are named from canon. */
const BOSS_NAMES: Record<number, string> = {
  10: 'Cerberus',
  20: 'Kasaka, the Blue Venom-Fanged Serpent',
  30: 'Vulcan, Knight of the Demon Castle',
  40: 'Metus, the Ice Elf',
  50: 'Baruka, Chief of the Ice Elves',
  60: 'Kargalgan, the Orc Shaman',
  70: 'Igris, the Blood-Red Commander',
  80: 'Beru, Ant King',
  90: 'Bellion, Grand Marshal',
  100: 'Baran, Monarch of White Flames',
}

const ORDINARY_NAMES = [
  'Stone Corridor',
  'Whispering Hall',
  'Fractured Stair',
  'Frozen Antechamber',
  'Hall of Broken Blades',
  'Ashen Gallery',
  'Silent Vault',
  'Crimson Landing',
  'Obsidian Passage',
]

/**
 * The requirement for a floor, chosen by its position in a repeating nine-step
 * cycle so the tower alternates between strength, endurance, consistency, and
 * accumulation rather than asking for the same thing a hundred times.
 */
function requirementFor(floor: number): FloorRequirement {
  // Progress runs 0 at floor 1 to 1 at floor 100.
  const t = (floor - 1) / 99
  const boss = floor % 10 === 0
  // Boss floors jump ahead, as though they sat a few floors higher.
  const effective = boss ? Math.min(1, t + 0.06) : t

  switch (floor % 9) {
    case 1:
      return {
        kind: 'e1rm_bodyweight_ratio',
        exerciseId: 'barbell-squat',
        exerciseName: 'Barbell Squat',
        // 0.75x bodyweight at the bottom to 2.5x at the top.
        ratio: round2(0.75 + effective * 1.75),
      }
    case 2:
      return {
        kind: 'reps',
        exerciseId: 'diamond-pushups',
        exerciseName: 'Diamond Pushups',
        reps: Math.round(5 + effective * 55),
      }
    case 3:
      return { kind: 'streak', days: Math.round(3 + effective * 175) }
    case 4:
      return {
        kind: 'e1rm_bodyweight_ratio',
        exerciseId: 'incline-barbell-press',
        exerciseName: 'Incline Barbell Press',
        ratio: round2(0.4 + effective * 1.2),
      }
    case 5:
      return {
        kind: 'weekly_sessions',
        sessions: Math.min(6, Math.round(3 + effective * 3)),
        weeks: Math.round(1 + effective * 11),
      }
    case 6:
      return {
        kind: 'reps',
        exerciseId: 'pull-ups',
        exerciseName: 'Pull-ups',
        reps: Math.round(1 + effective * 24),
      }
    case 7:
      return { kind: 'total_tonnage', kg: Math.round((5_000 + effective * 1_495_000) / 1000) * 1000 }
    case 8:
      return { kind: 'level', level: Math.max(2, Math.round(2 + effective * 88)) }
    default:
      return {
        kind: 'e1rm_bodyweight_ratio',
        exerciseId: 'leg-press',
        exerciseName: 'Leg Press',
        ratio: round2(1 + effective * 3.5),
      }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function buildFloor(floor: number): TowerFloor {
  const isBoss = floor % 10 === 0
  const name = isBoss
    ? BOSS_NAMES[floor] ?? `Guardian of Floor ${floor}`
    : `${ORDINARY_NAMES[floor % ORDINARY_NAMES.length]!} — Floor ${floor}`

  // Rewards grow faster than linearly so the deep floors are worth the climb,
  // and boss floors pay triple.
  const base = Math.round(50 + floor ** 1.6)
  return {
    floor,
    name,
    requirement: requirementFor(floor),
    rewardGold: isBoss ? base * 3 : base,
    rewardXp: isBoss ? base * 6 : base * 2,
    isBoss,
  }
}

export const TOWER_FLOORS: readonly TowerFloor[] = Array.from({ length: 100 }, (_, i) =>
  buildFloor(i + 1),
)

export function floorAt(n: number): TowerFloor | undefined {
  return TOWER_FLOORS[n - 1]
}

export function isFloorCleared(floor: TowerFloor, ctx: TowerContext): boolean {
  const req = floor.requirement
  switch (req.kind) {
    case 'e1rm_bodyweight_ratio': {
      if (ctx.bodyweightKg <= 0) return false
      const best = ctx.bestE1rm[req.exerciseId] ?? 0
      return best / ctx.bodyweightKg >= req.ratio
    }
    case 'reps':
      return (ctx.bestReps[req.exerciseId] ?? 0) >= req.reps
    case 'streak':
      return ctx.longestStreak >= req.days
    case 'weekly_sessions':
      return ctx.bestWeeklySessions >= req.sessions && ctx.consecutiveFullWeeks >= req.weeks
    case 'total_tonnage':
      return ctx.totalTonnageKg >= req.kg
    case 'level':
      return ctx.level >= req.level
  }
}

/** The highest floor cleared, which is what the tower screen shows. */
export function highestClearedFloor(ctx: TowerContext): number {
  let highest = 0
  for (const floor of TOWER_FLOORS) {
    if (isFloorCleared(floor, ctx)) highest = floor.floor
  }
  return highest
}

/** The next floor to attempt, which is not necessarily the one after the highest cleared. */
export function nextUnclearedFloor(ctx: TowerContext): TowerFloor | null {
  for (const floor of TOWER_FLOORS) {
    if (!isFloorCleared(floor, ctx)) return floor
  }
  return null
}

/** Plain-language statement of what a floor asks for. */
export function describeRequirement(req: FloorRequirement, bodyweightKg: number): string {
  switch (req.kind) {
    case 'e1rm_bodyweight_ratio':
      return `${req.exerciseName} at ${req.ratio}x bodyweight (${Math.round(req.ratio * bodyweightKg)} kg)`
    case 'reps':
      return `${req.reps} reps of ${req.exerciseName} in one set`
    case 'streak':
      return `A ${req.days}-day streak`
    case 'weekly_sessions':
      return `${req.sessions} sessions a week for ${req.weeks} consecutive weeks`
    case 'total_tonnage':
      return `${(req.kg / 1000).toLocaleString()} tonnes of lifetime tonnage`
    case 'level':
      return `Reach level ${req.level}`
  }
}
