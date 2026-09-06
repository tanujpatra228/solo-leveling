/**
 * The Hunter License Key screen — System Link setup (m6-plan commit 4).
 *
 * The loss warning comes first, before the key or anything else on the
 * screen: there is no account and no password reset, so a hunter needs to
 * see the stakes before being shown the thing worth protecting (F4).
 */
import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { LicenseKeyQr } from '../../components/LicenseKeyQr'
import { SystemPanel } from '../../components/SystemPanel'
import { SystemWindow } from '../../components/SystemWindow'
import { formatLicenseKey, pairingPayload } from '../../sync/identity'
import type { SyncStatus } from '../state'
import { useApp } from '../state'
import { rootRoute } from './root'

export const linkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/link',
  component: LinkScreen,
})

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: 'Not yet synced',
  syncing: 'Syncing…',
  ok: 'Up to date',
  failed: 'Sync failed. Will retry on its own.',
  offline: 'Offline. Will catch up when reconnected.',
}

/** "3 min ago", not a raw timestamp — this is a status line, not a log. */
function formatSyncedAt(at: number | null): string {
  if (at === null) return 'never'
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(at).toLocaleDateString()
}

function LinkScreen() {
  const identity = useApp((s) => s.identity)
  const settings = useApp((s) => s.settings)
  const syncStatus = useApp((s) => s.syncStatus)
  const lastSyncedAt = useApp((s) => s.lastSyncedAt)
  const updateSettings = useApp((s) => s.updateSettings)
  const syncNow = useApp((s) => s.syncNow)
  const forgetMirror = useApp((s) => s.forgetMirror)
  const [forgetting, setForgetting] = useState(false)
  const [forgotten, setForgotten] = useState(false)

  // Always set by the time this route is reachable — `load()` mints it
  // before `ready` flips true. The guard is for the type, not the runtime.
  if (!identity) return null

  async function toggleSync() {
    await updateSettings({ syncEnabled: !settings.syncEnabled })
  }

  async function forget() {
    if (forgetting) return
    const confirmed = window.confirm(
      'Forget this mirror? Every row it holds for this key is deleted from the server. ' +
        'Nothing on this device changes — your log, your level and your stats are untouched.',
    )
    if (!confirmed) return

    setForgetting(true)
    const ok = await forgetMirror()
    setForgetting(false)
    setForgotten(ok)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <SystemWindow title="System Link" strong>
        <p className="text-sm text-danger">
          This key is the only way back to your mirrored history. There is no account and no
          password reset — lose the key, and the mirror is gone with it. Your training log on this
          device is never at risk: everything below only touches the second copy kept on the
          server.
        </p>
      </SystemWindow>

      <SystemWindow title="Hunter License Key">
        <p className="text-center font-system text-lg tracking-[0.15em] text-system">
          {formatLicenseKey(identity.licenseKey)}
        </p>
        <div className="mt-3">
          <LicenseKeyQr payload={pairingPayload(identity.licenseKey)} />
        </div>
        <p className="mt-3 text-center text-xs text-ink-faint">
          Scan this on a second device to pair it to the same log.
        </p>
      </SystemWindow>

      <SystemWindow title="Sync">
        <SystemPanel className="flex items-center justify-between">
          <span className="text-sm text-ink">Sync to the mirror</span>
          <button
            type="button"
            onClick={() => void toggleSync()}
            className={`rounded-full border px-3 py-1 font-system text-[10px] uppercase ${
              settings.syncEnabled ? 'border-system text-system' : 'border-panel-edge text-ink-faint'
            }`}
          >
            {settings.syncEnabled ? 'On' : 'Off'}
          </button>
        </SystemPanel>

        {settings.syncEnabled ? (
          <SystemPanel className="mt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between font-system text-[10px] text-ink-faint uppercase">
              <span>{STATUS_LABEL[syncStatus]}</span>
              <span>last synced {formatSyncedAt(lastSyncedAt)}</span>
            </div>
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={syncStatus === 'syncing'}
              className="self-start rounded border border-panel-edge px-3 py-1.5 font-system text-[10px] text-ink-faint uppercase disabled:opacity-30"
            >
              Sync now
            </button>
          </SystemPanel>
        ) : null}
      </SystemWindow>

      <SystemWindow title="Forget the mirror">
        <SystemPanel className="flex flex-col gap-2">
          <p className="text-xs text-ink-soft">
            Deletes every row this key has mirrored on the server. Nothing on this device changes —
            your level, your log and your stats stay exactly as they are.
          </p>
          <button
            type="button"
            onClick={() => void forget()}
            disabled={forgetting}
            className="self-start rounded border border-danger/60 px-3 py-1.5 font-system text-[10px] text-danger uppercase disabled:opacity-30"
          >
            Forget the mirror
          </button>
          {forgotten ? <p className="text-xs text-good">Mirror forgotten.</p> : null}
        </SystemPanel>
      </SystemWindow>
    </div>
  )
}
