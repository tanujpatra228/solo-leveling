/**
 * The "?" trigger for a help topic. Unlike the earlier `HelpDisclosure`,
 * this never expands in place — it only calls `onClick`, and the caller
 * decides whether that opens a `HelpModal` or swaps `HelpTopicBody` into an
 * already-open summoned window (see `index.tsx`).
 */
import { HelpCircle } from 'lucide-react'
import { SystemIcon } from './SystemIcon'

export function HelpButton({ topicTitle, onClick }: { topicTitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`What is ${topicTitle}?`}
      className="flex min-h-11 min-w-11 items-center justify-center"
    >
      <SystemIcon icon={HelpCircle} tone="faint" size={16} glow="none" />
    </button>
  )
}
