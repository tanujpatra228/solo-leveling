import { describe, expect, it } from 'vitest'
import { formatRemaining, isChimeDue, remainingSeconds } from './rest-timer'

describe('remainingSeconds', () => {
  it('counts down from the full duration', () => {
    expect(remainingSeconds(0, 210_000)).toBe(210)
  })

  it('rounds a partial second up, so the display never shows 0 while time remains', () => {
    expect(remainingSeconds(209_500, 210_000)).toBe(1)
  })

  it('floors at zero rather than going negative once time is up', () => {
    expect(remainingSeconds(211_000, 210_000)).toBe(0)
  })

  it('recomputes correctly after the app was hidden for a while', () => {
    // A tab backgrounded at t=0 and returned to 60s later — the value must
    // reflect elapsed wall-clock time, not a counter that stopped ticking.
    const endsAt = 210_000
    expect(remainingSeconds(60_000, endsAt)).toBe(150)
  })
})

describe('isChimeDue', () => {
  it('is false while time remains', () => {
    expect(isChimeDue(100_000, 210_000)).toBe(false)
  })

  it('is true exactly at the end time', () => {
    expect(isChimeDue(210_000, 210_000)).toBe(true)
  })

  it('is true any time after the end, including a late check after backgrounding', () => {
    expect(isChimeDue(300_000, 210_000)).toBe(true)
  })
})

describe('formatRemaining', () => {
  it('formats minutes and seconds with a zero-padded seconds field', () => {
    expect(formatRemaining(210)).toBe('3:30')
    expect(formatRemaining(9)).toBe('0:09')
    expect(formatRemaining(0)).toBe('0:00')
  })

  it('truncates a fractional second rather than rounding up past what remains', () => {
    expect(formatRemaining(65.9)).toBe('1:05')
  })
})
