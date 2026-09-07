/**
 * The first-launch sequence, ending in "You have acquired the qualification to
 * be a Player." Gated on `Progress.doubleDungeonSeenAt` rather than on
 * whether a profile exists — the natural-seeming gate, "play while there is
 * no profile", is wrong: it would replay if the hunter reloads mid-onboarding.
 *
 * The index.css global rule sets every CSS animation to 0.01ms under
 * `prefers-reduced-motion`, which is correct for incidental motion but would
 * make a beat-by-beat cinematic complete instantly and flash rather than
 * degrade. So this branches in JavaScript instead: a direct
 * `prefers-reduced-motion` check renders every beat at once, in plain
 * readable text, with nothing timed — a plain media query rather than
 * `motion`'s hook of the same name, which pulled in the library's whole
 * `domAnimation` feature set (84 KB gzipped, ~38% of the main bundle) for
 * one component's one-time fade, wrapping the entire app in a `LazyMotion`
 * provider it was the only caller of. The fade itself is `--animate-system-in`,
 * the same CSS entrance every `SystemWindow` already uses.
 *
 * Skippable at every beat, and on every path — completion or skip — marks the
 * sequence seen. A cinematic you cannot dismiss is hostile the second time you
 * install the app, and a skip that does not count as seen would replay it.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import * as repo from '../db/repo'
import { SystemWindow } from './SystemWindow'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const BEATS = [
  {
    title: 'A voice.',
    body: 'You have obtained the qualification to enter the Double Dungeon.',
  },
  {
    title: 'The room fills with light.',
    body: 'Rules are rules. There is no leaving until the trial ends.',
  },
  {
    title: 'The trial is simple.',
    body: 'Grow strong enough to survive what real training demands, and the System will measure you honestly from here.',
  },
  {
    title: 'Congratulations.',
    body: 'You have acquired the qualification to be a Player.',
  },
] as const

async function markSeen(): Promise<void> {
  await repo.updateProgress({ doubleDungeonSeenAt: Date.now() })
  await useApp.getState().refresh()
}

export function DoubleDungeon() {
  const [reducedMotion] = useState(prefersReducedMotion)
  const [beatIndex, setBeatIndex] = useState(0)

  if (reducedMotion) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 overflow-y-auto bg-void p-6">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
          {BEATS.map((beat) => (
            <SystemWindow key={beat.title} title={beat.title}>
              <p className="text-sm text-ink-soft">{beat.body}</p>
            </SystemWindow>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void markSeen()}
          className="mx-auto w-full max-w-sm rounded bg-system-deep px-5 py-3 font-system text-xs text-ink uppercase"
        >
          Continue
        </button>
      </div>
    )
  }

  const beat = BEATS[beatIndex]!
  const isLast = beatIndex === BEATS.length - 1

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-void p-6">
      {/* `key` forces a fresh mount per beat; `SystemWindow` already plays
          `animate-system-in` itself on every mount, so no separate animation
          wrapper is needed here (see the file doc comment). */}
      <div key={beatIndex} className="w-full max-w-sm">
        <SystemWindow title={beat.title} strong>
          <p className="text-sm text-ink-soft">{beat.body}</p>
        </SystemWindow>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <button
          type="button"
          onClick={() => void markSeen()}
          className="font-system text-xs text-ink-faint"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => (isLast ? void markSeen() : setBeatIndex((i) => i + 1))}
          className="rounded bg-system-deep px-5 py-2 font-system text-xs text-ink uppercase"
        >
          {isLast ? 'Begin' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
