/**
 * The bridge's only script, loaded at /bridge (see public/_headers, which
 * detaches the site-wide CSP for this one path and sets one that only lets
 * Mana Plate frame it) and embedded by Mana Plate in a hidden iframe for its
 * setup prefill (mana-plate docs/plan.md §2, docs/m1-plan.md §9.1).
 *
 * Opening /bridge directly, outside a frame, must do nothing: there is
 * nothing to show, and no listener should be waiting for a message that can
 * never legitimately arrive outside a frame.
 */
import { readForManaPlate } from './read'

if (window.parent !== window) {
  const ALLOWED_ORIGINS = new Set<string>(['https://mana-plate.tanujpatra228.workers.dev'])
  // Matches Mana Plate's own dev server (mana-plate docs/m1-plan.md §11.1's
  // `server.port: 5174`). Gated on the hostname, not on DEV mode, so a
  // deployed page can never be tricked into widening the allowlist.
  if (location.hostname === 'localhost') {
    ALLOWED_ORIGINS.add('http://localhost:5174')
  }

  window.addEventListener('message', (event: MessageEvent) => {
    if (!ALLOWED_ORIGINS.has(event.origin)) return
    if ((event.data as { type?: unknown } | null)?.type !== 'mana-plate:profile-request') return

    // The requester, exactly as the browser attributes the message — never a
    // target origin read out of the message itself, which a forged message
    // could point anywhere.
    const source = event.source as Window | null
    if (!source) return
    const replyOrigin = event.origin

    void readForManaPlate(indexedDB).then((reply) => {
      source.postMessage(reply, replyOrigin)
    })
  })
}
