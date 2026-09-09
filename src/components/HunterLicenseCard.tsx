/**
 * The Hunter License: a shareable PNG card, the only canvas rendering in the
 * app (m7-plan F4). Drawn at the real device pixel ratio so a card shared
 * from a 3x phone screen is not soft — the canvas's backing store is scaled
 * by `devicePixelRatio` while its CSS size stays the logical size.
 *
 * Shows `identity.hunterId` — the SHA-256 of the Hunter Secret, safe to
 * display by construction (see `sync/identity.ts`) — never the license key
 * itself, which is the pairing credential.
 */
import { useEffect, useRef, useState } from 'react'
import type { Rank, StatBlock } from '../domain/types'
import { shareImage } from '../platform/capabilities'
import { SystemPanel } from './SystemPanel'

const RANK_COLOR: Record<Rank, string> = {
  E: '#93a9c9',
  D: '#4ade80',
  C: '#38bdf8',
  B: '#7dd3fc',
  A: '#fbbf24',
  S: '#fcd34d',
}

const CARD_WIDTH = 340
const CARD_HEIGHT = 200
const STAT_ORDER: readonly (keyof StatBlock)[] = ['STR', 'VIT', 'AGI', 'INT', 'PER']

export interface HunterLicenseCardProps {
  hunterId: string
  rank: Rank | null
  level: number
  hunterClassLabel: string
  total: StatBlock
  titlesHeld: number
  gatesCleared: number
  awakenedAt: number | null
}

function drawCard(ctx: CanvasRenderingContext2D, dpr: number, data: HunterLicenseCardProps) {
  const w = CARD_WIDTH
  const h = CARD_HEIGHT
  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#05070f')
  bg.addColorStop(1, '#0d1526')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const rankColor = data.rank ? RANK_COLOR[data.rank] : '#7b90b3'
  ctx.strokeStyle = rankColor
  ctx.lineWidth = 2
  ctx.strokeRect(4, 4, w - 8, h - 8)

  ctx.fillStyle = '#7dd3fc'
  ctx.font = '600 11px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText('HUNTER LICENSE', 18, 16)

  ctx.fillStyle = '#7b90b3'
  ctx.font = '10px monospace'
  ctx.fillText(`ID ${data.hunterId.slice(0, 16).toUpperCase()}`, 18, h - 32)
  ctx.fillText(
    data.awakenedAt ? `AWAKENED ${new Date(data.awakenedAt).toLocaleDateString()}` : 'NOT YET AWAKENED',
    18,
    h - 20,
  )

  ctx.strokeStyle = rankColor
  ctx.lineWidth = 1.5
  ctx.strokeRect(18, 40, 60, 32)
  ctx.fillStyle = rankColor
  ctx.font = '700 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(data.rank ?? '?', 48, 47)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#dbeafe'
  ctx.font = '700 20px monospace'
  ctx.fillText(`LV ${data.level}`, 92, 42)
  ctx.fillStyle = '#93a9c9'
  ctx.font = '11px monospace'
  ctx.fillText(data.hunterClassLabel.toUpperCase(), 92, 66)

  const statsTop = 92
  ctx.font = '10px monospace'
  STAT_ORDER.forEach((key, i) => {
    const x = 18 + i * 62
    ctx.fillStyle = '#7b90b3'
    ctx.fillText(key, x, statsTop)
    ctx.fillStyle = '#dbeafe'
    ctx.font = '700 14px monospace'
    ctx.fillText(String(data.total[key]), x, statsTop + 14)
    ctx.font = '10px monospace'
  })

  ctx.fillStyle = '#fcd34d'
  ctx.font = '10px monospace'
  ctx.fillText(`${data.titlesHeld} TITLES HELD`, 18, 132)
  ctx.fillText(`${data.gatesCleared} GATES CLEARED`, 18, 146)
}

export function HunterLicenseCard(props: HunterLicenseCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'sharing' | 'shared' | 'downloaded' | 'failed'>('idle')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CARD_WIDTH * dpr
    canvas.height = CARD_HEIGHT * dpr
    canvas.style.width = `${CARD_WIDTH}px`
    canvas.style.height = `${CARD_HEIGHT}px`
    const ctx = canvas.getContext('2d')
    if (ctx) drawCard(ctx, dpr, props)
  }, [
    props.hunterId,
    props.rank,
    props.level,
    props.hunterClassLabel,
    props.total,
    props.titlesHeld,
    props.gatesCleared,
    props.awakenedAt,
  ])

  async function handleShare() {
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus('sharing')
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      setStatus('failed')
      return
    }
    const shared = await shareImage(blob, 'hunter-license.png', 'Hunter License')
    if (shared) {
      setStatus('shared')
      return
    }
    // Web Share is unsupported, or the hunter cancelled — either way, a
    // download is the fallback rather than a dead end (m7-plan F4).
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hunter-license.png'
    link.click()
    URL.revokeObjectURL(url)
    setStatus('downloaded')
  }

  return (
    <SystemPanel className="mt-3 flex flex-col items-center gap-2">
      <p className="self-start font-system text-[11px] tracking-[0.12em] text-system uppercase">
        Hunter License
      </p>
      <canvas ref={canvasRef} className="rounded" />
      <button
        type="button"
        onClick={() => void handleShare()}
        className="font-system text-xs text-system-glow underline"
      >
        {status === 'sharing' ? 'Sharing…' : 'Share License'}
      </button>
      {status === 'downloaded' ? (
        <p className="text-xs text-ink-faint">Sharing isn't available here — saved as an image instead.</p>
      ) : null}
      {status === 'failed' ? <p className="text-xs text-danger">Could not render the card.</p> : null}
    </SystemPanel>
  )
}
