/**
 * Live QR scanning for pairing a second device (m6-plan commit 5).
 *
 * Prefers `BarcodeDetector`, which Chrome on Android — the only supported
 * platform — has. `jsqr` is dynamically imported only when that native
 * detector is absent, so the platform that matters never pays for a decoder
 * it has no use for (F2).
 */
import { useEffect, useRef, useState } from 'react'
import { createNativeQrDetector, openRearCamera } from '../platform/capabilities'

export interface QrScannerProps {
  onDecode: (rawValue: string) => void
  onCancel: () => void
}

export function QrScanner({ onDecode, onCancel }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDecodeRef = useRef(onDecode)
  onDecodeRef.current = onDecode
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let stopCamera: (() => void) | null = null
    let frameHandle: number | null = null

    async function start() {
      const camera = await openRearCamera()
      if (cancelled) {
        camera?.stop()
        return
      }
      if (!camera) {
        setError('No camera available on this device.')
        return
      }
      stopCamera = camera.stop

      const video = videoRef.current
      if (!video) return
      video.srcObject = camera.stream
      await video.play().catch(() => {})

      const detector = createNativeQrDetector()
      // Only reached on a browser without BarcodeDetector — never Android
      // Chrome, which is the one platform this app targets (F2).
      const jsQR = detector ? null : (await import('jsqr')).default
      const canvas = document.createElement('canvas')

      const tick = () => {
        if (cancelled) return
        void scanFrame(video, detector, jsQR, canvas).then((rawValue) => {
          if (cancelled) return
          if (rawValue) {
            onDecodeRef.current(rawValue)
            return
          }
          frameHandle = requestAnimationFrame(tick)
        })
      }
      frameHandle = requestAnimationFrame(tick)
    }

    void start()

    return () => {
      cancelled = true
      if (frameHandle !== null) cancelAnimationFrame(frameHandle)
      stopCamera?.()
    }
  }, [])

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-danger">{error}</p>
        <button
          type="button"
          onClick={onCancel}
          className="self-start rounded border border-panel-edge px-3 py-1.5 font-system text-[10px] text-ink-faint uppercase"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} muted playsInline className="w-full border border-panel-edge" />
      <button
        type="button"
        onClick={onCancel}
        className="self-start rounded border border-panel-edge px-3 py-1.5 font-system text-[10px] text-ink-faint uppercase"
      >
        Cancel
      </button>
    </div>
  )
}

/** One decode attempt against the current video frame. Null means "no code
 *  in this frame yet", not an error — the caller just tries the next one. */
async function scanFrame(
  video: HTMLVideoElement,
  detector: ReturnType<typeof createNativeQrDetector>,
  jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) return null

  try {
    if (detector) {
      const results = await detector.detect(video)
      return results[0]?.rawValue ?? null
    }
    if (jsQR) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      return jsQR(frame.data, frame.width, frame.height)?.data ?? null
    }
  } catch {
    // A single unreadable frame is routine, not a failure — the video keeps
    // rolling and the next tick tries again.
  }
  return null
}
