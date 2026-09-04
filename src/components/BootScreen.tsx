/**
 * Shown while `load()` seeds the exercise library, routines and standards
 * table on a first launch. A blank screen there would be the hunter's first
 * impression of the System, so this exists even though it is on stage only
 * for a moment.
 */
export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-void text-ink">
      <p className="font-system text-xs tracking-[0.3em] text-system uppercase animate-pulse">
        The System
      </p>
      <p className="font-system text-[11px] text-ink-faint">Arising…</p>
    </div>
  )
}
