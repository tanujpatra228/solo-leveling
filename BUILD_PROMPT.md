# Solo Leveling Fitness PWA — Build Brief

## Why this exists

I train six days a week and I want the logging and the target-setting to feel like the System from
the manhwa *Solo Leveling* — status windows, levels, stats, daily quests, shadow extraction — sitting
on top of real, correct strength-training progression. It is primarily for me, on my own phone,
installed as a PWA. If other people end up using it that is fine, but I am not building a SaaS and I
do not want a login screen.

The thing that makes or breaks this is not the theming. It is whether the app can look at what I
actually lifted and tell me what to lift next. That is the deliverable. The Solo Leveling layer is
the reason I will open it every day.

## What it is

An offline-first installable PWA. All training data lives on the device and is the source of truth.
A small Cloudflare Worker exists only to mirror that data between my devices and to send one daily
push notification. The app must work completely with the network off, because gym basements have no
signal.

## Hard constraints — these are decided, do not revisit them

- **Offline-first.** IndexedDB is the source of truth. Every feature — progression engine, XP, stats,
  quest generation, rank calculation — runs client-side. The server is a mirror, never a dependency.
  If the app cannot fully function in airplane mode, it is wrong.
- **No login screen.** No email, no password, no OAuth. Identity is a capability token (see Sync).
- **Free tier only, and no credit card.** Cloudflare Workers + D1 + Cron Triggers. Explicitly **not**
  R2 — it requires a payment method on file even for its free tier. Progress photos, if any, stay in
  IndexedDB.
- **No secret ever reaches the client bundle.** See Security.
- **Store kg and cm internally, always.** Convert only at the render layer. Unit preference is a
  display setting.
- **Stack is settled: Vite + React + TypeScript.** Not Next.js. Not vinext (beta, and its whole value
  is SSR/RSC, which fights offline-first and burns the Worker CPU budget). Not MongoDB — D1 is SQLite
  with a native Worker binding, and the Atlas Data API is gone.

## Stack

```
Cloudflare Workers (single worker, single deploy)
├── Static Assets   → the React PWA shell
│                     (static asset requests are free, unlimited, and do not count
│                      toward the 100k/day Worker request limit — keep the shell static)
├── Hono router     → /api/* only: sync + push subscription
├── D1 (SQLite)     → sync mirror
└── Cron Trigger    → one daily quest push

Client: Vite · React · TypeScript · Tailwind · Framer Motion (System window animations)
        Dexie (IndexedDB) · Zustand · Zod at every boundary
        TanStack Router · vite-plugin-pwa (Workbox precache)
```

Free-tier ceilings that shape the design (verify these before relying on them — Cloudflare's limits
move, and the D1 daily-limit *enforcement* only started 1 Sept 2026):

| Resource | Free plan |
|---|---|
| Worker requests | 100,000/day |
| Worker CPU | **10 ms per invocation** |
| Static assets | free, unlimited, uncounted |
| D1 | 5 GB, 5M row reads/day, 100k row writes/day |
| Workers KV | 1 GB, 100k reads/day, **only 1,000 writes/day** |
| Cron Triggers | 5/account |
| Workers AI | 10,000 Neurons/day |

Two consequences: nothing write-heavy goes in KV (rate-limit counters and sync state go in D1), and
no password hashing on the server — bcrypt or argon2 would blow the 10 ms CPU cap. SHA-256 over a
random token is microseconds, which is what the identity design needs anyway.

## The game system

Canon mechanics and how each maps to training. Use the canon vocabulary in the UI — the terse blue
System window, `[Daily Quest has arrived.]`, "ARISE", stat windows.

