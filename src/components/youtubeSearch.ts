/**
 * Builds a YouTube search URL for an exercise's demo/form videos. Pure
 * presentation, like `muscleMapRegions.ts` — it never leaves this
 * component's world, so it stays out of `src/domain/`.
 *
 * The channel hint is text folded into the search query, not a hard filter:
 * YouTube's public search URL has no parameter that restricts results to an
 * arbitrary channel, so this only nudges relevance toward a creator whose
 * content actually matches the movement, picked from equipment/pattern/
 * muscle rather than the exercise id (new exercises get a hint for free).
 * An exercise that matches none of the heuristics below still searches —
 * just without a channel nudge.
 */
import { LOAD_BEARING } from '../domain/equipment'
import type { Exercise } from '../domain/types'

const CHANNEL = {
  michaelEckert: 'Michael Eckert',
  hybridCalisthenics: 'Hybrid Calisthenics',
  jeffNippard: 'Jeff Nippard',
  yellowDude: 'Yellow Dude',
} as const

function channelHintFor(exercise: Exercise): string | null {
  const usesGrip = exercise.primaryMuscles.includes('grip') || exercise.secondaryMuscles.includes('grip')
  // Pull-ups, hangs, and grip work specifically — a narrower, stronger match
  // than "bodyweight" below, so it's checked first.
  if (usesGrip || exercise.equipment.includes('pullup_bar')) return CHANNEL.michaelEckert

  const isWeighted = exercise.equipment.some((eq) => LOAD_BEARING.includes(eq))
  if (isWeighted) return CHANNEL.jeffNippard

  // Treadmill (cardio) is neither load-bearing nor bodyweight training —
  // falls through to no hint, same as anything else neither list covers.
  const isBodyweight = exercise.equipment.every((eq) => eq === 'bodyweight' || eq === 'pullup_bar' || eq === 'bench' || eq === 'none')
  if (isBodyweight) return exercise.pattern === 'core' ? CHANNEL.yellowDude : CHANNEL.hybridCalisthenics

  // Cardio, or anything else the heuristics above don't recognise — a plain
  // search is honest here rather than guessing a channel.
  return null
}

export function youtubeSearchUrlFor(exercise: Exercise): string {
  const channel = channelHintFor(exercise)
  const query = channel ? `${exercise.name} exercise ${channel}` : `${exercise.name} exercise`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}
