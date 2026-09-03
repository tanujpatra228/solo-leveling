/**
 * The Worker duplicates the licence-key decoder because it is a separate
 * TypeScript project with different global types. This test is what stops the
 * two copies drifting: if they ever disagree on any input, pairing breaks and
 * this fails.
 */
import { describe, expect, it } from 'vitest'
import {
  decodeLicenseKey as clientDecode,
  encodeLicenseKey,
  generateHunterSecret,
  hunterIdFromSecret as clientHunterId,
} from '../src/sync/identity'
import {
  bearerFrom,
  decodeLicenseKey as workerDecode,
  hunterIdFromSecret as workerHunterId,
  timingSafeEqualStrings,
} from './identity'

describe('the client and Worker decoders agree', () => {
  it('decode the same random keys identically', () => {
    for (let i = 0; i < 200; i += 1) {
      const key = encodeLicenseKey(generateHunterSecret())
      const fromClient = clientDecode(key)
      const fromWorker = workerDecode(key)
      expect(fromWorker).not.toBeNull()
      expect([...fromWorker!]).toEqual([...fromClient!])
    }
  })

  it('produce the same hunter id', async () => {
    for (let i = 0; i < 20; i += 1) {
      const secret = generateHunterSecret()
      expect(await workerHunterId(secret)).toBe(await clientHunterId(secret))
    }
  })

  it('reject the same malformed input', () => {
    for (const bad of ['', 'short', 'A'.repeat(40), '!'.repeat(24)]) {
      expect(workerDecode(bad)).toBeNull()
      expect(clientDecode(bad)).toBeNull()
    }
  })

  it('apply the same character folding for keys typed by hand', () => {
    const key = 'O'.repeat(24)
    expect([...workerDecode(key)!]).toEqual([...clientDecode(key)!])
  })
})

describe('bearerFrom', () => {
  it('reads the token out of the header', () => {
    const request = new Request('https://example.com', {
      headers: { Authorization: 'Bearer ABCD1234' },
    })
    expect(bearerFrom(request)).toBe('ABCD1234')
  })

  it('accepts a lower-case scheme', () => {
    const request = new Request('https://example.com', {
      headers: { Authorization: 'bearer ABCD1234' },
    })
    expect(bearerFrom(request)).toBe('ABCD1234')
  })

  it('returns nothing when the header is absent or the wrong scheme', () => {
    expect(bearerFrom(new Request('https://example.com'))).toBeNull()
    expect(
      bearerFrom(
        new Request('https://example.com', { headers: { Authorization: 'Basic abc' } }),
      ),
    ).toBeNull()
  })
})

describe('timingSafeEqualStrings', () => {
  it('matches identical strings', () => {
    expect(timingSafeEqualStrings('a-shared-secret', 'a-shared-secret')).toBe(true)
  })

  it('rejects different strings of the same length', () => {
    expect(timingSafeEqualStrings('aaaaaaa', 'aaaaaab')).toBe(false)
  })

  it('rejects different lengths without throwing', () => {
    expect(timingSafeEqualStrings('short', 'much longer string')).toBe(false)
  })
})
