/**
 * A single help topic as its own `SystemOverlay`, not an inline expansion —
 * the earlier `<details>`-based disclosure pushed the page's own layout
 * down when opened, which read as a layout bug. Only mount this where no
 * other `SystemOverlay` can already be open (a page route, or content
 * hidden behind a summoned window's scrim while that window is open) — see
 * `ConfirmDialog.tsx`'s note on why two stacked overlays don't mix. Content
 * reached from inside an already-open summoned window (Shadow Army, Demon
 * Castle) swaps `HelpTopicBody` into that same overlay instead — see
 * `index.tsx`.
 */
import { HelpCircle } from 'lucide-react'
import type { HelpTopic } from '../content/help'
import { HelpTopicBody } from './HelpTopicBody'
import { SystemOverlay } from './SystemOverlay'

export function HelpModal({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  return (
    <SystemOverlay title={topic.title} icon={HelpCircle} onClose={onClose}>
      <HelpTopicBody topic={topic} />
    </SystemOverlay>
  )
}
