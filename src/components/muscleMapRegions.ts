/**
 * Which SVG element id(s) inside `anterior-outer-muscles.svg` /
 * `posterior-outer-muscles.svg` light up for each `Muscle`. Presentation
 * data, not domain logic — it never leaves this component's world, so it
 * lives beside `MuscleMap.tsx` rather than in `src/domain/`.
 *
 * The SVGs are a two-view anatomical illustration with ~90 individually
 * id'd regions (`BodyMap.tsx` recolors any of them via scoped CSS). Most of
 * this app's 20 `Muscle` values map straight onto one region's *wrapping*
 * group id, since the CSS rule targets `#id path` (every descendant), not
 * just direct children. A few map onto several sibling ids at once —
 * `hamstrings` has no single wrapping group across its three heads in this
 * atlas, so all three are listed; `abs` lists its ten ids individually
 * rather than the `rectus-abdominis` wrapper (see the comment at `abs`
 * below for why).
 *
 * Two approximations, both because the illustration doesn't distinguish
 * further:
 * - `front_delts` and `side_delts` share the front view's one `deltoid`
 *   region — this atlas doesn't split the anterior deltoid by head.
 * - `upper_back` reuses `trapezius` — there is no separate rhomboid/mid-back
 *   region in an "outer muscles" illustration; the rhomboids sit underneath
 *   the trapezius and are not a surface shape.
 *
 * Only `cardio` still renders as a labelled badge rather than a region — it
 * isn't a muscle. Every other 19 values now have a real, named region,
 * including `rotator_cuff` (`rotator-cuff-infraspinatus-teres-region`) and
 * `grip` (the hand regions), neither of which had one in this app's first,
 * hand-drawn-rectangle version of this component.
 */
import type { Muscle } from '../domain/types'
import type { BodyMapView } from './anatomy/BodyMap'

export interface SilhouetteMapping {
  kind: 'silhouette'
  front?: readonly string[]
  back?: readonly string[]
}

export interface BadgeMapping {
  kind: 'badge'
  label: string
}

export type MuscleMapping = SilhouetteMapping | BadgeMapping

export const MUSCLE_MAPPINGS: Readonly<Record<Muscle, MuscleMapping>> = {
  chest: { kind: 'silhouette', front: ['pectoralis-major'] },
  front_delts: { kind: 'silhouette', front: ['deltoid'] },
  side_delts: { kind: 'silhouette', front: ['deltoid'] },
  rear_delts: { kind: 'silhouette', back: ['posterior-deltoid'] },
  rotator_cuff: { kind: 'silhouette', back: ['rotator-cuff-infraspinatus-teres-region'] },
  biceps: { kind: 'silhouette', front: ['biceps-brachii'] },
  triceps: { kind: 'silhouette', front: ['triceps-brachii-lateral-head'], back: ['triceps-brachii'] },
  forearms: {
    kind: 'silhouette',
    front: ['forearm-distal-muscles', 'forearm-superficial-flexors', 'brachioradialis', 'flexor-carpi-radialis', 'pronator-teres'],
    back: ['forearm-distal-extensors', 'extensor-digitorum', 'extensor-carpi-ulnaris', 'anconeus', 'brachioradialis-posterior'],
  },
  // Explicit sub-groups, not the `rectus-abdominis` wrapper: the source SVG
  // nests `external-oblique-upper-segment` and
  // `external-oblique-middle-segment` inside that wrapper as siblings of the
  // real abs segments, so `#rectus-abdominis path` was lighting up obliques
  // on every abs exercise regardless of that exercise's actual secondary
  // muscles. Those two ids are listed under `obliques` below instead.
  //
  // The six `rectus-abdominis-*-segment` ids are only the six-pack's visible
  // bulges, drawn as two columns hugging the flanks — the linea-alba strip
  // down the middle is its own four ids (`thoracic-`, `upper-abdominal-`,
  // `middle-abdominal-`, `lower-abdominal-aponeurosis`), previously
  // unreferenced. Without them the highlight read as two side stripes with a
  // hollow belly, not "abs".
  abs: {
    kind: 'silhouette',
    front: [
      'rectus-abdominis-top-segment',
      'rectus-abdominis-upper-segment',
      'rectus-abdominis-upper-middle-segment',
      'thoracic-aponeurosis',
      'upper-abdominal-aponeurosis',
      'rectus-abdominis-middle-segment',
      'rectus-abdominis-lower-middle-segment',
      'rectus-abdominis-lower-segment',
      'middle-abdominal-aponeurosis',
      'lower-abdominal-aponeurosis',
    ],
  },
  obliques: {
    kind: 'silhouette',
    front: ['external-oblique', 'external-oblique-upper-segment', 'external-oblique-middle-segment'],
  },
  traps: { kind: 'silhouette', front: ['upper-trapezius-and-clavicular-region'], back: ['trapezius'] },
  upper_back: { kind: 'silhouette', back: ['trapezius'] },
  lats: { kind: 'silhouette', back: ['latissimus-dorsi'] },
  lower_back: { kind: 'silhouette', back: ['thoracolumbar-fascia'] },
  glutes: { kind: 'silhouette', back: ['gluteus-maximus', 'gluteus-medius', 'gluteus-medius-upper'] },
  quads: { kind: 'silhouette', front: ['vastus-lateralis', 'rectus-femoris', 'vastus-medialis'] },
  hamstrings: {
    kind: 'silhouette',
    back: ['semitendinosus', 'biceps-femoris-left', 'biceps-femoris-right', 'semimembranosus-left', 'semimembranosus-right'],
  },
  calves: { kind: 'silhouette', back: ['gastrocnemius'] },
  grip: { kind: 'silhouette', front: ['hand-muscles'], back: ['hand-muscles-posterior'] },
  cardio: { kind: 'badge', label: 'Cardiovascular' },
}

