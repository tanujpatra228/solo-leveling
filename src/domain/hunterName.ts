/**
 * The hunter's licence name (m11-plan §7, option A): user-entered at the
 * Awakening Test, never pre-filled from a device or account name, and never
 * invented when missing. A licence with a blank name field is still a
 * strange document, so a hunter who declined reads as `HUNTER 4010`-style
 * instead (§7 option B) — derived, not made up.
 */
export function hunterDisplayName(hunterName: string | undefined, hunterId: string): string {
  const trimmed = hunterName?.trim()
  if (trimmed) return trimmed
  return `HUNTER ${hunterId.slice(0, 4).toUpperCase()}`
}
