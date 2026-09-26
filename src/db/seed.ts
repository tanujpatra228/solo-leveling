/**
 * The seed exercise library and routines, encoding the hunter's actual training
 * week rather than a published programme.
 *
 * Original spellings from the brief are kept as `aliases` so search finds each
 * exercise by the name it is actually called. The engine applies progressive
 * overload to these movements; it does not replace them with something else.
 *
 * Increments follow the brief: upper-body isolation 1.25 to 2.5 kg, upper
 * compound 2.5 kg, lower compound 5 kg, and cables and machines one pin step.
 */
import type { Exercise, Routine } from '../domain/types'

/** One pin step on the cable stacks and most selectorised machines. */
const PIN_STEP = 2.5

export const SEED_EXERCISES: readonly Exercise[] = [
  /* ---------------- Monday: chest, shoulders, triceps ---------------- */
  {
    id: 'incline-barbell-press',
    name: 'Incline Barbell Press',
    aliases: ['Incline Barbel Press', 'Incline Bench Press', 'Incline Press'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['barbell', 'bench'],
    unit: 'kg',
    increment: 2.5,
    repRange: [5, 8],
    standardLift: 'incline_bench',
    cue: 'Elbows about 45 degrees from the torso. Bar to the upper chest, not the throat.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'machine-shoulder-press',
    name: 'Machine Shoulder Press',
    aliases: ['Shoulder Press Machine'],
    pattern: 'vertical_push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps'],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [8, 12],
    cue: 'Do not lock out hard at the top. Keep the ribs down.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'skullcrusher',
    name: 'Skullcrusher',
    aliases: ['Skull Crusher', 'Lying Triceps Extension'],
    pattern: 'isolation',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['ez_bar', 'bench'],
    unit: 'kg',
    increment: 1.25,
    repRange: [8, 12],
    cue: 'Elbows stay pointed at the ceiling. Only the forearm moves.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    aliases: ['Cable Flye', 'Cable Crossover'],
    pattern: 'isolation',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Slight elbow bend held constant. Squeeze at the midline, do not clap.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'machine-lateral-raise',
    name: 'Machine Lateral Raise',
    aliases: ['Lateral Raise Machine', 'Machine Side Raise'],
    pattern: 'isolation',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [12, 20],
    cue: 'Lead with the elbow. Stop at shoulder height.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'front-raises',
    name: 'Front Raises',
    aliases: ['Front Raise'],
    pattern: 'isolation',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    unit: 'kg',
    increment: 1.25,
    repRange: [12, 15],
    cue: 'The pressing already trains this head hard. Keep the load honest and the swing out of it.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'diamond-pushups',
    name: 'Diamond Pushups',
    aliases: ['Dimond Pushups', 'Diamond Push-ups', 'Close-grip Pushups'],
    pattern: 'horizontal_push',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'front_delts'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 20],
    progressionLadder: ['incline-pushups', 'pushups', 'diamond-pushups', 'deficit-pushups', 'archer-pushups'],
    cue: 'Hands together under the sternum. Elbows brush the ribs.',
    usesBodyweight: true,
    // Reasoned from segment mass, not measured — see docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.66,
    role: 'prescribed',
  },
  {
    id: 'cable-external-rotation',
    name: 'Cable External Rotation',
    aliases: ['Cable ER', 'External Rotation'],
    pattern: 'isolation',
    primaryMuscles: ['rotator_cuff'],
    secondaryMuscles: ['rear_delts'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [15, 20],
    cue: 'Elbow pinned to the side, forearm parallel to the floor. Light load — this is stability work, not a lift.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },

  /* ---------------- Tuesday: back and biceps ---------------- */
  {
    id: 'one-arm-cable-lat-pulldown',
    name: '1-Arm Cable Lat Pulldown',
    aliases: ['1-Arm Cabel Lat Pulldown', 'Single Arm Lat Pulldown', 'One Arm Pulldown'],
    pattern: 'vertical_pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [8, 12],
    cue: 'Let the shoulder rise at the top, then drive the elbow down and back.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'pull-ups',
    name: 'Pull-ups',
    // 'Chin-ups' is deliberately not an alias here — commit 4 seeds it as its
    // own fallback exercise with biceps as the primary mover, which an
    // overhand Pull-up does not represent. See commit 5d33216.
    aliases: ['Pullups', 'Pull Ups'],
    pattern: 'vertical_pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back', 'grip'],
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [5, 12],
    standardLift: 'pullup',
    progressionLadder: ['negative-pull-ups', 'pull-ups', 'archer-pull-ups'],
    cue: 'Full hang at the bottom. Chest to the bar, no kipping.',
    usesBodyweight: true,
    // Reasoned, not measured — a dead hang moves nearly all of it. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.95,
    role: 'prescribed',
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    aliases: ['Dumble Row', 'One Arm Row', 'DB Row'],
    pattern: 'horizontal_pull',
    primaryMuscles: ['upper_back'],
    secondaryMuscles: ['lats', 'biceps', 'grip'],
    equipment: ['dumbbell', 'bench'],
    unit: 'kg',
    increment: 2.5,
    repRange: [8, 12],
    cue: 'Pull to the hip, not the armpit. Keep the torso still.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'cable-shrug',
    name: 'Cable Shrug',
    // The hunter calls this a "Cable Shrug-in": standing at a low pulley holding
    // a straight bar at hip height and shrugging.
    aliases: ['Cable Shrug-in', 'Cable Shrug In', 'Low Pulley Shrug'],
    pattern: 'isolation',
    primaryMuscles: ['traps'],
    secondaryMuscles: ['grip', 'upper_back'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Straight up and down. No rolling — rolling the shoulders adds nothing and grinds the joint.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'machine-reverse-fly',
    name: 'Machine Reverse Fly',
    aliases: ['Reverse Fly Machine', 'Rear Delt Machine', 'Pec Deck Reverse'],
    pattern: 'isolation',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['upper_back'],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [12, 20],
    cue: 'Arms nearly straight. Think about spreading the hands apart, not squeezing the blades.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'cable-bicep-curl',
    name: 'Cable Bicep Curl',
    aliases: ['Cabel Bicep Curl', 'Cable Curl'],
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Elbows pinned to the sides. The cable keeps tension at the top, so use it.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'farmers-carry',
    name: "Farmer's Carry",
    aliases: ['Farmer Carry', 'Farmer Walk', 'Loaded Carry'],
    pattern: 'carry',
    primaryMuscles: ['grip'],
    secondaryMuscles: ['traps', 'forearms', 'abs'],
    equipment: ['dumbbell'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Heavy dumbbells, ribs down, walk tall. Set them down before the grip fails, not after.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'wrist-curl',
    name: 'Wrist Curl',
    aliases: ['Dumbbell Wrist Curl', 'Forearm Curl'],
    // Grip strength is produced by the forearm flexors crossing the wrist,
    // not by the hand holding a static position — a carry loads them
    // isometrically at a fixed, already-shortened length. This trains the
    // same muscles through the stretched position that actually drives
    // hypertrophy: wrist starts extended (flexors long) under load, curls
    // into flexion (flexors short).
    pattern: 'isolation',
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['grip'],
    equipment: ['dumbbell', 'bench'],
    unit: 'kg',
    increment: 1.25,
    repRange: [12, 15],
    cue: 'Forearms on the thighs or a bench, wrists off the edge. Let the bar or dumbbells roll to the fingertips at the bottom before curling back up.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'reverse-wrist-curl',
    name: 'Reverse Wrist Curl',
    aliases: ['Wrist Extension', 'Dumbbell Wrist Extension', 'Radial Wrist Extension'],
    // The extensors are what stabilise the wrist in slight extension so the
    // flexors above can actually transmit force to a crushing grip — a weak
    // extensor lets the wrist collapse into flexion under load, which is
    // exactly where grip strength drops off. Same stretch-bottom logic as
    // the curl, mirrored: wrist starts flexed (extensors long), extends up.
    // Angled toward the thumb (radial deviation) on the way up, not pure
    // sagittal extension: a failing grip collapses toward flexion *and*
    // ulnar deviation (think a heavy suitcase pulling the wrist down and
    // pinky-side), so extension biased toward the thumb side trains ECRL
    // and ECRB — the radial extensors — specifically against that failure
    // direction, rather than spreading the work evenly across all three
    // wrist extensors including the one (ECU) least relevant to it.
    pattern: 'isolation',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    equipment: ['dumbbell', 'bench'],
    unit: 'kg',
    increment: 1.25,
    repRange: [15, 20],
    cue: 'Same setup as the wrist curl, palms down. Angle the lift slightly toward the thumb side, not straight up — that bias is the point, not a style choice. This side is far weaker than the curl — expect a fraction of the load.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'dumbbell-hub-pinch',
    name: 'Dumbbell Hub Pinch',
    aliases: ['Hex Dumbbell Pinch', 'Thumb Pinch Hold', 'Plate Pinch'],
    // Wrist Curl and Reverse Wrist Curl train the forearm flexors and
    // extensors that cross the wrist; neither touches the thenar group
    // (the thumb's own muscles — adductor pollicis, flexor pollicis
    // brevis, opponens pollicis), which is what a pinch grip specifically
    // loads. This is a plate pinch in substance — flat-sided load, gripped
    // between fingers and thumb, no wrist joint action at all — done with
    // a hex dumbbell instead of a plate because `EquipmentSchema` has no
    // "plate" tag and mistagging this as `barbell` would misrepresent what
    // it actually needs, the same call already made for a couple of other
    // exercises this library deliberately left out.
    pattern: 'isolation',
    primaryMuscles: ['grip'],
    secondaryMuscles: ['forearms'],
    equipment: ['dumbbell'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Pinch a hex dumbbell between your fingers and thumb, flat side in, and let it hang — no resting it against your leg. Progress by picking a heavier dumbbell, not by holding longer once you can already hold to time.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },

  /* ---------------- Wednesday: abs and biceps ---------------- */
  {
    id: 'machine-preacher-curl',
    name: 'Machine Preacher Curls',
    aliases: ['Preacher Curl Machine', 'Machine Preacher Curl'],
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'The pad removes the cheat. Do not fight it by lifting the elbows.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'strict-curl',
    name: 'Strict Curls',
    aliases: ['Strict Curl', 'Barbell Strict Curl'],
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['barbell'],
    unit: 'kg',
    increment: 1.25,
    repRange: [6, 10],
    cue: 'Back against a wall if there is one. No hip drive at all.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'leg-raises',
    name: 'Leg Raises',
    aliases: ['Lying Leg Raise', 'Leg Raise'],
    pattern: 'core',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [12, 20],
    progressionLadder: ['leg-raises', 'hanging-leg-raises', 'toes-to-bar'],
    cue: 'Press the lower back into the floor. Stop before it arches.',
    usesBodyweight: true,
    // Reasoned from segment mass, not measured — legs only. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.3,
    role: 'prescribed',
  },
  {
    id: 'machine-abs-crunch',
    name: 'Machine Abs Crunch',
    aliases: ['Ab Crunch Machine', 'Machine Crunch'],
    pattern: 'core',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Shorten the distance between ribs and hips. It is a curl, not a hip fold.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    aliases: ['Kneeling Cable Crunch', 'Rope Crunch'],
    pattern: 'core',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Hips stay where they are. Pull the elbows toward the knees with the abs.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'dumbbell-bulgarian-split-squat',
    name: 'Dumbbell Bulgarian Split Squat',
    aliases: ['Bulgarian Split Squat', 'Rear-foot Elevated Split Squat (Loaded)'],
    pattern: 'lunge',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    // Sits on the lighter Wednesday day on purpose, not Friday: it is the
    // week's second squat/hinge/lunge-pattern day, which is what the
    // push-day-to-leg-day frequency gap needs — see docs/TODO.md.
    equipment: ['dumbbell', 'bench'],
    unit: 'kg',
    increment: 2.5,
    repRange: [8, 12],
    cue: 'Rear foot on the bench, front shin stays vertical. Load is the pair of dumbbells, held at the sides.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'pallof-press',
    name: 'Pallof Press',
    aliases: ['Anti-rotation Press', 'Cable Pallof Press'],
    pattern: 'core',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 12],
    cue: 'Press straight out from the chest and hold. The work is resisting the cable pulling you toward it, not the press itself.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },

  /* ---------------- Thursday: chest, shoulders, triceps, supersetted ---------------- */
  {
    id: 'incline-pushups',
    name: 'Incline Pushups',
    aliases: ['Incline Push-ups', 'Hands-elevated Pushups'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['bodyweight', 'bench'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 20],
    progressionLadder: ['incline-pushups', 'pushups', 'diamond-pushups', 'deficit-pushups', 'archer-pushups'],
    cue: 'The higher the hands, the easier it is. Lower the hands as this gets easy.',
    usesBodyweight: true,
    // Reasoned, not measured, and the honest weak spot: this genuinely varies
    // with bench height, and one number is wrong at both ends. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.5,
    role: 'prescribed',
  },
  {
    id: 'pike-pushups',
    name: 'Pike Pushups',
    aliases: ['Pike Push-ups'],
    pattern: 'vertical_push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'chest'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    // Its own ladder, not the horizontal_push line: front_delts via a vertical
    // press is a different pattern and muscle than a pushup.
    progressionLadder: ['pike-pushups', 'deficit-pike-pushups', 'wall-handstand-pushups'],
    cue: 'Hips high, head travels between the hands. This one is a shoulder press.',
    usesBodyweight: true,
    // Reasoned, not measured — torso vertical, most of the load on the shoulders. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.7,
    role: 'prescribed',
  },
  {
    id: 'cable-chest-press-mid',
    name: 'Cable Chest Press (mid chest)',
    aliases: ['Cable Press Mid', 'Cable Chest Press'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Pulleys at chest height. Press straight out and squeeze at the midline.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'cable-chest-press-low',
    name: 'Cable Chest Press (lower chest)',
    aliases: ['Cable Press Low', 'High-to-low Cable Press'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Pulleys high, press down and in toward the hips.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'cable-chest-press-high',
    name: 'Cable Chest Press (upper chest)',
    aliases: ['Cable Press High', 'Low-to-high Cable Press'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Pulleys low, press up and in toward the collarbones.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'tricep-overhead-extension',
    name: 'Tricep Overhead Extension',
    aliases: ['Tricep Overhead Extention', 'Overhead Tricep Extension'],
    pattern: 'isolation',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'Upper arms stay beside the ears. The stretch at the bottom is the point.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },

  /* ---------------- Friday: legs ---------------- */
  {
    id: 'barbell-squat',
    name: 'Barbell Squats',
    aliases: ['Barbell Squat', 'Back Squat', 'Squat'],
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'lower_back', 'hamstrings'],
    equipment: ['barbell'],
    unit: 'kg',
    increment: 5,
    repRange: [5, 8],
    standardLift: 'squat',
    cue: 'Knees track over the toes. Depth first, load second.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    aliases: ['RDL', 'Stiff-leg Deadlift'],
    // The hinge this week was missing entirely: a leg curl only trains the
    // knee-flexion half of the hamstrings, never the hip-extension half.
    pattern: 'hinge',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes', 'lower_back'],
    equipment: ['barbell'],
    unit: 'kg',
    increment: 5,
    repRange: [6, 10],
    cue: 'Push the hips back, bar stays against the thighs. Stop when the hamstrings stretch, not when the back rounds.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'barbell-hip-thrust',
    name: 'Barbell Hip Thrust',
    aliases: ['Hip Thrust', 'Glute Bridge (Loaded)'],
    pattern: 'hinge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['barbell', 'bench'],
    unit: 'kg',
    increment: 5,
    repRange: [8, 12],
    cue: 'Shoulder blades on the bench, chin tucked. Drive through the heels, ribs down at lockout.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    aliases: ['Machine Leg Press'],
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['machine'],
    unit: 'kg',
    increment: 5,
    repRange: [10, 15],
    cue: 'Do not let the lower back round off the pad at the bottom.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'hamstring-curl',
    name: 'Hamstring Curl',
    aliases: ['Leg Curl', 'Lying Leg Curl', 'Seated Leg Curl'],
    pattern: 'isolation',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [10, 15],
    cue: 'No longer the only hamstring work in the week — the Romanian Deadlift now covers the hip-extension half. Control the lowering here.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'nordic-curl',
    name: 'Nordic Curl',
    aliases: ['Nordic Hamstring Curl'],
    // Promoted from the fallback library: weekly eccentric-hamstring exposure
    // has real injury-prevention evidence (Petersen et al. 2011, ~51% fewer
    // hamstring strains), and it was previously never actually programmed.
    pattern: 'isolation',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [3, 10],
    progressionLadder: ['sliding-leg-curl', 'nordic-curl'],
    cue: 'Kneeling, ankles anchored. Lower under control for as long as possible and catch yourself at the bottom.',
    usesBodyweight: true,
    // Reasoned, not measured — the torso and hips lower under the hamstrings' control. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.8,
    role: 'prescribed',
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    aliases: ['Quad Extension'],
    pattern: 'isolation',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipment: ['machine'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [12, 15],
    cue: 'Pause at the top for a beat rather than swinging through.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'barbell-calf-raise',
    name: 'Barbell Calf Raises',
    aliases: ['Barbell Calf Raise', 'Standing Calf Raise'],
    pattern: 'isolation',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['barbell'],
    unit: 'kg',
    increment: 5,
    repRange: [10, 15],
    cue: 'Full stretch at the bottom, full contraction at the top. Slow, not bouncy.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },

  /* ---------------- Saturday: cardio and abs ---------------- */
  {
    id: 'hanging-leg-raises',
    name: 'Hanging Leg Raises',
    aliases: ['Hanging Leg Raise', 'Hanging Knee Raise'],
    pattern: 'core',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'grip'],
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    progressionLadder: ['leg-raises', 'hanging-leg-raises', 'toes-to-bar'],
    cue: 'Stop the swing before each rep. Curl the pelvis rather than just lifting the legs.',
    usesBodyweight: true,
    // Reasoned from segment mass, not measured — legs, with the trunk stabilising. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.35,
    role: 'prescribed',
  },
  {
    id: 'treadmill-intervals',
    name: 'Treadmill Intervals',
    aliases: ['Treadmill', 'Walk Run Intervals', 'Cardio'],
    pattern: 'cardio',
    primaryMuscles: ['cardio'],
    secondaryMuscles: [],
    equipment: ['treadmill'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Five minutes walking, five minutes running, repeated. Walk in zone 2, run in zone 4.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },

  /* ---------------- Available for the Daily Quest and Instant Dungeons ---------------- */
  {
    id: 'pushups',
    name: 'Pushups',
    aliases: ['Push-ups', 'Push Ups'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 30],
    progressionLadder: ['incline-pushups', 'pushups', 'diamond-pushups', 'deficit-pushups', 'archer-pushups'],
    cue: 'Body in one line from head to heels.',
    usesBodyweight: true,
    // The most commonly cited figure for a standard pushup (~64% of bodyweight),
    // but not independently verified against a primary source here — see
    // docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.64,
    role: 'prescribed',
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squats',
    aliases: ['Air Squat', 'Bodyweight Squat'],
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [15, 40],
    progressionLadder: ['bodyweight-squat', 'sissy-squat', 'pistol-squat'],
    cue: 'Sit down between the heels. Full depth every rep.',
    usesBodyweight: true,
    // Reasoned, not measured — trunk plus most of the legs. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.65,
    role: 'prescribed',
  },
  {
    id: 'situps',
    name: 'Sit-ups',
    aliases: ['Situps', 'Sit Ups'],
    pattern: 'core',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [15, 40],
    cue: 'Do not yank on the neck. Lead with the ribs.',
    usesBodyweight: true,
    // Reasoned, not measured — the trunk, not the whole body. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.45,
    role: 'prescribed',
  },

  /* ---------------- Bodyweight gates: ladder extensions and new movements
   * (docs/bodyweight-gates-plan.md). Every exercise below is either a new
   * rung on a ladder whose easier end was already prescribed, or a
   * promotion from the fallback library below — promoted because the
   * bodyweight-only programme (routines seeded in Phase 2) needs it as a
   * default, not just as something to swap onto. A promoted entry keeps
   * its original reasoning comments; only `role`, and where a ladder now
   * exists, `progressionLadder`, changed.
   */
  {
    id: 'deficit-pushups',
    name: 'Deficit Pushups',
    aliases: ['Deficit Push-ups', 'Pushups on Blocks'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 20],
    progressionLadder: ['incline-pushups', 'pushups', 'diamond-pushups', 'deficit-pushups', 'archer-pushups'],
    // The extra range of motion loads the chest at a longer stretch than a
    // standard pushup reaches — the same stretch-mediated-hypertrophy call
    // already made for the Romanian Deadlift and Nordic Curl.
    cue: 'Hands on blocks or plates, chest drops below hand level at the bottom. Same lockout as a standard pushup.',
    usesBodyweight: true,
    // Reasoned, not measured — same body position as Diamond Pushups. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.66,
    role: 'prescribed',
  },
  {
    id: 'archer-pushups',
    name: 'Archer Pushups',
    aliases: ['Archer Push-ups'],
    pattern: 'horizontal_push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [4, 12],
    progressionLadder: ['incline-pushups', 'pushups', 'diamond-pushups', 'deficit-pushups', 'archer-pushups'],
    // Shifts most of the load onto one arm — the ladder's stand-in for
    // external load, since nothing in a no-equipment gym can hang a plate.
    cue: 'One arm nearly straight out to the side, lower toward the bent working arm. Alternate sides each set.',
    usesBodyweight: true,
    // Reasoned, not measured — same body position as Diamond Pushups. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.66,
    role: 'prescribed',
  },
  {
    id: 'deficit-pike-pushups',
    name: 'Deficit Pike Pushups',
    aliases: ['Deficit Pike Push-ups'],
    pattern: 'vertical_push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'chest'],
    equipment: ['bodyweight', 'bench'],
    unit: 'reps',
    increment: 0,
    repRange: [6, 15],
    progressionLadder: ['pike-pushups', 'deficit-pike-pushups', 'wall-handstand-pushups'],
    cue: 'Hands on a bench or blocks, hips high in a pike. Lower the head below hand level — the extra drop a floor pike pushup cannot reach.',
    usesBodyweight: true,
    // Reasoned, not measured — same torso angle as Pike Pushups. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.7,
    role: 'prescribed',
  },
  {
    id: 'wall-handstand-pushups',
    name: 'Wall Handstand Pushups',
    aliases: ['Wall HSPU', 'Handstand Pushups'],
    pattern: 'vertical_push',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'side_delts'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [3, 10],
    progressionLadder: ['pike-pushups', 'deficit-pike-pushups', 'wall-handstand-pushups'],
    cue: 'Feet up the wall, walk into a vertical handstand. Lower the head to the floor and press back up — keep someone nearby the first sessions.',
    usesBodyweight: true,
    // Reasoned, not measured — a true handstand puts nearly all of it
    // overhead, closer to what Pull-ups move than Pike Pushups' half-vertical
    // torso. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'negative-pull-ups',
    name: 'Negative Pull-ups',
    aliases: ['Negative Pullups', 'Eccentric Pull-ups'],
    pattern: 'vertical_pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back', 'grip'],
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [3, 8],
    progressionLadder: ['negative-pull-ups', 'pull-ups', 'archer-pull-ups'],
    cue: 'Jump or step up to a chin-over-bar position, then lower as slowly as control allows — 5 seconds minimum. Reset from the floor each rep.',
    usesBodyweight: true,
    // Reasoned, not measured — same near-full-bodyweight hang as Pull-ups. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.95,
    role: 'prescribed',
  },
  {
    id: 'archer-pull-ups',
    name: 'Archer Pull-ups',
    aliases: ['Archer Pullups'],
    pattern: 'vertical_pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back', 'grip'],
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [3, 8],
    progressionLadder: ['negative-pull-ups', 'pull-ups', 'archer-pull-ups'],
    cue: 'Pull toward one hand while the other arm stays nearly straight along the bar. Alternate sides each set — the working arm carries most of the pull.',
    usesBodyweight: true,
    // Reasoned, not measured — same near-full-bodyweight hang as Pull-ups. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.95,
    role: 'prescribed',
  },
  {
    id: 'incline-inverted-row',
    name: 'Incline Inverted Row',
    aliases: ['High Bar Inverted Row'],
    pattern: 'horizontal_pull',
    primaryMuscles: ['upper_back'],
    secondaryMuscles: ['lats', 'biceps', 'rear_delts'],
    // Same equipment approximation as Inverted Row: "a bar, rings, or a table
    // edge", closest available tag is pullup_bar.
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 20],
    progressionLadder: ['incline-inverted-row', 'inverted-row', 'feet-elevated-inverted-row'],
    cue: 'Bar set higher than a standard row, body closer to vertical. Same straight-body line, just less of your weight in the pull.',
    usesBodyweight: true,
    // Reasoned, not measured — the more vertical body angle moves less than
    // Inverted Row's 0.55, same reasoned-not-measured method as commit 5ce8d44.
    bodyweightFactor: 0.4,
    role: 'prescribed',
  },
  {
    id: 'inverted-row',
    name: 'Inverted Row',
    aliases: ['Body Row', 'Table Row', 'Bar Row'],
    pattern: 'horizontal_pull',
    primaryMuscles: ['upper_back'],
    secondaryMuscles: ['lats', 'biceps', 'rear_delts'],
    // The audit's minimum implement is "a bar, rings, or a table edge" — a squat
    // rack or Smith machine bar is the closest match the equipment
    // vocabulary has, so this tag is approximate rather than exact.
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    progressionLadder: ['incline-inverted-row', 'inverted-row', 'feet-elevated-inverted-row'],
    cue: 'Bar at hip height. Body straight, pull the chest to the bar.',
    usesBodyweight: true,
    // Reasoned, not measured — a lower bar and shallower body angle move
    // less than a dead hang. Same reasoned-not-measured method as commit
    // 5ce8d44, extended to fallbacks here.
    bodyweightFactor: 0.55,
    role: 'prescribed',
  },
  {
    id: 'feet-elevated-inverted-row',
    name: 'Feet-elevated Inverted Row',
    aliases: ['Feet-elevated Body Row'],
    pattern: 'horizontal_pull',
    primaryMuscles: ['upper_back'],
    secondaryMuscles: ['lats', 'biceps', 'rear_delts'],
    equipment: ['pullup_bar', 'bodyweight', 'bench'],
    unit: 'reps',
    increment: 0,
    repRange: [5, 12],
    progressionLadder: ['incline-inverted-row', 'inverted-row', 'feet-elevated-inverted-row'],
    cue: 'Feet up on a bench, body close to horizontal under the bar. The flatter the body, the more of your weight the pull has to move.',
    usesBodyweight: true,
    // Reasoned, not measured — a near-horizontal body moves substantially
    // more than Inverted Row's 0.55, same reasoned-not-measured method as
    // commit 5ce8d44.
    bodyweightFactor: 0.75,
    role: 'prescribed',
  },
  {
    id: 'sissy-squat',
    name: 'Sissy Squat',
    aliases: [],
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    progressionLadder: ['bodyweight-squat', 'sissy-squat', 'pistol-squat'],
    // Loads the quads at their longest length of anything in the library
    // that needs no equipment — the same stretch-mediated-hypertrophy call
    // already made for the Romanian Deadlift and Nordic Curl.
    cue: 'Rise onto the balls of the feet, lean back as the knees drive forward, lower in a straight line from knee to shoulder. Hold a wall or doorframe for balance at first.',
    usesBodyweight: true,
    // Reasoned, not measured — deep knee flexion, most of the trunk and legs
    // through the rep, similar order to Split Squat's 0.85. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.85,
    role: 'prescribed',
  },
  {
    id: 'pistol-squat',
    name: 'Pistol Squat',
    aliases: ['Single-leg Squat'],
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [3, 10],
    progressionLadder: ['bodyweight-squat', 'sissy-squat', 'pistol-squat'],
    cue: 'One leg extended out in front, sit back and down on the standing leg until the hip drops below the knee, then stand back up without the other foot touching down.',
    usesBodyweight: true,
    // Reasoned, not measured — one leg carries nearly the whole body through
    // a full-depth squat, slightly less than Split Squat's 0.85 for the
    // extended-leg counterbalance. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'split-squat',
    name: 'Split Squat',
    aliases: ['Bulgarian Split Squat', 'Rear-foot Elevated Split Squat'],
    pattern: 'lunge',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 20],
    progressionLadder: ['split-squat', 'deficit-split-squat'],
    cue: 'Rear foot elevated if you have something to put it on. Front shin stays vertical.',
    usesBodyweight: true,
    // Reasoned, not measured — one leg carries nearly the whole body through the rep. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.85,
    role: 'prescribed',
  },
  {
    id: 'deficit-split-squat',
    name: 'Deficit Split Squat',
    aliases: ['Split Squat (Front Foot Elevated)'],
    pattern: 'lunge',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    progressionLadder: ['split-squat', 'deficit-split-squat'],
    // Same stretch-mediated-hypertrophy call as the rest of this library's
    // deficit variants: the lower front foot adds range a flat-floor split
    // squat does not reach.
    cue: 'Front foot on a small step or plate, so the working leg drops below the level of the back foot.',
    usesBodyweight: true,
    // Reasoned, not measured — slightly more front-leg loading than Split
    // Squat's 0.85 for the added depth. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    aliases: ['Hip Bridge', 'Bodyweight Glute Bridge'],
    pattern: 'hinge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [12, 20],
    // The ladder's primary muscle deliberately crosses glutes -> hamstrings,
    // same as the barbell library already splits Barbell Hip Thrust (glutes)
    // from Romanian Deadlift (hamstrings) for the same two-leg-vs-more-hip-
    // flexion reasoning. Not an accident inherited from the shipped push
    // ladder's chest->triceps crossing — see docs/bodyweight-gates-plan.md §3.
    progressionLadder: ['glute-bridge', 'single-leg-glute-bridge', 'feet-elevated-single-leg-glute-bridge'],
    cue: 'Two feet down, squeeze at the top, ribs down rather than arching the back.',
    usesBodyweight: true,
    // Reasoned, not measured — both legs share the load, so less per leg than the single-leg version. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.55,
    role: 'prescribed',
  },
  {
    id: 'single-leg-glute-bridge',
    name: 'Single-leg Glute Bridge',
    aliases: ['Single Leg Hip Bridge'],
    pattern: 'hinge',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 20],
    progressionLadder: ['glute-bridge', 'single-leg-glute-bridge', 'feet-elevated-single-leg-glute-bridge'],
    cue: 'One foot down, hips square. Squeeze at the top, control the lower.',
    usesBodyweight: true,
    // Reasoned, not measured — one leg carries the hips, not the whole body. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.35,
    role: 'prescribed',
  },
  {
    id: 'feet-elevated-single-leg-glute-bridge',
    name: 'Feet-elevated Single-leg Glute Bridge',
    aliases: ['Single-leg Hip Bridge (Elevated)'],
    pattern: 'hinge',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight', 'bench'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    progressionLadder: ['glute-bridge', 'single-leg-glute-bridge', 'feet-elevated-single-leg-glute-bridge'],
    cue: 'Heel up on a bench or chair, other leg extended. Drive through the elevated heel — the added hip flexion at the bottom stretches the hamstring further than a floor-level bridge reaches.',
    usesBodyweight: true,
    // Reasoned, not measured — slightly more than Single-leg Glute Bridge's
    // 0.35 for the greater range of motion. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.4,
    role: 'prescribed',
  },
  {
    id: 'sliding-leg-curl',
    name: 'Sliding Leg Curl',
    aliases: ['Slider Hamstring Curl', 'Towel Leg Curl'],
    pattern: 'isolation',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
    // Needs a slick floor and something for the heels to slide on (a towel,
    // furniture sliders) — no tracked equipment tag fits, so this is
    // approximated as bodyweight, same precedent as Inverted Row's bar-or-
    // table-edge approximation.
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [8, 15],
    progressionLadder: ['sliding-leg-curl', 'nordic-curl'],
    cue: 'Lying on your back, heels on a towel or sliders on a smooth floor, hips lifted and held. Curl the heels in toward the glutes, then slide back out under control without the hips dropping.',
    usesBodyweight: true,
    // Reasoned, not measured — the hips stay lifted and supported throughout;
    // only the legs and the held bridge position move. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.4,
    role: 'prescribed',
  },
  {
    id: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    aliases: ['Bodyweight Calf Raise'],
    pattern: 'isolation',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [15, 30],
    progressionLadder: ['standing-calf-raise', 'single-leg-calf-raise', 'deficit-single-leg-calf-raise'],
    cue: 'Full stretch at the bottom, pause at the top.',
    usesBodyweight: true,
    // Genuinely unsourced — how much a two-footed raise is worth versus a
    // loaded barbell calf raise is not something this estimate is confident
    // about. Flagged rather than presented as measured. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'single-leg-calf-raise',
    name: 'Single-leg Calf Raise',
    aliases: [],
    pattern: 'isolation',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [12, 20],
    progressionLadder: ['standing-calf-raise', 'single-leg-calf-raise', 'deficit-single-leg-calf-raise'],
    cue: 'One foot on the ground, hands lightly on a wall for balance. Full stretch at the bottom, pause at the top.',
    usesBodyweight: true,
    // Reasoned, not measured — standing on one leg does not halve the load;
    // the whole body still rises through the ankle, same as the two-footed
    // version. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'deficit-single-leg-calf-raise',
    name: 'Deficit Single-leg Calf Raise',
    aliases: ['Single-leg Calf Raise (Step Edge)'],
    pattern: 'isolation',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 15],
    progressionLadder: ['standing-calf-raise', 'single-leg-calf-raise', 'deficit-single-leg-calf-raise'],
    // Same stretch-mediated-hypertrophy call as the rest of this library's
    // deficit variants: the step edge adds a stretch a flat-floor raise
    // cannot reach.
    cue: 'One foot on the edge of a step, heel hanging below the edge. Drop into a full stretch at the bottom before driving up onto the toes.',
    usesBodyweight: true,
    // Reasoned, not measured — same mechanism as Single-leg Calf Raise. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'toes-to-bar',
    name: 'Toes-to-bar',
    aliases: ['Toes to Bar'],
    pattern: 'core',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'grip'],
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [5, 15],
    progressionLadder: ['leg-raises', 'hanging-leg-raises', 'toes-to-bar'],
    cue: 'Full hang, drive the toes up to touch the bar without swinging into it. Lower back to a dead hang under control.',
    usesBodyweight: true,
    // Reasoned, not measured — more than Hanging Leg Raises' 0.35: the legs
    // extend all the way to the bar, a longer range through the same mass.
    // See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.4,
    role: 'prescribed',
  },
  {
    id: 'chin-ups',
    name: 'Chin-ups',
    aliases: ['Chinups', 'Underhand Pull-ups'],
    // Modelled with biceps as the primary mover (not lats, as Pull-ups is)
    // so it can actually fill the isolation/biceps gap the audit found — an identical
    // exercise to Pull-ups here would not help when the curl station, not
    // the bar, is what is occupied.
    pattern: 'vertical_pull',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['lats', 'upper_back'],
    equipment: ['pullup_bar'],
    unit: 'reps',
    increment: 0,
    repRange: [4, 12],
    cue: 'Underhand, shoulder width. Chin clears the bar.',
    usesBodyweight: true,
    // Reasoned, not measured — close to a dead hang, same as Pull-ups. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.9,
    role: 'prescribed',
  },
  {
    id: 'side-plank',
    name: 'Side Plank',
    aliases: ['Side Bridge'],
    pattern: 'core',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    equipment: ['bodyweight'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Straight line from ankles to shoulders. Hips up and held, not sagging.',
    usesBodyweight: true,
    // Reasoned, not measured — roughly half the body's mass, borne along the forearm and feet. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.5,
    role: 'prescribed',
  },
  {
    id: 'dead-hang',
    name: 'Dead Hang',
    aliases: ['Bar Hang', 'Timed Hang'],
    pattern: 'isolation',
    primaryMuscles: ['grip'],
    secondaryMuscles: ['forearms', 'lats'],
    equipment: ['pullup_bar', 'bodyweight'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Full hang, shoulders relaxed. Hold until the grip, not the shoulders, gives out.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'prone-ytw-raise',
    name: 'Prone Y-T-W Raise',
    aliases: ['YTW Raise', 'Prone Raise'],
    pattern: 'isolation',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['upper_back'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 20],
    cue: 'Face down on a bench or the floor. Thumbs up, squeeze the shoulder blades, not the lower back.',
    usesBodyweight: true,
    // Reasoned, not measured — only the arms move against gravity. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.15,
    role: 'prescribed',
  },
  {
    id: 'burpees',
    name: 'Burpees',
    aliases: [],
    pattern: 'cardio',
    primaryMuscles: ['cardio'],
    secondaryMuscles: ['chest', 'quads'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [10, 30],
    cue: 'Chest to the floor, full jump at the top. Keep the pace honest.',
    usesBodyweight: true,
    // Reasoned, not measured — full body through the rep, close to a pushup-plus-jump. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.7,
    role: 'prescribed',
  },
  {
    id: 'outdoor-run',
    name: 'Outdoor Run',
    aliases: ['Run', 'Jog'],
    pattern: 'cardio',
    primaryMuscles: ['cardio'],
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Same walk-run structure as the treadmill: five easy, five hard, repeated.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'prescribed',
  },
  {
    id: 'plank-shoulder-tap',
    name: 'Plank Shoulder Tap',
    aliases: ['Shoulder Tap Plank'],
    pattern: 'core',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    equipment: ['bodyweight'],
    unit: 'reps',
    increment: 0,
    repRange: [16, 24],
    // Anti-rotation core work, the bodyweight stand-in for the Pallof Press —
    // spine stability, not hypertrophy, so the stretch standard does not
    // apply here. No progressionLadder for the same reason Pallof Press has
    // none: there is nothing to advance toward, only more control.
    cue: 'Plank on the hands, feet a little wider than normal for stability. Tap the opposite shoulder with one hand without letting the hips rotate or sag.',
    usesBodyweight: true,
    // Reasoned, not measured — same order as Side Plank: roughly half the
    // body's mass, borne along the arms and feet. See docs/TODO.md's Exercise substitution entry (commit 5ce8d44).
    bodyweightFactor: 0.5,
    role: 'prescribed',
  },
  /* ---------------- Fallback library ----------------
   * Never prescribed, never a routine default, never promoted by mastering
   * one. Exists only so `substitutesFor` (commit 5) has an answer for the
   * groups the equipment-desert audit found (commit 5d33216). Two entries
   * from that table are deliberately absent: Skipping (needs a jump rope,
   * which is not in EquipmentSchema) and Plate Raise (needs a loose plate,
   * same gap) — both would have to be tagged with equipment they do not
   * really require, which is worse than seeding one fewer exercise.
   */
  {
    id: 'single-arm-dumbbell-row',
    name: 'Single-arm Dumbbell Row (No Bench)',
    aliases: ['Bent-over One Arm Row', 'Suitcase Row'],
    pattern: 'horizontal_pull',
    primaryMuscles: ['upper_back'],
    secondaryMuscles: ['lats', 'biceps', 'rear_delts'],
    equipment: ['dumbbell'],
    unit: 'kg',
    increment: 2,
    repRange: [8, 15],
    cue: 'Hinge at the hip, flat back. Row to the hip, not the shoulder.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'dumbbell-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    aliases: ['DB Lateral Raise', 'Side Raise'],
    pattern: 'isolation',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    unit: 'kg',
    increment: 1,
    repRange: [10, 20],
    cue: 'Lead with the elbows. Stop at shoulder height.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'dumbbell-shrug',
    name: 'Dumbbell Shrug',
    aliases: ['DB Shrug'],
    pattern: 'isolation',
    primaryMuscles: ['traps'],
    secondaryMuscles: ['grip'],
    equipment: ['dumbbell'],
    unit: 'kg',
    increment: 2,
    repRange: [10, 20],
    cue: 'Straight up and down. No rolling the shoulders.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'barbell-shrug',
    name: 'Barbell Shrug',
    aliases: [],
    pattern: 'isolation',
    primaryMuscles: ['traps'],
    secondaryMuscles: ['grip'],
    equipment: ['barbell'],
    unit: 'kg',
    increment: 5,
    repRange: [8, 15],
    cue: 'Straight up and down. No rolling the shoulders.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'towel-curl',
    name: 'Towel Curl',
    aliases: ['Isometric Towel Curl'],
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['bodyweight'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Loop a towel under one foot. Curl against it as hard as you can hold.',
    // Isometric and self-resisted — no bodyweight mass is actually moved, so
    // this earns hard-set and work-interval credit but no tonnage.
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'wall-sit',
    name: 'Wall Sit',
    aliases: [],
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['bodyweight'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Thighs parallel to the floor, back flat against the wall.',
    // unit: 'time' sets always log reps: 0, and tonnage() multiplies by reps,
    // so bodyweightFactor could never contribute here regardless of value —
    // left false rather than seed a number that can never be read.
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'stair-climb',
    name: 'Stair Climb',
    aliases: ['Stairs', 'Stair Sprints'],
    pattern: 'cardio',
    primaryMuscles: ['cardio'],
    secondaryMuscles: ['quads', 'glutes'],
    equipment: ['bodyweight'],
    unit: 'time',
    increment: 0,
    repRange: [1, 1],
    cue: 'Steady pace up, walk down to recover. Repeat for the interval.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },

  /* ---------------- Fallbacks added alongside the hinge/cuff/grip/anti-rotation
   * fixes, and later the forearms one: each of those newly prescribed
   * exercises is the only one (or only dumbbell one) in the library naming
   * its primary muscle, so without an equipment-free stand-in here
   * `substitutesFor` would have no answer once its own station is taken.
   */
  {
    id: 'dumbbell-external-rotation',
    name: 'Dumbbell External Rotation',
    aliases: ['DB External Rotation', 'Sidelying External Rotation'],
    pattern: 'isolation',
    primaryMuscles: ['rotator_cuff'],
    secondaryMuscles: ['rear_delts'],
    equipment: ['dumbbell'],
    unit: 'kg',
    increment: 1,
    repRange: [15, 20],
    cue: 'Lying on your side, elbow at 90 degrees and pinned to the ribs. Rotate the forearm up, nothing else moves.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
  {
    id: 'cable-wrist-curl',
    name: 'Cable Wrist Curl',
    aliases: ['Cable Forearm Curl'],
    // Added alongside wrist-curl/reverse-wrist-curl: both need a dumbbell,
    // so this is their equipment-free-of-*that*-station answer when it is
    // occupied — a low cable and a straight bar covers either direction.
    pattern: 'isolation',
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['grip'],
    equipment: ['cable'],
    unit: 'kg',
    increment: PIN_STEP,
    repRange: [12, 15],
    cue: 'Forearm braced on the thigh, wrist curling against the low pulley. Full stretch at the bottom, every rep.',
    usesBodyweight: false,
    bodyweightFactor: 1,
    role: 'fallback',
  },
]

/**
 * The barbell hunter's old six-day CST/back-biceps/legs split — no longer
 * seeded (see `SEED_ROUTINES` below), kept only so `repo.reconcileRoutines`
 * can still prove an already-onboarded hunter's stored rows are untouched
 * before replacing them with the Push/Pull/Legs split. Never edit this
 * array's content: its whole purpose is being a frozen, known-old shape to
 * compare against. If it stops being referenced by any live migration path,
 * delete it rather than let it silently rot.
 */
export const LEGACY_SEED_ROUTINES_CST: readonly Routine[] = [
  {
    id: 'monday-cst',
    dayOfWeek: 1,
    name: 'CST Gate',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'incline-barbell-press', sets: 4, repRange: [5, 8], restSec: 180 }] },
      { type: 'single', items: [{ exerciseId: 'machine-shoulder-press', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'skullcrusher', sets: 3, repRange: [8, 12], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'cable-fly', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'machine-lateral-raise', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'front-raises', sets: 2, repRange: [12, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'diamond-pushups', sets: 3, repRange: [8, 20], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'cable-external-rotation', sets: 2, repRange: [15, 20], restSec: 45 }] },
    ],
  },
  {
    id: 'tuesday-back-biceps',
    dayOfWeek: 2,
    name: 'Back and Biceps Gate',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'one-arm-cable-lat-pulldown', sets: 3, repRange: [8, 12], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'pull-ups', sets: 4, repRange: [5, 12], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'dumbbell-row', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'cable-shrug', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'machine-reverse-fly', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'cable-bicep-curl', sets: 3, repRange: [10, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'farmers-carry', sets: 3, repRange: [1, 1], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'wrist-curl', sets: 3, repRange: [12, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'reverse-wrist-curl', sets: 2, repRange: [15, 20], restSec: 45 }] },
      { type: 'single', items: [{ exerciseId: 'dumbbell-hub-pinch', sets: 3, repRange: [1, 1], restSec: 60 }] },
    ],
  },
  {
    id: 'wednesday-abs-biceps',
    dayOfWeek: 3,
    name: 'Abs and Biceps Gate',
    gateRank: 'D',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'dumbbell-bulgarian-split-squat', sets: 3, repRange: [8, 12], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'machine-preacher-curl', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'cable-bicep-curl', sets: 3, repRange: [10, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'strict-curl', sets: 3, repRange: [6, 10], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'leg-raises', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'pallof-press', sets: 3, repRange: [10, 12], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'cable-crunch', sets: 3, repRange: [10, 15], restSec: 60 }] },
    ],
  },
  {
    id: 'thursday-cst-supersets',
    dayOfWeek: 4,
    name: 'CST Gate (Supersets)',
    gateRank: 'C',
    blocks: [
      {
        type: 'superset',
        items: [
          { exerciseId: 'incline-pushups', sets: 3, repRange: [10, 20], restSec: 0 },
          { exerciseId: 'cable-chest-press-mid', sets: 3, repRange: [10, 15], restSec: 90 },
        ],
      },
      {
        type: 'superset',
        items: [
          { exerciseId: 'pike-pushups', sets: 3, repRange: [8, 15], restSec: 0 },
          { exerciseId: 'cable-chest-press-low', sets: 3, repRange: [10, 15], restSec: 90 },
        ],
      },
      {
        type: 'superset',
        items: [
          { exerciseId: 'diamond-pushups', sets: 3, repRange: [8, 20], restSec: 0 },
          { exerciseId: 'cable-chest-press-high', sets: 3, repRange: [10, 15], restSec: 90 },
        ],
      },
      { type: 'single', items: [{ exerciseId: 'machine-shoulder-press', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'tricep-overhead-extension', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'cable-external-rotation', sets: 2, repRange: [15, 20], restSec: 45 }] },
    ],
  },
  {
    id: 'friday-legs',
    dayOfWeek: 5,
    name: 'Legs Gate',
    gateRank: 'B',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'barbell-squat', sets: 4, repRange: [5, 8], restSec: 210 }] },
      { type: 'single', items: [{ exerciseId: 'romanian-deadlift', sets: 3, repRange: [6, 10], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'barbell-hip-thrust', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'leg-press', sets: 3, repRange: [10, 15], restSec: 150 }] },
      {
        type: 'superset',
        items: [
          { exerciseId: 'hamstring-curl', sets: 3, repRange: [10, 15], restSec: 0 },
          { exerciseId: 'leg-extension', sets: 3, repRange: [12, 15], restSec: 90 },
        ],
      },
      { type: 'single', items: [{ exerciseId: 'nordic-curl', sets: 2, repRange: [3, 10], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'barbell-calf-raise', sets: 4, repRange: [10, 15], restSec: 75 }] },
    ],
  },
  {
    id: 'saturday-cardio-abs',
    dayOfWeek: 6,
    name: 'Cardio and Abs Gate',
    gateRank: 'D',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'leg-raises', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'cable-crunch', sets: 3, repRange: [10, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'hanging-leg-raises', sets: 3, repRange: [8, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'treadmill-intervals', sets: 1, repRange: [1, 1], restSec: 0 }] },
    ],
  },
]

