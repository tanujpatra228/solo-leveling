/**
 * The house button vocabulary (m10-plan F10), copied verbatim from
 * `gate.tsx` rather than re-derived. Extracted to a shared module because
 * this commit gives it its third-plus caller across the Status surfaces —
 * below three, CLAUDE.md's one-home rule says copy instead.
 */
export const PRIMARY_BUTTON =
  'w-full rounded bg-system-deep px-5 py-3 font-system text-xs text-ink uppercase disabled:opacity-30'
export const SECONDARY_BUTTON =
  'w-full font-system text-[11px] text-ink-faint uppercase underline disabled:opacity-30'
export const PILL_BUTTON = 'rounded-full border px-3 py-1 font-system text-[10px] uppercase'
export const SUBLABEL = 'font-system text-[10px] tracking-[0.16em] text-system-dim uppercase'
