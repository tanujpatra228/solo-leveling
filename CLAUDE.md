# Solo Leveling — working rules

Full rules live in `docs/engineering-standards.md`. Read that file before any task
touching `src/domain/`, `src/app/state.ts`, or the Worker. What follows is the
subset that has already cost us a production bug.

## What we are deploying onto

One Cloudflare Worker on the **free plan**, serving a static React PWA whose source of
truth is IndexedDB on the user's phone. D1 is a sync mirror, not the database of record.
Details and the full budget table: `docs/infrastructure.md`.

The limits that change how code gets written:

| | Limit | Consequence |
|---|---|---|
| Worker CPU | **10 ms per invocation** | No progression maths, no bcrypt/argon2, no big JSON transforms server-side. Design target 3 ms. |
| Worker requests | 100,000/day | Static assets are served by the `ASSETS` binding and cost nothing. Only `/api/*` runs the Worker (`run_worker_first`). Keep it that way. |
| D1 bound parameters | **100 per query** | We batch **16 rows per statement (80 params)**. Do not raise it. |
| D1 subrequests | 50 per invocation | Our cap is 16 queries per request. Bound every page size. |
| D1 rows read | Counts rows *scanned*, not returned | Every query filters on an indexed column. An unindexed filter over 5,000 rows bills 5,000. |
| Isolate memory | 128 MB, shared across concurrent requests | Never buffer more than 64 KB. Stream instead. |

Everything above hard-fails rather than billing you, which means a limit breach is an
outage, not an invoice. Free plan is a correctness constraint here, not a budget note.

Also true, and load-bearing:

- Offline is the default path. Write to IndexedDB and return; sync later, in the
  background. No feature awaits the network, and no spinner blocks logging a set.
  If a change misbehaves in airplane mode, the change is wrong.
- The daily reminder is a Cron Trigger at 02:30 UTC (08:00 IST), a deploy-time constant.
- `.npmrc` sets `minimum-release-age=10080` — dependencies must be 7 days old. Requires
  pnpm ≥ 10.16, which silently ignores it below that. We pin `pnpm@10.34.5`.
- Never log a request body. They carry bodyweight, body fat, and waist measurements.
- No secret reaches the client bundle. Every `VITE_` variable is public by definition.

## Non-negotiable

- `src/domain/` is pure. No React, no Dexie, no ambient clock — time is an argument.
- The log is append-only. Level, XP, stats, rank, fatigue, streak are derived by
  `projectPlayer`, never stored. Corrections are new rows that supersede old ones.
- Components never import Dexie. Only `src/db/repo.ts` knows about IndexedDB.
- kg and cm in storage, domain, and sync. Convert only inside formatters.

## Zustand selectors must return stable identities

Zustand v5 is `useSyncExternalStore` with `Object.is`. A selector that builds a new
object or array on every call re-renders forever and crashes with React #185 —
a blank screen in production, not a slow one.

```ts
// BAD — new object every call
const target = useApp((s) => s.targetFor(id))
// BAD — new array every call
const mine = useApp((s) => s.sets.filter((x) => x.sessionId === id))

// GOOD — select the slice, derive locally
const sets = useApp((s) => s.sets)
const mine = useMemo(() => sets.filter((x) => x.sessionId === id), [sets, id])
// BEST — derive once in recompute(), store the result, select it
const targets = useApp((s) => s.targetsByExerciseId)
```

Anything derived from more than one slice belongs in `recompute()`.
`pnpm run check:render` enforces this; it runs as part of `pnpm run build`.

## Incomplete rows are not results

A `SessionLog` with `endedAt === null` is in progress. The projection must not pay
it XP, a gate rank, or stats. The same holds for any partially written row: a row
existing never means the thing happened.

## Tests

- Every domain function taking a collection gets an empty-input test.
- A function returning a rank or enum states what empty returns explicitly. Falling
  through to the initialiser is how an empty gate came to pay an E-rank clear.
- Seed store-level tests via `fake-indexeddb` + `useApp.setState`, as in
  `src/app/state.test.ts`.
- Before reporting done: `pnpm test` and `pnpm run typecheck`.
