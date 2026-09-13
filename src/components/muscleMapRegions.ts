/**
 * Which rectangle(s) of the shared body silhouette light up for each
 * `Muscle`. Presentation data, not domain logic — it never leaves this
 * component's world, so it lives beside `MuscleMap.tsx` rather than in
 * `src/domain/`.
 *
 * The body is drawn as flat, blocky regions rather than traced anatomy —
 * consistent with docs/system-visuals-plan.md's "thick strokes, solid
 * fills" correction, and far more robust to get right without a visual
 * design tool than hand-authored curves would be.
 *
 * Three muscles have no honest surface region on a flat silhouette —
 * `rotator_cuff` is a deep stabiliser, `grip` is really the hand/forearm
 * grip itself, `cardio` is not a muscle at all — so they render as a
 * labelled badge instead of a fake highlight. `MuscleMap.test.tsx` asserts
 * every `Muscle` value is covered by one path or the other.
 */
import type { Muscle } from '../domain/types'

/** Shared by both the front and back `<svg viewBox>` — same body, different side. */
export const BODY_VIEWBOX = '0 0 120 260'

export interface RegionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SilhouetteMapping {
  kind: 'silhouette'
  front?: readonly RegionRect[]
  back?: readonly RegionRect[]
}

export interface BadgeMapping {
  kind: 'badge'
  label: string
}

export type MuscleMapping = SilhouetteMapping | BadgeMapping

// Shoulder-cap rectangles are shared across all three delt heads: a flat
// silhouette has no room to draw anterior/lateral/posterior as separate
// sub-regions without them overlapping into noise, so front_delts lights
// only the front cap, rear_delts only the back cap, and side_delts —
// genuinely visible from both angles — lights both.
const LEFT_SHOULDER = { x: 15, y: 33, width: 18, height: 14 }
const RIGHT_SHOULDER = { x: 87, y: 33, width: 18, height: 14 }
const LEFT_UPPER_ARM = { x: 15, y: 47, width: 18, height: 35 }
const RIGHT_UPPER_ARM = { x: 87, y: 47, width: 18, height: 35 }
const LEFT_FOREARM = { x: 15, y: 82, width: 18, height: 50 }
const RIGHT_FOREARM = { x: 87, y: 82, width: 18, height: 50 }
const LEFT_LEG_UPPER = { x: 38, y: 160, width: 20, height: 60 }
const RIGHT_LEG_UPPER = { x: 62, y: 160, width: 20, height: 60 }

export const MUSCLE_MAPPINGS: Readonly<Record<Muscle, MuscleMapping>> = {
  chest: { kind: 'silhouette', front: [{ x: 40, y: 36, width: 40, height: 22 }] },
  front_delts: { kind: 'silhouette', front: [LEFT_SHOULDER, RIGHT_SHOULDER] },
  side_delts: { kind: 'silhouette', front: [LEFT_SHOULDER, RIGHT_SHOULDER], back: [LEFT_SHOULDER, RIGHT_SHOULDER] },
  rear_delts: { kind: 'silhouette', back: [LEFT_SHOULDER, RIGHT_SHOULDER] },
  biceps: { kind: 'silhouette', front: [LEFT_UPPER_ARM, RIGHT_UPPER_ARM] },
  triceps: { kind: 'silhouette', back: [LEFT_UPPER_ARM, RIGHT_UPPER_ARM] },
  forearms: { kind: 'silhouette', front: [LEFT_FOREARM, RIGHT_FOREARM], back: [LEFT_FOREARM, RIGHT_FOREARM] },
  abs: { kind: 'silhouette', front: [{ x: 44, y: 60, width: 32, height: 45 }] },
  obliques: {
    kind: 'silhouette',
    front: [
      { x: 40, y: 60, width: 8, height: 45 },
      { x: 72, y: 60, width: 8, height: 45 },
    ],
  },
  traps: { kind: 'silhouette', back: [{ x: 48, y: 32, width: 24, height: 20 }] },
  upper_back: { kind: 'silhouette', back: [{ x: 42, y: 52, width: 36, height: 35 }] },
  lats: {
    kind: 'silhouette',
    back: [
      { x: 35, y: 52, width: 9, height: 45 },
      { x: 76, y: 52, width: 9, height: 45 },
    ],
  },
  lower_back: { kind: 'silhouette', back: [{ x: 44, y: 110, width: 32, height: 20 }] },
  glutes: { kind: 'silhouette', back: [{ x: 40, y: 130, width: 40, height: 28 }] },
  quads: { kind: 'silhouette', front: [LEFT_LEG_UPPER, RIGHT_LEG_UPPER] },
  hamstrings: {
    kind: 'silhouette',
    back: [
      { x: 38, y: 160, width: 20, height: 55 },
      { x: 62, y: 160, width: 20, height: 55 },
    ],
  },
  calves: {
    kind: 'silhouette',
    back: [
      { x: 38, y: 218, width: 20, height: 37 },
      { x: 62, y: 218, width: 20, height: 37 },
    ],
  },
  rotator_cuff: { kind: 'badge', label: 'Rotator cuff (deep stabiliser)' },
  grip: { kind: 'badge', label: 'Grip' },
  cardio: { kind: 'badge', label: 'Cardiovascular' },
}
