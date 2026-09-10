/**
 * The central Help window: every topic from `src/content/help.ts`, always
 * expanded — unlike `HelpDisclosure`'s inline collapsed form, a hunter who
 * opened this from the summon list came to read, not to be asked first.
 */
import { HELP_TOPICS } from '../content/help'
import { SystemPanel } from './SystemPanel'

export function HelpPanel() {
  return (
    <div className="flex flex-col gap-3">
      {Object.values(HELP_TOPICS).map((topic) => (
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
