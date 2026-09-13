/**
 * A small front/back body silhouette, lit up wherever an exercise's primary
 * and secondary muscles fall. Pure presentation over `MUSCLE_MAPPINGS` — see
 * `muscleMapRegions.ts` for why the regions are flat rectangles rather than
 * traced anatomy, and why three muscles render as a badge instead.
 */
import type { Muscle } from '../domain/types'
import { BODY_VIEWBOX, MUSCLE_MAPPINGS, type MuscleMapping, type RegionRect } from './muscleMapRegions'

type Tone = 'primary' | 'secondary'

const FILL_CLASS: Record<Tone, string> = {
  primary: 'fill-system/90',
  secondary: 'fill-system-dim/60',
}

function toneFor(muscle: Muscle, primary: ReadonlySet<Muscle>, secondary: ReadonlySet<Muscle>): Tone | null {
  if (primary.has(muscle)) return 'primary'
  if (secondary.has(muscle)) return 'secondary'
  return null
}

function BodyOutline() {
  const stroke = 'fill-none stroke-ink-faint/40'
  return (
    <g strokeWidth={1.5}>
      <circle cx={60} cy={14} r={12} className={stroke} />
      <rect x={54} y={25} width={12} height={8} className={stroke} />
      <path d="M35,33 L85,33 L80,130 L40,130 Z" className={stroke} />
      <rect x={15} y={33} width={18} height={100} rx={6} className={stroke} />
      <rect x={87} y={33} width={18} height={100} rx={6} className={stroke} />
      <path d="M40,130 L80,130 L85,160 L35,160 Z" className={stroke} />
      <rect x={38} y={160} width={20} height={95} rx={6} className={stroke} />
      <rect x={62} y={160} width={20} height={95} rx={6} className={stroke} />
    </g>
  )
}

const MUSCLE_ENTRIES = Object.entries(MUSCLE_MAPPINGS) as [Muscle, MuscleMapping][]

function BodyView({
  view,
  label,
  primary,
  secondary,
}: {
  view: 'front' | 'back'
  label: string
  primary: ReadonlySet<Muscle>
  secondary: ReadonlySet<Muscle>
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={BODY_VIEWBOX} className="h-40 w-auto" role="img" aria-label={`${label} view`}>
        <BodyOutline />
        {MUSCLE_ENTRIES.map(([muscle, mapping]) => {
          if (mapping.kind !== 'silhouette') return null
          const rects: readonly RegionRect[] | undefined = mapping[view]
          if (!rects) return null
          const tone = toneFor(muscle, primary, secondary)
          if (!tone) return null
          return rects.map((r, i) => (
            <rect
              key={`${muscle}-${view}-${i}`}
              data-muscle={muscle}
              data-tone={tone}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              rx={2}
              className={FILL_CLASS[tone]}
            />
          ))
        })}
      </svg>
      <span className="font-system text-[9px] tracking-[0.1em] text-ink-faint uppercase">{label}</span>
    </div>
  )
}

export interface MuscleMapProps {
  primaryMuscles: readonly Muscle[]
  secondaryMuscles: readonly Muscle[]
}

export function MuscleMap({ primaryMuscles, secondaryMuscles }: MuscleMapProps) {
  const primary = new Set(primaryMuscles)
  const secondary = new Set(secondaryMuscles)

  const badges = MUSCLE_ENTRIES.filter(
    ([muscle, mapping]) => mapping.kind === 'badge' && (primary.has(muscle) || secondary.has(muscle)),
  ) as [Muscle, { kind: 'badge'; label: string }][]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-6">
        <BodyView view="front" label="Front" primary={primary} secondary={secondary} />
        <BodyView view="back" label="Back" primary={primary} secondary={secondary} />
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
