/**
 * The central Help window: every topic from `src/content/help.ts`, always
 * expanded — unlike `HelpDisclosure`'s inline collapsed form, a hunter who
 * opened this from the summon list came to read, not to be asked first.
 *
 * Fatigue is left out — it already shows in the Status Window's own "?"
 * (index.tsx), and this window's list still doubles as its topic archive so
 * a repeat reading of the same copy wouldn't add anything here.
 */
import { HELP_TOPICS } from '../content/help'
import { HelpTopicList } from './HelpTopicList'

/** Exported so the summon row's own topic count (index.tsx) never drifts from what actually renders here. */
export const HELP_PANEL_TOPICS = [HELP_TOPICS.leveling, HELP_TOPICS.army, HELP_TOPICS.castle]

export function HelpPanel() {
  return <HelpTopicList topics={HELP_PANEL_TOPICS} />
}
