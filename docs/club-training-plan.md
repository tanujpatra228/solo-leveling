# Indian club training — research and integration plan

The gym has a wooden Indian club. This is what the evidence actually supports, and how it fits a
programme and an XP model that were both built for hypertrophy.

Written 2026-09-06.

## 1. What the tool is, and is not

An Indian club is a light tapered wooden club, typically **0.5–2.0 kg**, with the standard club
around **1.1 kg**. It is swung in continuous circular patterns, usually in pairs. It is not a
clubbell and not a gada — those are steel, 5–20 kg, and are strength tools. The distinction
matters because the training effect is different and the two get conflated constantly online.

The honest summary of what light club swinging does:

- **Shoulder and thoracic mobility**, through loaded circular movement in all three planes rather
  than the single plane most gym movements work in.
- **Rotator cuff conditioning** at a load low enough to be worked daily and at high rep counts,
  which is difficult with dumbbells.
- **Grip and forearm endurance**, from holding a lever at the end of a long moment arm.
- **Coordination and joint prep**, which is why it survives as a warm-up modality.

What it does **not** do: build muscle or maximal strength. A 1 kg club cannot drive hypertrophy,
and treating it as though it can is the mistake this plan is mostly written to prevent.

### On the evidence

Be careful here. Most of what is written about Indian clubs is tradition and practitioner claim,
not measurement. The one peer-reviewed result I could find is a 2023 study on cricket fast bowlers
reporting improved shoulder rotational range of motion and internal rotator strength after a
clubbell programme. I could not read the full text — PMC blocked automated access — so I cannot
report its sample size, duration, or controls, and it should not be cited in the app as though it
settles anything.

Position to take: the mobility and cuff-conditioning benefits are plausible, widely reported by
practitioners, and carry very low risk at 1 kg. That is enough to justify including it. It is not
enough to make claims in the interface about what it will do.

### Safety, worth one line in the cue

The classic injury route is starting too heavy — elbow and wrist strain from a club that is fine to
hold and wrong to swing. Standard clubs are around a kilogram for a reason. Space matters too: a
swung club has a wide arc and gyms are crowded.

## 2. The design trap

Club work is high-rep, low-load, continuous. Logged naively it corrupts two systems that already
work.

**It must not count as hypertrophy volume.** `countHardSets` feeds `hardSetsPerMuscle`, which feeds
`detectAdvisories` and the weekly volume landmarks. `isHardSet` counts any non-warmup set with no
logged RPE as hard. So three sets of club swings would add three hard sets to the shoulders — and
`detectAdvisories` would either fire a false "shoulder volume is too high" warning or, worse, mask
genuine under-volume by filling the quota with prep work. Prep is not stimulus, and the volume
model must not confuse them.

**Its progression is complexity, not load.** The club stays 1 kg forever; you advance by learning
harder patterns. `computeNextTarget`'s bodyweight branch tries `add_external_load` before
`advance_variation`, which is exactly backwards here — a heavier club is a different tool, not the
next rep target.

**And it earns zero XP today.** Club work is naturally logged as time (the standard protocol is 45
seconds of work, 15 seconds of rest), and `isHardSet` rejects any set with `reps <= 0` while the
entry form sends `reps: 0` for `time` units. This is the same defect that makes `treadmill-intervals`
worth nothing, recorded in `docs/substitution-plan.md` section 0.

**So this feature depends on commit 2 of the substitution plan.** Seeding club exercises before the
cardio XP fix would add movements that pay nothing, which reads as the feature being broken.

## 3. The exercises to seed

A progression ladder, easiest first. All `unit: 'time'`, all `equipment: ['club']`, all
`pattern: 'mobility'`.

| Exercise | Pattern taught | Notes |
|---|---|---|
| Club Front Pendulum | the basic swing, elbows fixed | entry point; teaches the arc |
| Club Inner Circle | small circle inside the arm | first rotation under load |
| Club Outer Circle | small circle outside the arm | the harder of the two circles |
| Club Inside Mill | full cast, Y position, sword-in-sheath, elbow circle | the classic beginner sequence |
| Club Outside Mill | the mill reversed | requires the inside mill first |
| Club Hand-to-Hand | passing between hands mid-swing | coordination ceiling |

`progressionLadder` in that order, so `advance_variation` walks it. Protocol on every one: 45
seconds work, 15 seconds rest, which is what the sources converge on and what suits a `time` unit.

## 4. Schema changes