| Canon | App |
|---|---|
| The System | The app. Terse blue notification windows, notification sound |
| Daily Quest | A small fixed baseline, **separate from my gym split**. Scaled from the canon 100 push-ups / 100 sit-ups / 100 squats / 10 km run |
| Penalty Zone (canon: 4h survival, reward +3 stat points and a loot box) | Missing the daily quest issues a Penalty Quest of extra work the next day. Never deletes progress — see Forgiveness |
| Gate / Dungeon | One gym session = one Gate. Monday is the CST Gate, Friday the Legs Gate |
| Gate rank E→S | Session difficulty, computed from planned tonnage × intensity |
| Boss | The top set. A PR is a boss kill |
| **Dungeon Break — canon: 7 days after a gate opens if the boss is not slain** | A skipped session stays open 7 days. Not made up in time → break → backlog penalty. Reuse the canon number |
| Red Gate (canon: minimum B-rank, closes behind you) | A voluntary brutal session — PR attempt or AMRAP finisher. Once entered, no partial credit |
| Instant Dungeon Key | Travel or home mode. Generates a bodyweight-only session from available equipment |
| **ARISE / shadow extraction** | Clearing a milestone on an exercise extracts a shadow, named and ranked from my e1RM percentile in that lift. Each grants a small passive buff. Active shadows are capped by INT (mana capacity), so the roster is a real choice |
| Igris / Beru / Tank | My strongest lifts get named marshal shadows |
| Job Change Quest | Around level 20, a benchmark test week. My stat distribution picks a class — Fighter, Tanker, Assassin, Ranger — with Shadow Monarch as the endgame |
| Hunter Rank E→D→C→B→A→S | **Derived from real published strength standards relative to bodyweight.** This is what ties the fantasy to something true; do not fake it |
| Reawakening Test | Re-assessment every 8–12 weeks, recomputes rank |
| Gold / mana crystals | Earned per session, spent in the System Shop |
| System Shop | Rest tokens, quest rerolls, cosmetics, shadow skins, themes |
| Titles ("Wolf Assassin") | Achievements: 100 unbroken push-ups, a 2× bodyweight squat, a 30-day streak |
| Runes / Skills | Intensity techniques unlock by level — drop sets at 10, rest-pause at 15, clusters at 25. Real coaching gating wearing a fantasy costume |
| Fatigue | Driven by ACWR. High fatigue cuts the XP multiplier and makes the System issue a Recovery Quest |
| Status Window | Home screen |
| Demon Castle floors | A 100-floor tower, each floor a benchmark to clear. Long-term content |
| Monarchs | My own past PRs. The Monarch of Sloth is my longest missed streak |
| Double Dungeon | First launch. "You have acquired the qualification to be a Player." |
| Hunter License | A shareable PNG stat card |

## The progression engine

This is the core. Get it right before anything cosmetic.

**Load progression — double progression.** Each exercise has a rep range `[lo, hi]` and a set count.

- All sets reach `hi` at RPE 8 or below → add one increment next session, reset reps to `lo`
- Any set falls below `lo` → drop load about 7%, or repeat the session
- Otherwise → hold load, add a rep to the lowest set

Increments: upper-body isolation 1.25–2.5 kg, upper compound 2.5 kg, lower compound 5 kg, cables and
machines one pin step.

**Bodyweight movements** (push-up variants, pull-ups, leg raises) progress along a ladder:
reps, then tempo, then added load, then a harder variation. That ladder is a skill tree, and it is a
natural fit for the shadow and rune layer — diamond push-ups unlock after incline push-ups are
mastered.

**e1RM** — Epley: `weight × (1 + reps / 30)`. Drives rank, PR detection, and shadow ranks.

**Weekly volume** — count hard sets per muscle per week against landmarks (MEV around 8–10, MAV
12–20, MRV around 20–25). Render as per-muscle mana bars. Below MEV reads as a starving muscle group.

**Fatigue** — ACWR = `7-day tonnage / (28-day tonnage / 4)`. Safe band 0.8–1.3. Above 1.5 the System
issues a Recovery Quest and the XP multiplier drops.

**Deload** — every fifth week, or when ACWR exceeds 1.5, or after two sessions of e1RM regression.

**Rank** — percentile of e1RM per kg of bodyweight for each major lift against published strength
standards, which are sex- and bodyweight-specific. Untrained→E, Novice→D, Intermediate→C,
Proficient→B, Advanced→A, Elite→S. Ship the lookup table with the app; it has to work offline.

