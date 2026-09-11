/**
 * A help topic's paragraphs (`src/content/help.ts`), shared between
 * `HelpModal` (a standalone popup) and the in-place swap `index.tsx` does
 * inside an already-open summoned window — same body markup either way.
 */
import type { HelpTopic } from '../content/help'

export function HelpTopicBody({ topic }: { topic: HelpTopic }) {
  return (
    <div className="flex flex-col gap-3">
      {topic.body.map((line, index) => (
        <p key={index} className="text-sm text-ink-soft">
          {line}
        </p>
      ))}
    </div>
  )
}
