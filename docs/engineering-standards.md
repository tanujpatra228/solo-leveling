# Engineering standards

Rules for writing code in this repository. Written for the stack we actually use: a single
Cloudflare Worker serving a static React PWA whose source of truth is IndexedDB on the device.

## 1. The domain layer is pure and has no idea it is in a browser

Everything in `src/domain/` is pure TypeScript. No `window`, no reading the clock from inside a
formula, no Dexie import, no React. Functions take their inputs and return their outputs. Time is
passed in as an argument rather than read from the ambient clock.

This is the most important rule here because the progression engine is the deliverable. If the
engine can only run inside a mounted React component with a live database behind it, it cannot be
tested, and an untested progression engine can hand the user a load that injures them. Purity is
what makes the arithmetic checkable.

Consequence: `src/domain/` may import from `src/domain/`. It may import nothing else.

## 2. Test-first for anything that produces a number

Every formula gets a Vitest test alongside its implementation, with cases taken from the brief. That
covers e1RM, the double-progression decision, ACWR, the XP formula, the level curve, the derived
stats, the Navy body-fat estimate, rank lookup, and volume-landmark classification.

A test for a formula asserts a specific numeric output for a specific input. Asserting that it
returns a number is not a test. Where the brief states a constant (Epley, Tanaka,
Hodgdon-Beckett, the ACWR safe band of 0.8 to 1.3) that constant appears in a test as a literal.

Cases from the brief are not sufficient on their own, because the brief only describes training
that happened. Two more are required:

- Every function taking a collection gets an empty-input case. Zero sets, zero sessions, no history.
- Every function returning a rank or other enum states its empty answer as a deliberate assertion.
  `gateDifficulty([])` returned `'E'` for a year because `'E'` was the initialiser of the loop
  variable, and an empty gate was therefore paid a full E-rank clear bonus. Nothing in the brief
  describes a gate with no work in it, so nothing in the tests did either.

User interface code needs no test for its appearance. It does need one for whether it mounts; see
rule 14.

## 3. Zod validates boundaries only

Three boundaries exist, and they are the only places a schema runs.

1. User free-text and form input.
2. Data read back out of IndexedDB, because it may have been written by an older version of the app.
3. Every request and response body crossing the Worker HTTP surface, in both directions.

Do not validate the output of a function that another function in the same module just produced.
Internal calls are guarded by the type system.

Each entity gets exactly one Zod schema, and its TypeScript type is `z.infer` of that schema, so
the type and the validator cannot drift apart.

## 4. Append-only log, derived projection

`SessionLog` and `SetLog` rows are written once and never updated or deleted. Everything the player
sees about their progress (level, XP, stats, rank, fatigue, streak, shadows) is recomputed from that
log by a pure function.

This is not a stylistic preference. It is what makes sync tractable, because append-only rows barely
conflict. It is what makes a formula change a re-grade rather than a migration. And it makes a bug
in the XP constants a recalculation instead of corrupted history.

Corrections are new rows that supersede old ones, not edits.

## 5. Repository pattern over Dexie

React components never import Dexie or touch a table directly. They call functions in
`src/db/repo.ts`, which is the only module that knows about IndexedDB. The repository returns domain
types rather than raw rows.

The storage engine is an implementation detail we may need to change. More immediately, this keeps
the query surface small enough to reason about the offline story, and it lets the domain layer be
handed plain arrays in tests.

## 6. Adapter pattern for every platform capability

Anything the browser might not provide gets an adapter module with a narrow interface and a
degrade-gracefully fallback: Screen Wake Lock, notification permission and push subscription, Web
Share, camera access for QR scanning, vibration, and the install prompt.

The primary environment for this app is a phone in a gym basement, and mobile browsers withhold
capabilities depending on context, such as whether the PWA is installed. A missing capability must
degrade to a working app, never to a thrown exception. The adapter is where the answer to "this
device cannot do that" lives once, instead of at every call site.

## 7. Offline is the default path, not the fallback

