/**
 * The central Help window: every topic from `src/content/help.ts`, always
 * expanded — unlike `HelpDisclosure`'s inline collapsed form, a hunter who
 * opened this from the summon list came to read, not to be asked first.
 */
import { HELP_TOPICS } from '../content/help'
import { HelpTopicList } from './HelpTopicList'

export function HelpPanel() {
  return <HelpTopicList topics={Object.values(HELP_TOPICS)} />
}
