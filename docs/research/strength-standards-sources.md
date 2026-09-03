# Strength Standards Research — Published, Citable Lookup Tables (kg)

**Compiled:** 2026-09-03
**Purpose:** offline 1RM → training-level lookup table for a fitness app, indexed by sex and bodyweight (kg).
**Rule followed:** every number below was scraped from the live page HTML or an Internet Archive capture of the publisher's own page. Nothing is interpolated, estimated, unit-converted, or recalled from memory. Where a value was unavailable it is marked as missing rather than filled in.

---

## 1. Sources used

| # | Source | Status | How retrieved |
|---|--------|--------|---------------|
| A | **StrengthLevel.com** strength standards, kg pages | Retrieved successfully, live | Direct HTTPS fetch of the live page, then a second independent raw-HTML fetch (`curl`) and HTML table parse to verify every cell. Both passes matched exactly. |
| B | **ExRx.net** Weightlifting Performance Standards, kg pages | **Live site blocked** — every `exrx.net` URL returns HTTP 403 behind a Cloudflare "Just a moment…" JS interstitial, for both the page-fetch tool and `curl` with full browser headers. Retrieved instead from **Internet Archive (web.archive.org) captures** of the ExRx pages. | Wayback availability API → raw (`id_`) capture → HTML table parse. Capture timestamps recorded per lift below. |

### Source A — StrengthLevel.com URLs

- Squat: https://strengthlevel.com/strength-standards/squat/kg
- Bench press: https://strengthlevel.com/strength-standards/bench-press/kg
- Shoulder press: https://strengthlevel.com/strength-standards/shoulder-press/kg
- Deadlift: https://strengthlevel.com/strength-standards/deadlift/kg
- Incline bench press: https://strengthlevel.com/strength-standards/incline-bench-press/kg
- Pull ups: https://strengthlevel.com/strength-standards/pull-ups/kg

**Version / date of source pages:** fetched 2026-09-03. Each page publishes its own dataset window (see the per-lift provenance blocks in §4). Data cutoffs range 5 March 2026 – 10 March 2026. The site states: "We will continue to update them as more community data becomes available." The site also states: "Strength Level introduced these exact Beginner-to-Elite percentile boundaries in 2015." Footer: Company Registration No. 14076102.

### Source B — ExRx.net URLs and archive captures

| Lift | Live URL (403 when fetched) | Wayback capture used |
|------|------------------------------|----------------------|
| Squat | https://exrx.net/Testing/WeightLifting/SquatStandardsKg | capture **20250821035616** (2025-08-21 03:56:16 UTC) |
| Bench press | https://exrx.net/Testing/WeightLifting/BenchStandardsKg | capture **20260405160254** (2026-04-05 16:02:54 UTC) |
| Deadlift | https://exrx.net/Testing/WeightLifting/DeadliftStandardsKg | capture **20250802012003** (2025-08-02 01:20:03 UTC) |
| Press (overhead) | https://exrx.net/Testing/WeightLifting/PressStandardsKg | capture **20230523091159** (2023-05-23 09:11:59 UTC) |
| Methodology page | https://exrx.net/Testing/WeightLifting/StrengthStandards | capture **20260812203558** (2026-08-12 20:35:58 UTC) |

Wayback URL form used: `http://web.archive.org/web/<timestamp>id_/<live URL>`.

ExRx copyright line as captured: **"©1999-2026 ExRx.net LLC"**. Page titles are of the form "Squat Strength Standards (Ages 18-39, kg)". The methodology page credits the tables to **Dr. Lon Kilgore, PhD**.

Note: the four ExRx captures are from different dates (2023–2026). The ExRx tables are historically static (described by the publisher as based on ~70 years of accumulated competition data, not a rolling dataset), but the Press capture is the oldest (2023) and is the one most worth re-verifying if the live site ever becomes fetchable.

---

## 2. What the numbers are (units and measurement type)

**Both sources publish one-repetition maximum (1RM) values in the stated unit. Neither publishes rep-based or submaximal loads in these weight tables** — the pull-up page is the sole exception, and it publishes both a rep table and a 1RM added-load table.

### StrengthLevel

- Explicitly labelled 1RM. Verbatim examples: "The average Squat weight for a male lifter is 131 kg (1RM)"; "The average Bench Press is 96 kg for men and 51 kg for women (1RM)".
- **"Barbell weights include the weight of the bar, normally 20 kg / 44 lb."** — important for the app: the table value is total loaded barbell mass, bar included.
- Values are derived from user-submitted community lifts; submaximal sets are converted to a 1RM estimate by the site before aggregation. "Qualifying results are retained after checks for implausible data, duplicates, and unusual or automated submission patterns."
- Bodyweight column header is `BW` in kg; level column headers are abbreviated `Beg. | Nov. | Int. | Adv. | Elite`.

### ExRx

Verbatim from the ExRx methodology page:

> "The performance standards are adult standards (>18 years old) for a single maximal repetition (1RM) based on competitive weightlifter and powerlifting classification systems in use from the 1950's to present."
>
> "Accumulated performance data is not predictive or regression derived. These performance standards should not to be confused with strength norms."
>
> "Standards are based on lifts with no assistive training gear (belt is acceptable) as described in each lift's official international competitive and/or as shown via link to exercise."
>
> "Tables for the basic barbell exercises are based on nearly 70 years of accumulated performance data and are not predicted or regression derived."

Lift-specific condition, verbatim from the ExRx squat page: **"In order for these standards to apply, squat must be performed with thighs traveling below parallel to floor."**

The ExRx kg tables reproduced here are the **Ages 18-39** tables. ExRx publishes separate pages for ages 40-49, 50-59 and 60-69 (`SquatStandards40Kg`, `SquatStandards50Kg`, `SquatStandards60Kg`, and equivalents for the other lifts). Those were not retrieved.

