/**
 * Carries the Status frame's tier (m10-plan commit 9, §1.7) down to every
 * `SystemWindow` without each of Gate/Status/Link/Awaken computing or
 * passing it themselves — a token lookup set once in `root.tsx`, so the
 * three routes stay identical rather than drifting per screen. `useContext`
 * rather than the Zustand store directly: it returns the default tier with
 * no provider mounted, which keeps every existing component test (rendered
 * standalone, with no app shell around it) rendering the plain tier-1 frame
 * instead of needing a store seeded just to satisfy this.
 */
import { createContext, useContext } from 'react'
import type { FrameTier } from '../domain/frameTier'

export const FrameTierContext = createContext<FrameTier>(1)

export function useFrameTier(): FrameTier {
  return useContext(FrameTierContext)
}
