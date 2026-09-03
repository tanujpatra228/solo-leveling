/**
 * Identity without an account.
 *
 * There is no login screen, no email and no password. The credential is a
 * random secret generated on the device — the Hunter Secret. It leaves the
 * device only as a bearer header, and the server stores only its SHA-256, so a
 * dump of the server's tables does not yield anything that can be replayed.
 *
 * A note on a deviation from the brief, which asked for both 32 random bytes
 * and a 24-character Hunter License Key. Those two cannot both be true: 32
 * bytes is 256 bits, which needs 52 base32 characters, so it cannot be printed
 * in 24. Since the key has to be typeable by hand on a second device, the
 * secret is 15 bytes — 120 bits — which encodes to exactly 24 characters. 120
 * bits of entropy from `crypto.getRandomValues` is not brute-forceable, so
 * nothing is lost in practice.
 */

/**
 * Crockford's base32 alphabet. It leaves out I, L, O and U, so a key read off
 * one phone and typed into another cannot be ruined by confusing 1 with I or
 * 0 with O, and it cannot accidentally spell anything.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 15 bytes encodes to exactly 24 base32 characters with no padding. */
export const SECRET_BYTES = 15
export const LICENSE_KEY_LENGTH = 24

export function generateHunterSecret(): Uint8Array {
  const bytes = new Uint8Array(SECRET_BYTES)
  crypto.getRandomValues(bytes)
  return bytes
}

export function encodeLicenseKey(secret: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of secret) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31]

  return output
}

/**
 * Accepts a key as the hunter typed it: any case, with or without the grouping
 * dashes, and with the characters Crockford treats as aliases folded in — I and
 * L read as 1, O reads as 0.
 */
export function decodeLicenseKey(key: string): Uint8Array | null {
  const cleaned = key
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')

  if (cleaned.length !== LICENSE_KEY_LENGTH) return null

  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  if (bytes.length !== SECRET_BYTES) return null
  return new Uint8Array(bytes)
}

/** Grouped into fours for reading aloud and copying by hand. */
export function formatLicenseKey(key: string): string {
  return key.replace(/(.{4})/g, '$1-').replace(/-$/, '')
}

/**
 * The account identifier: SHA-256 of the secret, hex encoded. This is what the
 * server sees and stores. It cannot be reversed into the secret, so it is safe
 * to keep in the database and safe to put in a log line.
 */
export async function hunterIdFromSecret(secret: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', secret as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The bearer value sent to the Worker. The secret itself, base32 encoded. */
export function bearerFromSecret(secret: Uint8Array): string {
  return encodeLicenseKey(secret)
}

export interface Identity {
  secret: Uint8Array
  licenseKey: string
  hunterId: string
}

export async function identityFromSecret(secret: Uint8Array): Promise<Identity> {
  return {
    secret,
    licenseKey: encodeLicenseKey(secret),
    hunterId: await hunterIdFromSecret(secret),
  }
}

export async function createIdentity(): Promise<Identity> {
  return identityFromSecret(generateHunterSecret())
}

/**
 * Rebuilds an identity from a typed or scanned key, for pairing a second
 * device. Returns null when the key is malformed, which is the only validation
 * the client can do — whether the key is *correct* is answered by the server
 * returning rows or returning nothing.
 */
export async function identityFromLicenseKey(key: string): Promise<Identity | null> {
  const secret = decodeLicenseKey(key)
  if (!secret) return null
  return identityFromSecret(secret)
}

/** What the QR code on the first device contains. */
export function pairingPayload(licenseKey: string): string {
  return `hunter-license:${licenseKey}`
}

export function parsePairingPayload(payload: string): string | null {
  const match = /^hunter-license:([0-9A-Za-z-]+)$/.exec(payload.trim())
  return match ? match[1]! : null
}
