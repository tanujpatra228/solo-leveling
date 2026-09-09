/**
 * The Awakening Test's step machine. Pure logic, no React import — the parts
 * of onboarding worth testing are which step comes next given the answers so
 * far, whether a step's input is valid, and whether the flow can complete
 * with every optional field blank, and all three are functions over a small
 * state object. The screen components are thin readers of this.
 *
 * Each step validates through the field schema already declared on
 * `ProfileSchema` or `BodyMetricSchema`, rather than a second copy of the
 * same rule that could drift from it.
 */
import { BodyMetricSchema, ProfileSchema, type BodyFatSource, type Equipment, type Profile, type Sex, type UnitPref } from '../domain/types'

export type AwakeningStepId =
  | 'name'
  | 'units'
  | 'sex'
  | 'standardsTable'
  | 'age'
  | 'height'
  | 'bodyweight'
  | 'trainingYears'
  | 'equipment'
  | 'physique'

/** Every field optional, filled in as the hunter answers each step. */
export interface AwakeningAnswers {
  /** The licence name (m11-plan §7). Skippable — declining falls back to a hunterId-derived label, never invented. */
  hunterName?: string
  unitPref?: UnitPref
  sex?: Sex
  /** Which published table to borrow when `sex` is `unspecified`. Absent means declined. */
  standardsTableOverride?: 'male' | 'female'
  birthYear?: number
  heightCm?: number
  bodyweightKg?: number
  trainingYears?: number
  equipmentAccess?: Equipment[]
  waistCm?: number
  neckCm?: number
  hipCm?: number
  bodyFatPct?: number
  bodyFatSource?: BodyFatSource
}

/**
 * The sequence for these answers so far. A function rather than a constant
 * because `standardsTable` is genuinely conditional: it appears only once the
 * hunter has said `sex` is `unspecified`. Everything else is fixed, in the
 * order each field's consumer needs it — units before any number that needs
 * one to interpret, sex before the standards-table question it gates, and so
 * on through what each later field feeds.
 */
export function stepsFor(answers: AwakeningAnswers): AwakeningStepId[] {
  const steps: AwakeningStepId[] = ['name', 'units', 'sex']
  if (answers.sex === 'unspecified') steps.push('standardsTable')
  steps.push('age', 'height', 'bodyweight', 'trainingYears', 'equipment', 'physique')
  return steps
}

const CURRENT_YEAR = new Date().getFullYear()

/** `null` means the step's current answer is acceptable. */
export function validateStep(step: AwakeningStepId, answers: AwakeningAnswers): string | null {
  switch (step) {
    case 'name': {
      // Skippable — a blank answer is a decline, not an error (§7 option B
      // covers the fallback). Only a name that was actually typed gets
      // checked against the schema's length bound.
      const trimmed = answers.hunterName?.trim()
      if (!trimmed) return null
      return ProfileSchema.shape.hunterName.safeParse(trimmed).success
        ? null
        : 'Keep it to 40 characters or fewer.'
    }

    case 'units':
      return ProfileSchema.shape.unitPref.safeParse(answers.unitPref).success
        ? null
        : 'Choose kilograms or pounds.'

    case 'sex':
      return ProfileSchema.shape.sex.safeParse(answers.sex).success
        ? null
        : 'Choose an option, or "prefer not to say".'

    case 'standardsTable':
      // Declining is a valid answer — that is the whole point of the step —
      // so there is no wrong answer here to reject.
      return null

    case 'age': {
      if (answers.birthYear === undefined) return 'Enter your birth year.'
      if (!ProfileSchema.shape.birthYear.safeParse(answers.birthYear).success) {
        return 'That is not a real birth year.'
      }
      return answers.birthYear > CURRENT_YEAR ? 'Your birth year cannot be in the future.' : null
    }

    case 'height':
      return ProfileSchema.shape.heightCm.safeParse(answers.heightCm).success
        ? null
        : 'Enter a height above zero.'

    case 'bodyweight':
      return BodyMetricSchema.shape.weightKg.safeParse(answers.bodyweightKg).success
        ? null
        : 'Enter a bodyweight above zero.'

    case 'trainingYears':
      return ProfileSchema.shape.trainingYears.safeParse(answers.trainingYears).success
        ? null
        : 'Enter how many years you have trained, or 0.'

    case 'equipment': {
      const result = ProfileSchema.shape.equipmentAccess.safeParse(answers.equipmentAccess)
      if (!result.success || result.data.length === 0) {
        return 'Choose at least one, even just "bodyweight".'
      }
      return null
    }

    case 'physique':
      // Skippable, and skipped by default — nothing here is required.
      return null
  }
}

/**
 * True once every step this set of answers actually visits accepts its
 * current answer. `physique` and a declined `standardsTable` always validate,
 * so this is true with both left untouched — which is the brief's
 * requirement that onboarding complete, and every later feature work, with
 * every optional field blank.
 */
export function isComplete(answers: AwakeningAnswers): boolean {
  return stepsFor(answers).every((step) => validateStep(step, answers) === null)
}

export interface AwakeningCompletionInput {
  profile: Omit<Profile, 'id' | 'createdAt' | 'awakenedAt'>
  bodyweightKg: number
  optional?: {
    waistCm?: number
    neckCm?: number
    hipCm?: number
    bodyFatPct?: number
    bodyFatSource?: BodyFatSource
  }
}

/**
 * Shapes completed answers into `completeAwakening`'s argument. Only
 * meaningful once `isComplete` is true — the non-null assertions below are
 * exactly the fields `isComplete` already guaranteed are present.
 */
export function toProfileInput(answers: AwakeningAnswers): AwakeningCompletionInput {
  const optional = {
    waistCm: answers.waistCm,
    neckCm: answers.neckCm,
    hipCm: answers.hipCm,
    bodyFatPct: answers.bodyFatPct,
    bodyFatSource: answers.bodyFatSource,
  }
  const hasOptional = Object.values(optional).some((value) => value !== undefined)

  const hunterName = answers.hunterName?.trim()

  return {
    profile: {
      hunterName: hunterName ? hunterName : undefined,
      sex: answers.sex!,
      birthYear: answers.birthYear!,
      heightCm: answers.heightCm!,
      unitPref: answers.unitPref!,
      trainingYears: answers.trainingYears!,
      equipmentAccess: answers.equipmentAccess!,
      standardsTableOverride: answers.standardsTableOverride,
    },
    bodyweightKg: answers.bodyweightKg!,
    optional: hasOptional ? optional : undefined,
  }
}
