/**
 * The rest timer's arithmetic, with no ambient clock and no React import.
 *
 * Background tabs throttle `setInterval` to roughly once a minute, and squat
 * rest in this programme is 210 seconds — a naive countdown would drift the
 * moment the hunter's screen turns off, which during rest is exactly what
 * happens. So nothing here counts down: every function takes `now` and an
 * absolute `endsAt` and derives the truth fresh, which is what lets the hook
 * built on top of this just re-render on a tick and on `visibilitychange`
 * rather than track any state of its own.
 */

/** Seconds left until `endsAt`, floored at zero rather than going negative. */
export function remainingSeconds(now: number, endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

/** Whether rest is over. A plain time comparison — nothing here fires once. */
export function isChimeDue(now: number, endsAt: number): boolean {
  return now >= endsAt
}

/** `m:ss`, the way a rest countdown is read at a glance. */
export function formatRemaining(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  const secs = whole % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