**XP** — `tonnage/100 + 5 × hardSets + 25 × exercisePR + gateClearBonus`, multiplied by the fatigue
multiplier. Level curve `xpToNext = 100 × level^1.5`. Tune the constants so a consistent year of my
training lands somewhere around level 50; treat that as a calibration target, not a rule.

**Stats — hybrid, and this part matters.** Five canon stats: STR, VIT, AGI, INT, PER.

- *Derived* from a 28-day rolling window, so they cannot be gamed: STR from major-lift e1RM per kg of
  bodyweight, VIT from tonnage and streak, AGI from cardio and bodyweight rep density, PER from
  logging completeness and RPE accuracy, INT from program adherence.
- *Allocated*: 3 free points per level, as in the manhwa. Spending them **biases the next mesocycle's
  quest generation** — points into STR skew the engine toward heavy low-rep work.

Agency and honesty at the same time. The derived half is not cheatable; the allocated half is where I
express intent.

**Quest generation is deterministic.** A rules engine, not a language model. Progressive overload is
arithmetic, and a model inventing "3×8 at 60 kg" is unverifiable and can injure me. Any AI in this
project is for flavour text and free-text parsing only, and it should be Workers AI (10,000 Neurons a
day, free) or generated at build time — never a runtime call holding an external key.

## Data model

Append-only where possible. Never mutate history; recompute derived state from the log. This makes
re-grading, rollback, and schema migration survivable, and it happens to be how the System works in
fiction — the log is truth and the status window is a projection.

```ts
Exercise    { id, name, aliases[], pattern, primaryMuscles[], secondaryMuscles[],
              equipment, unit: 'kg'|'reps'|'time'|'distance', increment,
              repRange: [lo, hi], progressionLadder?: string[] }
Routine     { id, dayOfWeek, name, gateRank, blocks: Block[] }
Block       { type: 'single'|'superset',
              items: { exerciseId, sets, repRange, restSec }[] }
SessionLog  { id, routineId, startedAt, endedAt, bodyweight?, sets: SetLog[] }
SetLog      { exerciseId, order, weight, reps, rpe?, isWarmup, completedAt }
PlayerState { level, xp, statPoints, stats: {STR,VIT,AGI,INT,PER},
              fatigue, rank, class?, titles[], gold, streak, restTokens }
Shadow      { id, exerciseId, name, rank, extractedAt, buff }
QuestLog    { date, type: 'daily'|'gate'|'penalty'|'recovery', status, payload }
Profile     { sex, birthYear, heightCm, unitPref, trainingYears, equipmentAccess[] }
BodyMetric  { date, weightKg, waistCm?, neckCm?, hipCm?, bodyFatPct?,
              bodyFatSource?: 'dexa'|'hydrostatic'|'bodpod'|'calipers'|'bia'|'other' }
```

No BMI field anywhere. When `bodyFatPct` is absent but the tape measurements are present, the Navy
estimate is *derived* rather than stored — see Body composition.

## My actual training week

Encode these as the seed routines. My original spelling is in parentheses where it differed; keep
those as `aliases` so search finds them.

**Monday — CST (chest, shoulders, triceps)**
Incline Barbell Press (Barbel) · Machine Shoulder Press · Skullcrusher · Cable Fly ·
Machine Lateral Raise · Front Raises · Diamond Pushups (Dimond)

**Tuesday — Back and biceps**
1-Arm Cable Lat Pulldown (Cabel) · Pull-ups · Dumbbell Row (Dumble) · Cable Shrug · Machine Reverse
Fly · Cable Bicep Curl

My name for the shrug is "Cable Shrug-in": standing at a low pulley holding a straight bar at hip
height and shrugging. Upper traps primary, grip and mid traps secondary. Progress by reps, then load,
then a pause at the top. The app should cue "no rolling".

**Wednesday — Abs and biceps**
Machine Preacher Curls · Cable Bicep Curl · Strict Curls · Leg Raises · Machine Abs Crunch ·
Cable Crunch

**Thursday — CST, supersetted.** The `+` pairs are real supersets, so the Block model has to carry them.
Incline Pushups + Cable Chest Press (mid chest) · Pike Pushups + Cable Chest Press (lower chest) ·
Diamond Pushups + Cable Chest Press (upper chest) · Machine Shoulder Press ·
Tricep Overhead Extension (extention)

