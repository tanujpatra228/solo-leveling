/**
 * Renders the Hunter License Key as a QR code for pairing a second device.
 * `qrcode` is bundled rather than dynamically imported — unlike `jsqr` on the
 * scanning side (M6 commit 5), rendering the key is the primary path here and
 * is always needed the moment this screen opens (m6-plan F2).
 */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function LicenseKeyQr({ payload }: { payload: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(payload, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [payload])

  if (!dataUrl) return null

  return (
    <img
      src={dataUrl}
      width={220}
      height={220}
      alt="QR code encoding the Hunter License Key"
      className="mx-auto rounded-none"
    />
  )
}
