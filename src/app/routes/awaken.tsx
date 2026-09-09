/**
 * The Awakening Test. Redirects to `/` once a profile exists — onboarding is a
 * one-time gate, not a screen a returning hunter can wander back into.
 *
 * This screen holds no validation logic of its own: it renders whatever
 * `validateStep` says about the current answers, and the `awakening.ts`
 * machine decides what step comes next. Units are asked first because every
 * later numeric field needs one to interpret, and the standards-table step
 * only exists at all once sex reads `unspecified`.
 */
import { useMemo, useState } from 'react'
import { createRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { NumberField } from '../../components/NumberField'
import { SystemValue } from '../../components/SystemValue'
import { SystemWindow } from '../../components/SystemWindow'
import { formatHeight, formatLength, formatWeight, parseHeightToCm, parseWeightToKg } from '../../domain/units'
import type { Equipment, Sex, UnitPref } from '../../domain/types'
import {
  isComplete,
  stepsFor,
  toProfileInput,
  validateStep,
  type AwakeningAnswers,
  type AwakeningStepId,
} from '../awakening'
import { useAwakeningDraft } from '../awakeningDraft'
import { useApp } from '../state'
import { rootRoute } from './root'

export const awakenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/awaken',
  beforeLoad: () => {
    if (useApp.getState().profile) throw redirect({ to: '/' })
  },
  component: AwakeningTestScreen,
})

const STEP_TITLES: Record<AwakeningStepId, string> = {
  name: 'Name',
  units: 'Units',
  sex: 'Body',
  standardsTable: 'Standards Table',
  age: 'Age',
  height: 'Height',
  bodyweight: 'Bodyweight',
  trainingYears: 'Training History',
  equipment: 'Equipment',
  physique: 'Physique',
}

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'bodyweight', label: 'Bodyweight only' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'bench', label: 'Bench' },
  { value: 'ez_bar', label: 'EZ bar' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bands', label: 'Bands' },
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'none', label: 'None of the above' },
]

function hasAnyPhysique(answers: AwakeningAnswers): boolean {
  return [answers.waistCm, answers.neckCm, answers.hipCm].some((value) => value !== undefined)
}

function AwakeningTestScreen() {
  const completeAwakening = useApp((s) => s.completeAwakening)
  const navigate = useNavigate()
  const answers = useAwakeningDraft((s) => s.answers)
  const stepIndex = useAwakeningDraft((s) => s.stepIndex)
  const patch = useAwakeningDraft((s) => s.patch)
  const setStepIndex = useAwakeningDraft((s) => s.setStepIndex)
  const resetDraft = useAwakeningDraft((s) => s.reset)
  const [submitting, setSubmitting] = useState(false)

  const steps = useMemo(() => stepsFor(answers), [answers])
  const index = Math.min(stepIndex, steps.length - 1)
  const step = steps[index]!
  const error = validateStep(step, answers)
  const isLast = index === steps.length - 1

  async function goNext() {
    if (error) return
    if (!isLast) {
      setStepIndex(index + 1)
      return
    }
    if (!isComplete(answers) || submitting) return
    setSubmitting(true)
    await completeAwakening(toProfileInput(answers))
    resetDraft()
    await navigate({ to: '/' })
  }

  function goBack() {
    if (index > 0) setStepIndex(index - 1)
  }

  const primaryLabel = isLast ? (hasAnyPhysique(answers) ? 'Awaken' : 'Skip and Awaken') : 'Next'

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <p className="flex items-baseline gap-1 px-1 font-system text-[11px] tracking-[0.2em] text-ink-faint uppercase">
        Awakening Test — <SystemValue value={index + 1} max={steps.length} size="md" />
      </p>

      <SystemWindow title={STEP_TITLES[step]} strong>
        {/* Keyed on the step id: without it, switching from one NumberField
            step straight into another (height into bodyweight) reuses the
            same component instance and leaks its typed-but-unsubmitted text
            into the next field, since only the initial mount reads
            defaultRaw. */}
        <StepBody key={step} step={step} answers={answers} onChange={patch} />
        {error ? <p className="mt-3 font-system text-[11px] text-warn">{error}</p> : null}
      </SystemWindow>

      <div className="mt-auto flex items-center justify-between gap-3 px-1 pb-2">
        <button
          type="button"
          onClick={goBack}
          disabled={index === 0}
          className="font-system text-xs text-ink-faint disabled:opacity-30"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void goNext()}
          disabled={Boolean(error) || submitting}
          className="rounded bg-system-deep px-5 py-2 font-system text-xs text-ink uppercase disabled:opacity-30"
        >
          {primaryLabel}
        </button>
      </div>
    </main>
  )
}

