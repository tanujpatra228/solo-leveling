#!/usr/bin/env node
/**
 * Post-deploy smoke check (M4 commit 1). Four requests against a live
 * deployment — the same four `curl` calls done by hand for every deploy so
 * far — so a bad deploy fails the pipeline instead of reporting a green tick
 * over one. Exits non-zero on any failure.
 */
const BASE_URL = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? 'https://solo-leveling.tanujpatra228.workers.dev'

let failures = 0

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function check(label, fn) {
  try {
    await fn()
    console.log(`ok — ${label}`)
  } catch (err) {
    failures += 1
    console.error(`FAIL — ${label}: ${err.message}`)
  }
}

await check('health answers 200', async () => {
  const response = await fetch(`${BASE_URL}/api/health`)
  assert(response.status === 200, `expected 200, got ${response.status}`)
  const body = await response.json()
  assert(body.ok === true, 'expected { ok: true }')
})

await check('unauthenticated sync is 401', async () => {
  const response = await fetch(`${BASE_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ since: 0, changes: { sessions: [], sets: [], bodyMetrics: [] } }),
  })
  assert(response.status === 401, `expected 401, got ${response.status}`)
})

await check('an unknown API path is a JSON 404', async () => {
  const response = await fetch(`${BASE_URL}/api/does-not-exist`)
  assert(response.status === 404, `expected 404, got ${response.status}`)
  const body = await response.json()
  assert(typeof body.error === 'string', 'expected a JSON body with an error field')
})

await check('a client route returns the app shell through the SPA fallback', async () => {
  const response = await fetch(`${BASE_URL}/gate`)
  assert(response.status === 200, `expected 200, got ${response.status}`)
  const text = await response.text()
  assert(text.includes('<div id="root">'), 'expected the SPA shell HTML')
})

if (failures > 0) {
  console.error(`\n${failures} check(s) failed against ${BASE_URL}.`)
  process.exit(1)
}
console.log(`\nAll smoke checks passed against ${BASE_URL}.`)