/**
 * The six training days. Day numbers match `Date.prototype.getDay`, so Sunday
 * is 0 and is deliberately absent — Sunday is rest.
 *
 * A Push/Pull/Legs split, twice through the week — replaced the CST/back-
 * biceps/legs split above (docs/TODO.md, "Push/Pull/Legs replaces the CST
 * split") after a hunter's own Analysis screen turned up eight simultaneous
 * warnings against it: no hip hinge, biceps on back-to-back days, three-plus
 * biceps exercises in one session, front delts outweighing rear delts, twice
 * as many push days as leg days, no single-leg work, no direct grip work, no
 * rotator cuff work. Every one of those is closed by design here, not by
 * accident — verified against the real `detectAdvisories`/`weeklyVolumeReport`
 * before this shipped: zero advisories fire, and every muscle this split
 * trains clears its MEV floor. Two honest trade-offs that remain, neither
 * tripping a warning: traps sit below their floor (a pre-existing gap the
 * old split had too — only one weekly Cable Shrug exists in the prescribed
 * library), and grip runs a little hot (Farmer's Carry stacked on top of two
 * pull sessions' worth of rowing) without reaching its recoverable ceiling.
 *
 * Gate ranks here are starting values. Once there is history the real rank is
 * computed from planned tonnage and intensity by `gateDifficulty`.
 */
