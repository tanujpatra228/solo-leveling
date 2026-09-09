import { describe, expect, it } from 'vitest'
import { hunterDisplayName } from './hunterName'

describe('hunterDisplayName (m11-plan §7)', () => {
  it('uses the entered name, trimmed', () => {
    expect(hunterDisplayName('  Jinwoo  ', 'abcd1234')).toBe('Jinwoo')
  })

  it('falls back to a label derived from the hunter id when unset', () => {
    expect(hunterDisplayName(undefined, 'abcd1234ef')).toBe('HUNTER ABCD')
  })

  it('falls back the same way for a blank or whitespace-only name', () => {
    expect(hunterDisplayName('   ', 'abcd1234ef')).toBe('HUNTER ABCD')
    expect(hunterDisplayName('', 'abcd1234ef')).toBe('HUNTER ABCD')
  })
})