**Friday — Legs**
Barbell Squats · Leg Press · Hamstring Curl + Leg Extension (superset) · Barbell Calf Raises

**Saturday — Cardio and abs**
Leg Raises · Cable Crunch · Hanging Leg Raises · Treadmill 20–30 min, alternating 5 min walk and
5 min run

**Sunday — rest**

I do not follow a published program. This is just what I do, and the engine should apply progressive
overload to these movements rather than replace them with something else.

There are real gaps in it, and the app should surface them as dismissible System advisories rather
than silently rewriting my week. No hip hinge anywhere — no deadlift, RDL, or good morning, so the
hamstrings only get the curl machine. Direct biceps land on Tuesday and again on Wednesday, with
three curl variants on the Wednesday. Legs get one day against two push days. Monday carries a lot of
front-delt volume: incline press, then shoulder press, then front raises. And there is no grip work,
no rotator-cuff prehab, and no unilateral leg work anywhere in the week.

## Onboarding — the Awakening Test

Canon has hunters awakened and rank-tested, so onboarding *is* that, and it ends with the E-Rank
window and "you have acquired the qualification to be a Player." Every field is load-bearing for the
engine, not decoration:

| Field | What needs it |
|---|---|
| Sex | Strength-standard tables are sex-specific; rank is meaningless without it. Offer male, female, and prefer-not-to-say, and handle the third case gracefully |
| Bodyweight in kg, editable, re-logged weekly | Standards are per kg of bodyweight; also feeds relative-tonnage XP |
| Height | The Navy body-fat estimate (its only use, now that BMI is gone) |
| Age | Heart-rate zones for the treadmill work. Use Tanaka (`208 − 0.7 × age`), not `220 − age`. Also softens increments past about 40 |
| Training years | Starting rank floor, and how aggressive load increments are |
| Unit preference | Display only |
| Equipment access | Gate generation and Instant Dungeon Key fallbacks |

Waist, neck, and hip measurements and a body fat percentage are **not** part of this flow. Offer them
as a clearly skippable optional step at the end — most people arriving here have neither a tape
measure to hand nor a scan result — and let them be added later from the Physique panel. Onboarding
must complete, and every subsequent feature must work, with all of them left blank.

## Body composition — no BMI

BMI is out of this app entirely. Not as a stored field, not as a displayed number, not as an input to
anything. It cannot separate muscle from fat and will call a lean lifter overweight, which makes it
worse than useless here — it would actively mislead the person it is describing.

What replaces it, in order of how much it is worth:

**Bodyweight trend rather than bodyweight.** Daily weight swings a kilo or two on water, food, and
glycogen. Store every reading, but display a 7-day exponentially weighted moving average and its
slope. The raw number is noise; the slope is the signal.

**Waist circumference.** The single most informative tape measurement, and it needs no formula at
all. Log it weekly at the same site.

**The recomposition signal — the thing BMI can never show.** Weight flat or rising while the waist is
flat or shrinking means muscle gained and fat lost. That is what a lifter actually wants to know, and
it needs nothing but a scale and a tape measure, so it works for everyone. Surface it prominently.
Weight up with waist up is a bulk; weight down with waist down is a cut; weight down with waist flat
is a warning, because it suggests lean mass going out the door.

**Body fat percentage — optional, tiered, and never load-bearing.**

Nothing in the engine may require it. Rank, stats, XP, and quest generation all run on total
bodyweight and must keep running for someone who never enters a body fat number at all. Note
specifically that published strength standards are indexed on *total* bodyweight, not lean mass — do
not "improve" the rank calculation by switching it to lean mass, because that breaks the mapping to
the tables.

Most people have no lab number, so there are two input paths and a skip.

*Path A — enter a number.* The user types a percentage and picks where it came from. Store the source
alongside the value, because the sources are not equivalent and should not be displayed as though
they were:

