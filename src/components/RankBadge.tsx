/**
 * E through S — and a `null` state. `rank` is nullable and reads "Unranked",
 * which the unspecified-sex path (decline every standards table) makes
 * reachable on day one, not an edge case to patch in later.
 */
import type { Rank } from '../domain/types'

const RANK_STYLES: Record<Rank, string> = {
  E: 'text-ink-soft border-ink-faint',
  D: 'text-good border-good',
  C: 'text-system border-system',
  B: 'text-system-glow border-system-glow',
  A: 'text-warn border-warn',
  S: 'text-gold border-gold',
}

export function RankBadge({ rank }: { rank: Rank | null }) {
  if (rank === null) {
    return (
      <span className="rounded border border-ink-faint px-2 py-0.5 font-system text-xs text-ink-faint">
        Unranked
      </span>
    )
  }

  return (
    <span className={`rounded border px-2 py-0.5 font-system text-xs ${RANK_STYLES[rank]}`}>
      {rank}-Rank
    </span>
  )
}
