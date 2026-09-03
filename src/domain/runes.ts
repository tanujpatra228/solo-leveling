/**
 * Runes and Skills: intensity techniques that unlock by level.
 *
 * This is real coaching gating wearing a fantasy costume. Drop sets at level
 * 10, rest-pause at 15, clusters at 25 — those three numbers come from the
 * brief and are fixed. The reason for gating them at all is that these
 * techniques add a lot of fatigue for their stimulus, and handing them to
 * someone in their first month is how people end up hurt or burnt out.
 *
 * `suitableFor` exists so the app never offers a technique on a movement where
 * it is dangerous. A drop set on a heavy back squat means racking a bar you are
 * already close to failure under, so squats are absent from that list.
 */
import type { MovementPattern } from './types'

export interface RuneDef {
  id: string
  /** The real technique name. */
  name: string
  /** The System name for it. */
  runeName: string
  unlockLevel: number
  description: string
  howToPerform: string
  suitableFor: readonly MovementPattern[]
}

const ISOLATION_AND_MACHINES: readonly MovementPattern[] = ['isolation', 'core']
const UPPER_PUSH_PULL: readonly MovementPattern[] = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]

export const RUNES: readonly RuneDef[] = [
  {
    id: 'tempo',
    name: 'Tempo and eccentric emphasis',
    runeName: 'Rune of Patience',
    unlockLevel: 3,
    description:
      'Slowing the lowering phase, which increases time under tension without adding load. The safest way to make a weight harder.',
    howToPerform: 'Take three seconds to lower the weight, then lift at normal speed. Same load, same reps.',
    suitableFor: [...ISOLATION_AND_MACHINES, ...UPPER_PUSH_PULL, 'squat', 'hinge', 'lunge'],
  },
  {
    id: 'pause-reps',
    name: 'Pause reps',
    runeName: 'Rune of Stillness',
    unlockLevel: 6,
    description:
      'A dead stop in the hardest position, which removes momentum and exposes the weak point of the movement.',
    howToPerform: 'Hold for a full second at the bottom of each rep with no bouncing.',
    suitableFor: [...ISOLATION_AND_MACHINES, ...UPPER_PUSH_PULL, 'squat', 'lunge'],
  },
  {
    id: 'superset',
    name: 'Supersets',
    runeName: 'Twin Rune',
    unlockLevel: 8,
    description:
      'Two exercises performed back to back. Buys time rather than stimulus, which is why it fits accessory work and not the main lift.',
    howToPerform: 'Alternate the two movements with no rest between them, then rest once at the end.',
    suitableFor: [...ISOLATION_AND_MACHINES, ...UPPER_PUSH_PULL],
  },
  {
    id: 'drop-set',
    name: 'Drop sets',
    runeName: 'Rune of Descent',
    unlockLevel: 10,
    description:
      'Reaching failure, cutting the load, and continuing immediately. High stimulus and high fatigue, so one per session at most.',
    howToPerform:
      'Take the set to technical failure, strip about 25% of the load without resting, and go again to failure.',
    suitableFor: ISOLATION_AND_MACHINES,
  },
  {
    id: 'rest-pause',
    name: 'Rest-pause',
    runeName: 'Rune of the Second Breath',
    unlockLevel: 15,
    description:
      'Short rests inside a single set, which lets you accumulate reps close to failure at a load you could not otherwise sustain.',
    howToPerform:
      'Take the set to near failure, rest fifteen seconds, then perform as many more reps as you can. Repeat twice.',
    suitableFor: [...ISOLATION_AND_MACHINES, 'horizontal_push', 'vertical_pull'],
  },
  {
    id: 'partials',
    name: 'Partial-rep extended sets',
    runeName: 'Rune of the Fragment',
    unlockLevel: 18,
    description:
      'Continuing with a shortened range once full reps are gone, keeping tension on the muscle past the point of full-range failure.',
    howToPerform: 'When you can no longer complete a full rep, continue with half reps until those fail too.',
    suitableFor: ISOLATION_AND_MACHINES,
  },
  {
    id: 'myo-reps',
    name: 'Myo-reps',
    runeName: 'Rune of Echoes',
    unlockLevel: 20,
    description:
      'One activation set followed by several short clusters, which keeps the muscle near maximum recruitment for far more reps than a straight set.',
    howToPerform:
      'One set to near failure, then rest five deep breaths and do three to five reps. Repeat until you cannot hit three.',
    suitableFor: ISOLATION_AND_MACHINES,
  },
  {
    id: 'one-and-a-half',
    name: 'One and a half reps',
    runeName: 'Rune of the Half Step',
    unlockLevel: 22,
    description:
      'A full rep followed by a half rep through the hardest part of the range, before the next full rep.',
    howToPerform: 'Lower fully, come up halfway, lower again, then come all the way up. That is one rep.',
    suitableFor: [...ISOLATION_AND_MACHINES, 'lunge'],
  },
  {
    id: 'clusters',
    name: 'Cluster sets',
    runeName: 'Rune of the Broken Chain',
    unlockLevel: 25,
    description:
      'Heavy singles or doubles with fifteen to thirty seconds between them, which allows near-maximal load for more total reps than a straight set would.',
    howToPerform:
      'Load about 85% of your estimated max. Do two reps, rest twenty seconds, repeat for five clusters.',
    suitableFor: [...UPPER_PUSH_PULL, 'squat', 'hinge'],
  },
  {
    id: 'giant-set',
    name: 'Giant sets',
    runeName: 'Rune of the Swarm',
    unlockLevel: 28,
    description:
      'Four or more exercises for one muscle group performed in sequence. Very time-efficient and very fatiguing.',
    howToPerform: 'Four movements for the same muscle, no rest between them, then rest two minutes.',
    suitableFor: ISOLATION_AND_MACHINES,
  },
  {
    id: 'amrap-finisher',
    name: 'AMRAP finisher',
    runeName: 'Rune of the Last Stand',
    unlockLevel: 30,
    description:
      'A single all-out set at the end of a session. Useful as a Red Gate objective, since it either happens or it does not.',
    howToPerform: 'One set, as many reps as possible, at about 60% of your estimated max. Stop and it is over.',
    suitableFor: [...ISOLATION_AND_MACHINES, ...UPPER_PUSH_PULL, 'squat'],
  },
]

export function unlockedRunes(level: number): RuneDef[] {
  return RUNES.filter((rune) => level >= rune.unlockLevel)
}

/** Runes that unlock exactly at this level, for the level-up announcement. */
export function newlyUnlockedAt(level: number): RuneDef[] {
  return RUNES.filter((rune) => rune.unlockLevel === level)
}

/**
 * Runes available for a given movement. Filters on `suitableFor`, so a
 * technique that is unsafe on a heavy compound is never offered there however
 * high the level.
 */
export function runesFor(level: number, pattern: MovementPattern): RuneDef[] {
  return unlockedRunes(level).filter((rune) => rune.suitableFor.includes(pattern))
}

export function runeById(id: string): RuneDef | undefined {
  return RUNES.find((r) => r.id === id)
}