| Source | Typical error | Handling |
|---|---|---|
| DEXA scan | ±1–2% | Trust as an absolute |
| Hydrostatic weighing / BodPod | ±2–3% | Trust as an absolute |
| Skinfold calipers | ±3–5%, operator-dependent | Absolute, with the caveat shown |
| Navy tape estimate | ±3–4% | Absolute, with the caveat shown |
| BIA or smart scale | ±5–8%, moves with hydration | **Trend only.** Never present as an absolute — these can shift 3–5 points day to day on water alone |
| Other or unknown | unknown | Trend only |

*Path B — tape measurements, computed.* Given neck, waist, height, and hips for women, compute the
Navy estimate (Hodgdon-Beckett, 1984; correlates about r = 0.90 with hydrostatic weighing, standard
error roughly 3–4 points against DEXA). All measurements in cm, which is what we store anyway:

```
Men:   %BF = 495 / (1.0324  − 0.19077 × log10(waist − neck)       + 0.15456 × log10(height)) − 450
Women: %BF = 495 / (1.29579 − 0.35004 × log10(waist + hip − neck) + 0.22100 × log10(height)) − 450
```

Measurement sites, and note the waist site genuinely differs by sex: neck just below the larynx;
waist at navel level for men, but at the narrowest part of the abdomen for women; hips at the widest
part of the buttocks. Show a diagram or an unambiguous instruction, because an inconsistent site
makes the trend worthless even when each individual reading is fine.

The formula needs sex. If the person chose prefer-not-to-say, offer them the choice of which formula
to apply, and if they decline, skip the estimate and fall back to weight trend plus waist trend. That
fallback path has to stay fully functional — it is not a degraded mode.

*Path C — skip it.* This is the default, and everything above still works.

**Derived, computed rather than stored:** lean body mass and fat mass whenever a body fat percentage
is available, each with its own trend. Recompute them from the log rather than storing them, so that
a corrected measurement re-derives the history behind it.

Re-measure on the Reawakening Test cadence, every 8–12 weeks — a body-composition re-check is
naturally what that event is for. In the UI this whole readout is the Physique panel of the Status
Window.

## Forgiveness

The canon penalty is cruel, and real cruelty destroys adherence — a punishing system is how this app
dies. So: two rest tokens a month, a way to declare illness or travel, and a streak freeze. Penalties
add work; they never delete progress. Day rollover is 04:00 local, not midnight, so a late session
does not split across two days.

## Sync — no accounts

The simplification that makes this tractable: **sync only the immutable event log and derive
everything else locally.** `SessionLog` and `SetLog` are append-only and never edited, so conflicts
are close to impossible. `PlayerState` is derived — never sync it; recompute it from the log on each
device. Settings are last-write-wins. This removes most of the usual sync complexity.

```
POST /api/sync  { since: <seq>, changes: [...] }
  → server assigns a monotonic seq per hunter, returns rows newer than `since`
```

Identity is a capability token:

1. On first launch the client generates 32 random bytes with `crypto.getRandomValues` — the Hunter
   Secret. It leaves the device only as a bearer header.
2. The server stores only `SHA-256(secret)`. All rows are scoped to it.
3. The UI shows a 24-character Hunter License Key and tells me to save it.
4. A second device pairs by scanning a QR code rendered on the first, or by typing the key. In
   fiction, call it System Link.
5. A later optional upgrade path is a passkey, so the operating system's password manager syncs the
   credential.

This is real authentication with no login screen — the key *is* the credential. Losing it means
losing the server-side mirror, and the interface has to say so before it becomes my problem rather
than a surprise.

## Security

Treat this section as requirements, not suggestions.

- Anything shipped to the browser is public: every `VITE_*` variable, every string in the bundle,
  everything in the service worker cache. There is no client-side way to hide a key, and obfuscation
  is not a mitigation. If a secret reaches the browser, it is leaked.
- Secrets live in Worker environment variables set with `wrangler secret put` — never in
  `wrangler.toml`, never in a committed file. Gitignore `.env*` and `.dev.vars`.
- Store `SHA-256(secret)`, never the secret. Compare with a timing-safe comparison.
- Rate-limit `/api/sync` per hunter ID in D1, not KV — KV allows only 1,000 writes a day.
- Never log request bodies. They carry health data.
- Set a strict Content-Security-Policy. Keep third-party analytics off any route touching body
  metrics.
