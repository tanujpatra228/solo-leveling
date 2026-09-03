/**
 * Heart-rate zones for the treadmill work.
 *
 * Uses Tanaka rather than the familiar `220 - age`. Tanaka is
 * `208 - 0.7 * age`, derived from a meta-analysis of over 18,000 subjects,
 * and it does not systematically under-predict maximum heart rate for older
 * people the way the folk formula does. The difference is not academic: at 50
 * years old the folk formula is about 7 beats low, which drags every zone
 * boundary down with it.
 */

export interface Zone {
  zone: 1 | 2 | 3 | 4 | 5
  name: string
  /** Fraction of maximum heart rate at the bottom and top of the zone. */
  range: [number, number]
  lowBpm: number
  highBpm: number
  purpose: string
}

export function tanakaMaxHr(age: number): number {
  return 208 - 0.7 * age
}

const ZONE_DEFS: { zone: 1 | 2 | 3 | 4 | 5; name: string; range: [number, number]; purpose: string }[] = [
  { zone: 1, name: 'Recovery', range: [0.5, 0.6], purpose: 'Warm-up, cool-down, and active recovery.' },
  { zone: 2, name: 'Aerobic base', range: [0.6, 0.7], purpose: 'The walking half of the intervals. Builds the aerobic base without adding meaningful fatigue to lifting.' },
  { zone: 3, name: 'Tempo', range: [0.7, 0.8], purpose: 'Sustainable hard work. Where a steady run sits.' },
  { zone: 4, name: 'Threshold', range: [0.8, 0.9], purpose: 'The running half of the intervals. Improves the pace you can hold.' },
  { zone: 5, name: 'Maximal', range: [0.9, 1], purpose: 'Short bursts only. Interferes with lifting recovery if overused.' },
]

export function heartRateZones(age: number): Zone[] {
  const max = tanakaMaxHr(age)
  return ZONE_DEFS.map((def) => ({
    ...def,
    lowBpm: Math.round(max * def.range[0]),
    highBpm: Math.round(max * def.range[1]),
  }))
}

/** Which zone a measured heart rate falls in, or null if below zone 1. */
export function zoneForHeartRate(bpm: number, age: number): Zone | null {
  const zones = heartRateZones(age)
  for (const zone of zones) {
    if (bpm >= zone.lowBpm && bpm <= zone.highBpm) return zone
  }
  const top = zones[zones.length - 1]!
  if (bpm > top.highBpm) return top
  return null
}

/**
 * The treadmill session in the actual training week alternates five minutes of
 * walking with five of running, which maps onto zone 2 and zone 4. Returned so
 * the session screen can show a target rather than a bare instruction.
 */
export function intervalTargets(age: number): { walk: Zone; run: Zone } {
  const zones = heartRateZones(age)
  return { walk: zones[1]!, run: zones[3]! }
}