---

## 3. Level names and the tier-count mismatch

### What each source actually publishes

**ExRx** — 5 named levels plus a reference column:
`Untrained | Novice | Intermediate | Advanced | Elite` (+ a **World Record** column, which is a record reference, not a training level).

Verbatim ExRx level definitions:

| Level | ExRx definition (verbatim) |
|-------|-----------------------------|
| Untrained | "An individual who has not trained on the exercises before, but can perform them correctly." |
| Novice | "An individual who has trained regularly for up to several months." |
| Intermediate | "An individual who has trained regularly for up to a couple years." |
| Advanced | "An individual who has trained multiple years." |
| Elite | "An athlete competing in strength sports. Keep in mind, the standards shown in the tables do not represent the highest level of strength performance possible." |

**StrengthLevel** — 5 named levels:
`Beginner | Novice | Intermediate | Advanced | Elite`

Verbatim StrengthLevel level definitions (these are **percentile** boundaries):

| Level | StrengthLevel definition (verbatim) |
|-------|--------------------------------------|
| Beginner | "Stronger than 5% of lifters. A beginner lifter can perform the movement correctly and has practiced it for at least a month." |
| Novice | "Stronger than 20% of lifters. A novice lifter has trained regularly in the technique for at least six months." |
| Intermediate | "Stronger than 50% of lifters. An intermediate lifter has trained regularly in the technique for at least two years." |
| Advanced | "Stronger than 80% of lifters. An advanced lifter has progressed for over five years." |
| Elite | "Stronger than 95% of lifters. An elite lifter has dedicated over five years to become competitive at strength sports." |

### The mismatch — read this before mapping to E/D/C/B/A/S

**Neither source has 6 tiers. Both have exactly 5.** The app's requested ladder (Untrained→E, Novice→D, Intermediate→C, Proficient/Advanced→B, Advanced→A, Elite→S) needs 6, and specifically asks for **two distinct tiers between Intermediate and Elite** ("Proficient/Advanced" and "Advanced"). **No published tier in either source corresponds to that extra middle band. Neither source publishes a "Proficient" tier at all.**

There is one honest way to reach 6 bands without inventing numbers: **5 published thresholds partition the number line into 6 bands** — one band below the lowest threshold, plus one band at-or-above each of the 5 thresholds.

| App grade | Band using published thresholds (ExRx) | Band using published thresholds (StrengthLevel) |
|-----------|----------------------------------------|--------------------------------------------------|
| E | 1RM < Untrained value | 1RM < Beginner value (below ~5th percentile) |
| D | Untrained ≤ 1RM < Novice | Beginner ≤ 1RM < Novice (≈5th–20th pct) |
| C | Novice ≤ 1RM < Intermediate | Novice ≤ 1RM < Intermediate (≈20th–50th pct) |
| B | Intermediate ≤ 1RM < Advanced | Intermediate ≤ 1RM < Advanced (≈50th–80th pct) |
| A | Advanced ≤ 1RM < Elite | Advanced ≤ 1RM < Elite (≈80th–95th pct) |
| S | 1RM ≥ Elite | 1RM ≥ Elite (top ~5%) |

**This mapping is a proposal, not something either publisher endorses.** Note that it shifts the label semantics by one step relative to the app's stated naming: a lifter exactly at the published "Intermediate" threshold lands in grade B, not grade C. If the app must preserve its literal label-to-grade wording, the "Proficient/Advanced→B" tier has no published basis and would have to be synthesised — which is beyond what this research can support without fabricating numbers.

**Recommendation for shipping:** use **StrengthLevel** as the primary table, because (1) it is live and fetchable, so it is re-verifiable and re-citable at ship time, whereas ExRx is Cloudflare-blocked and reachable only via archive; (2) its bodyweight rows are a regular 5 kg grid, directly indexable with no weight-class boundary logic; (3) its tiers are explicit percentiles, giving the app a defensible statement of what a grade means; (4) it covers all 6 requested lifts versus ExRx's 4. Keep ExRx as a secondary citation for the four barbell lifts — it is the more conservative, competition-classification-derived source and is a useful sanity check.

---

## 4. StrengthLevel tables (kg, 1RM, bar weight included)

Column headers exactly as published: `BW | Beg. | Nov. | Int. | Adv. | Elite`. `BW` = bodyweight in kg. All values in kg.

### 4.1 Squat (barbell back squat)

Page title: "Squat Standards for Men and Women (kg) - Strength Level". Provenance block as published: Community lifts 24,988,444 · Qualifying results 7,039,938 · Male results 6,014,970 · Female results 1,024,968 · Data start 7 March 2015 · Data cutoff 8 March 2026. Published averages: 131 kg men / 76 kg women (1RM).

