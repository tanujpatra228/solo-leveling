import { describe, expect, it } from 'vitest'
import {
  FULL_TRAINING_WEEK_GOLD,
  QUEST_REROLL_PRICE_GOLD,
  REST_TOKEN_PRICE_GOLD,
  SHOP_CATALOGUE,
  canAfford,
  purchase,
  shopItemById,
} from './shop'

describe('the catalogue never sells what the log has to earn (m7b-plan commit 5, F2)', () => {
  it('is exactly the two items with existing mechanics behind them', () => {
    // A closed-set assertion rather than "review the diff": adding a third
    // item forces this test to be touched, which is the point.
    expect(SHOP_CATALOGUE.map((item) => item.id).sort()).toEqual(['quest_reroll', 'rest_token'])
  })

  it('every item resolves by id', () => {
    for (const item of SHOP_CATALOGUE) {
      expect(shopItemById(item.id)).toEqual(item)
    }
  })

  it('has no price of zero or below, which would not be a purchase at all', () => {
    for (const item of SHOP_CATALOGUE) {
      expect(item.priceGold).toBeGreaterThan(0)
    }
  })
})

describe('pricing is calibrated against real gold income, not invented (F2)', () => {
  it('a month of full training affords a small handful of Rest Tokens, not zero and not dozens', () => {
    const monthlyGold = FULL_TRAINING_WEEK_GOLD * 4
    const affordable = Math.floor(monthlyGold / REST_TOKEN_PRICE_GOLD)
    expect(affordable).toBeGreaterThanOrEqual(1)
    expect(affordable).toBeLessThanOrEqual(5)
  })

  it('a Quest Reroll costs roughly a day of training, not a week', () => {
    const dailyGoldEstimate = FULL_TRAINING_WEEK_GOLD / 7
    expect(QUEST_REROLL_PRICE_GOLD).toBeLessThan(REST_TOKEN_PRICE_GOLD)
    expect(QUEST_REROLL_PRICE_GOLD).toBeGreaterThanOrEqual(dailyGoldEstimate)
  })
})

describe('canAfford', () => {
  const item = shopItemById('quest_reroll')!

  it('is true with exactly enough gold', () => {
    expect(canAfford(item.priceGold, item)).toBe(true)
  })

  it('is true with more than enough', () => {
    expect(canAfford(item.priceGold + 1, item)).toBe(true)
  })

  it('is false one gold short', () => {
    expect(canAfford(item.priceGold - 1, item)).toBe(false)
  })

  it('is false with no gold at all', () => {
    expect(canAfford(0, item)).toBe(false)
  })
})

describe('purchase', () => {
  const item = shopItemById('rest_token')!

  it('deducts the price on success', () => {
    const result = purchase(item.priceGold + 100, item)
    expect(result.ok).toBe(true)
    expect(result.goldAfter).toBe(100)
  })

  it('leaves the balance untouched on failure', () => {
    const result = purchase(item.priceGold - 1, item)
    expect(result.ok).toBe(false)
    expect(result.goldAfter).toBe(item.priceGold - 1)
  })

  it('never goes negative on an exact-price purchase', () => {
    const result = purchase(item.priceGold, item)
    expect(result.ok).toBe(true)
    expect(result.goldAfter).toBe(0)
  })
})
