/**
 * Adapters for every platform capability the browser might not give us.
 *
 * The primary environment for this app is a phone in a gym basement, and mobile
 * browsers withhold capabilities depending on context — whether the page is
 * installed, whether it is in a secure context, whether the user has granted
 * permission. A missing capability must degrade to a working app and never to a
 * thrown exception, so every one of these answers "this device cannot do that"
 * once, here, instead of at each call site.
 */

/* ------------------------------------------------------------------ */
/* Screen Wake Lock — keeps the screen on during a rest timer          */
/* ------------------------------------------------------------------ */

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

export interface WakeLock {
  readonly supported: boolean
  acquire: () => Promise<boolean>
  release: () => Promise<void>
  readonly held: boolean
}

export function createWakeLock(): WakeLock {
  const api = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
  let sentinel: WakeLockSentinelLike | null = null

  return {
    supported: api !== undefined,
    get held() {
      return sentinel !== null && !sentinel.released
    },
    async acquire() {
      if (!api) return false
      if (sentinel && !sentinel.released) return true
      try {
        sentinel = await api.request('screen')
        sentinel.addEventListener('release', () => {
          sentinel = null
        })
        return true
      } catch {
        // The browser refuses if the page is not visible. Not an error worth
        // showing anyone — the timer still runs, the screen just may sleep.
        sentinel = null
        return false
      }
    },
    async release() {
      if (!sentinel || sentinel.released) return
      try {
        await sentinel.release()
      } catch {
        // Already gone.
      }
      sentinel = null
    },
  }
}

/* ------------------------------------------------------------------ */
/* Haptics and sound                                                   */
/* ------------------------------------------------------------------ */

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers expose the method and then refuse to run it.
  }
}

function getAudioContextCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  )
}

/**
 * The System notification sound, synthesised rather than shipped as a file so
 * the app has no audio asset to cache and no autoplay-blocked media element.
 * A short two-tone chime, deliberately terse. Reserved for things worth
 * announcing — a level up, a gate cleared, a PR — never for routine taps,
 * which is what `playTapTone` below is for.
 */
export function playSystemChime(): void {
  const AudioCtor = getAudioContextCtor()
  if (!AudioCtor) return

  try {
    const ctx = new AudioCtor()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)

    for (const [frequency, at] of [
      [880, 0],
      [1320, 0.12],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency
      osc.connect(gain)
      osc.start(now + at)
      osc.stop(now + at + 0.3)
    }

    // Release the hardware once the sound has finished.
    window.setTimeout(() => void ctx.close().catch(() => {}), 800)
  } catch {
    // Audio is a nicety. Never let it break a screen.
  }
}

// One context, opened lazily on the first tap and kept alive for the rest of
// the session — a button-mashed stat allocation can fire this dozens of times
// a second, and opening/closing an AudioContext per call is the kind of thing
// that stutters on a mid-range Android. The rest-timer countdown tick shares
// it for the same reason: ten ticks in ten seconds is not rare.
let tapCtx: AudioContext | null = null

function getTapContext(): AudioContext | null {
  if (tapCtx) return tapCtx
  const AudioCtor = getAudioContextCtor()
  if (!AudioCtor) return null
  try {
    tapCtx = new AudioCtor()
    return tapCtx
  } catch {
    return null
  }
}

/**
 * The generic UI click — a single, quiet, ~40 ms blip fired by
 * `useUiTapSound` on every button and link in the app. Deliberately smaller
 * and flatter than `playSystemChime`: it has to be pleasant at the rate a
 * gate screen's rep steppers get tapped, not attention-grabbing.
 */
export function playTapTone(): void {
  const ctx = getTapContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1400
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.05)
  } catch {
    // Audio is a nicety. Never let it break a screen.
  }
}

/**
 * The rest timer's countdown tick, fired once per second for the final ten
 * seconds (`useRestTimer`, gated by `countdownUrgency`). `urgency` runs 0
 * (ten seconds out) to 1 (the second before the buzzer) and drives both
 * pitch and volume, so the countdown visibly — audibly — closes in rather
 * than ticking at one flat volume until it stops. Deliberately a different
 * timbre from `playTapTone` (sharper attack, no decay tail) so a tick never
 * reads as a stray button press, and lower-pitched than `playSystemChime`'s
 * 880-1320 Hz so the final chime still reads as the more important sound.
 */
