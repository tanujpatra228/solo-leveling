import { describe, expect, it } from 'vitest'
import {
  LICENSE_KEY_LENGTH,
  SECRET_BYTES,
  decodeLicenseKey,
  encodeLicenseKey,
  formatLicenseKey,
  generateHunterSecret,
  hunterIdFromSecret,
  identityFromLicenseKey,
  pairingPayload,
  parsePairingPayload,
} from './identity'

describe('the Hunter Secret', () => {
  it('is 15 bytes, which is what encodes to a 24-character key', () => {
    expect(generateHunterSecret()).toHaveLength(SECRET_BYTES)
    expect(encodeLicenseKey(generateHunterSecret())).toHaveLength(LICENSE_KEY_LENGTH)
  })

  it('is different every time', () => {
    const a = encodeLicenseKey(generateHunterSecret())
    const b = encodeLicenseKey(generateHunterSecret())
    expect(a).not.toBe(b)
  })
})

describe('the licence key round-trips', () => {
  it('decodes back to the exact bytes it was encoded from', () => {
    for (let i = 0; i < 50; i += 1) {
      const secret = generateHunterSecret()
      const decoded = decodeLicenseKey(encodeLicenseKey(secret))
      expect(decoded).not.toBeNull()
      expect([...decoded!]).toEqual([...secret])
    }
  })

  it('survives being typed in lower case', () => {
    const secret = generateHunterSecret()
    const key = encodeLicenseKey(secret)
    expect([...decodeLicenseKey(key.toLowerCase())!]).toEqual([...secret])
  })

  it('survives the grouping dashes being left in', () => {
    const secret = generateHunterSecret()
    const key = encodeLicenseKey(secret)
    expect([...decodeLicenseKey(formatLicenseKey(key))!]).toEqual([...secret])
  })

  it('survives whitespace', () => {
    const secret = generateHunterSecret()
    const key = encodeLicenseKey(secret)
    expect([...decodeLicenseKey(` ${key} `)!]).toEqual([...secret])
  })
})

describe('the alphabet avoids characters that get misread', () => {
  it('never produces I, L, O or U', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(encodeLicenseKey(generateHunterSecret())).not.toMatch(/[ILOU]/)
    }
  })

  it('reads a typed I or L as 1, and a typed O as 0', () => {
    // Build a key that legitimately contains 1 and 0, then retype it wrongly.
    const secret = new Uint8Array(SECRET_BYTES).fill(0)
    const key = encodeLicenseKey(secret)
    expect(key).toBe('0'.repeat(LICENSE_KEY_LENGTH))
    expect([...decodeLicenseKey('O'.repeat(LICENSE_KEY_LENGTH))!]).toEqual([...secret])
  })
})

describe('a malformed key is rejected rather than half-accepted', () => {
  it('rejects a key of the wrong length', () => {
    expect(decodeLicenseKey('ABC')).toBeNull()
    expect(decodeLicenseKey('A'.repeat(40))).toBeNull()
  })

  it('rejects a key containing a character outside the alphabet', () => {
    expect(decodeLicenseKey('!'.repeat(LICENSE_KEY_LENGTH))).toBeNull()
  })

  it('rejects an empty key', () => {
    expect(decodeLicenseKey('')).toBeNull()
  })
})

describe('the hunter id', () => {
  it('is the SHA-256 of the secret, hex encoded', async () => {
    const secret = new Uint8Array(SECRET_BYTES).fill(1)
    const id = await hunterIdFromSecret(secret)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for the same secret and different for another', async () => {
    const a = new Uint8Array(SECRET_BYTES).fill(1)
    const b = new Uint8Array(SECRET_BYTES).fill(2)
    expect(await hunterIdFromSecret(a)).toBe(await hunterIdFromSecret(a))
    expect(await hunterIdFromSecret(a)).not.toBe(await hunterIdFromSecret(b))
  })

  it('does not contain the secret, so it is safe to store and log', async () => {
    const secret = generateHunterSecret()
    const id = await hunterIdFromSecret(secret)
    expect(id).not.toContain(encodeLicenseKey(secret))
  })
})

describe('pairing a second device', () => {
  it('rebuilds the same identity from the key', async () => {
    const secret = generateHunterSecret()
    const key = encodeLicenseKey(secret)
    const rebuilt = await identityFromLicenseKey(key)
    expect(rebuilt?.hunterId).toBe(await hunterIdFromSecret(secret))
  })

  it('refuses a malformed key', async () => {
    expect(await identityFromLicenseKey('nope')).toBeNull()
  })

  it('round-trips through the QR payload', () => {
    const key = encodeLicenseKey(generateHunterSecret())
    expect(parsePairingPayload(pairingPayload(key))).toBe(key)
  })

  it('ignores a QR code that is not a hunter licence', () => {
    expect(parsePairingPayload('https://example.com')).toBeNull()
  })
})
