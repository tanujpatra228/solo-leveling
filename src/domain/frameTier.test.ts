import { describe, expect, it } from 'vitest'
import { frameTierFor } from './frameTier'

describe('frameTierFor (m10-plan commit 9)', () => {
  it('renders tier 1 for a fresh hunter with no rank yet', () => {
    expect(frameTierFor(null, 'none')).toBe(1)
  })

  it('renders tier 1 for E and D rank', () => {
    expect(frameTierFor('E', 'none')).toBe(1)
    expect(frameTierFor('D', 'fighter')).toBe(1)
  })

  it('renders tier 2 for C and B rank', () => {
    expect(frameTierFor('C', 'none')).toBe(2)
    expect(frameTierFor('B', 'tanker')).toBe(2)
  })

  it('renders tier 3 for A and S rank', () => {
    expect(frameTierFor('A', 'assassin')).toBe(3)
    expect(frameTierFor('S', 'ranger')).toBe(3)
  })

  it('renders tier 4 for the Shadow Monarch class, regardless of rank', () => {
    expect(frameTierFor('S', 'shadow_monarch')).toBe(4)
    expect(frameTierFor('E', 'shadow_monarch')).toBe(4)
  })
})
