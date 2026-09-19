/**
 * "How do I do this?" for one exercise: the coaching cue already shown
 * mid-set, the longer setup/steps/common-mistakes guide from
 * `content/exerciseGuides.ts`, and a `MuscleMap` of what it trains. Same
 * `SystemOverlay` shell as `HelpModal` — see that file's note on why this
 * must not be mounted where another `SystemOverlay` is already open.
 *
 * An exercise with no guide yet (any fallback-library exercise, until a
 * later pass writes those — see docs/TODO.md) still opens, honestly showing
 * "not written yet" rather than a blank body or a crash.
 */
import { Dumbbell } from 'lucide-react'
import { EXERCISE_GUIDES } from '../content/exerciseGuides'
import type { Exercise } from '../domain/types'
import { MuscleMap } from './MuscleMap'
import { SystemOverlay } from './SystemOverlay'
import { SystemPanel } from './SystemPanel'

export function ExerciseHelpModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const guide = EXERCISE_GUIDES[exercise.id]

  return (
    <SystemOverlay title={exercise.name} icon={Dumbbell} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <SystemPanel boxed className="p-3">
          <MuscleMap primaryMuscles={exercise.primaryMuscles} secondaryMuscles={exercise.secondaryMuscles} exerciseId={exercise.id} />
        </SystemPanel>

        {exercise.cue ? (
          <p className="border-l-2 border-system-dim py-1 pl-3 text-sm text-ink">{exercise.cue}</p>
        ) : null}

        {guide ? (
          <>
            <SystemPanel className="flex flex-col gap-2">
              <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint uppercase">Setup</p>
              <p className="text-sm text-ink-soft">{guide.setup}</p>
            </SystemPanel>

            <SystemPanel className="flex flex-col gap-2">
              <p className="font-system text-[10px] tracking-[0.12em] text-ink-faint uppercase">How to do it</p>
              <ol className="flex flex-col gap-1.5">
                {guide.steps.map((step, index) => (
                  <li key={index} className="flex gap-2 text-sm text-ink-soft">
                    <span className="shrink-0 font-system text-xs text-system-dim tabular-nums">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </SystemPanel>

            <SystemPanel className="flex flex-col gap-2">
              <p className="font-system text-[10px] tracking-[0.12em] text-warn uppercase">Common mistakes</p>
              <ul className="flex flex-col gap-1.5">
                {guide.commonMistakes.map((mistake, index) => (
                  <li key={index} className="flex gap-2 text-sm text-ink-soft">
                    <span className="shrink-0 text-warn">·</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </SystemPanel>
          </>
        ) : (
          <p className="font-system text-xs text-ink-faint uppercase">Full guide not written yet.</p>
        )}
      </div>
    </SystemOverlay>
  )
}