export const SEED_ROUTINES: readonly Routine[] = [
  {
    id: 'ppl-monday-push-a',
    dayOfWeek: 1,
    name: 'Push Gate A',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'incline-barbell-press', sets: 4, repRange: [5, 8], restSec: 180 }] },
      { type: 'single', items: [{ exerciseId: 'machine-shoulder-press', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'machine-lateral-raise', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'skullcrusher', sets: 3, repRange: [8, 12], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'cable-external-rotation', sets: 2, repRange: [15, 20], restSec: 45 }] },
    ],
  },
  {
    id: 'ppl-tuesday-pull-a',
    dayOfWeek: 2,
    name: 'Pull Gate A',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'pull-ups', sets: 4, repRange: [5, 12], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'dumbbell-row', sets: 3, repRange: [8, 12], restSec: 120 }] },
      // Direct rear-delt work on every Pull day, deliberately — this and its
      // Friday counterpart are what keep front delts from running away from
      // rear delts, since nothing on a Push day adds isolated front-delt
      // work beyond what pressing already gives it.
      { type: 'single', items: [{ exerciseId: 'machine-reverse-fly', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'cable-shrug', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'cable-bicep-curl', sets: 3, repRange: [10, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'machine-preacher-curl', sets: 2, repRange: [10, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'farmers-carry', sets: 3, repRange: [1, 1], restSec: 90 }] },
    ],
  },
  {
    id: 'ppl-wednesday-legs-a',
    dayOfWeek: 3,
    name: 'Legs Gate A',
    gateRank: 'B',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'barbell-squat', sets: 4, repRange: [5, 8], restSec: 210 }] },
      { type: 'single', items: [{ exerciseId: 'romanian-deadlift', sets: 3, repRange: [6, 10], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'leg-press', sets: 3, repRange: [10, 15], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'hamstring-curl', sets: 3, repRange: [10, 15], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'barbell-calf-raise', sets: 4, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'cable-crunch', sets: 3, repRange: [10, 15], restSec: 60 }] },
    ],
  },
  {
    id: 'ppl-thursday-push-b',
    dayOfWeek: 4,
    name: 'Push Gate B',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'cable-chest-press-mid', sets: 4, repRange: [10, 15], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'machine-shoulder-press', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'cable-fly', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'tricep-overhead-extension', sets: 3, repRange: [10, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'machine-lateral-raise', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'cable-external-rotation', sets: 2, repRange: [15, 20], restSec: 45 }] },
    ],
  },
  {
    id: 'ppl-friday-pull-b',
    dayOfWeek: 5,
    name: 'Pull Gate B',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'one-arm-cable-lat-pulldown', sets: 4, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'dumbbell-row', sets: 3, repRange: [8, 12], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'prone-ytw-raise', sets: 3, repRange: [10, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'strict-curl', sets: 3, repRange: [6, 10], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'cable-bicep-curl', sets: 2, repRange: [10, 15], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'pallof-press', sets: 3, repRange: [10, 12], restSec: 60 }] },
    ],
  },
  {
    id: 'ppl-saturday-legs-b',
    dayOfWeek: 6,
    name: 'Legs Gate B',
    gateRank: 'B',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'leg-press', sets: 4, repRange: [10, 15], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'barbell-hip-thrust', sets: 3, repRange: [8, 12], restSec: 120 }] },
      // Closes the no-single-leg-work gap — the only unilateral movement in
      // the split, deliberately on the second Legs day rather than repeated.
      { type: 'single', items: [{ exerciseId: 'dumbbell-bulgarian-split-squat', sets: 3, repRange: [8, 12], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'hamstring-curl', sets: 3, repRange: [10, 15], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'barbell-calf-raise', sets: 4, repRange: [10, 15], restSec: 75 }] },
    ],
  },
]

