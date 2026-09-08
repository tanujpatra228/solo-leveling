/**
 * The System Shop. Gold has had two sources and no sink since M3 (m7b-plan
 * F2, F1) — this is the sink, and it is deliberately small: rest tokens and
 * quest rerolls, the two items that already have real mechanics behind
 * them (`resolveMissedDay`, `activeQuestFor`'s reroll). Nothing here grants
 * XP, stats, rank, a gate clear, or an untrained streak day — the rule
 * that makes the rest of the catalogue safe to add later without
 * relitigating this one:
 *
 * Gold never buys anything the log would otherwise have to earn.
 */

export type ShopItemId = 'rest_token' | 'quest_reroll'

export interface ShopItem {
  id: ShopItemId
  name: string
  description: string
  priceGold: number
}

/**
 * Both gold sources pay a flat 25 today — `finishGate` and
 * `completeDailyQuest` in `state.ts`, and `generateDailyQuest`'s
 * `goldReward` in this file. Mirrored rather than imported: the Shop is a
 * domain module and must not depend on the app layer (rule: `src/domain/`
 * is pure). If the real reward ever changes, the calibration test below is
 * what will notice the drift.
 */
const ASSUMED_GOLD_PER_GATE = 25
const ASSUMED_GOLD_PER_DAILY_QUEST = 25

/**
 * A full training week: six gates, and a Daily Quest issued every day
 * including the seventh, rest day.
 */
export const FULL_TRAINING_WEEK_GOLD = 6 * ASSUMED_GOLD_PER_GATE + 7 * ASSUMED_GOLD_PER_DAILY_QUEST

/**
 * 300 gold: F2's own calibration anchor. At this price a Rest Token costs
 * roughly a week's full training income, which is what makes buying a
 * third one (beyond the two free monthly tokens) a real choice rather than
 * a rounding error.
 */
export const REST_TOKEN_PRICE_GOLD = 300

/**
 * 50 gold: roughly a single day's income (one gate, or one Daily Quest and
 * change). A reroll is a lighter, more-frequent decision than a rest
 * token, so it is priced against a day rather than a week.
 */
export const QUEST_REROLL_PRICE_GOLD = 50

export const SHOP_CATALOGUE: readonly ShopItem[] = [
  {
    id: 'rest_token',
    name: 'Rest Token',
    description:
      'Forgives one missed day without breaking the streak — the same forgiveness the two free monthly tokens give.',
    priceGold: REST_TOKEN_PRICE_GOLD,
  },
  {
    id: 'quest_reroll',
    name: 'Quest Reroll',
    description: "Replaces today's Daily Quest with a freshly generated one.",
    priceGold: QUEST_REROLL_PRICE_GOLD,
  },
]

export function shopItemById(id: ShopItemId): ShopItem | undefined {
  return SHOP_CATALOGUE.find((item) => item.id === id)
}

export function canAfford(gold: number, item: ShopItem): boolean {
  return gold >= item.priceGold
}

export interface PurchaseResult {
  ok: boolean
  /** Gold after the purchase — unchanged from the input when `ok` is false. */
  goldAfter: number
}

/** Pure: deciding what a purchase does to the balance. Applying the item's actual effect is the caller's job. */
export function purchase(gold: number, item: ShopItem): PurchaseResult {
  if (!canAfford(gold, item)) return { ok: false, goldAfter: gold }
  return { ok: true, goldAfter: gold - item.priceGold }
}
