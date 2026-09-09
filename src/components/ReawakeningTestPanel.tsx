/**
 * The Reawakening Test: due every 8 to 12 weeks (m7b-plan F4,
 * `domain/bodycomp.ts`'s `remeasureDue`) — a prompt to re-measure, not a
 * recalculation. Rank and every other derived figure already recompute on
 * every call; what goes stale is the input, not the arithmetic. Reuses the
 * Awakening Test's own physique-step fields and parsers.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import { formatLength, formatWeight, parseHeightToCm, parseWeightToKg } from '../domain/units'
import { NumberField } from './NumberField'
import { SystemWindow } from './SystemWindow'

export function ReawakeningTestPanel({ strong = false, index }: { strong?: boolean; index?: number }) {
  const reawakeningDue = useApp((s) => s.projection?.reawakeningDue ?? false)
  const unitPref = useApp((s) => s.profile?.unitPref ?? 'metric')
  const completeReawakeningTest = useApp((s) => s.completeReawakeningTest)

  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [waistCm, setWaistCm] = useState<number | null>(null)
  const [neckCm, setNeckCm] = useState<number | null>(null)
  const [hipCm, setHipCm] = useState<number | null>(null)

  if (!reawakeningDue) return null

  function submit() {
    if (weightKg === null) return
    void completeReawakeningTest({
      weightKg,
      waistCm: waistCm ?? undefined,
      neckCm: neckCm ?? undefined,
      hipCm: hipCm ?? undefined,
    })
  }

  return (
    <SystemWindow
      title="Reawakening Test"
      strong={strong}
      index={index}
      footer={
        <button
          type="button"
          disabled={weightKg === null}
          onClick={submit}
          className={`w-full rounded px-5 py-3 font-system text-xs uppercase ${
            weightKg !== null ? 'bg-system-deep text-ink' : 'bg-panel-edge/40 text-ink-faint'
          }`}
        >
          Take the Reawakening Test
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-center text-xs text-ink-soft">
          Every measurement on file is 8 to 12 weeks old. Rank and tonnage read off the numbers given
          at the Awakening — a fresh reading keeps them honest. Waist, neck and hip stay optional.
        </p>
        <NumberField
          label="Bodyweight"
          parse={(raw) => parseWeightToKg(raw, unitPref)}
          echo={(kg) => `≈ ${formatWeight(kg, unitPref)}`}
          onParsed={(value) => setWeightKg(value)}
        />
        <NumberField
          label="Waist"
          parse={(raw) => parseHeightToCm(raw, unitPref)}
          echo={(cm) => `≈ ${formatLength(cm, unitPref)}`}
          onParsed={(value) => setWaistCm(value)}
        />
        <NumberField
          label="Neck"
          parse={(raw) => parseHeightToCm(raw, unitPref)}
          echo={(cm) => `≈ ${formatLength(cm, unitPref)}`}
          onParsed={(value) => setNeckCm(value)}
        />
        <NumberField
          label="Hip"
          parse={(raw) => parseHeightToCm(raw, unitPref)}
          echo={(cm) => `≈ ${formatLength(cm, unitPref)}`}
          onParsed={(value) => setHipCm(value)}
        />
      </div>
    </SystemWindow>
  )
}
