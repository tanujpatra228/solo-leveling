/**
 * The Hunter License: a shareable PNG card (m11-plan). The one deliberately
 * un-System surface in the app — near-white, serif, rounded — because every
 * other surface is the dark holographic System and this is a laminated
 * document the Hunter's Association issued, meant to leave the app and be
 * read on a stranger's screen (m11-plan §1). The rounded corners are the
 * exception to the app's square-corner rule, not a lapse of it — see
 * `docs/system-visuals-plan.md` §2.1.
 *
 * All field derivation lives in `domain/license.ts`; this file only paints.
 * Shows `identity.hunterId` — the SHA-256 of the Hunter Secret, safe to
 * display by construction (see `sync/identity.ts`) — never the license key
 * itself, which is the pairing credential, and never a body measurement, sex
 * or birth year (m11-plan §6).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { licenseAriaLabel, licenseFields, type LicenseFields } from '../domain/license'
import type { HunterClass, Rank, StatBlock } from '../domain/types'
import { shareImage } from '../platform/capabilities'
import { SystemPanel } from './SystemPanel'

const CARD_WIDTH = 384
const CARD_HEIGHT = 240
const CORNER_RADIUS = 10
/** Fixed regardless of the display (m11-plan §8.1) — a desktop share at DPR 1
 * was as soft as the logical size; the on-screen preview still uses DPR. */
const SHARE_SCALE = 3

const SERIF_STACK = "Georgia, 'Times New Roman', serif"
const SANS_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const INK_NAVY = '#1e3350'
const INK_NAVY_SOFT = '#4b6482'
const CARD_BODY = '#f7f8fb'
const HAIRLINE = '#c7d2e0'
const EMPTY_SLOT_INK = '#6b7a92'

/** The reference's dark rank palette (`#7dd3fc`, `#fcd34d`) falls under 2:1 on
 * a near-white card — a second table, tuned against `CARD_BODY`, not a reuse
 * (m11-plan §5). Ratios are estimates; the share test in the plan's §11
 * checklist is what actually confirms them. */
const RANK_INK: Record<Rank, string> = {
  E: '#334155', // slate 700, ~7:1
  D: '#15803d', // green 700, ~4.9:1
  C: '#0369a1', // sky 700, ~5.7:1
  B: '#0e7490', // cyan 700, ~4.9:1
  A: '#b45309', // amber 700, ~4.8:1 — plus a thin amber keyline (below)
  S: '#1e3350', // navy on the gold foil plate — foil is what solves S, not a brighter ink
}
const UNRANKED_INK = '#64748b'
const GOLD_FOIL = '#d9b649'
const GOLD_FOIL_EDGE = '#a9822f'

export interface HunterLicenseCardProps {
  hunterId: string
  hunterName: string | undefined
  rank: Rank | null
  level: number
  hunterClass: HunterClass
  total: StatBlock
  /** Newest first — see `state.ts`'s `earnedTitleIds`. */
  earnedTitleIds: readonly string[]
  gatesCleared: number
  awakenedAt: number | null
  onRename: (name: string) => void
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Deterministic, stable across renders, leaks nothing beyond `hunterId`
 * itself, which is already public by construction (m11-plan §6). Packed to
 * fill `availableWidth` rather than a fixed bar count — the right-edge band
 * is only 24 px wide, and a fixed count sized for a wider barcode mostly ran
 * off the edge and drew nothing.
 */
function barcodeWidths(hunterId: string, availableWidth: number): number[] {
  const widths: number[] = []
  let used = 0
  let i = 0
  while (used < availableWidth) {
    const code = hunterId.charCodeAt(i % hunterId.length) || 48
    const bar = 1 + (code % 2)
    if (used + bar > availableWidth) break
    widths.push(bar)
    used += bar + 1
    i += 1
  }
  return widths
}

function drawCard(ctx: CanvasRenderingContext2D, scale: number, fields: LicenseFields, data: HunterLicenseCardProps) {
  const w = CARD_WIDTH
  const h = CARD_HEIGHT
  ctx.resetTransform()
  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, w, h)
  ctx.textBaseline = 'alphabetic'