/**
 * The bodyweight hunter's own six gates (docs/bodyweight-gates-plan.md §4).
 * Same six `dayOfWeek` values as `SEED_ROUTINES`, so `weekDayStatus`, streaks
 * and gate ranks all work unchanged — only which routine set gets seeded
 * differs, decided in `domain/equipment.ts`'s selection rule. Ids are `bw-`
 * prefixed so the two sets can never collide.
 *
 * Every exercise below is deliberately reachable with nothing more than
 * `['bodyweight', 'pullup_bar']` — the plan's baseline tier — which is what
 * `seed.test.ts` enforces. That ruled out `incline-pushups`, whose easiest
 * rung needs a bench: Thursday opens on plain Pushups instead, one rung up
 * the same ladder.
 */
export const SEED_ROUTINES_BODYWEIGHT: readonly Routine[] = [
  {
    id: 'bw-monday-push',
    dayOfWeek: 1,
    name: 'Push Gate',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'deficit-pushups', sets: 4, repRange: [8, 20], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'pike-pushups', sets: 3, repRange: [8, 15], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'diamond-pushups', sets: 3, repRange: [8, 20], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'prone-ytw-raise', sets: 3, repRange: [10, 20], restSec: 60 }] },
    ],
  },
  {
    id: 'bw-tuesday-pull',
    dayOfWeek: 2,
    name: 'Pull Gate',
    gateRank: 'C',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'pull-ups', sets: 5, repRange: [5, 12], restSec: 150 }] },
      { type: 'single', items: [{ exerciseId: 'inverted-row', sets: 4, repRange: [8, 15], restSec: 120 }] },
      { type: 'single', items: [{ exerciseId: 'chin-ups', sets: 4, repRange: [4, 12], restSec: 90 }] },
      // Rear delts get direct work twice this week (here and Monday) for the
      // same reason cable-external-rotation and machine-shoulder-press
      // repeat Monday+Thursday in the barbell week: a small, easily-
      // neglected group earns frequency, not just a single weekly set block.
      { type: 'single', items: [{ exerciseId: 'prone-ytw-raise', sets: 3, repRange: [10, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'dead-hang', sets: 3, repRange: [1, 1], restSec: 75 }] },
    ],
  },
  {
    id: 'bw-wednesday-lower-core',
    dayOfWeek: 3,
    name: 'Lower and Core Gate',
    gateRank: 'D',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'split-squat', sets: 3, repRange: [10, 20], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'sliding-leg-curl', sets: 3, repRange: [8, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'single-leg-calf-raise', sets: 4, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'side-plank', sets: 2, repRange: [1, 1], restSec: 45 }] },
      { type: 'single', items: [{ exerciseId: 'plank-shoulder-tap', sets: 3, repRange: [16, 24], restSec: 60 }] },
    ],
  },
  {
    id: 'bw-thursday-push-supersets',
    dayOfWeek: 4,
    name: 'Push Gate (Supersets)',
    gateRank: 'C',
    // Ascending difficulty across the pairs, same shape as the barbell
    // week's Thursday — pushups (easiest bodyweight-only rung available,
    // since Incline Pushups needs a bench this baseline tier does not
    // guarantee) through to Archer Pushups alone.
    blocks: [
      {
        type: 'superset',
        items: [
          { exerciseId: 'pushups', sets: 3, repRange: [10, 30], restSec: 0 },
          { exerciseId: 'pike-pushups', sets: 3, repRange: [8, 15], restSec: 90 },
        ],
      },
      {
        type: 'superset',
        items: [
          { exerciseId: 'diamond-pushups', sets: 3, repRange: [8, 20], restSec: 0 },
          { exerciseId: 'deficit-pushups', sets: 3, repRange: [8, 20], restSec: 90 },
        ],
      },
      { type: 'single', items: [{ exerciseId: 'archer-pushups', sets: 3, repRange: [4, 12], restSec: 90 }] },
    ],
  },
  {
    id: 'bw-friday-legs',
    dayOfWeek: 5,
    name: 'Legs Gate',
    gateRank: 'B',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'sissy-squat', sets: 3, repRange: [8, 15], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'deficit-split-squat', sets: 3, repRange: [8, 15], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'single-leg-glute-bridge', sets: 3, repRange: [10, 20], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'nordic-curl', sets: 2, repRange: [3, 10], restSec: 90 }] },
      { type: 'single', items: [{ exerciseId: 'deficit-single-leg-calf-raise', sets: 4, repRange: [10, 15], restSec: 75 }] },
    ],
  },
  {
    id: 'bw-saturday-cardio-core',
    dayOfWeek: 6,
    name: 'Cardio and Core Gate',
    gateRank: 'D',
    blocks: [
      { type: 'single', items: [{ exerciseId: 'leg-raises', sets: 3, repRange: [12, 20], restSec: 60 }] },
      { type: 'single', items: [{ exerciseId: 'hanging-leg-raises', sets: 3, repRange: [8, 15], restSec: 75 }] },
      { type: 'single', items: [{ exerciseId: 'side-plank', sets: 2, repRange: [1, 1], restSec: 45 }] },
      { type: 'single', items: [{ exerciseId: 'outdoor-run', sets: 1, repRange: [1, 1], restSec: 0 }] },
    ],
  },
]

/** Lookup by id, for the many callers that resolve an exercise from a set log. */
export const SEED_EXERCISE_BY_ID: ReadonlyMap<string, Exercise> = new Map(
  SEED_EXERCISES.map((exercise) => [exercise.id, exercise]),
)

export function seedExercise(id: string): Exercise | undefined {
  return SEED_EXERCISE_BY_ID.get(id)
}
