/**
 * The Awakening Test's in-progress answers, held outside the screen
 * component itself. The bottom nav can reach `/gate` without a profile, which
 * unmounts and remounts `AwakeningTestScreen` — component-local state would
 * lose everything typed so far. A module-level store survives that; only an
 * actual reload restarts onboarding, which is the only time "start over"
 * should mean starting over.
 */
import { create } from 'zustand'
import type { AwakeningAnswers } from './awakening'

interface AwakeningDraftState {
  answers: AwakeningAnswers
  stepIndex: number
  patch: (next: Partial<AwakeningAnswers>) => void
  setStepIndex: (index: number) => void
  reset: () => void
}

export const useAwakeningDraft = create<AwakeningDraftState>((set) => ({
  answers: {},
  stepIndex: 0,
  patch: (next) => set((state) => ({ answers: { ...state.answers, ...next } })),
  setStepIndex: (index) => set({ stepIndex: index }),
  reset: () => set({ answers: {}, stepIndex: 0 }),
}))