  const rankInk = data.rank ? RANK_INK[data.rank] : UNRANKED_INK

  // The card body, clipped to its own rounded rect so every fill below stays
  // inside it — the rounding the reference's plastic card has and every
  // System surface in this app deliberately does not (m11-plan §1).
  ctx.save()
  roundRectPath(ctx, 0, 0, w, h, CORNER_RADIUS)
  ctx.clip()
  ctx.fillStyle = CARD_BODY
  ctx.fillRect(0, 0, w, h)

  // The right-edge navy band, holding the barcode — one of the two
  // "structural blocks" the reference frames the card with (m11-plan §2).
  const bandX = w - 24
  ctx.fillStyle = INK_NAVY
  ctx.fillRect(bandX, 0, 24, h)

  // The top-left wedge, the other structural block — a corner accent, not a
  // shape that competes with the masthead text sitting just past it.
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(22, 0)
  ctx.lineTo(0, 18)
  ctx.closePath()
  ctx.fill()

  // Masthead
  ctx.fillStyle = INK_NAVY
  ctx.font = `700 15px ${SERIF_STACK}`
  ctx.fillText("Hunter's License", 16, 22)

  ctx.font = `700 9px ${SERIF_STACK}`
  ctx.textAlign = 'right'
  ctx.fillText('THE SYSTEM', bandX - 12, 13)
  ctx.font = `7px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY_SOFT
  ctx.fillText('ISSUING AUTHORITY', bandX - 12, 24)
  ctx.textAlign = 'left'

  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 36.5)
  ctx.lineTo(bandX, 36.5)
  ctx.stroke()

  // The level plate — the anime's Status window draws level exactly this
  // way, so the two surfaces rhyme even though this one is not the System
  // (m11-plan §3).
  const plateX = 20
  const plateY = 44
  const plateW = 96
  const plateH = 128
  roundRectPath(ctx, plateX, plateY, plateW, plateH, 4)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = INK_NAVY
  ctx.fillRect(plateX, plateY, plateW, plateH)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 6
  for (let x = plateX - plateH; x < plateX + plateW; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, plateY + plateH)
    ctx.lineTo(x + plateH, plateY)
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = '#e6edf7'
  ctx.font = `700 42px ${SANS_STACK}`
  ctx.textAlign = 'center'
  ctx.fillText(String(data.level), plateX + plateW / 2, plateY + plateH / 2 + 12)
  ctx.font = `700 10px ${SANS_STACK}`
  ctx.fillStyle = '#9db3d1'
  ctx.fillText('LEVEL', plateX + plateW / 2, plateY + plateH - 12)
  ctx.textAlign = 'left'

  // The field column: License No. and Rank share a row, Name next, Category
  // fills the rest (m11-plan §5's geometry).
  const colX = 132
  const colRight = bandX - 12

  ctx.font = `600 8px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY_SOFT
  ctx.fillText('LICENSE NO.', colX, 48)
  ctx.font = `700 12px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY
  ctx.fillText(fields.documentNumber, colX, 62)

  ctx.font = `600 8px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY_SOFT
  ctx.textAlign = 'right'
  ctx.fillText('RANK', colRight - 34, 48)
  if (data.rank === 'S') {
    ctx.fillStyle = GOLD_FOIL
    roundRectPath(ctx, colRight - 34, 40, 34, 26, 3)
    ctx.fill()
    ctx.strokeStyle = GOLD_FOIL_EDGE
    ctx.lineWidth = 1
    ctx.stroke()
  } else if (data.rank === 'A') {
    ctx.strokeStyle = rankInk
    ctx.lineWidth = 1
    roundRectPath(ctx, colRight - 34, 40, 34, 26, 3)
    ctx.stroke()
  }
  ctx.fillStyle = rankInk
  ctx.textAlign = 'center'
  if (fields.rankLetter.length === 1) {
    // The loudest glyph on the card (m11-plan §2) — only when there is one.
    ctx.font = `700 22px ${SANS_STACK}`
    ctx.fillText(fields.rankLetter, colRight - 17, 60)
  } else {
    // "UNRANKED" states its answer explicitly (rule 13) rather than falling
    // through to a phantom letter — too long for the badge's big-letter
    // size, so it drops to a small caption instead of truncating to "UN"
    // and reading as a rank that does not exist.
    ctx.font = `700 8px ${SANS_STACK}`
    ctx.fillText(fields.rankLetter, colRight - 17, 55)
  }
  ctx.textAlign = 'left'