/** This app's tracked regions for one muscle, on one view — used to build a `MuscleFillMap`. */
export function idsFor(muscle: Muscle, view: BodyMapView): readonly string[] {
  const mapping = MUSCLE_MAPPINGS[muscle]
  if (mapping.kind !== 'silhouette') return []
  return mapping[view] ?? []
}

/**
 * Which half of the abdominal wall an exercise actually emphasises, keyed by
 * exercise id rather than `Muscle` — the domain model tracks `abs` as one
 * muscle (rectus abdominis is anatomically one sheet), so this split is
 * presentation-only and never feeds volume, gates, or substitution.
 *
 * The two id lists below bisect `abs`'s ten ids top-to-bottom (each
 * six-pack segment paired with the linea-alba strip beside it). An exercise
 * with no entry here renders `abs` uniformly, as before.
 */
export type AbsEmphasis = 'lower' | 'upper'

export const ABS_EMPHASIS_BY_EXERCISE: Readonly<Record<string, AbsEmphasis>> = {
  // Hip-flexion-driven: the pelvis curls up toward the ribs, loading the
  // lower rectus abdominis hardest.
  'leg-raises': 'lower',
  'hanging-leg-raises': 'lower',
  // Spinal-flexion-driven: the ribs curl down toward the pelvis, loading the
  // upper/mid rectus abdominis hardest.
  'cable-crunch': 'upper',
  'machine-abs-crunch': 'upper',
}

const ABS_UPPER_IDS: readonly string[] = [
  'rectus-abdominis-top-segment',
  'rectus-abdominis-upper-segment',
  'rectus-abdominis-upper-middle-segment',
  'thoracic-aponeurosis',
  'upper-abdominal-aponeurosis',
]
const ABS_LOWER_IDS: readonly string[] = [
  'rectus-abdominis-middle-segment',
  'rectus-abdominis-lower-middle-segment',
  'rectus-abdominis-lower-segment',
  'middle-abdominal-aponeurosis',
  'lower-abdominal-aponeurosis',
]

/** The emphasised half's ids and the other half's, for one `AbsEmphasis`. */
export function absSegmentSplit(emphasis: AbsEmphasis): { emphasised: readonly string[]; rest: readonly string[] } {
  return emphasis === 'lower' ? { emphasised: ABS_LOWER_IDS, rest: ABS_UPPER_IDS } : { emphasised: ABS_UPPER_IDS, rest: ABS_LOWER_IDS }
}