Write to IndexedDB first and return. Sync happens later, in the background, and its failure is not
an error the user sees. No feature may await a network response on its critical path, and no loading
spinner may block logging a set.

If a change would make the app misbehave in airplane mode, the change is wrong.

## 8. Worker code is written against the 10 ms CPU budget

The Worker mirrors rows and sends one push a day. It does not compute progression, it does not hash
passwords, and it does not serialise large payloads. Static assets are served by the assets binding,
which does not consume Worker CPU and does not count against the request limit, so the shell stays
static.

In practice that means no bcrypt or argon2 (SHA-256 over a random token only), no heavy JSON
transforms, a bounded page size on every query, and no unbounded loop over synced rows.

## 9. Singletons for genuinely single things, and only those

The Dexie instance, the Zustand stores, the sync client, and the router are module-level singletons
because there is exactly one of each per tab. Nothing else is. Do not introduce a service locator or
a dependency-injection container. This is one app on one device and the indirection would cost more
than it buys.

## 10. Store canonical units, format at the edge

Kilograms and centimetres in storage, in the domain layer, and in the sync payload, always. Pounds,
inches, and stones exist only inside formatting functions called by components. A number that has
been converted for display never flows back into a calculation.

## 11. Secrets

No secret reaches the client bundle, because there is no such thing as a hidden value in a browser.
Every `VITE_` prefixed variable is public by definition. Server-side secrets are set with
`wrangler secret put` and are readable only by the Worker. `.env` files and `.dev.vars` are
gitignored.

The VAPID public key is intentionally public and may ship in the bundle. The VAPID private key never
leaves the Worker environment.

## 12. Never log a request body

Request bodies carry bodyweight, body-fat percentage, and waist measurements. That is health data.
Log a status code, and a short hunter-id prefix if you must log an identifier at all.

## 13. Selectors return what the store already holds

Zustand v5 reads through `useSyncExternalStore` and compares snapshots with `Object.is`. There is
no equality shim any more. A selector that constructs its return value therefore produces a new
identity on every read, React concludes the store changed, and the component re-renders until it
dies with "Maximum update depth exceeded" — minified to error #185, which is a blank screen with no
useful message on a phone.

So a selector may return a slice of state, or a field of one. It may not call a store method, build
an object or array literal, or run `filter`, `map`, `flatMap`, `slice`, `sort`, or `concat`.
`find` is fine, because it returns an element that already exists.

Where the value is derived from one slice, select the slice and derive in `useMemo`. Where it is
derived from several, derive it once in `recompute()` and store it, which is what `projection`
already does — that is the pattern, and it costs less than recomputing per component per render.

`scripts/check-render-rules.mjs` enforces the mechanical half of this and runs during `pnpm run
build`. It is a tripwire for the known shapes, not a proof, and it does not replace reading the
rule.

## 14. Every route has a mount test

A component that throws on mount is a broken feature, not a cosmetic defect, and the domain tests
cannot see it — they never render anything. Each route gets one test that seeds the store into the
state the route is meant to display, mounts it, and asserts it did not throw. The state that matters
is the state a user reaches, so a screen with a session open is tested with a session open.

This is the only reason UI code is tested at all. Do not extend these into assertions about text,
layout, or styling; those change constantly and the tests would be noise.

## 15. Incomplete rows are not results

Rule 4 makes the projection the source of every number the player sees. It follows that the
projection must know which rows are finished. A `SessionLog` with `endedAt === null` is a session in
progress: it pays no XP, earns no gate rank, and moves no stat. A row existing never implies the
thing it records happened.

Stated because the opposite was shipped. Opening a gate created the session row, the projection
walked every session without checking `endedAt`, and the hunter was paid a 200 XP gate clear and a
level for pressing a button. Anything derived from a row must first ask whether that row is complete.

## 16. Scope discipline

Build what the current phase asks for and nothing more. No abstraction whose second caller does not
yet exist, and no error handling for a case that cannot occur. A pre-existing problem found along
the way is written down in `NOTES.md` or `TODO.md` and reported, rather than fixed in the same
change.
