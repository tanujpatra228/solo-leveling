/**
 * Generates the PWA icons with no dependencies.
 *
 * `sharp` is not installed and adding an image library to produce four flat
 * graphics would be a poor trade, so this writes the PNGs directly: pixels are
 * computed by hand and encoded with the one compressor Node already ships.
 *
 * The mark is the System's own language rather than a placeholder — void
 * ground, a hairline holographic edge, and the upward chevron that means a
 * level just went up. Deliberate at 192px and still legible at 48.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(HERE, '..', 'public')

/* ---- the palette, matching the theme tokens in src/index.css ---- */
const VOID = [0x05, 0x07, 0x0f]
const EDGE = [0x1b, 0x30, 0x50]
const SYSTEM = [0x38, 0xbd, 0xf8]
const GLOW = [0x7d, 0xd3, 0xfc]

/* ------------------------------------------------------------------ */
/* PNG encoding                                                        */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Encodes RGBA pixel data as a PNG. `pixels` is a Uint8Array of size*size*4. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  header[10] = 0 // deflate
  header[11] = 0 // adaptive filtering
  header[12] = 0 // no interlace

  // One filter byte per scanline, filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    pixels.subarray(y * size * 4, (y + 1) * size * 4).forEach((byte, i) => {
      raw[rowStart + 1 + i] = byte
    })
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ */
/* The mark                                                            */
/* ------------------------------------------------------------------ */

/**
 * Distance from a point to the nearest edge of an upward chevron, so the shape
 * can be drawn with a soft edge instead of a staircase. The chevron is two
 * strokes meeting at an apex, which as a signed distance is the distance to
 * `|x - cx| + apexY` measured along y.
 */
function chevronDistance(x, y, cx, apexY, halfWidth, riseOverRun) {
  const dx = Math.abs(x - cx)
  if (dx > halfWidth) return Infinity
  const strokeY = apexY + dx * riseOverRun
  return Math.abs(y - strokeY)
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/**
 * `inset` is the fraction of the canvas left clear around the mark. A maskable
 * icon needs its content inside the safe zone, because the launcher is free to
 * crop the corners to whatever shape it likes.
 */
function drawIcon(size, { maskable = false } = {}) {
  const pixels = new Uint8Array(size * size * 4)
  const scale = maskable ? 0.62 : 0.84
  const cx = size / 2
  const cy = size / 2

  // Two chevrons stacked, the upper one brighter: a level going up, twice.
  const chevronHalf = (size * scale) / 2.6
  const thickness = Math.max(1.4, size * scale * 0.085)
  const rise = 0.72
  const gap = size * scale * 0.26
  const upperApex = cy - gap * 0.72
  const lowerApex = cy + gap * 0.28

  const radius = maskable ? 0 : size * 0.18
  const borderWidth = Math.max(1, size * 0.02)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      /* ---- rounded-square mask, so a non-maskable icon has real corners ---- */
      let inside = true
      let edgeProximity = Infinity
      if (!maskable) {
        const qx = Math.abs(px - cx) - (size / 2 - radius)
        const qy = Math.abs(py - cy) - (size / 2 - radius)
        const outside =
          qx > 0 && qy > 0
            ? Math.hypot(qx, qy) - radius
            : Math.max(qx, qy) - radius
        inside = outside <= 0
        edgeProximity = Math.abs(outside)
      }

      if (!inside) {
        pixels[i + 3] = 0
        continue
      }

      let colour = VOID
      let alpha = 255

      // A faint vertical lift toward the top, the same gradient the app body
      // uses, so the icon and the shell look like one thing.
      const lift = Math.max(0, 1 - py / (size * 0.9)) * 0.5
      colour = mix(colour, EDGE, lift)

      /* ---- the holographic edge ---- */
      if (!maskable && edgeProximity < borderWidth) {
        colour = mix(EDGE, SYSTEM, 1 - edgeProximity / borderWidth)
      }

      /* ---- the chevrons ---- */
      const upper = chevronDistance(px, py, cx, upperApex, chevronHalf, rise)
      const lower = chevronDistance(px, py, cx, lowerApex, chevronHalf, rise)

      for (const [distance, tint] of [
        [upper, GLOW],
        [lower, SYSTEM],
      ]) {
        if (distance < thickness) {
          // Antialias the last pixel of the stroke rather than leaving a jag.
          const coverage = Math.min(1, (thickness - distance) / 1.2)
          colour = mix(colour, tint, coverage)
        }
      }

      pixels[i] = colour[0]
      pixels[i + 1] = colour[1]
      pixels[i + 2] = colour[2]
      pixels[i + 3] = alpha
    }
  }

  return encodePng(size, pixels)
}

/* ------------------------------------------------------------------ */

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#05070f"/>
  <rect x="1" y="1" width="62" height="62" rx="11" fill="none" stroke="#1b3050" stroke-width="2"/>
  <path d="M18 30 L32 19 L46 30" fill="none" stroke="#7dd3fc" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 45 L32 34 L46 45" fill="none" stroke="#38bdf8" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`

mkdirSync(resolve(PUBLIC, 'icons'), { recursive: true })

const written = []
for (const [name, size, options] of [
  ['icons/icon-192.png', 192, {}],
  ['icons/icon-512.png', 512, {}],
  ['icons/icon-maskable-512.png', 512, { maskable: true }],
  ['icons/apple-touch-icon.png', 180, {}],
]) {
  const png = drawIcon(size, options)
  writeFileSync(resolve(PUBLIC, name), png)
  written.push(`${name} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} KiB`)
}

writeFileSync(resolve(PUBLIC, 'favicon.svg'), FAVICON_SVG)
written.push('favicon.svg')

console.log('Generated:')
for (const line of written) console.log(`  ${line}`)
