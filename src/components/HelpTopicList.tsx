/**
 * Several help topics stacked as labelled sections in one place — the body
 * `HelpPanel` (every topic) and the Status Window's own help button (a
 * chosen few) both render, so the block markup has one home.
 */
import { SystemPanel } from './SystemPanel'
import type { HelpTopic } from '../content/help'

export function HelpTopicList({ topics }: { topics: readonly HelpTopic[] }) {
  return (
    <div className="flex flex-col gap-3">
      {topics.map((topic) => (
        <SystemPanel key={topic.title} boxed className="flex flex-col gap-2 p-3">
          <p className="font-system text-[11px] tracking-[0.12em] text-system uppercase">{topic.title}</p>
          {topic.body.map((line, index) => (
            <p key={index} className="text-xs text-ink-soft">
              {line}
            </p>
          ))}
        </SystemPanel>
      ))}
    </div>
  )
}