*(Discrepancy noted: the page's meta description says "since 2014" while its own provenance table says data start 7 March 2015. The provenance table is the more specific claim.)*

**Male**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | 36 | 55 | 78 | 106 | 137 |
| 55 | 43 | 63 | 88 | 118 | 150 |
| 60 | 49 | 71 | 98 | 129 | 162 |
| 65 | 56 | 79 | 107 | 139 | 174 |
| 70 | 62 | 86 | 116 | 149 | 185 |
| 75 | 69 | 94 | 124 | 159 | 196 |
| 80 | 75 | 101 | 132 | 168 | 206 |
| 85 | 81 | 108 | 140 | 177 | 216 |
| 90 | 87 | 115 | 148 | 186 | 226 |
| 95 | 93 | 121 | 156 | 194 | 235 |
| 100 | 98 | 128 | 163 | 203 | 244 |
| 105 | 104 | 134 | 170 | 211 | 253 |
| 110 | 109 | 140 | 177 | 218 | 261 |
| 115 | 115 | 147 | 184 | 226 | 270 |
| 120 | 120 | 152 | 191 | 233 | 278 |
| 125 | 125 | 158 | 197 | 240 | 285 |
| 130 | 130 | 164 | 203 | 247 | 293 |
| 135 | 135 | 169 | 209 | 254 | 300 |
| 140 | 140 | 175 | 215 | 261 | 307 |

**Female**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | 19 | 34 | 53 | 76 | 102 |
| 45 | 23 | 38 | 58 | 82 | 110 |
| 50 | 26 | 42 | 63 | 88 | 116 |
| 55 | 29 | 46 | 68 | 94 | 123 |
| 60 | 32 | 49 | 72 | 99 | 129 |
| 65 | 35 | 53 | 76 | 104 | 134 |
| 70 | 37 | 56 | 80 | 109 | 140 |
| 75 | 40 | 59 | 84 | 113 | 145 |
| 80 | 42 | 62 | 88 | 117 | 149 |
| 85 | 45 | 65 | 91 | 121 | 154 |
| 90 | 47 | 68 | 94 | 125 | 158 |
| 95 | 49 | 71 | 98 | 129 | 162 |
| 100 | 52 | 74 | 101 | 132 | 166 |
| 105 | 54 | 76 | 104 | 136 | 170 |
| 110 | 56 | 79 | 107 | 139 | 174 |
| 115 | 58 | 81 | 109 | 142 | 177 |
| 120 | 60 | 83 | 112 | 145 | 181 |

Also published on the same page, useful as an implementation cross-check (bodyweight-multiple form): male Beginner 0.75x, Novice 1.25x, Intermediate 1.75x, Advanced 2.25x, Elite 2.75x bodyweight; female 0.50x / 0.75x / 1.25x / 1.75x / 2.25x.

### 4.2 Bench press (flat barbell)

Page title: "Bench Press Standards for Men and Women (kg) - Strength Level". Provenance: Community lifts 48,718,584 · Qualifying results 10,923,537 · Male 9,906,475 · Female 1,017,062 · Data start 22 March 2015 · Data cutoff 10 March 2026. Published averages: 96 kg men / 51 kg women (1RM).

**Male**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | 27 | 41 | 58 | 78 | 101 |
| 55 | 32 | 47 | 65 | 87 | 110 |
| 60 | 37 | 53 | 72 | 95 | 119 |
| 65 | 42 | 59 | 79 | 102 | 128 |
| 70 | 47 | 64 | 85 | 110 | 136 |
| 75 | 51 | 70 | 92 | 117 | 144 |
| 80 | 56 | 75 | 98 | 124 | 151 |
| 85 | 60 | 80 | 104 | 130 | 158 |
| 90 | 65 | 85 | 109 | 137 | 165 |
| 95 | 69 | 90 | 115 | 143 | 172 |
| 100 | 73 | 95 | 120 | 149 | 179 |
| 105 | 77 | 99 | 125 | 155 | 185 |
| 110 | 81 | 104 | 131 | 160 | 191 |
| 115 | 85 | 108 | 135 | 166 | 197 |
| 120 | 89 | 113 | 140 | 171 | 203 |
| 125 | 93 | 117 | 145 | 176 | 209 |
| 130 | 97 | 121 | 150 | 181 | 214 |
| 135 | 100 | 125 | 154 | 186 | 220 |
| 140 | 104 | 129 | 158 | 191 | 225 |

**Female**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | 10 | 19 | 33 | 49 | 68 |
| 45 | 12 | 22 | 36 | 54 | 74 |
| 50 | 14 | 25 | 40 | 58 | 79 |
| 55 | 17 | 28 | 44 | 62 | 84 |
| 60 | 19 | 31 | 47 | 66 | 88 |
| 65 | 21 | 33 | 50 | 70 | 92 |
| 70 | 22 | 36 | 53 | 74 | 96 |
| 75 | 24 | 38 | 56 | 77 | 100 |
| 80 | 26 | 40 | 59 | 80 | 104 |
| 85 | 28 | 43 | 61 | 83 | 107 |
| 90 | 30 | 45 | 64 | 86 | 111 |
| 95 | 31 | 47 | 66 | 89 | 114 |
| 100 | 33 | 49 | 69 | 92 | 117 |
| 105 | 35 | 51 | 71 | 94 | 120 |
| 110 | 36 | 53 | 73 | 97 | 123 |
| 115 | 38 | 54 | 75 | 99 | 126 |
| 120 | 39 | 56 | 77 | 102 | 128 |

### 4.3 Shoulder press (StrengthLevel's name for the barbell overhead press)

Page title: "Shoulder Press Standards for Men and Women (kg) - Strength Level". Provenance: Community lifts 5,644,500 · Qualifying results 1,827,472 · Male 1,622,185 · Female 205,287 · Data start 12 August 2015 · Data cutoff 5 March 2026. Published averages: 62 kg men / 33 kg women (1RM).

*Naming caveat:* the page is titled "Shoulder Press", sits in StrengthLevel's **Barbell** exercise category, and is the site's barbell overhead-press entry (dumbbell and seated variants are separate exercises with their own pages). The page does not state standing vs seated in its own text, so "standing" is an inference from the exercise taxonomy, not a published claim.

**Male**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | 15 | 24 | 36 | 51 | 67 |
| 55 | 18 | 28 | 41 | 56 | 73 |
| 60 | 21 | 32 | 45 | 62 | 79 |
| 65 | 24 | 35 | 50 | 67 | 85 |
| 70 | 27 | 39 | 54 | 72 | 90 |
| 75 | 30 | 43 | 58 | 76 | 96 |
| 80 | 33 | 46 | 62 | 81 | 101 |
| 85 | 36 | 49 | 66 | 85 | 106 |
| 90 | 38 | 53 | 70 | 90 | 111 |
| 95 | 41 | 56 | 74 | 94 | 115 |
| 100 | 44 | 59 | 77 | 98 | 120 |
| 105 | 47 | 62 | 81 | 102 | 124 |
| 110 | 49 | 65 | 84 | 105 | 128 |
| 115 | 52 | 68 | 87 | 109 | 132 |
| 120 | 54 | 71 | 90 | 113 | 136 |
| 125 | 56 | 73 | 94 | 116 | 140 |
| 130 | 59 | 76 | 97 | 119 | 144 |
| 135 | 61 | 79 | 100 | 123 | 147 |
| 140 | 63 | 81 | 102 | 126 | 151 |

**Female**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | 7 | 13 | 22 | 33 | 45 |
| 45 | 9 | 15 | 24 | 36 | 48 |
| 50 | 10 | 17 | 27 | 38 | 51 |
| 55 | 11 | 19 | 29 | 41 | 54 |
| 60 | 12 | 20 | 31 | 43 | 57 |
| 65 | 14 | 22 | 32 | 45 | 59 |
| 70 | 15 | 23 | 34 | 47 | 62 |
| 75 | 16 | 25 | 36 | 49 | 64 |
| 80 | 17 | 26 | 37 | 51 | 66 |
| 85 | 18 | 27 | 39 | 53 | 68 |
| 90 | 19 | 28 | 40 | 54 | 70 |
| 95 | 20 | 30 | 42 | 56 | 72 |
| 100 | 21 | 31 | 43 | 58 | 74 |
| 105 | 22 | 32 | 45 | 59 | 75 |
| 110 | 23 | 33 | 46 | 61 | 77 |
| 115 | 24 | 34 | 47 | 62 | 79 |
| 120 | 24 | 35 | 48 | 64 | 80 |

### 4.4 Deadlift

Page title: "Deadlift Standards for Men and Women (kg) - Strength Level". Provenance: Community lifts 22,978,599 · Qualifying results 6,393,746 · Male 5,398,185 · Female 995,561 · Data start 16 March 2015 · Data cutoff 10 March 2026. Published averages: 154 kg men / 91 kg women (1RM).

**Male**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | 46 | 68 | 96 | 129 | 164 |
| 55 | 54 | 77 | 107 | 141 | 178 |
| 60 | 61 | 86 | 117 | 153 | 191 |
| 65 | 68 | 95 | 127 | 164 | 204 |
| 70 | 75 | 103 | 137 | 175 | 216 |
| 75 | 82 | 111 | 146 | 186 | 228 |
| 80 | 89 | 119 | 155 | 196 | 239 |
| 85 | 96 | 127 | 164 | 205 | 250 |
| 90 | 102 | 134 | 172 | 215 | 260 |
| 95 | 108 | 141 | 180 | 224 | 270 |
| 100 | 114 | 148 | 188 | 232 | 279 |
| 105 | 120 | 155 | 195 | 241 | 289 |
| 110 | 126 | 161 | 203 | 249 | 298 |
| 115 | 132 | 168 | 210 | 257 | 306 |
| 120 | 137 | 174 | 217 | 265 | 315 |
| 125 | 143 | 180 | 224 | 272 | 323 |
| 130 | 148 | 186 | 231 | 280 | 331 |
| 135 | 153 | 192 | 237 | 287 | 339 |
| 140 | 159 | 198 | 243 | 294 | 346 |

**Female**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | 26 | 43 | 65 | 92 | 121 |
| 45 | 30 | 48 | 71 | 99 | 129 |
| 50 | 34 | 52 | 76 | 105 | 136 |
| 55 | 37 | 56 | 81 | 111 | 143 |
| 60 | 40 | 60 | 86 | 116 | 149 |
| 65 | 43 | 64 | 90 | 121 | 155 |
| 70 | 46 | 68 | 95 | 126 | 160 |
| 75 | 49 | 71 | 99 | 131 | 166 |
| 80 | 52 | 74 | 102 | 135 | 170 |
| 85 | 54 | 77 | 106 | 139 | 175 |
| 90 | 57 | 80 | 109 | 143 | 180 |
| 95 | 59 | 83 | 113 | 147 | 184 |
| 100 | 61 | 86 | 116 | 151 | 188 |
| 105 | 64 | 89 | 119 | 154 | 192 |
| 110 | 66 | 91 | 122 | 158 | 196 |
| 115 | 68 | 94 | 125 | 161 | 200 |
| 120 | 70 | 96 | 128 | 164 | 203 |

### 4.5 Incline bench press (barbell) — published standards DO exist

Page title: "Incline Bench Press Standards for Men and Women (kg) - Strength Level". Provenance: Community lifts 2,165,292 · Qualifying results 593,967 · Male 568,407 · **Female 25,560** · Data start 18 August 2017 · Data cutoff 5 March 2026. Published averages: 86 kg men / 43 kg women (1RM).

⚠ **Confidence caveat:** the female incline table rests on only **25,560 qualifying results** — roughly 40× thinner than the female squat table (1,024,968). Treat the female incline column as the least reliable data in this report.

This is the **barbell** incline entry; StrengthLevel lists "Incline Dumbbell Bench Press" as a separate exercise.

**Male**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | 22 | 34 | 49 | 66 | 86 |
| 55 | 27 | 40 | 56 | 74 | 94 |
| 60 | 32 | 45 | 62 | 82 | 103 |
| 65 | 36 | 51 | 69 | 89 | 111 |
| 70 | 41 | 56 | 75 | 96 | 119 |
| 75 | 45 | 61 | 81 | 103 | 126 |
| 80 | 50 | 66 | 87 | 109 | 134 |
| 85 | 54 | 71 | 92 | 116 | 141 |
| 90 | 58 | 76 | 98 | 122 | 147 |
| 95 | 62 | 81 | 103 | 128 | 154 |
| 100 | 66 | 86 | 108 | 134 | 160 |
| 105 | 70 | 90 | 113 | 139 | 166 |
| 110 | 74 | 94 | 118 | 145 | 172 |
| 115 | 78 | 99 | 123 | 150 | 178 |
| 120 | 82 | 103 | 128 | 155 | 184 |
| 125 | 85 | 107 | 132 | 160 | 189 |
| 130 | 89 | 111 | 137 | 165 | 195 |
| 135 | 93 | 115 | 141 | 170 | 200 |
| 140 | 96 | 119 | 145 | 175 | 205 |

**Female**

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | 7 | 15 | 26 | 40 | 57 |
| 45 | 9 | 17 | 29 | 45 | 62 |
| 50 | 11 | 20 | 33 | 49 | 67 |
| 55 | 12 | 22 | 36 | 53 | 72 |
| 60 | 14 | 25 | 39 | 56 | 76 |
| 65 | 16 | 27 | 42 | 60 | 80 |
| 70 | 18 | 29 | 45 | 63 | 84 |
| 75 | 20 | 32 | 47 | 66 | 87 |
| 80 | 21 | 34 | 50 | 69 | 91 |
| 85 | 23 | 36 | 52 | 72 | 94 |
| 90 | 24 | 38 | 55 | 75 | 97 |
| 95 | 26 | 40 | 57 | 78 | 101 |
| 100 | 28 | 42 | 59 | 80 | 104 |
| 105 | 29 | 43 | 62 | 83 | 106 |
| 110 | 30 | 45 | 64 | 85 | 109 |
| 115 | 32 | 47 | 66 | 88 | 112 |
| 120 | 33 | 49 | 68 | 90 | 114 |

### 4.6 Pull ups — published, in TWO different units

Page title: "Pull Ups Standards for Men and Women (kg) - Strength Level". Provenance: Community lifts 4,852,758 · Qualifying results 1,348,109 · Male 1,220,115 · Female 127,994 · Data start 4 December 2016 · Data cutoff 8 March 2026. Published averages: 13 reps men / 6 reps women.

**Read this before implementing.** The pull-up page publishes **two separate standards tables per sex**:

1. a **rep-count** table (bodyweight-only reps), and
2. a **"1RM Weight"** table whose values are **added external load, not total system load**.

Verbatim from the page: **"If the standard is negative, you have assistance weight. If positive, you add on weight using a weight belt."** So `+22 kg` means bodyweight plus 22 kg on a belt for one rep; `-5 kg` means the lifter needs 5 kg of assistance to complete one rep. **These are NOT bodyweight-plus-load totals.** To express a total-system 1RM the app must add the lifter's own bodyweight, and should label that as derived, not published.

#### Male — reps (bodyweight only)

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | < 1 | 6 | 14 | 24 | 34 |
| 55 | < 1 | 7 | 14 | 24 | 34 |
| 60 | < 1 | 7 | 14 | 23 | 33 |
| 65 | < 1 | 7 | 14 | 23 | 32 |
| 70 | < 1 | 7 | 14 | 22 | 31 |
| 75 | < 1 | 7 | 13 | 21 | 30 |
| 80 | 1 | 7 | 13 | 21 | 29 |
| 85 | 1 | 7 | 13 | 20 | 28 |
| 90 | 1 | 7 | 12 | 19 | 27 |
| 95 | 1 | 7 | 12 | 19 | 26 |
| 100 | < 1 | 6 | 11 | 18 | 25 |
| 105 | < 1 | 6 | 11 | 18 | 24 |
| 110 | < 1 | 6 | 10 | 17 | 23 |
| 115 | < 1 | 6 | 10 | 16 | 23 |
| 120 | < 1 | 5 | 10 | 16 | 22 |
| 125 | < 1 | 5 | 10 | 15 | 21 |
| 130 | < 1 | 5 | 9 | 14 | 20 |
| 135 | < 1 | 4 | 9 | 14 | 20 |
| 140 | < 1 | 4 | 9 | 13 | 19 |

#### Male — 1RM added weight (kg; negative = assistance required)

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 50 | -5 | +7 | +22 | +39 | +56 |
| 55 | -4 | +9 | +25 | +42 | +61 |
| 60 | -4 | +11 | +27 | +45 | +64 |
| 65 | -3 | +12 | +29 | +48 | +68 |
| 70 | -2 | +13 | +31 | +50 | +71 |
| 75 | -2 | +14 | +32 | +52 | +73 |
| 80 | -2 | +14 | +33 | +54 | +75 |
| 85 | -2 | +15 | +34 | +56 | +77 |
| 90 | -2 | +15 | +35 | +57 | +79 |
| 95 | -2 | +15 | +36 | +58 | +81 |
| 100 | -3 | +15 | +36 | +59 | +82 |
| 105 | -3 | +15 | +37 | +60 | +83 |
| 110 | -4 | +15 | +37 | +60 | +84 |
| 115 | -5 | +15 | +37 | +60 | +85 |
| 120 | -6 | +14 | +36 | +61 | +85 |
| 125 | -7 | +13 | +36 | +61 | +86 |
| 130 | -8 | +13 | +36 | +61 | +86 |
| 135 | -9 | +12 | +35 | +60 | +86 |
| 140 | -10 | +11 | +35 | +60 | +86 |

#### Female — reps (bodyweight only)

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | < 1 | < 1 | 6 | 14 | 23 |
| 45 | < 1 | < 1 | 6 | 13 | 22 |
| 50 | < 1 | < 1 | 6 | 13 | 22 |
| 55 | < 1 | < 1 | 6 | 13 | 21 |
| 60 | < 1 | < 1 | 6 | 12 | 20 |
| 65 | < 1 | < 1 | 6 | 11 | 19 |
| 70 | < 1 | < 1 | 5 | 11 | 18 |
| 75 | < 1 | < 1 | 5 | 10 | 17 |
| 80 | < 1 | < 1 | 5 | 10 | 16 |
| 85 | < 1 | < 1 | 4 | 9 | 15 |
| 90 | < 1 | < 1 | 4 | 9 | 14 |
| 95 | < 1 | < 1 | 4 | 9 | 13 |
| 100 | < 1 | < 1 | 3 | 8 | 13 |
| 105 | < 1 | < 1 | 3 | 8 | 12 |
| 110 | < 1 | < 1 | 2 | 7 | 11 |
| 115 | < 1 | < 1 | 2 | 7 | 10 |
| 120 | < 1 | < 1 | 1 | 6 | 10 |

#### Female — 1RM added weight (kg; negative = assistance required)

| BW | Beginner | Novice | Intermediate | Advanced | Elite |
|---:|---:|---:|---:|---:|---:|
| 40 | -14 | -5 | +6 | +17 | +30 |
| 45 | -14 | -5 | +7 | +19 | +33 |
| 50 | -14 | -4 | +8 | +21 | +35 |
| 55 | -15 | -4 | +8 | +22 | +37 |
| 60 | -16 | -4 | +9 | +23 | +38 |
| 65 | -16 | -5 | +9 | +24 | +39 |
| 70 | -18 | -5 | +9 | +24 | +40 |
| 75 | -19 | -6 | +8 | +24 | +41 |
| 80 | -20 | -7 | +8 | +24 | +41 |
| 85 | -21 | -8 | +7 | +24 | +41 |
| 90 | -23 | -9 | +7 | +24 | +41 |
| 95 | -24 | -10 | +6 | +23 | +41 |
| 100 | -26 | -12 | +5 | +22 | +40 |
| 105 | -28 | -13 | +3 | +21 | +40 |
| 110 | -30 | -15 | +2 | +20 | +39 |
| 115 | -32 | -17 | +1 | +19 | +38 |
| 120 | -34 | -18 | -1 | +18 | +37 |

---

## 5. ExRx tables (kg, 1RM, Ages 18-39)

Column headers exactly as published: `Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record`. Bodyweight rows are **competitive weight classes, not a regular grid**, and the top row is an open class (`145+` men, `90+` women). The **World Record** column is reproduced for completeness but is a record reference, not a training level — do not map it to a grade.

### 5.1 Squat (below-parallel required) — capture 20250821035616

**Kilograms | Squat - Adult Men**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 52 | 35.0 | 65.0 | 80.0 | 107.5 | 145.0 | 240 |
| 56 | 37.5 | 70.0 | 87.5 | 117.5 | 157.5 | 245 |
| 60 | 40.0 | 77.5 | 92.5 | 127.5 | 167.5 | 250 |
| 67 | 45.0 | 85.0 | 105.0 | 142.5 | 185.0 | 265 |
| 75 | 50.0 | 92.5 | 112.5 | 155.0 | 202.5 | 300 |
| 82 | 55.0 | 100.0 | 122.5 | 167.5 | 217.5 | 345 |
| 90 | 57.5 | 105.0 | 130.0 | 177.5 | 230.0 | 365 |
| 100 | 60.0 | 110.0 | 135.0 | 185.0 | 240.0 | 374 |
| 110 | 62.5 | 115.0 | 140.0 | 192.5 | 250.0 | 390 |
| 125 | 65.0 | 117.5 | 145.0 | 197.5 | 257.5 | 410 |
| 145 | 67.5 | 122.5 | 147.5 | 202.5 | 262.5 | 419 |
| 145+ | 70.0 | 125.0 | 150.0 | 207.5 | 270.0 | 491 |

**Kilograms | Squat - Adult Women**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 44 | 20.0 | 37.5 | 45.0 | 60.0 | 75.0 | 127 |
| 48 | 22.5 | 40.0 | 47.5 | 65.0 | 80.0 | 136 |
| 52 | 25.0 | 45.0 | 52.5 | 67.5 | 87.5 | 155 |
| 56 | 25.0 | 47.5 | 55.0 | 72.5 | 90.0 | 157 |
| 60 | 27.5 | 50.0 | 60.0 | 77.5 | 95.0 | 164 |
| 67 | 30.0 | 55.0 | 62.5 | 85.0 | 105.0 | 178 |
| 75 | 32.5 | 57.5 | 67.5 | 90.0 | 115.0 | 194 |
| 82 | 35.0 | 62.5 | 75.0 | 97.5 | 122.5 | 200 |
| 90 | 37.5 | 67.5 | 80.0 | 105.0 | 132.5 | 210 |
| 90+ | 40.0 | 72.5 | 85.0 | 110.0 | 137.5 | 232 |

### 5.2 Bench press — capture 20260405160254

**Kilograms | Bench Press - Adult Men**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 52 | 37.5 | 50.0 | 60.0 | 82.5 | 100.0 | 199.0 |
| 56 | 40.0 | 52.5 | 62.5 | 90.0 | 110.0 | 207.0 |
| 60 | 45.0 | 57.5 | 70.0 | 95.0 | 117.5 | 211.0 |
| 67 | 50.0 | 65.0 | 77.5 | 107.5 | 132.5 | 229.0 |
| 75 | 55.0 | 70.0 | 85.0 | 115.0 | 145.0 | 245.0 |
| 82 | 60.0 | 75.0 | 90.0 | 125.0 | 157.5 | 253.0 |
| 90 | 62.5 | 80.0 | 97.5 | 132.5 | 162.5 | 277.0 |
| 100 | 62.5 | 82.5 | 102.5 | 137.5 | 172.5 | 280.0 |
| 110 | 65.0 | 85.0 | 105.0 | 142.5 | 180.0 | 305.0 |
| 125 | 67.5 | 87.5 | 107.5 | 147.5 | 185.0 | 307.0 |
| 145 | 70.0 | 90.0 | 112.5 | 152.5 | 190.0 | 320.0 |
| 145+ | 72.5 | 92.5 | 115.0 | 155.0 | 192.5 | 355.0 |

**Kilograms | Bench Press - Adult Women**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 44 | 22.5 | 30.0 | 35.0 | 42.5 | 52.5 | 80.0 |
| 48 | 25.0 | 32.5 | 37.5 | 45.0 | 57.5 | 90.0 |
| 52 | 27.5 | 35.0 | 37.5 | 50.0 | 62.5 | 107.0 |
| 56 | 30.0 | 37.5 | 40.0 | 52.5 | 65.0 | 120.0 |
| 60 | 32.5 | 40.0 | 42.5 | 57.5 | 67.5 | 122.0 |
| 67 | 35.0 | 40.0 | 47.5 | 62.5 | 75.0 | 124.0 |
| 75 | 37.5 | 42.5 | 52.5 | 65.0 | 85.0 | 128.0 |
| 82 | 37.5 | 50.0 | 55.0 | 72.5 | 90.0 | 133.0 |
| 90 | 40.0 | 52.5 | 60.0 | 75.0 | 95.0 | 137.0 |
| 90+ | 42.5 | 55.0 | 62.5 | 80.0 | 100.0 | 145.0 |

### 5.3 Deadlift — capture 20250802012003

**Kilograms | Deadlift - Adult Men**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 52 | 42.5 | 82.5 | 92.5 | 135.0 | 175.0 | 270.0 |
| 56 | 47.5 | 87.5 | 100.0 | 145.0 | 187.5 | 288.0 |
| 60 | 50.0 | 95.0 | 110.0 | 155.0 | 200.0 | 286.0 |
| 67 | 57.5 | 107.5 | 122.5 | 172.5 | 217.5 | 320.0 |
| 75 | 62.5 | 115.0 | 135.0 | 185.0 | 235.0 | 345.0 |
| 82 | 67.5 | 125.0 | 142.5 | 200.0 | 250.0 | 405.0 |
| 90 | 70.0 | 132.5 | 152.5 | 207.5 | 257.5 | 400.0 |
| 100 | 75.0 | 137.5 | 160.0 | 217.5 | 265.0 | 433.0 |
| 110 | 77.5 | 145.0 | 165.0 | 222.5 | 270.0 | 441.0 |
| 125 | 80.0 | 147.5 | 170.0 | 227.5 | 272.5 | 431.0 |
| 145 | 82.5 | 152.5 | 172.5 | 230.0 | 277.5 | 427.0 |
| 145+ | 85.0 | 155.0 | 177.5 | 232.5 | 280.0 | 461.0 |

**Kilograms | Deadlift - Adult Women**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 44 | 25.0 | 47.5 | 50.0 | 80.0 | 105.0 | 159.0 |
| 48 | 27.5 | 52.5 | 60.0 | 85.0 | 110.0 | 168.0 |
| 52 | 30.0 | 55.0 | 62.5 | 90.0 | 115.0 | 184.0 |
| 56 | 32.5 | 60.0 | 67.5 | 95.0 | 120.0 | 189.0 |
| 60 | 35.0 | 62.5 | 72.5 | 100.0 | 125.0 | 198.0 |
| 67 | 37.5 | 67.5 | 80.0 | 110.0 | 135.0 | 214.0 |
| 75 | 40.0 | 72.5 | 85.0 | 117.5 | 145.0 | 227.0 |
| 82 | 42.5 | 80.0 | 92.5 | 125.0 | 150.0 | 229.0 |
| 90 | 45.0 | 87.5 | 97.5 | 130.0 | 160.0 | 230.0 |
| 90+ | 50.0 | 90.0 | 105.0 | 137.5 | 165.0 | 252.0 |

### 5.4 Press (overhead / standing barbell press) — capture 20230523091159

**Kilograms | Press - Adult Men**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 52 | 22.5 | 32.5 | 40.0 | 50.0 | 60.0 | 119.0 |
| 56 | 25.0 | 35.0 | 45.0 | 52.5 | 65.0 | 122.0 |
| 60 | 27.5 | 37.5 | 47.5 | 57.5 | 70.0 | 126.0 |
| 67 | 30.0 | 42.5 | 55.0 | 62.5 | 77.5 | 134.0 |
| 75 | 32.5 | 45.0 | 57.5 | 70.0 | 85.0 | 144.0 |
| 82 | 35.0 | 50.0 | 62.5 | 75.0 | 100.0 | 161.0 |
| 90 | 37.5 | 52.5 | 65.0 | 77.5 | 105.0 | 179.0 |
| 100 | 40.0 | 55.0 | 70.0 | 82.5 | 115.0 | 187.0 |
| 110 | 42.5 | 57.5 | 72.5 | 85.0 | 120.0 | 203.0 |
| 125 | 42.5 | 60.0 | 75.0 | 87.5 | 122.5 | 203.0 |
| 145 | 45.0 | 60.0 | 75.0 | 90.0 | 125.0 | 211.0 |
| 145+ | 45.0 | 62.5 | 77.5 | 92.5 | 130.0 | 240.0 |

**Kilograms | Press - Adult Women**

| Body Weight | Untrained | Novice | Intermediate | Advanced | Elite | World Record |
|---:|---:|---:|---:|---:|---:|---:|
| 44 | 15.0 | 17.5 | 22.5 | 30.0 | 40.0 | 61.0 |
| 48 | 15.0 | 20.0 | 25.0 | 32.5 | 42.5 | 67.0 |
| 52 | 17.5 | 22.5 | 27.5 | 35.0 | 45.0 | 77.0 |
| 56 | 17.5 | 22.5 | 27.5 | 37.5 | 47.5 | 88.0 |
| 60 | 17.5 | 25.0 | 30.0 | 40.0 | 50.0 | 90.0 |
| 67 | 20.0 | 27.5 | 32.5 | 42.5 | 55.0 | 91.0 |
| 75 | 22.5 | 30.0 | 35.0 | 47.5 | 62.5 | 94.0 |
| 82 | 22.5 | 32.5 | 37.5 | 50.0 | 65.0 | 96.0 |
| 90 | 25.0 | 35.0 | 40.0 | 52.5 | 67.5 | 97.0 |
| 90+ | 27.5 | 37.5 | 42.5 | 57.5 | 72.5 | 105.0 |

---

## 6. REQUIRED SECTION — gaps, and what the numbers actually are

### 6.1 Lifts with NO published data found

| Requested lift | ExRx | StrengthLevel | Verdict |
|---|---|---|---|
| 1. Barbell back squat | found | found | complete |
| 2. Barbell bench press (flat) | found | found | complete |
| 3. Overhead / standing barbell press | found ("Press") | found ("Shoulder Press") | complete |
| 4. Deadlift | found | found | complete |
| 5. **Barbell incline bench press** | **NOT PUBLISHED** | found | **StrengthLevel only** |
| 6. **Pull-up** | **NOT PUBLISHED** | found (reps + added-load) | **StrengthLevel only** |

**ExRx does not publish incline bench press or pull-up standards.** This is confirmed structurally, not assumed: the standards navigation on the ExRx squat page links to exactly six lifts — `BenchStandardsKg`, `CleanStandardsKg`, `DeadliftStandardsKg`, `PressStandardsKg`, `SnatchStandardsKg`, `SquatStandardsKg` (plus age variants of the same lift). ExRx's weightlifting performance standards cover only the barbell squat, bench press, deadlift, overhead press, clean, and snatch. There is no incline-bench and no pull-up table on ExRx to retrieve.

**No requested lift came back empty from both sources.** All six are covered by at least one publisher.

Other things NOT obtained, flagged so nobody assumes they are in this file:
- ExRx tables for ages 40+ (published on separate pages, not retrieved — this report is Ages 18-39 only).
- StrengthLevel's age-indexed tables (they exist and were seen on-page, but the app indexes by sex and bodyweight only, so they are not reproduced).
- ExRx lb tables (kg was requested).
- Any third source. If a tiebreaker between ExRx and StrengthLevel is ever needed, that requires new research.

### 6.2 Are the source numbers 1RM? — YES, with three caveats

**Both sources' weight tables are one-repetition maximum (1RM) values in kg.** Stated explicitly by both publishers; verbatim quotes in §2.

Three caveats the app must handle:

1. **StrengthLevel 1RMs are largely estimated, not directly tested.** They are aggregated from user-logged sets, with submaximal work converted to a 1RM estimate by the site. ExRx's come from competition classification systems (directly contested maxes). The two sources' "1RM" are therefore not the same kind of measurement — StrengthLevel is a percentile of an estimated-1RM distribution; ExRx is a competition-classification threshold. **Do not blend values from the two sources into one table.**

2. **Bar weight is included in StrengthLevel barbell values** ("Barbell weights include the weight of the bar, normally 20 kg / 44 lb"). If the app records plates-only loads, it must add ~20 kg before looking up.

3. **The pull-up tables are the exception to "1RM in kg".** That page publishes a **rep-count** table (bodyweight-only reps — not a weight at all) and a separate **1RM added-load** table. The added-load table is **external load only**, signed: positive = belt weight added, negative = assistance weight needed. It is **not** bodyweight + load. Verbatim: "If the standard is negative, you have assistance weight. If positive, you add on weight using a weight belt." To express a pull-up standard as a total-system 1RM the app must compute `bodyweight + published added load` itself, and should label that as a derived value.

### 6.3 Provenance risks to record alongside the shipped table

- **ExRx is not fetchable from the live web.** Cloudflare 403 / JS challenge on every path, for both the fetch tool and `curl` with full browser headers. All ExRx values in this file come from Internet Archive captures, with capture timestamps listed in §1. They are faithful to those captures; they have not been re-verified against the live site, because the live site cannot be read.
- **The ExRx Press capture is from 2023-05-23** — the oldest of the four, and the lowest-freshness data in this report.
- **StrengthLevel is a rolling dataset.** Its numbers as shipped are a snapshot of the 5–10 March 2026 data cutoffs, fetched 2026-09-03. They will drift. Freeze the snapshot in the app and cite the cutoff date rather than implying the values are current.
- **Verification performed:** every StrengthLevel table was retrieved twice by independent methods (page-fetch tool, then raw-HTML `curl` plus HTML table parse) and compared cell by cell. All cells matched. No StrengthLevel value in this file is single-sourced from a summarizer.
- Values are transcribed exactly as published, including StrengthLevel's `< 1` rep entries, ExRx's one-decimal formatting, and ExRx's `145+` / `90+` open-class row labels.
- Both sources are third-party commercial websites. Neither publishes an explicit reuse licence on these pages. **Confirm redistribution rights before shipping the tables inside an app**, and attribute the source in-app either way.