export function playCountdownTick(urgency: number): void {
  const ctx = getTapContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const clamped = Math.min(1, Math.max(0, urgency))
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 700 + clamped * 500
    const peak = 0.09 + clamped * 0.1
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.1)
  } catch {
    // Audio is a nicety.
  }
}

/* ------------------------------------------------------------------ */
/* Install prompt                                                      */
/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
const installListeners = new Set<(available: boolean) => void>()

/**
 * Captures the install prompt so it can be offered at a moment that makes
 * sense, rather than the instant the page loads. Android fires this event; if
 * it never fires, the app simply never offers the button.
 */
export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event as BeforeInstallPromptEvent
    for (const listener of installListeners) listener(true)
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    for (const listener of installListeners) listener(false)
  })
}

export function onInstallAvailabilityChange(listener: (available: boolean) => void): () => void {
  installListeners.add(listener)
  listener(deferredInstallPrompt !== null)
  return () => installListeners.delete(listener)
}

export function canPromptInstall(): boolean {
  return deferredInstallPrompt !== null
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable'
  try {
    await deferredInstallPrompt.prompt()
    const { outcome } = await deferredInstallPrompt.userChoice
    deferredInstallPrompt = null
    for (const listener of installListeners) listener(false)
    return outcome
  } catch {
    return 'dismissed'
  }
}

/** True when running as an installed app rather than in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/* ------------------------------------------------------------------ */
/* Notifications and push                                              */
/* ------------------------------------------------------------------ */

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: string; installFirst: boolean }

/**
 * Whether this device can receive a daily quest push. On Android the answer is
 * usually yes without installing; the install-first case is reported separately
 * so the interface can tell the hunter what to do rather than failing silently.
 */
export function checkPushSupport(): PushSupport {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      reason: 'This browser has no service worker support, which push notifications require.',
      installFirst: false,
    }
  }
  if (!('PushManager' in window)) {
    return {
      supported: false,
      reason:
        'This browser does not support the Push API. On iPhone, add the app to your Home Screen first — push only works from an installed app there.',
      installFirst: !isInstalled(),
    }
  }
  if (!('Notification' in window)) {
    return {
      supported: false,
      reason: 'This browser cannot show notifications.',
      installFirst: false,
    }
  }
  return { supported: true }
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Must be called from a user gesture. Browsers reject a permission request that
 * did not come from a tap, and some of them count a rejected request against
 * you permanently.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/**
 * The VAPID public key arrives as URL-safe base64 and the Push API wants raw
 * bytes. Returns an `ArrayBuffer` rather than a typed-array view because
 * `applicationServerKey` is typed against a plain `ArrayBuffer`.
 */
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output.buffer
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  const support = checkPushSupport()
  if (!support.supported) return null

  try {
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing

    return await registration.pushManager.subscribe({
      // Chrome requires this to be true and will reject a silent subscription.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
    })
  } catch {
    return null
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true
    return await subscription.unsubscribe()
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Sharing                                                             */
/* ------------------------------------------------------------------ */

export async function shareImage(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title })
      return true
    } catch {
      // The hunter cancelled, or the target refused. Either way, fall through.
      return false
    }
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Camera, for System Link QR pairing                                  */
/* ------------------------------------------------------------------ */

export interface CameraStream {
  stream: MediaStream
  stop: () => void
}

export async function openRearCamera(): Promise<CameraStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    return {
      stream,
      stop: () => {
        for (const track of stream.getTracks()) track.stop()
      },
    }
  } catch {
    return null
  }
}

/**
 * Native barcode detection where it exists, which on Android Chrome it does.
 * Returns null when unavailable so the caller can fall back to the bundled
 * JavaScript decoder rather than losing the feature.
 */
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

export function createNativeQrDetector(): BarcodeDetectorLike | null {
  const Ctor = (
    window as Window & {
      BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
    }
  ).BarcodeDetector
  if (!Ctor) return null
  try {
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Online status                                                       */
/* ------------------------------------------------------------------ */

export function onConnectivityChange(listener: (online: boolean) => void): () => void {
  const handleOnline = () => listener(true)
  const handleOffline = () => listener(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