function StepBody({
  step,
  answers,
  onChange,
}: {
  step: AwakeningStepId
  answers: AwakeningAnswers
  onChange: (patch: Partial<AwakeningAnswers>) => void
}) {
  const unitPref: UnitPref = answers.unitPref ?? 'metric'

  switch (step) {
    case 'name':
      return (
        <label className="flex flex-col gap-1">
          <span className="font-system text-xs tracking-wide text-ink-soft uppercase">
            What should the System call you?
          </span>
          <input
            type="text"
            maxLength={40}
            value={answers.hunterName ?? ''}
            onChange={(event) => onChange({ hunterName: event.target.value })}
            placeholder="Optional — skip to be known by your Hunter ID"
            className="rounded border border-panel-edge bg-void-soft px-3 py-3 text-lg text-ink placeholder:text-sm placeholder:text-ink-faint"
          />
        </label>
      )

    case 'units':
      return (
        <ChoiceGroup<UnitPref>
          label="Units"
          options={[
            { value: 'metric', label: 'Kilograms, centimetres' },
            { value: 'imperial', label: 'Pounds, feet & inches' },
          ]}
          value={answers.unitPref ? [answers.unitPref] : []}
          onChange={([value]) => onChange({ unitPref: value })}
        />
      )

    case 'sex':
      return (
        <ChoiceGroup<Sex>
          label="Body"
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'unspecified', label: 'Prefer not to say' },
          ]}
          value={answers.sex ? [answers.sex] : []}
          onChange={([value]) => onChange({ sex: value, standardsTableOverride: undefined })}
        />
      )

    case 'standardsTable':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            Rank comes from strength standards published separately for male and female bodies.
            Borrow a table to see a rank, or decline — everything else works without it.
          </p>
          <ChoiceGroup<'male' | 'female'>
            label="Borrow a table"
            options={[
              { value: 'male', label: 'Male table' },
              { value: 'female', label: 'Female table' },
            ]}
            value={answers.standardsTableOverride ? [answers.standardsTableOverride] : []}
            onChange={([value]) => onChange({ standardsTableOverride: value })}
          />
          {answers.standardsTableOverride ? (
            <button
              type="button"
              onClick={() => onChange({ standardsTableOverride: undefined })}
              className="self-start font-system text-xs text-ink-faint underline"
            >
              Never mind — decline
            </button>
          ) : (
            <p className="font-system text-[11px] text-ink-faint">
              No table chosen. Your rank will read Unranked.
            </p>
          )}
        </div>
      )

    case 'age':
      return (
        <label className="flex flex-col gap-1">
          <span className="font-system text-xs tracking-wide text-ink-soft uppercase">Birth year</span>
          <input
            type="number"
            inputMode="numeric"
            value={answers.birthYear ?? ''}
            onChange={(event) =>
              onChange({ birthYear: event.target.value === '' ? undefined : Number(event.target.value) })
            }
            className="rounded border border-panel-edge bg-void-soft px-3 py-3 text-lg text-ink"
          />
        </label>
      )

    case 'height':
      return (
        <NumberField
          label="Height"
          parse={(raw) => parseHeightToCm(raw, unitPref)}
          echo={(cm) => `≈ ${formatHeight(cm, unitPref)}`}
          onParsed={(value) => onChange({ heightCm: value ?? undefined })}
        />
      )

    case 'bodyweight':
      return (
        <NumberField
          label="Bodyweight"
          parse={(raw) => parseWeightToKg(raw, unitPref)}
          echo={(kg) => `≈ ${formatWeight(kg, unitPref)}`}
          onParsed={(value) => onChange({ bodyweightKg: value ?? undefined })}
        />
      )

    case 'trainingYears':
      return (
        <label className="flex flex-col gap-1">
          <span className="font-system text-xs tracking-wide text-ink-soft uppercase">
            Years training with intent
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={answers.trainingYears ?? ''}
            onChange={(event) =>
              onChange({
                trainingYears: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
            className="rounded border border-panel-edge bg-void-soft px-3 py-3 text-lg text-ink"
          />
        </label>
      )

    case 'equipment':
      return (
        <ChoiceGroup<Equipment>
          label="Equipment access"
          multi
          options={EQUIPMENT_OPTIONS}
          value={answers.equipmentAccess ?? []}
          onChange={(value) => onChange({ equipmentAccess: value })}
        />
      )

    case 'physique':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            Optional — skip it. Nothing else in the System needs these to work; the Physique panel
            can fill them in later.
          </p>
          <NumberField
            label="Waist"
            parse={(raw) => parseHeightToCm(raw, unitPref)}
            echo={(cm) => `≈ ${formatLength(cm, unitPref)}`}
            onParsed={(value) => onChange({ waistCm: value ?? undefined })}
          />
          <NumberField
            label="Neck"
            parse={(raw) => parseHeightToCm(raw, unitPref)}
            echo={(cm) => `≈ ${formatLength(cm, unitPref)}`}
            onParsed={(value) => onChange({ neckCm: value ?? undefined })}
          />
          <NumberField
            label="Hip"
            parse={(raw) => parseHeightToCm(raw, unitPref)}
            echo={(cm) => `≈ ${formatLength(cm, unitPref)}`}
            onParsed={(value) => onChange({ hipCm: value ?? undefined })}
          />
        </div>
      )
  }
}
