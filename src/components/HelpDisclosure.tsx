/**
 * A "?" disclosure for in-place help text (`src/content/help.ts`). Plain
 * `<details>`/`<summary>` rather than a `SystemOverlay` — a second overlay
 * nested inside one already open would fight the one-overlay-at-a-time rule
 * (index.tsx: a pending message takes the single overlay slot over a
 * summoned window), and a few lines of copy do not need a dialog.
 */
import { HelpCircle } from 'lucide-react'
import type { HelpTopic } from '../content/help'
import { SystemIcon } from './SystemIcon'

export function HelpDisclosure({ topic }: { topic: HelpTopic }) {
  return (
    <details className="group w-full">
      {/* `justify-end` on the summary itself, not a wrapper — the caller can
          drop this into any row without knowing it needs to right-align it. */}
      <summary
        aria-label={`What is ${topic.title}?`}
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-end [&::-webkit-details-marker]:hidden"
      >
        <SystemIcon icon={HelpCircle} tone="faint" size={16} glow="none" />
      </summary>
      <div className="mt-1 flex flex-col gap-1.5 border-t border-panel-edge/60 pt-2">
        {topic.body.map((line, index) => (
          <p key={index} className="text-xs text-ink-soft">
            {line}
          </p>
        ))}
      </div>
    </details>
  )
}