- **`club` added to `EquipmentSchema`.** Nothing currently uses it.
- **`mobility` added to `MovementPatternSchema`.** Club work is not push, pull, squat, core, or
  cardio, and forcing it into `isolation` is what would silently feed the volume model.
- **Volume exclusion derived from the pattern**, not a new field: `hardSetsPerMuscle` skips
  `pattern === 'mobility'`. Deriving keeps one source of truth, and per rule 16 a second flag has no
  second caller yet.
- **`computeNextTarget` must prefer `advance_variation` over `add_external_load`** for a `mobility`
  exercise, so mastering a pattern unlocks the next pattern rather than asking for a heavier club.

## 5. Where it goes in the week

The best-supported use is shoulder prep immediately before overhead and pressing work, so that is
where it earns its place rather than being sprinkled everywhere.

- **Monday CST Gate** — a club block first, before pressing.
- **Thursday CST Gate (Supersets)** — same, and this is the heaviest shoulder day of the week.
- **Saturday Cardio and Abs Gate** — a longer club flow as conditioning and active recovery. It
  fits the day's intent and gives the ladder somewhere to be practised without competing with
  pressing.

Three placements, not six. Club work before Friday Legs or Wednesday Abs would be habit for its own
sake, and rule 16 says build what the phase asks for.

Each block is a single item, 2–3 sets of 45 seconds, `restSec: 15`.

## 6. Interaction with the substitution plan

Club exercises are `role: 'prescribed'` — they are part of the programme, not stand-ins.

But the club is a single shared object in a gym, so it will be occupied, and the coverage guarantee
in `docs/substitution-plan.md` section 4 now has to cover a new `mobility / shoulders` group. The
fallbacks are easy and need nothing: band dislocates where a band exists, and otherwise arm circles
and shoulder CARs, both `role: 'fallback'`, both bodyweight.

Conversely the club is itself an excellent fallback for other shoulder prep, so it should appear as
a tier 2 candidate for shoulder work when it is free.

## 7. Thematic note

An Indian club is a weapon-adjacent implement with genuine wrestling heritage, which sits well in a
System that already talks about ranks and gates. There is an obvious hook — weapon proficiency,
a swinging ritual before a gate — and it should stay a hook. Flavour text on the exercises is free;
a new game subsystem for it is not, and rule 16 applies.

## 8. Sequence

1. Commit 2 of `docs/substitution-plan.md` — XP for time-based work. **Blocking.**
2. `club` equipment, `mobility` pattern, volume exclusion, and the `advance_variation` preference.
3. Seed the six club exercises with their ladder.
4. Add the three routine blocks.
5. Add the mobility fallbacks and extend the coverage guarantee to the new group.

## 9. Verification

- A club block logs, earns XP proportional to its time, and appears in the session summary.
- Three sets of club work add **zero** hard sets to `hardSetsPerMuscle`, and trigger no volume
  advisory for shoulders.
- Weekly shoulder volume is unchanged by adding club blocks — the number the advisories read is the
  same before and after.
- Mastering Club Front Pendulum advances to Club Inner Circle, and never asks for a heavier club.
- With `blockedEquipment: ['club']`, a club block still returns a substitute.
- The club appears as a tier 2 candidate for shoulder prep when it is free.

## Sources

- [Indian club — Wikipedia](https://en.wikipedia.org/wiki/Indian_club)
- [An Introduction to Indian Club Training — The Art of Manliness](https://www.artofmanliness.com/health-fitness/fitness/an-introduction-to-indian-club-training/)
- [Indian Clubs Workout for Beginners — Maverick Mace](https://www.maverickmace.com/indian-clubs-workout-for-beginners/)
- [Light Clubs — Dutch Flow Academy](https://dutchflowacademy.com/light-clubs/)
- [Indian Club Swinging Benefits — Dutch Flow Academy](https://dutchflowacademy.com/indian-club-swinging-benefits-mobility-joint-health-and-coordination/)
- [Indian Clubs vs Steel Maces — Gravity Fitness](https://gravity.fitness/blogs/training/indian-clubs-vs-steel-maces-how-to-choose-between-them)
- [Indian Clubs for Shoulder Health and Mobility — Fitness Volt](https://fitnessvolt.com/indian-clubs-shoulder-health/)
- [Effect of Indian clubbell exercises on cricket fast bowlers' shoulder kinematics — PMC10798617](https://pmc.ncbi.nlm.nih.gov/articles/PMC10798617/) (abstract only; full text blocked)
