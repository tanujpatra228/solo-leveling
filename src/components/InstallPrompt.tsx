/**
 * Offers Android's install prompt at two moments rather than leaving it to
 * Chrome's own mini-infobar, which fires on its own timeline: a one-time
 * celebration once the hunter has actually cleared a gate or leveled up, and
 * a quiet recurring reminder on any later visit (docs/TODO.md "Android
 * install prompt"). `useInstallPrompt`'s `install` must run inside this
 * component's own click handler — it is the user gesture, not a derived
 * effect — see rest-timer.ts and useUiTapSound.ts for the same rule applied
 * to sound.
 *
 * iOS has no equivalent: Safari never fires `beforeinstallprompt`, so this
 * component renders nothing there. The Link screen carries the manual
 * Add-to-Home-Screen instructions instead.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import { useInstallPrompt } from '../app/useInstallPrompt'
import { shouldOfferInstallBanner, shouldOfferInstallNudge } from '../domain/install'
import { PILL_BUTTON } from './buttonStyles'
import { SystemWindow } from './SystemWindow'

export function InstallPrompt({ index }: { index?: number }) {
  const { available, install } = useInstallPrompt()
  const settings = useApp((s) => s.settings)
  const profile = useApp((s) => s.profile)
  const today = useApp((s) => s.today)
  const gatesCleared = useApp((s) => s.progress.gatesCleared)
  const level = useApp((s) => s.projection?.player.level ?? 1)
  const updateSettings = useApp((s) => s.updateSettings)
  const [busy, setBusy] = useState(false)

  const offer = (() => {
    if (!available || !profile) return null
    const now = Date.now()
    if (
      shouldOfferInstallNudge({
        nudgeSeen: settings.installNudgeSeen,
        dismissedAt: settings.installPromptDismissedAt,
        now,
        gatesCleared,
        level,
      })
    ) {
      return 'nudge' as const
    }
    if (
      shouldOfferInstallBanner({
        createdAt: profile.createdAt,
        today,
        dismissedAt: settings.installPromptDismissedAt,
        now,
      })
    ) {
      return 'banner' as const
    }
    return null
  })()

  if (!offer) return null

  async function recordDismissal() {
    await updateSettings({
      installPromptDismissedAt: Date.now(),
      installNudgeSeen: offer === 'nudge' ? true : settings.installNudgeSeen,
    })
  }

  async function handleInstall() {
    if (busy) return
    setBusy(true)
    await install()
    await recordDismissal()
    setBusy(false)
  }

  async function handleDismiss() {
    if (busy) return
    setBusy(true)
    await recordDismissal()
    setBusy(false)
  }

  return (
    <SystemWindow title="Install" index={index}>
      <div className="flex flex-col gap-2">
        <p className="font-system text-[11px] text-ink-soft">
          {offer === 'nudge'
            ? 'You are actually doing this. Installing keeps the System one tap away and working offline.'
            : 'Installing puts the System on your home screen — offline, and without a browser bar in the way.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleInstall()}
            disabled={busy}
            className={`min-h-11 border-system text-system disabled:opacity-30 ${PILL_BUTTON}`}
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            disabled={busy}
            className={`min-h-11 border-panel-edge text-ink-faint disabled:opacity-30 ${PILL_BUTTON}`}
          >
            Not now
          </button>
        </div>
      </div>
    </SystemWindow>
  )
}
