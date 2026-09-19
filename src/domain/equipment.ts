/**
 * What "the hunter has this equipment" actually means, in one place, so the
 * seven call sites that used to read `profile.equipmentAccess` raw cannot
 * each get it slightly wrong. See docs/bodyweight-gates-plan.md §2.
 */
import type { Equipment } from './types'

/** Equipment tags that add resistance. Excludes `pullup_bar` and `bench`,
 *  which change leverage and range of motion but add no load — the same
 *  line `canAddExternalLoad` (progression.ts) already draws. */
const LOAD_BEARING: readonly Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'ez_bar', 'kettlebell', 'bands']

/**
 * The access array as every consumer should read it: `bodyweight` is always
 * present (a hunter's body is never equipment they can lack), and `none` is
 * dropped as a redundant synonym for "bodyweight and nothing else". Idempotent
 * and order-independent — safe to call on every read, including once per
 * exercise in a recompute loop.
 */
export function effectiveEquipment(access: readonly Equipment[] | undefined): Equipment[] {
  const set = new Set(access ?? [])
  set.delete('none')
  set.add('bodyweight')
  return [...set]
}

/**
 * The rule behind the Awakening's equipment chips: `bodyweight` and
 * load-bearing equipment are mutually exclusive, since ticking "Bodyweight"
 * while a barbell is also ticked describes no coherent programme. A bar or a
 * bench survives either direction — they are the plan's baseline tier, not a
 * load source. Pure so `awaken.tsx` can call it straight from `onChange`.
 */
export function applyEquipmentSelection(current: readonly Equipment[], toggled: Equipment): Equipment[] {
  const set = new Set(current)
  const turningOn = !set.has(toggled)

  if (turningOn) {
    set.add(toggled)
    if (toggled === 'bodyweight') {
      for (const eq of LOAD_BEARING) set.delete(eq)
    } else if (LOAD_BEARING.includes(toggled)) {
      set.delete('bodyweight')
    }
  } else {
    set.delete(toggled)
  }

  return [...set]
}
