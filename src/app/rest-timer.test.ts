import { describe, expect, it } from 'vitest'
import { countdownUrgency, elapsedPct, formatRemaining, isChimeDue, remainingSeconds } from './rest-timer'

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

describe('elapsedPct', () => {
  it('is 0 the instant a rest starts', () => {
    expect(elapsedPct(210, 210)).toBe(0)
  })

  it('is 100 the instant a rest ends', () => {
    expect(elapsedPct(0, 210)).toBe(100)
  })

  it('is 100 for a zero-length rest rather than dividing by zero', () => {
    expect(elapsedPct(0, 0)).toBe(100)
  })

  it('clamps a remaining value past the total to 0, not negative', () => {
    expect(elapsedPct(300, 210)).toBe(0)
  })
})

describe('countdownUrgency', () => {
  it('is 0 at ten seconds left, the quietest tick of the countdown', () => {
    expect(countdownUrgency(10)).toBe(0)
  })

  it('is 1 at one second left, the most tense tick before the final chime', () => {
    expect(countdownUrgency(1)).toBe(1)
  })

  it('rises monotonically as seconds left falls', () => {
    const values = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(countdownUrgency)
    for (let i = 1; i < values.length; i += 1) expect(values[i]!).toBeGreaterThan(values[i - 1]!)
  })

  it('clamps outside the 1-10 window rather than extrapolating', () => {
    expect(countdownUrgency(20)).toBe(0)
    expect(countdownUrgency(0)).toBe(1)
  })
})
