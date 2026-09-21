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
  // `pectoralis-major` still wraps six ids, not two: the source SVG drew
  // each side as one undivided shape, so this component split each side into
  // upper/mid/lower via `clip-path` (added directly to the SVG — see the
  // `chest-third-{left,right}-{upper,mid,lower}` clipPaths and the comment at
  // `CHEST_EMPHASIS_BY_EXERCISE` below) rather than leaving every chest
  // exercise lighting up the same whole-pec blob regardless of incline,
  // flat, or decline. The two dividing lines are diagonal, not horizontal,
  // and tilt toward each other (checked against a fibre-direction diagram a
  // hunter provided) — real pec fibres fan out from near the armpit rather
  // than stacking in flat rows, so a straight horizontal split read as
  // anatomically wrong even though it was simpler to compute.
  chest: {
    kind: 'silhouette',
    front: [
      'pectoralis-major-left-upper',
      'pectoralis-major-left-mid',
      'pectoralis-major-left-lower',
      'pectoralis-major-right-upper',
      'pectoralis-major-right-mid',
      'pectoralis-major-right-lower',
    ],
  },
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
  //
  // `mid-abdominal-aponeurosis-overlay-left/right-01` are two more paths this
  // component added ids to (they had none in the source file): a second,
  // undocumented pair of shapes covering the same area as
  // `upper-abdominal-aponeurosis` + `middle-abdominal-aponeurosis` combined,
  // drawn on top of them in the original artwork. Left uncoloured, they sat
  // over the highlighted aponeurosis underneath and hid it — the mid-abs
  // highlight read as a dark hole between the upper and lower thirds.
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
      'mid-abdominal-aponeurosis-overlay-left-01',
      'mid-abdominal-aponeurosis-overlay-right-01',
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
 * Which third of a muscle an exercise actually emphasises, keyed by exercise
 * id rather than `Muscle` — the domain model tracks `abs` and `chest` as one
 * muscle each (rectus abdominis and pectoralis major are anatomically one
 * sheet apiece), so this split is presentation-only and never feeds volume,
 * gates, or substitution. Shared between `abs` and `chest` since both are a
 * single sheet an exercise can bias toward one end of, and the rendering
 * rule is identical either way: the emphasised third gets the exercise's
 * normal tone, the other two thirds get dimmed one tone down rather than
 * disappearing. An exercise with no entry in either map below renders the
 * whole muscle uniformly, as before this feature existed.
 */
export type VerticalThird = 'upper' | 'mid' | 'lower'

/**
 * Rectus abdominis, cut top-to-bottom into thirds (each pair of six-pack
 * segments with the linea-alba strip(s) beside it — see the `abs` mapping
 * above for where those ten ids come from).
 */
export const ABS_EMPHASIS_BY_EXERCISE: Readonly<Record<string, VerticalThird>> = {
  // Hip-flexion-driven: the pelvis curls up toward the ribs, loading the
  // lower rectus abdominis hardest.
  'leg-raises': 'lower',
  'hanging-leg-raises': 'lower',
  // Spinal-flexion-driven from a fixed pelvis: the ribs curl down toward the
  // hips, loading the mid rectus abdominis hardest — not the very top, which
  // sits close enough to the fixed attachment (the sternum/ribs) to do less
  // work than the segments below it.
  'cable-crunch': 'mid',
  'machine-abs-crunch': 'mid',
}

const ABS_THIRDS: Readonly<Record<VerticalThird, readonly string[]>> = {
  upper: ['rectus-abdominis-top-segment', 'rectus-abdominis-upper-segment', 'thoracic-aponeurosis'],
  mid: [
    'rectus-abdominis-upper-middle-segment',
    'rectus-abdominis-middle-segment',
    'upper-abdominal-aponeurosis',
    'middle-abdominal-aponeurosis',
    'mid-abdominal-aponeurosis-overlay-left-01',
    'mid-abdominal-aponeurosis-overlay-right-01',
  ],
  lower: ['rectus-abdominis-lower-middle-segment', 'rectus-abdominis-lower-segment', 'lower-abdominal-aponeurosis'],
}

/**
 * Pectoralis major, cut top-to-bottom into thirds by `clip-path` (the source
 * SVG drew each side as one undivided shape — see the `chest` mapping above)
 * — the incline/flat/decline angle of a press or fly changes which fibres
 * do the most work, same idea as the abs split above.
 */
export const CHEST_EMPHASIS_BY_EXERCISE: Readonly<Record<string, VerticalThird>> = {
  // Low-to-high bar or hand path: the clavicular (upper) fibres do the most work.
  'incline-barbell-press': 'upper',
  'incline-pushups': 'upper',
  'cable-chest-press-high': 'upper',
  // Roughly horizontal bar or hand path: the sternal (mid) fibres do the most work.
  'cable-fly': 'mid',
  'cable-chest-press-mid': 'mid',
  pushups: 'mid',
  'diamond-pushups': 'mid',
  'deficit-pushups': 'mid',
  'archer-pushups': 'mid',
  // High-to-low bar or hand path: the lower/costal fibres do the most work.
  'cable-chest-press-low': 'lower',
}

const CHEST_THIRDS: Readonly<Record<VerticalThird, readonly string[]>> = {
  upper: ['pectoralis-major-left-upper', 'pectoralis-major-right-upper'],
  mid: ['pectoralis-major-left-mid', 'pectoralis-major-right-mid'],
  lower: ['pectoralis-major-left-lower', 'pectoralis-major-right-lower'],
}

const THIRDS_BY_MUSCLE: Partial<Record<Muscle, { ids: Readonly<Record<VerticalThird, readonly string[]>>; byExercise: Readonly<Record<string, VerticalThird>> }>> = {
  abs: { ids: ABS_THIRDS, byExercise: ABS_EMPHASIS_BY_EXERCISE },
  chest: { ids: CHEST_THIRDS, byExercise: CHEST_EMPHASIS_BY_EXERCISE },
}

/**
 * The emphasised third's ids and the other two thirds', for one exercise's
 * take on one muscle — `null` when that muscle has no thirds concept, or
 * this exercise doesn't emphasise a particular third of it.
 */
export function verticalThirdSplitFor(muscle: Muscle, exerciseId: string): { emphasised: readonly string[]; rest: readonly string[] } | null {
  const config = THIRDS_BY_MUSCLE[muscle]
  const emphasis = config?.byExercise[exerciseId]
  if (!config || !emphasis) return null
  const emphasised = config.ids[emphasis]
  const rest = (Object.keys(config.ids) as VerticalThird[]).filter((third) => third !== emphasis).flatMap((third) => config.ids[third])
  return { emphasised, rest }
}