- Enable GitHub secret scanning and push protection before the first commit, not after.
- If runtime AI is ever added, prefer Workers AI so no external key exists to leak. If an external
  key becomes necessary, it lives only in a Worker environment variable, the endpoint is gated by a
  shared secret I configure, it is rate-limited, and a hard spend cap is set at the provider so that
  total compromise is still bounded.

## Phases

Ship in this order. Phase 2 is where this stops being a sticker chart, so get there quickly.

0. Awakening Test, exercise library seeded from my week, session logging, a rest timer with a screen
   wake lock, PWA install. No game layer yet.
1. XP, levels, the five stats, Status Window, Daily Quest, streak.
2. **The progression engine** — automatic per-exercise targets, e1RM, PR detection, volume landmarks,
   ACWR and deload.
3. Sync and QR pairing. The Worker and D1 appear here and not before.
4. Gates with ranks, Dungeon Break, shadow extraction and the shadow army, titles, hunter rank from
   standards, the shop.
5. Daily-quest push via a Cron Trigger and web-push. iOS needs 16.4 or later and an installed PWA.
6. Flavour text via Workers AI or build-time generation.

## How I want you to work

Scope the whole thing first. Ask me the questions that would change the architecture, then build. I
would rather answer five good questions up front than review a wrong foundation later.

Do not follow this brief as a recipe. It is a specification of decisions, constraints, and formulas,
not a procedure — pick your own order of work inside a phase.

Establish a way to check your own work as you build, and run it on a cadence, verifying against this
brief. Prefer a fresh-context sub-agent doing the verifying over self-critique. Delegate independent
subtasks to sub-agents and keep working while they run rather than blocking on each one; step in if
one drifts or is missing context.

Before reporting progress, audit each claim against a tool result from this session. Only report work
you can point to evidence for, and if something is not yet verified, say so. If tests fail, say so
and show the output. If you skipped a step, say that. When something is done and verified, state it
plainly.

Keep changes to what each phase needs. Don't add features, refactor, or introduce abstractions beyond
what the task requires, and don't design for hypothetical future requirements. No error handling or
validation for cases that cannot happen — validate at system boundaries only: my input, the network,
and the Worker's request surface. If you find a pre-existing problem, or something this brief doesn't
mention, report it as a follow-up in your summary rather than fixing it in the same change. Verify
however you like; scratch scripts don't need to be kept, and don't turn them into permanent test
files. That is about extras only — implement every behaviour a phase does ask for, completely.

When editing existing files, prefer surgical edits over whole-file rewrites where the result is the
same.

Keep a `NOTES.md` for things worth carrying between sessions: one lesson per entry with a one-line
summary at the top, corrections and confirmed approaches alike, and why each mattered. Consult it at
the start of later sessions. Don't record what the repository or git history already shows; update an
entry rather than duplicating it, and delete entries that turn out to be wrong.

Keep a `TODO.md` for tracking tasks, you can mark tasks with status and order the tasks in the order of logical implementation. update an
task rather than duplicating it, and delete task that turn out to be wrong. This is just for tracking status of each tasks so keep the tassk one-line.

Also maintain a `engineering-standards.md` to note the important standerds to follow while writing code like TDD, Adapter patern, singleton pattern, etc. whatever is usefull according to our tech stack and infrastructure.

Alos maintain a `infrastructure.md` file which will hold the details about the infrastructure which is easy to understand and follow for a developer.

Cloudflare's free-tier limits, the Workers API surface, and the library versions named in this brief
all move faster than model training data. Where a number or an API shape matters, verify it against
current documentation before building on it. Recognising a product name is not the same as knowing
its current state, and partial knowledge is exactly what makes a stale answer sound authoritative.

Lead with the outcome when you report back — the first sentence should answer what happened or what
you found, with detail after that. Write the final summary for someone who did not watch you work:
plain sentences, no arrow chains, no shorthand you invented along the way, and each file or flag you
mention explained in its own clause. If you have to choose between short and clear, choose clear.
