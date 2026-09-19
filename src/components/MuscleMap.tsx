/**
 * A front/back anatomical body diagram, lit up wherever an exercise's
 * primary and secondary muscles fall. Pure presentation over
 * `MUSCLE_MAPPINGS` (which id(s) belong to which `Muscle`) and `BodyMap`
 * (which actually recolors the SVG) — see `muscleMapRegions.ts` for the
 * mapping and its approximations.
 */
import type { Muscle } from '../domain/types'
import { BodyMap, type BodyMapView, type MuscleFillMap } from './anatomy/BodyMap'
import { ABS_EMPHASIS_BY_EXERCISE, MUSCLE_MAPPINGS, absSegmentSplit, idsFor, type MuscleMapping } from './muscleMapRegions'

type Tone = 'primary' | 'secondary'

// Indirected through the app's own tokens (index.css) rather than hardcoded
// hex, so a palette change stays in sync automatically.
const FILL: Record<Tone, string> = {
  primary: 'color-mix(in srgb, var(--color-system) 92%, transparent)',
  secondary: 'color-mix(in srgb, var(--color-system-dim) 65%, transparent)',
}

// Every untouched region and every outline, in both views — the source
// SVGs' own fill (light grey/white, a clinical-chart palette) and the
// anterior file's missing outline paths (see BodyMap.tsx) both need
// overriding, or the diagram reads as borrowed rather than System hardware.
const BASE_FILL = 'var(--color-panel-edge)'
const BASE_STROKE = 'color-mix(in srgb, var(--color-ink-faint) 45%, transparent)'

function toneFor(muscle: Muscle, primary: ReadonlySet<Muscle>, secondary: ReadonlySet<Muscle>): Tone | null {
  if (primary.has(muscle)) return 'primary'
  if (secondary.has(muscle)) return 'secondary'
  return null
}

const MUSCLES = Object.keys(MUSCLE_MAPPINGS) as Muscle[]

function fillsFor(
  view: BodyMapView,
  primary: ReadonlySet<Muscle>,
  secondary: ReadonlySet<Muscle>,
  exerciseId: string | undefined,
): MuscleFillMap {
  const fills: MuscleFillMap = {}
  for (const muscle of MUSCLES) {
    const tone = toneFor(muscle, primary, secondary)
    if (!tone) continue
    const emphasis = muscle === 'abs' && view === 'front' && exerciseId ? ABS_EMPHASIS_BY_EXERCISE[exerciseId] : undefined
    if (emphasis) {
      const { emphasised, rest } = absSegmentSplit(emphasis)
      for (const id of emphasised) fills[id] = FILL[tone]
      // The half an exercise doesn't emphasise still trains, just less —
      // shown one tone down from whatever the emphasised half got.
      for (const id of rest) fills[id] = FILL.secondary
      continue
    }
    for (const id of idsFor(muscle, view)) fills[id] = FILL[tone]
  }
  return fills
}

export interface MuscleMapProps {
  primaryMuscles: readonly Muscle[]
  secondaryMuscles: readonly Muscle[]
  /** When set and one of the muscles above is `abs`, narrows the highlight to that exercise's half of the six-pack. See `ABS_EMPHASIS_BY_EXERCISE`. */
  exerciseId?: string
}

export function MuscleMap({ primaryMuscles, secondaryMuscles, exerciseId }: MuscleMapProps) {
  const primary = new Set(primaryMuscles)
  const secondary = new Set(secondaryMuscles)

  const badges = Object.entries(MUSCLE_MAPPINGS).filter(
    ([muscle, mapping]) => mapping.kind === 'badge' && (primary.has(muscle as Muscle) || secondary.has(muscle as Muscle)),
  ) as [Muscle, Extract<MuscleMapping, { kind: 'badge' }>][]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <BodyMap
            view="front"
            fills={fillsFor('front', primary, secondary, exerciseId)}
            baseFill={BASE_FILL}
            baseStroke={BASE_STROKE}
            className="[&_svg]:h-52 [&_svg]:w-auto"
          />
          <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">Front</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <BodyMap
            view="back"
            fills={fillsFor('back', primary, secondary, exerciseId)}
            baseFill={BASE_FILL}
            baseStroke={BASE_STROKE}
            className="[&_svg]:h-52 [&_svg]:w-auto"
          />
          <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">Back</span>
        </div>
      </div>
      {badges.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {badges.map(([muscle, mapping]) => (
            <span
              key={muscle}
              data-muscle={muscle}
              data-tone={primary.has(muscle) ? 'primary' : 'secondary'}
              className={`rounded-full border px-2 py-1 font-system text-[10px] uppercase ${
                primary.has(muscle) ? 'border-system text-system' : 'border-panel-edge text-ink-faint'
              }`}
            >
              {mapping.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-3 font-system text-[9px] text-ink-faint uppercase">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-system" /> Primary
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-system-dim" /> Secondary
        </span>
      </div>
    </div>
  )
}
