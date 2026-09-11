/**
 * A blocking Yes/No prompt in front of an action that spends a limited
 * resource (gold, a rest token) or changes state with no button anywhere
 * to undo it. Built on `SystemOverlay` rather than the browser's native
 * `confirm()` so the buttons carry their own labels ("Revoke", "Spend
 * token") instead of a generic OK/Cancel.
 *
 * Only ever mount this where no other `SystemOverlay` can be open at the
 * same time (a page route, or content that is itself hidden behind a
 * summoned window's scrim while that window is open) — two overlays each
 * registering their own `window` Escape listener would both fire on one
 * keypress, closing the outer one along with this. The System Shop, which
 * lives inside a summoned window, uses an inline confirm row instead for
 * exactly this reason (see `ShopPanel.tsx`).
 */
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './buttonStyles'
import { SystemOverlay } from './SystemOverlay'

export interface ConfirmDialogProps {
  title: string
  icon?: LucideIcon
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  icon = AlertTriangle,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <SystemOverlay title={title} icon={icon} iconTone="warn" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">{message}</p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onConfirm} className={PRIMARY_BUTTON}>
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </SystemOverlay>
  )
}
