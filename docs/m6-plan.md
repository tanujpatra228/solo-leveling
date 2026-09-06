# M6 — Sync and System Link

Two devices converge on the same log. The Hunter License Key screen, QR rendering and scanning,
sync status, manual sync, and the forget-the-mirror control. Written 2026-09-07.

## 0. The shape of this milestone is unusual

Almost everything M6 needs is already written and tested. What is missing is the wiring.

| Piece | State |
|---|---|
| `worker/index.ts` — `/api/sync`, `/api/push/*`, `/api/forget-me`, `/api/health` | **Done**, 337 lines, tested |
| `src/sync/client.ts` — `runSync`, `forgetMirror`, `fetchPushKey`, push subscribe/unsubscribe | **Done**, 295 lines, tested |
| `src/sync/identity.ts` — the Hunter Secret, with a Worker cross-check test | **Done** |
| `openRearCamera`, `createNativeQrDetector` capability adapters | **Done** |
| `Settings.syncEnabled` | **Exists**, defaults false |
| Anything connecting the above to the app | **None** |

So M6 is not "build sync". It is "connect sync, carefully, and find out what the untested seams
were wrong about".

## 1. Findings

### F1 — the sync client has never run against the app

`grep` for `sync/client` under `src/app/` returns nothing. `runSync` is 295 lines of code plus 110
lines of test that no screen, store action, or effect has ever called. Its unit tests exercise it
against mocked responses; nothing has exercised it against the real store, real Dexie rows, or the
deployed Worker.

Treat the first wiring commit as **discovery, not integration**. Expect the seams to be wrong —
row shapes, cursor handling, what `collectPendingRows` considers pending after M5 added quest
payload writes. Budget for that rather than being surprised by it.

### F2 — `qrcode` and `jsqr` are dependencies that nothing imports

Both sit in `package.json` and neither appears in `src/` or `worker/`. They were added in
anticipation and have been carrying dependency-audit and release-age surface since.

`jsqr` is specifically the *fallback* decoder for browsers without `BarcodeDetector`. The target
device is Android only (settled), and Chrome on Android has `BarcodeDetector`. So jsQR is a fallback
that the one supported platform does not need — and it is roughly 30 KB.

Decision for this milestone: **`qrcode` is bundled** (rendering the key is the primary path, always
needed), and **`jsqr` is lazily imported only when `createNativeQrDetector()` returns null**. That
keeps the fallback working for a desktop browser or an older device without paying for it on the
phone that matters. If lazy-loading it proves awkward, removing it entirely is defensible given the
platform decision.

This is also the first real code-splitting win available, which matters because of F6.

### F3 — sync must not be able to block logging, structurally

`CLAUDE.md` is unambiguous: offline is the default path, no feature awaits the network, no spinner
blocks logging a set. Sync is the first code in the app that can violate that.

Convention is not enough here. The discipline should be structural:

- `runSync` is never called from `logSet`, `correctSet`, or anything on the set-entry path. The
  triggers are **app foreground**, **after `finishGate`**, and **a manual button** — nothing else,
  and never per set.
- The store action wrapping it is fire-and-forget: it never returns a promise a component awaits,
  and a failure sets status rather than throwing.
- In-flight syncs coalesce. A second trigger while one is running joins the first rather than
  starting a second.
- Failures back off exponentially and give up rather than retrying forever.

A test that asserts `logSet` triggers no network call is worth more than a comment saying it should
not.

### F4 — the Hunter Secret has no recovery, and the warning has to come first

The secret is the only credential. There is no account, no email, no reset. Losing it loses the
mirror, and no amount of support can recover it.

So the License Key screen states the loss consequence **before** it shows the key or offers to pair,
not in small text underneath. And "forget the mirror" needs a confirmation that says what is
actually destroyed — per `CLAUDE.md`, deleting is a look-before-you-overwrite moment.

The local log is unaffected by forgetting the mirror. Saying so plainly is what makes the control
safe to use.

### F5 — the request budget starts being spent, and a breach is an outage

The Worker free plan allows 100,000 requests a day and **hard-fails rather than billing** — so
running out is downtime, not an invoice. The estimate for normal use is roughly 50 requests a day.

The gap between 50 and 100,000 is enormous, which is exactly why a bug could hide in it for a while
before it bites. A retry loop, a sync-per-set regression, or a coalescing failure would burn through
it quietly. Add a client-side daily cap with a counter, so a runaway client stops itself before the
platform does.

### F6 — the bundle is over target and M6 adds to it

205.33 KB JS + 5.86 KB CSS gzipped, past the 200 KB line `infrastructure.md` set at M2 — a number
M4 finding H2 already argues was borrowed from the wrong kind of app, and which M4 commit 3 was
supposed to replace with a measured one. It has drifted through the substitution feature, the
visuals, and M5, with nobody deciding anything.

M6 adds `qrcode` and a QR screen. **M4's remaining commits should land before or alongside M6**, so
this milestone is measured against a real budget. F2's lazy jsQR is a genuine saving available now
regardless.

## 2. Commits

### Commit 1 — the sync store action, wired and coalesced

`syncNow()` on the store: fire-and-forget, coalescing, with `syncStatus` state
(`idle | syncing | ok | failed | offline`) and a last-synced timestamp. Exponential backoff and a
daily request cap. No UI yet.

Tests: `logSet` triggers no network call; two concurrent triggers produce one request; a failure
backs off and does not retry forever; the cap stops a runaway.

### Commit 2 — the triggers

Foreground (`visibilitychange`), after `finishGate`, and manual. Gated on `settings.syncEnabled`,
which stays false until the hunter turns it on.

### Commit 3 — first end-to-end run, and whatever it breaks

Run it against the deployed Worker with real Dexie rows. Fix the seams F1 predicts. This commit is
deliberately open-ended and should not be planned in more detail than that — the point is to find
out what is wrong, then write down what was found.

### Commit 4 — the License Key screen

A `/link` route: the loss warning first, then the key, then `qrcode` rendering. The sync toggle,
sync status, manual sync, and the forget-the-mirror control with its confirmation.

### Commit 5 — QR scanning

`openRearCamera` plus `createNativeQrDetector`, with `jsqr` dynamically imported only when the
native detector is absent. Pairing a second device by scanning the first one's key.

### Commit 6 — two-device convergence

The acceptance test: two browser profiles, both seeded, both syncing, converging on one log.
Append-only means conflicts should not arise; corrections are new rows that supersede, so
`dropSuperseded` has to survive a merge where the superseding row arrives before the row it
supersedes. That ordering case is the one worth an explicit test.

## 3. Verification

- Two browser profiles with the same Hunter Secret converge on the same set of rows, and both
  projections agree on level, XP and rank.
- A correction made on device A shows as corrected on device B, regardless of the order the two rows
  arrive in.
- `logSet` performs no network request, asserted in a test.
- Airplane mode: logging a set, finishing a gate and completing a quest all work; sync reports
  offline and recovers on reconnect without losing anything.
- Two triggers firing together produce one request, not two.
- A failing Worker backs off and stops, and the daily cap holds.
- Forgetting the mirror removes the server rows, leaves the local log untouched, and says so before
  it happens.
- `jsqr` does not appear in the initial bundle.
- Measured API requests for a normal training day sit well under 100.
- Every route still mounts, including `/link` (rule 14), and `pnpm run check:render` stays clean.

## 4. What M6 does not do

Push notifications are M8, which is **parked** — see `docs/TODO.md`. The Worker endpoints exist and
`fetchPushKey` is written, but nothing wires them and nothing will until the rest of the platform is
finished. The tower, red gates, shadow army and shop are M7.
