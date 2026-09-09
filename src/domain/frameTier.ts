/**
 * The Status frame levels up with the hunter (§1.7, m10-plan commit 9):
 * Jinwoo's own interface changes at fixed power beats, never at random. A
 * tier is a token lookup driven by the projection, never stored — the log
 * stays append-only and rank stays derived, so the frame can never disagree
 * with what the hunter actually is.
 */
import type { HunterClass, Rank } from './types'

export type FrameTier = 1 | 2 | 3 | 4

/** No rank yet (pre-Awakening) reads as tier 1, same as a fresh E-rank hunter. */
export function frameTierFor(rank: Rank | null, hunterClass: HunterClass): FrameTier {
  if (hunterClass === 'shadow_monarch') return 4
  if (rank === 'A' || rank === 'S') return 3
  if (rank === 'B' || rank === 'C') return 2
  return 1
}
