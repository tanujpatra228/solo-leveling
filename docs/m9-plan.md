# M9 — Flavour

The System says the same twenty sentences forever. M9 gives it range without giving it a network
dependency. Written 2026-09-08.

## 1. What exists

Every line the System speaks is a hardcoded string at its call site in `src/app/state.ts`:

```ts
title: `[Gate cleared. Rank ${summary.gateRank ?? 'E'}.]`
title: '[Boss slain.]'
title: 'ARISE.'
title: '[Daily Quest has arrived.]'
```

They are good lines. The voice is consistent and it was written deliberately. The problem is only
that there is exactly one of each, so the hundredth gate reads identically to the first.

## 2. Findings

### F1 — build-time generation, and runtime AI is ruled out by a rule already written

The brief allows either build-time generation or Workers AI (line 387). `CLAUDE.md` settles it:

> Offline is the default path. Write to IndexedDB and return; sync later, in the background. No
> feature awaits the network, and no spinner blocks logging a set. If a change misbehaves in
> airplane mode, the change is wrong.

A gate finishing in a gym basement must produce its message immediately. A runtime call — Workers
AI or anything else — puts the network on the path of the app's most important moment, costs Worker
CPU against a 10 ms budget, and fails in exactly the environment the app was built for.

So: **generated ahead of time, shipped as a static table.** No key exists to leak, no request is
made, no Neurons are spent, and it works in airplane mode because it is just strings in the bundle.

### F2 — "build-time" should mean "generated once and committed", not "regenerated every build"

This is a correction to how the brief's wording reads. Regenerating on every `pnpm run build`
would mean:

- the shipped text differs between two builds of the same commit, so a build is no longer
  reproducible;
- nobody reviews what ships, because it did not exist when the commit was reviewed;
- a voice drift or an embarrassing line reaches the phone with no human in the loop.

The System's voice is the app's personality and it is already established across ~20 lines. Generate
candidates offline, **read them, cut the bad ones, and commit the table as source.** The generation
step is a tool a person runs, like `scripts/generate-standards.mjs` and `scripts/generate-icons.mjs`
already are — not a build step.

That also keeps the domain layer pure: a flavour table is data, and selecting from it is a function.

### F3 — selection must be deterministic per event, not random per render

A naive `lines[Math.floor(Math.random() * lines.length)]` inside a component changes on every
re-render, so the message would flicker as the user watches it. That is the same class of problem as
standards rule 13, arriving through randomness instead of identity.

Selection takes a seed and is pure: seed from the `SystemMessage.id` (already a UUID) or the session
id, so a given event always reads the same line, and the domain layer stays free of ambient
randomness the way it is already free of the ambient clock.

### F4 — the fallback is the line that exists today

Every flavour lookup needs a default, and the natural default is the hardcoded line already in
place. That makes this milestone strictly additive: if a key is missing from the table, the System
says what it says now. No event can end up with no message.

### F5 — bundle, measured not assumed

The initial route is 196.16 KB JS + 5.97 KB CSS gzipped, comfortably under the ~480 KB Slow-4G
budget M4 settled. A flavour table of a few hundred short strings is perhaps 4–6 KB gzipped, which
is affordable — but it should be measured, and it is a natural candidate for the lazy chunk the M7
panels already ship in if it turns out larger than expected.

## 3. Commits

### Commit 1 — the flavour table and its selector

`src/domain/flavour.ts`: the table as data keyed by event, and `flavourFor(key, seed)` as a pure
function with the current hardcoded line as the fallback (F4). Tests: a given seed always returns
the same line; a missing key returns the fallback; an empty table returns the fallback for every
key.

### Commit 2 — the generation script

`scripts/generate-flavour.mjs`, run by hand, writing candidates for review. Its output is not
committed; the reviewed table is. Documented as a tool, not a build step (F2).

### Commit 3 — wire the call sites

Replace the hardcoded strings in `state.ts` with `flavourFor(...)`, seeded from the message id.
Behaviour is unchanged where the table has one entry, which makes this reviewable as a refactor.

### Commit 4 — the table, filled and read

The reviewed lines. This is the commit where a person actually reads every string that will ship.

## 4. Verification

- `flavourFor` is pure: same key and seed, same line, no ambient randomness.
- A missing key or an empty table falls back to the line the app ships today.
- No message flickers across re-renders — the same event shows the same line.
- No network request is made to produce any message; airplane mode is unaffected.
- Every line in the committed table has been read by a person before it ships.
- Bundle measured after commit 4 against the ~480 KB budget.

## 5. What M9 does not do

No runtime AI, per F1 — and if it is ever revisited, `NOTES.md` records that the Kimi, GLM and
DeepSeek model families require a paid plan and must be avoided. Free-text parsing, the brief's
other AI use, is not in this milestone.
