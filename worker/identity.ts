/**
 * Server-side half of the capability-token identity.
 *
 * This deliberately duplicates the base32 decoder from
 * `src/sync/identity.ts` rather than importing it. The client bundle and the
 * Worker are separate TypeScript projects with different global types, and
 * `identity.cross-check.test.ts` asserts the two implementations agree on
 * random input, so the duplication cannot silently drift.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SECRET_BYTES = 15
const LICENSE_KEY_LENGTH = 24

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

/**
 * The stored identifier. SHA-256 over a random token costs microseconds, which
 * is what the 10 ms CPU budget requires — bcrypt or argon2 would blow it, and
 * neither is needed for a value that was random to begin with rather than
 * chosen by a person.
 */
export async function hunterIdFromSecret(secret: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', secret as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Pulls the bearer token out of the header, without logging it. */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1]!.trim() : null
}

export async function authenticate(request: Request): Promise<string | null> {
  const bearer = bearerFrom(request)
  if (!bearer) return null
  const secret = decodeLicenseKey(bearer)
  if (!secret) return null
  return hunterIdFromSecret(secret)
}

/**
 * Constant-time comparison, for the places where we do compare a caller-supplied
 * string against a configured one — the optional shared secret that gates any
 * future AI endpoint. The sync path does not use this: it hashes the token and
 * looks the hash up as a primary key, so there is no comparison to time.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.byteLength !== right.byteLength) return false

  // Written by hand rather than using `crypto.subtle.timingSafeEqual`, which is
  // a Cloudflare-only extension and therefore cannot be exercised by a test
  // running off-platform. Accumulating the difference over every byte means the
  // loop cannot exit early and leak the position of the first mismatch.
  let difference = 0
  for (let i = 0; i < left.byteLength; i += 1) {
    difference |= left[i]! ^ right[i]!
  }
  return difference === 0
}