  ctx.font = `600 8px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY_SOFT
  ctx.fillText('NAME', colX, 80)
  ctx.font = `700 13px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY
  ctx.fillText(fields.name, colX, 94)

  // The Category grid — the best idea in the reference (m11-plan §4): eight
  // empty slots read `-- --` beside a filled one, telling a progression
  // story in one glance rather than hiding what's missing.
  ctx.font = `600 8px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY_SOFT
  ctx.fillText('CATEGORY', colX, 106)

  const gridY = 110
  const gridH = 68
  const gridW = colRight - colX
  const cellW = gridW / 3
  const cellH = gridH / 3
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const cx = colX + col * cellW
      const cy = gridY + row * cellH
      ctx.strokeRect(Math.round(cx) + 0.5, Math.round(cy) + 0.5, cellW, cellH)
      const slot = fields.categorySlots[row * 3 + col]!
      ctx.fillStyle = slot === '-- --' ? EMPTY_SLOT_INK : INK_NAVY
      ctx.font = row === 0 && col === 0 ? `700 9px ${SANS_STACK}` : `8px ${SANS_STACK}`
      ctx.fillText(slot, cx + 5, cy + cellH / 2 + 3)
    }
  }

  // The foot: gold chip, stat band, certification line — everything today's
  // dark card already showed, kept at a weight that does not fight the
  // document (m11-plan §3).
  const footY = h - 56
  ctx.fillStyle = GOLD_FOIL
  roundRectPath(ctx, 16, footY + 32, 32, 18, 2)
  ctx.fill()
  ctx.strokeStyle = GOLD_FOIL_EDGE
  ctx.lineWidth = 0.75
  for (const dy of [6, 10, 14]) {
    ctx.beginPath()
    ctx.moveTo(16, footY + 32 + dy)
    ctx.lineTo(48, footY + 32 + dy)
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.font = `600 8px ${SANS_STACK}`
  ctx.fillStyle = INK_NAVY_SOFT
  ctx.fillText(fields.statBand, bandX / 2, footY + 10)

  ctx.font = `italic 9px ${SERIF_STACK}`
  ctx.fillStyle = INK_NAVY
  ctx.fillText('This individual has been certified to work as a hunter by the System.', bandX / 2, footY + 26)

  if (fields.issuedAt !== null) {
    ctx.font = `7px ${SANS_STACK}`
    ctx.fillStyle = INK_NAVY_SOFT
    ctx.fillText(`ISSUED ${new Date(fields.issuedAt).toLocaleDateString()}`, bandX / 2, footY + 38)
  }
  ctx.textAlign = 'left'

  // The 1 px navy keyline the card body needs so it never bleeds into a
  // white chat bubble (m11-plan §5).
  ctx.restore()
  roundRectPath(ctx, 1, 1, w - 2, h - 2, CORNER_RADIUS - 1)
  ctx.strokeStyle = INK_NAVY
  ctx.lineWidth = 1
  ctx.stroke()

  // The barcode, in the right-edge band — bar widths derive from `hunterId`,
  // already public by construction, and encode nothing further (m11-plan §6:
  // never a QR here, only ornament that leaks nothing new).
  const barMargin = 4
  let bx = bandX + barMargin
  const barTop = 24
  const barBottom = h - 24
  const widths = barcodeWidths(data.hunterId, 24 - barMargin * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  for (const bw of widths) {
    if (bx + bw > w - barMargin) break
    ctx.fillRect(bx, barTop, bw, barBottom - barTop)
    bx += bw + 1
  }
}

export function HunterLicenseCard(props: HunterLicenseCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'sharing' | 'shared' | 'downloaded' | 'failed'>('idle')
  const [renameDraft, setRenameDraft] = useState(props.hunterName ?? '')
  const [renamed, setRenamed] = useState(false)

  const fields = useMemo(
    () =>
      licenseFields({
        hunterId: props.hunterId,
        hunterName: props.hunterName,
        rank: props.rank,
        hunterClass: props.hunterClass,
        earnedTitleIds: props.earnedTitleIds,
        level: props.level,
        total: props.total,
        gatesCleared: props.gatesCleared,
        awakenedAt: props.awakenedAt,
      }),
    [
      props.hunterId,
      props.hunterName,
      props.rank,
      props.hunterClass,
      // Joined rather than the array itself — an id list rebuilt with the
      // same contents on an unrelated `refresh()` must not read as changed.
      props.earnedTitleIds.join(','),
      props.level,
      // Individual stats, not `props.total` (m11-plan §8.4): `recompute()`
      // hands back a new `total` object on every unrelated projection
      // change, and depending on the object itself redrew the card for it.
      props.total.STR,
      props.total.VIT,
      props.total.AGI,
      props.total.INT,
      props.total.PER,
      props.gatesCleared,
      props.awakenedAt,
    ],
  )
  const ariaLabel = useMemo(() => licenseAriaLabel(fields), [fields])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    function paint() {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = CARD_WIDTH * dpr
      canvas.height = CARD_HEIGHT * dpr
      canvas.style.width = `${CARD_WIDTH}px`
      canvas.style.height = `${CARD_HEIGHT}px`
      const ctx = canvas.getContext('2d')
      if (ctx) drawCard(ctx, dpr, fields, props)
    }

    // The redesign's masthead is serif, which — unlike the old card's
    // monospace, always resolved — can still be loading on first paint.
    // `fonts.ready` before drawing, and a redraw if the set changes under us.
    void document.fonts.ready.then(() => {
      if (!cancelled) paint()
    })
    paint()
    document.fonts.addEventListener('loadingdone', paint)
    return () => {
      cancelled = true
      document.fonts.removeEventListener('loadingdone', paint)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  async function renderShareBlob(): Promise<Blob | null> {
    await document.fonts.ready
    const offscreen = document.createElement('canvas')
    offscreen.width = CARD_WIDTH * SHARE_SCALE
    offscreen.height = CARD_HEIGHT * SHARE_SCALE
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    drawCard(ctx, SHARE_SCALE, fields, props)
    return new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'))
  }

  async function handleShare() {
    setStatus('sharing')
    const blob = await renderShareBlob()
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

  function handleRename() {
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === props.hunterName) return
    props.onRename(trimmed)
    setRenamed(true)
  }

  return (
    <SystemPanel className="flex flex-col items-center gap-2">
      {/* `role="img"` plus an `aria-label` built from the same `licenseFields`
          call the canvas draws from (m11-plan §8.3) — a `<canvas>` with
          neither is invisible to a screen reader, and deriving the label
          separately would let the two drift apart. */}
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="rounded-[10px]" />
      <div className="flex w-full flex-col gap-1">
        <label className="flex items-center gap-2">
          <span className="font-system text-[10px] tracking-[0.1em] text-ink-faint uppercase">Rename</span>
          <input
            type="text"
            maxLength={40}
            value={renameDraft}
            onChange={(event) => {
              setRenameDraft(event.target.value)
              setRenamed(false)
            }}
            className="min-w-0 flex-1 rounded border border-panel-edge bg-void-soft px-2 py-1 text-sm text-ink"
          />
          <button
            type="button"
            onClick={handleRename}
            disabled={!renameDraft.trim() || renameDraft.trim() === props.hunterName}
            className="font-system text-[10px] text-system-glow uppercase disabled:opacity-30"
          >
            Save
          </button>
        </label>
        {renamed ? <p className="text-xs text-good">Saved.</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void handleShare()}
        className="font-system text-xs text-system-glow underline"
      >
        {status === 'sharing' ? 'Sharing…' : 'Issue License'}
      </button>
      {status === 'downloaded' ? (
        <p className="text-xs text-ink-faint">Sharing isn't available here — saved as an image instead.</p>
      ) : null}
      {status === 'failed' ? <p className="text-xs text-danger">Could not render the card.</p> : null}
    </SystemPanel>
  )
}
