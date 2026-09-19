/**
 * How-to copy for the prescribed exercise library, shown by `ExerciseHelpModal`
 * alongside `MuscleMap`. Plain data, no React — same convention as
 * `help.ts`. Keyed by `Exercise.id`, not merged into the `Exercise` schema
 * itself, so this content can grow without touching the 40+ existing seed
 * object literals or anything that flows through sync.
 *
 * `Exercise.cue` stays the one-line coaching reminder shown mid-set; `steps`
 * here is the longer explanation for someone who has never done the movement.
 * The two are allowed to overlap — they are read at different moments.
 *
 * Fallback-library exercises intentionally have no guide yet (see
 * docs/TODO.md) — `ExerciseHelpModal` renders an honest "not written yet"
 * state rather than a placeholder for those, and the coverage test below only
 * requires every *prescribed* exercise to have one.
 */
export interface ExerciseGuide {
  setup: string
  steps: readonly string[]
  commonMistakes: readonly string[]
}

export const EXERCISE_GUIDES: Readonly<Record<string, ExerciseGuide>> = {
  'incline-barbell-press': {
    setup: 'Bench at a 30-45° incline. Grip just outside shoulder width, bar over the collarbone.',
    steps: [
      'Unrack and lower the bar to the upper chest, elbows at roughly 45° from the torso.',
      'Touch lightly at the upper chest without bouncing.',
      'Drive the bar back up and slightly back over the shoulders, finishing with elbows nearly locked.',
    ],
    commonMistakes: [
      'Flaring the elbows to 90° — it shifts stress onto the front of the shoulder instead of the chest.',
      'Setting the incline too steep, which turns the lift into a shoulder press.',
    ],
  },
  'machine-shoulder-press': {
    setup: 'Seat adjusted so the handles start level with the top of the shoulders.',
    steps: [
      'Press the handles straight up without arching the lower back off the pad.',
      'Stop just short of locking the elbows out hard.',
      'Lower under control back to the start position.',
    ],
    commonMistakes: [
      'Locking out and resting at the top between reps — it kills tension and adds joint stress for no benefit.',
      'Letting the ribs flare up to help the press.',
    ],
  },
  skullcrusher: {
    setup: 'Lying on a bench, EZ-bar held with a narrow overhand grip, arms extended straight up over the chest.',
    steps: [
      'Keeping the upper arms vertical and still, bend only at the elbow to lower the bar toward the forehead or just behind it.',
      'Stop when you feel a full stretch in the triceps.',
      'Extend the elbows back to the start without moving the shoulders.',
    ],
    commonMistakes: [
      'Letting the elbows drift backward over the face — it reduces triceps tension and is where this exercise gets its name.',
      'Using momentum from the shoulders instead of the elbow hinge.',
    ],
  },
  'cable-fly': {
    setup: 'Pulleys set roughly at chest height, one handle per hand, standing in the middle in a slight forward lean.',
    steps: [
      'Start with arms out to the sides, a slight, fixed bend in the elbow.',
      'Sweep the hands together in an arc until they meet in front of the chest.',
      'Squeeze at the midline, then return under control to the stretch position.',
    ],
    commonMistakes: [
      'Bending and straightening the elbow during the rep — the bend should stay constant so the chest, not the triceps, does the work.',
      'Clapping the hands together at the top instead of stopping at the squeeze.',
    ],
  },
  'machine-lateral-raise': {
    setup: 'Seated, pads positioned against the outside of the upper arms, elbows softly bent.',
    steps: [
      'Lead with the elbows and raise the arms out to the sides.',
      'Stop at shoulder height — going higher shifts the work onto the traps.',
      'Lower under control rather than letting the weight stack drop.',
    ],
    commonMistakes: [
      'Shrugging the shoulders up to help lift the weight.',
      'Swinging instead of a controlled raise.',
    ],
  },
  'front-raises': {
    setup: 'Standing, a dumbbell in each hand, arms hanging in front of the thighs.',
    steps: [
      'Raise one arm straight in front of you to about shoulder height, palm down.',
      'Pause briefly at the top.',
      'Lower under control and repeat, alternating arms or moving together.',
    ],
    commonMistakes: [
      'Swinging the torso to generate momentum instead of lifting with the shoulder.',
      'Going heavier than the front delts can strictly handle — this sits on top of pressing volume, so form matters more than load here.',
    ],
  },
  'diamond-pushups': {
    setup: 'Hands together under the sternum, thumbs and index fingers touching to form a diamond.',
    steps: [
      'Lower the chest toward the hands, elbows brushing the ribs rather than flaring out.',
      'Touch the chest lightly to the hands.',
      'Press back up to a full arm extension, keeping the body in one straight line.',
    ],
    commonMistakes: [
      'Letting the hips sag or pike up, which turns this into a core exercise instead of a pressing one.',
      'Flaring the elbows wide, which removes the close-grip triceps emphasis this variation is for.',
    ],
  },
  'cable-external-rotation': {
    setup: 'Cable at elbow height, standing side-on to the machine, elbow bent 90° and pinned to the ribs.',
    steps: [
      'Holding the handle with the working arm, rotate the forearm outward and away from the body, keeping the elbow glued to the side.',
      'Stop when the forearm is roughly parallel to the floor.',
      'Return under control to the start.',
    ],
    commonMistakes: [
      'Letting the elbow drift away from the ribs — the movement should come from the shoulder rotating, not the arm swinging.',
      'Loading it heavy. This is stability work for a small muscle group; light and controlled is correct, not a compromise.',
    ],
  },
  'one-arm-cable-lat-pulldown': {
    setup: 'Single handle attached high, kneeling or half-kneeling facing the machine, arm extended overhead.',
    steps: [
      'Let the shoulder rise fully at the top of the stretch.',
      'Pull by driving the elbow down and back, not by curling the forearm.',
      'Squeeze the lat at the bottom before returning to a full stretch.',
    ],
    commonMistakes: [
      'Leaning back and using body weight to yank the handle down instead of the lat.',
      'Stopping the range short at the top, which cuts out the stretch that makes this variation valuable.',
    ],
  },
  'pull-ups': {
    setup: 'Full overhand grip, slightly wider than shoulder width, hanging with arms fully extended.',
    steps: [
      'Start from a genuine dead hang — shoulders relaxed, not pre-tensed.',
      'Pull the chest up toward the bar by driving the elbows down, not by hauling with the arms alone.',
      'Touch the chest to the bar or get the chin clearly over it, then lower back to a full hang.',
    ],
    commonMistakes: [
      'Kipping — using a leg swing to create momentum defeats the point of a strength exercise.',
      'Only doing half the range at the bottom. The dead hang is where most of the stretch-driven stimulus comes from.',
    ],
  },
  'dumbbell-row': {
    setup: 'One knee and hand on a bench, flat back, dumbbell in the free hand, arm hanging straight down.',
    steps: [
      'Pull the dumbbell up toward the hip, not the armpit, driving the elbow back and up.',
      'Keep the torso still — the movement is in the arm and shoulder blade, not a twisting torso.',
      'Lower under control to a full stretch before the next rep.',
    ],
    commonMistakes: [
      'Rowing to the armpit/chest, which turns it into more of a rear-delt exercise than a back one.',
      'Twisting the torso to help move the weight — that is momentum doing the work the back should be doing.',
    ],
  },
  'cable-shrug': {
    setup: 'Standing at a low pulley, holding a straight bar or handles at hip height, arms straight.',
    steps: ['Shrug the shoulders straight up toward the ears.', 'Hold the top for a beat.', 'Lower under control back to the start.'],
    commonMistakes: [
      'Rolling the shoulders in a circular motion — straight up and down is the only path that loads the traps without grinding the joint.',
      'Using the arms to help hoist the weight instead of keeping them straight and letting the traps do the lifting.',
    ],
  },
  'machine-reverse-fly': {
    setup: 'Seated facing into the pad, chest supported, handles held with arms nearly straight.',
    steps: [
      'Move the arms out and back, focusing on spreading the hands apart rather than squeezing the shoulder blades together.',
      'Pause briefly at the point of full extension.',
      'Return under control without letting the weight stack slam down.',
    ],
    commonMistakes: [
      'Turning it into a shrug by letting the traps take over instead of the rear delts.',
      'Using too much weight and relying on momentum instead of a controlled arc.',
    ],
  },
  'cable-bicep-curl': {
    setup: 'Standing at a low pulley with a straight or EZ handle, elbows pinned to the sides.',
    steps: [
      'Curl the handle up by bending the elbow, keeping the upper arms still.',
      'Squeeze at the top of the range.',
      "Lower under control — the cable keeps tension through the whole rep, so don't let it go slack.",
    ],
    commonMistakes: [
      'Swinging the elbows forward to cheat the weight up.',
      'Using a hip kick instead of the biceps to start the rep.',
    ],
  },
  'farmers-carry': {
    setup: 'A heavy dumbbell in each hand, standing tall, shoulders back and down.',
    steps: [
      'Brace the core as if about to be punched in the stomach.',
      'Walk at a controlled pace, ribs stacked over the hips, without leaning to either side.',
      'Set the weights down under control the moment grip or posture starts to break down — not after.',
    ],
    commonMistakes: [
      'Letting the shoulders round forward or shrug up to compensate for a failing grip.',
      'Walking too fast or jerky — a smooth, controlled pace keeps tension on the target muscles instead of turning it into a sprint.',
    ],
  },
  'wrist-curl': {
    setup: 'Seated, forearms resting on the thighs or a bench, wrists just past the edge, palms up, a dumbbell in each hand.',
    steps: [
      'Let the dumbbells roll down to the fingertips, opening the hand and fully extending the wrists.',
      'Curl the wrists up, closing the hand back around the bar as you go.',
      'Squeeze at the top, then lower under control back to the full stretch.',
    ],
    commonMistakes: [
      'Stopping short of the full extension at the bottom — that stretch is the entire point of this exercise, not an optional extra.',
      'Swinging the forearms off the thighs to help, turning a wrist isolation into a sloppy curl.',
    ],
  },
  'reverse-wrist-curl': {
    setup: 'Same setup as the wrist curl, forearms supported, but palms down.',
    steps: [
      'Let the wrists drop into full flexion, hands hanging toward the floor.',
      'Extend the wrists to lift the dumbbells, angling the lift slightly toward the thumb side rather than straight up.',
      'Lower back under control to the full stretch before the next rep.',
    ],
    commonMistakes: [
      'Loading it like the wrist curl — the extensors are much weaker; ego-loading this one just means it turns into forearm-swinging.',
      'Extending straight up instead of toward the thumb side — the radial angle is what targets the extensors that actually resist a grip collapsing, not a stylistic variation.',
      'Cutting the range short at the bottom, the same mistake as the wrist curl, mirrored.',
    ],
  },
  'dumbbell-hub-pinch': {
    setup: 'A hex dumbbell standing on its end, or lying with a flat side accessible — grip it by the flat hex faces with your fingers on one side and thumb on the other.',
    steps: [
      'Pinch hard enough to lift the dumbbell clear of the floor or bench.',
      'Let it hang at your side, arm straight, without resting it against your leg.',
      'Hold for the target time, then set it down under control rather than dropping it the moment it slips.',
    ],
    commonMistakes: [
      'Bracing the dumbbell against the leg or body — that turns a pinch-strength exercise into a support-strength one and defeats the point.',
      'Choosing a dumbbell so heavy the hold lasts a few seconds — this is a strength-endurance exercise; if you cannot hold it anywhere near the target time, the load is wrong, not the effort.',
    ],
  },
  'machine-preacher-curl': {
    setup: 'Chest and upper arms resting fully on the preacher pad, elbows just off the bottom edge.',
    steps: ['Curl through the full range the machine allows.', 'Squeeze at the top.', 'Lower under control — the pad prevents cheating with the elbows, so let it do that job.'],
    commonMistakes: [
      'Lifting the elbows off the pad to help finish a rep.',
      'Bouncing out of the bottom stretch instead of controlling the transition.',
    ],
  },
  'strict-curl': {
    setup: 'Standing, back against a wall if one is available, barbell held with an underhand shoulder-width grip.',
    steps: [
      'Curl the bar up by bending the elbows only, upper arms pinned to the sides.',
      'Squeeze at the top without leaning back.',
      'Lower under full control back to a straight-arm start.',
    ],
    commonMistakes: [
      'Using hip drive to sling the bar up — the wall is there specifically to remove that option.',
      'Only completing a partial range at the top or bottom.',
    ],
  },
  'leg-raises': {
    setup: 'Lying flat on the floor or a bench, hands by the sides or under the lower back for support.',
    steps: [
      'Press the lower back into the floor before starting — this stays true for the whole set.',
      'Raise the legs, straight or slightly bent, until the hips start to curl.',
      'Lower under control and stop the moment the lower back wants to arch off the floor.',
    ],
    commonMistakes: [
      'Letting the lower back arch as the legs lower — that shifts load off the abs and onto the spine.',
      'Using momentum to swing the legs up instead of a controlled lift.',
    ],
  },
  'machine-abs-crunch': {
    setup: 'Seated, chest against the pad, hands gripping the handles.',
    steps: [
      'Curl the ribs down toward the hips — this is a spinal flexion, not a hip fold.',
      'Squeeze at the bottom of the curl.',
      'Return under control to the start without letting the weight stack slam.',
    ],
    commonMistakes: [
      'Pulling with the arms on the handles instead of curling with the abs.',
      'Turning the movement into a hip fold rather than a spinal curl.',
    ],
  },
  'cable-crunch': {
    setup: 'Kneeling below a high pulley with a rope attachment, holding the rope by the head or shoulders.',
    steps: [
      'Keeping the hips fixed in place, curl the elbows down toward the knees using the abs.',
      'Round the spine through the crunch rather than just bending at the hips.',
      'Return under control to the start, keeping tension on the abs throughout.',
    ],
    commonMistakes: [
      'Letting the hips rock back and forth to help — the hips should not move; only the spine curls.',
      'Pulling with the arms or lats instead of the abs.',
    ],
  },
  'dumbbell-bulgarian-split-squat': {
    setup: 'Rear foot up on a bench behind you, front foot far enough forward that the front shin stays close to vertical, a dumbbell in each hand.',
    steps: [
      'Lower straight down, letting the back knee travel toward the floor.',
      'Keep the front shin roughly vertical throughout — the front foot should not need to shift.',
      'Drive through the front heel to stand back up.',
    ],
    commonMistakes: [
      'Placing the front foot too close to the bench, pushing the knee far past the toes and making it a quad-only, joint-stressed movement.',
      'Letting the front knee cave inward on the way up.',
    ],
  },
  'pallof-press': {
    setup: 'Standing side-on to a cable set at chest height, holding the handle at the sternum with both hands.',
    steps: [
      'Brace the core and press the handle straight out from the chest.',
      "Hold the extended position for a beat, resisting the cable's pull that wants to rotate the torso toward the machine.",
      'Return under control to the chest without letting the torso twist.',
    ],
    commonMistakes: [
      'Letting the hips or shoulders rotate toward the cable — resisting that rotation is the entire point of the exercise.',
      'Rushing the hold at the extended position instead of actually pausing there.',
    ],
  },
  'incline-pushups': {
    setup: 'Hands on a raised surface — a bench works well — feet on the floor, body in a straight line.',
    steps: [
      'Lower the chest to the bench under control.',
      'Keep the elbows at roughly 45° from the torso.',
      'Press back up to full extension without letting the hips sag.',
    ],
    commonMistakes: [
      "Setting the hands too high, making the exercise too easy to be a real stimulus — lower the hands as this gets easy.",
      'Letting the hips drop or pike up instead of holding a straight line.',
    ],
  },
  'pike-pushups': {
    setup: 'Hips piked high in an inverted-V, hands on the floor roughly shoulder-width, feet closer in than a normal pushup.',
    steps: [
      'Bend the elbows and lower the head toward the floor between the hands.',
      'Think of it as a vertical press — the torso stays close to vertical, not a diagonal pushup.',
      'Press back up to the starting pike position.',
    ],
    commonMistakes: [
      'Letting the hips drop, which turns this back into a regular pushup and removes the shoulder-press emphasis.',
      'Only lowering a few inches instead of a full range to the floor.',
    ],
  },
  'cable-chest-press-mid': {
    setup: 'Pulleys set at chest height, staggered stance, handles held at the sides of the chest.',
    steps: [
      'Press straight out in front of you.',
      'Squeeze the chest at the midline at full extension.',
      'Return under control to the starting position without letting the weight stack touch down between reps.',
    ],
    commonMistakes: [
      'Letting the shoulders round forward at the start instead of keeping the chest up.',
      "Pressing at an angle instead of straight out, which pulls the shoulder joint out of its strongest line.",
    ],
  },
  'cable-chest-press-low': {
    setup: 'Pulleys set high, handles held at the sides of the chest, staggered stance leaning slightly forward.',
    steps: [
      'Press down and in toward the hips, following the high-to-low angle the pulley position sets up.',
      'Squeeze at the bottom of the arc.',
      'Return under control to the stretch position.',
    ],
    commonMistakes: [
      'Pressing straight out instead of following the down-and-in angle — that defeats the point of targeting the lower chest.',
      'Using too much forward lean, turning the press into a shoulder-dominant movement.',
    ],
  },
  'cable-chest-press-high': {
    setup: 'Pulleys set low, handles held at the sides of the chest, staggered stance.',
    steps: [
      'Press up and in toward the collarbones, following the low-to-high angle.',
      'Squeeze at the top of the arc.',
      'Return under control to the stretch position.',
    ],
    commonMistakes: [
      'Pressing straight out instead of up-and-in, losing the upper-chest emphasis this angle is for.',
      'Shrugging the shoulders up to help drive the weight instead of pressing with the chest.',
    ],
  },
  'tricep-overhead-extension': {
    setup: 'Facing away from a low cable pulley, rope or handle held overhead, upper arms beside the ears.',
    steps: [
      'Keeping the upper arms still and vertical, extend the elbows to straighten the arms overhead.',
      'Feel the stretch at the bottom of the movement — that stretch is the point of this variation.',
      'Return under control to a full stretch before the next rep.',
    ],
    commonMistakes: [
      'Letting the elbows flare out to the sides or drift forward, which shifts tension off the triceps.',
      'Cutting the bottom stretch short instead of lowering fully.',
    ],
  },
  'barbell-squat': {
    setup: 'Bar racked across the upper back, feet roughly shoulder width, toes slightly out.',
    steps: [
      'Brace the core and unrack the bar, taking a step or two back.',
      'Sit down and back, keeping the knees tracking in the same direction as the toes.',
      'Descend to at least parallel and drive back up through the whole foot.',
    ],
    commonMistakes: [
      'Letting the knees cave inward, especially on the way up out of the hole.',
      'Chasing a heavier number before depth is consistent — depth first, load second.',
    ],
  },
  'romanian-deadlift': {
    setup: 'Standing tall holding a barbell at hip height, feet hip-width.',
    steps: [
      'Push the hips straight back while keeping the bar in contact with the thighs on the way down.',
      'Keep the knees only softly bent — this is a hip hinge, not a squat.',
      'Stop the descent once a full stretch is felt in the hamstrings, then drive the hips forward to stand back up.',
    ],
    commonMistakes: [
      'Rounding the lower back to chase more range — the range should stop wherever the back can stay flat.',
      'Bending the knees too much, turning the movement into a stiff-legged squat instead of a hip hinge.',
    ],
  },
  'barbell-hip-thrust': {
    setup: 'Upper back braced against the edge of a bench, barbell rolled over the hips (a pad helps), knees bent, feet flat.',
    steps: [
      'Brace and drive through the heels to extend the hips straight up.',
      'At the top, squeeze the glutes hard and keep the ribs down rather than overarching the lower back.',
      'Lower under control back to a stretch position, not all the way to the floor between reps.',
    ],
    commonMistakes: [
      'Overextending at the top by arching the lower back instead of squeezing the glutes.',
      'Pushing through the toes instead of the heels, which shifts emphasis off the glutes.',
    ],
  },
  'leg-press': {
    setup: 'Seated in the machine, feet shoulder-width on the platform, mid-foot placement.',
    steps: [
      'Lower the platform under control until the knees reach a comfortable depth.',
      'Do not let the lower back round off the pad at the bottom — that is the limit of useful range, not the knees.',
      'Press back up through the full foot without locking the knees out hard.',
    ],
    commonMistakes: [
      'Letting the lower back lift off the pad to chase extra depth.',
      'Locking the knees out and resting there between reps.',
    ],
  },
  'hamstring-curl': {
    setup: 'Lying, seated, or standing depending on the machine, pad positioned against the back of the lower leg or ankle.',
    steps: ['Curl the heels toward the glutes by bending the knee.', 'Squeeze at the top of the range.', 'Lower under control rather than letting the weight stack drop.'],
    commonMistakes: [
      'Using the hips to help hoist the weight instead of isolating the knee bend.',
      'Rushing the lowering phase — that is where a lot of the stimulus for this exercise comes from.',
    ],
  },
  'nordic-curl': {
    setup: 'Kneeling, ankles anchored firmly, torso upright to start.',
    steps: [
      'Keeping the hips extended — a straight line from knee to shoulder — lower the torso toward the floor as slowly as control allows.',
      'Use the hands to catch yourself at the bottom rather than free-falling.',
      'Push back up using the hamstrings as far as possible before assisting with the hands.',
    ],
    commonMistakes: [
      'Bending at the hips instead of staying rigid from knee to shoulder — that turns it into a sit-up, not a hamstring exercise.',
      'Dropping fast instead of controlling the lower — the slow eccentric is the entire point.',
    ],
  },
  'leg-extension': {
    setup: 'Seated, pad positioned against the front of the lower shins, knees aligned with the machine pivot.',
    steps: ['Extend the knees to raise the pad.', 'Pause for a beat at the top rather than swinging through it.', 'Lower under control back to the start.'],
    commonMistakes: [
      'Using momentum to swing the weight up instead of a controlled extension.',
      'Only using the top half of the range instead of a full stretch-to-contraction rep.',
    ],
  },
  'barbell-calf-raise': {
    setup: 'Standing, bar racked across the upper back, balls of the feet on a small platform if available for extra range.',
    steps: [
      'Lower the heels for a full stretch at the bottom.',
      'Rise up onto the toes for a full contraction at the top.',
      'Move slowly through the whole range — this is not a bouncing movement.',
    ],
    commonMistakes: [
      'Bouncing out of the bottom stretch instead of controlling it — that trades tension for momentum.',
      'Only using a small, partial range instead of the full stretch-to-contraction.',
    ],
  },
  'hanging-leg-raises': {
    setup: 'Hanging from a pull-up bar with a full grip, legs extended or knees bent to start.',
    steps: [
      'Stop any swing from the setup before starting the rep.',
      'Curl the pelvis up and raise the legs, rather than just swinging the legs forward.',
      'Lower under control back to a still hang before the next rep.',
    ],
    commonMistakes: [
      'Using momentum or kipping to throw the legs up instead of a controlled curl.',
      'Letting the body swing between reps instead of resetting to still each time.',
    ],
  },
  'treadmill-intervals': {
    setup: 'Treadmill set to a walking pace to start.',
    steps: [
      'Walk for five minutes at a pace you could hold a conversation through — zone 2.',
      'Increase the pace to a hard run for five minutes — zone 4, breathing heavily.',
      'Repeat the five-and-five cycle for the session.',
    ],
    commonMistakes: [
      "Running the 'walk' portion too hard, defeating the point of the easy interval and leaving you fatigued for the hard one.",
      "Holding the handrails, which reduces the intensity and the accuracy of the effort you think you're putting in.",
    ],
  },
  pushups: {
    setup: 'Hands roughly shoulder-width on the floor, body in one straight line from head to heels.',
    steps: [
      'Lower the chest toward the floor, elbows at roughly 45° from the torso.',
      'Touch the chest lightly to the floor.',
      'Press back up to full extension without letting the hips sag or pike.',
    ],
    commonMistakes: [
      'Letting the hips sag, which turns tension onto the lower back instead of the chest and triceps.',
      'Only doing a partial range instead of touching down.',
    ],
  },
  'bodyweight-squat': {
    setup: 'Feet roughly shoulder-width, toes slightly turned out.',
    steps: [
      'Sit down and back between the heels, keeping the chest up.',
      'Descend to full depth — thighs at least parallel to the floor, ideally lower.',
      'Drive back up through the whole foot to standing.',
    ],
    commonMistakes: [
      'Stopping the squat short of full depth out of habit rather than a real mobility limit.',
      'Letting the knees cave inward, especially near the bottom.',
    ],
  },
  situps: {
    setup: 'Lying on the back, knees bent, feet flat on the floor, hands lightly touching the ears or crossed on the chest.',
    steps: [
      'Curl the torso up, leading with the ribs rather than the chin or neck.',
      'Come all the way up to a seated position under control.',
      'Lower back down with the same control, not a drop.',
    ],
    commonMistakes: [
      'Yanking on the neck with the hands to help the torso up — the pull should come from the abs, not the arms.',
      'Using momentum by throwing the arms forward instead of a controlled curl.',
    ],
  },
  'split-squat': {
    setup: 'Standing in a staggered stance, rear foot elevated behind on a bench or step if one is available, front foot flat.',
    steps: [
      'Lower straight down until the front thigh is roughly parallel to the floor.',
      'Keep the front shin close to vertical, tracking over the foot rather than drifting forward.',
      'Drive back up through the front heel to the starting position.',
    ],
    commonMistakes: [
      'Letting the front knee cave inward under the single-leg load.',
      'Leaning the torso far forward instead of staying upright, which shifts work off the front leg.',
    ],
  },
  'glute-bridge': {
    setup: 'Lying on the back, knees bent, both feet flat on the floor close to the hips.',
    steps: [
      'Drive through both heels to lift the hips off the floor.',
      'Squeeze the glutes at the top, keeping the ribs down rather than arching the lower back.',
      'Lower under control before the next rep.',
    ],
    commonMistakes: [
      'Arching the lower back to reach extra height instead of stopping at a straight line from knees to shoulders.',
      'Pushing through the toes instead of the heels, which shifts the work toward the calves.',
    ],
  },
  'single-leg-glute-bridge': {
    setup: 'Lying on the back, one foot flat on the floor close to the hips, the other leg extended straight out.',
    steps: [
      'Drive through the planted heel to lift the hips off the floor.',
      'Squeeze at the top, keeping the hips square rather than letting one side rotate up.',
      'Lower under control, feeling the stretch through the working hip and hamstring before the next rep.',
    ],
    commonMistakes: [
      'Letting the hips tilt or rotate instead of staying level throughout the rep.',
      'Using the extended leg to help push instead of keeping it purely for balance.',
    ],
  },
  'deficit-pushups': {
    setup: 'Hands on two sturdy blocks or weight plates, shoulder-width apart, body in one straight line from head to heels.',
    steps: [
      'Lower the chest below hand level, into the gap the blocks create.',
      'Pause briefly at the bottom to feel the extra stretch across the chest.',
      'Press back up to full lockout without letting the hips sag or pike.',
    ],
    commonMistakes: [
      'Using blocks that are too high before the range is controlled — the shoulder needs to earn the extra depth gradually.',
      'Letting the hips drop at the bottom, which shifts the stretch off the chest and onto the lower back.',
    ],
  },
  'archer-pushups': {
    setup: 'Hands well outside shoulder width, body in a straight line, ready to shift weight toward one side.',
    steps: [
      'Lower toward one hand while the opposite arm stays nearly straight and slides along the floor.',
      'Touch the chest close to the bent-arm side, then press back up through that same arm.',
      'Alternate the working side each rep, or each set if the movement is still new.',
    ],
    commonMistakes: [
      'Letting the hips rotate toward the working arm instead of staying square to the floor.',
      'Barely shifting the weight over, which turns this back into a regular pushup with wide hands.',
    ],
  },
  'deficit-pike-pushups': {
    setup: 'Hands on a bench or blocks, hips piked high, feet on the floor closer in than a normal pushup.',
    steps: [
      'Bend the elbows and lower the head below the level of the hands, into the space the elevation creates.',
      'Keep the torso close to vertical throughout — this is a press, not a diagonal pushup.',
      'Press back up to the starting pike position.',
    ],
    commonMistakes: [
      'Letting the hips drop toward the floor, which turns this into an incline pushup and removes the shoulder-press emphasis.',
      'Stopping the descent early instead of using the full extra range the elevation provides.',
    ],
  },
  'wall-handstand-pushups': {
    setup: 'Facing away from a wall, hands on the floor about a foot out from it, ready to kick up into a handstand with the heels resting on the wall.',
    steps: [
      'Kick up one leg at a time until both heels rest on the wall, body as vertical as balance allows.',
      'Bend the elbows and lower the head toward the floor under control.',
      'Press back up to full lockout without walking the feet down the wall to help.',
    ],
    commonMistakes: [
      'Flaring the elbows out wide, which turns the load away from the shoulders and onto the joint itself.',
      'Rushing the kick-up before the wall-supported hold itself is comfortable — spend sessions just balancing first.',
    ],
  },
  'negative-pull-ups': {
    setup: 'A box, bench, or jump to get the chin above the bar, since the exercise starts at the top of the range, not the bottom.',
    steps: [
      'Get the chin over the bar by jumping or stepping up, arms bent.',
      'Lower yourself as slowly as control allows, aiming for five seconds or more to a full hang.',
      'Reset from the floor and repeat — every rep starts from the top.',
    ],
    commonMistakes: [
      'Dropping fast for the last third of the range once the strength runs out — the whole descent should stay slow.',
      'Skipping the reset and trying to climb back up mid-rep, which turns it into a half pull-up instead of a full negative.',
    ],
  },
  'archer-pull-ups': {
    setup: 'A wide overhand grip on the bar, wider than a standard pull-up, hanging with arms extended.',
    steps: [
      'Pull toward one hand, letting the other arm stay nearly straight and travel along the bar.',
      'Get that side’s chin near the bar, then lower back to a full hang.',
      'Alternate the working side each rep, or each set while the movement is still new.',
    ],
    commonMistakes: [
      'Letting the "straight" arm do real work by bending it — it should stay passive, along for the ride.',
      'Turning the body to cheat the working side closer to the bar instead of actually shifting the pulling load.',
    ],
  },
  'incline-inverted-row': {
    setup: 'A bar set above waist height — a squat rack bar works — body straight, heels on the floor, hands just outside shoulder width.',
    steps: [
      'Hang with arms extended and the body in one straight line from shoulders to heels.',
      'Pull the chest to the bar by driving the elbows down and back.',
      'Lower under control to a full arm extension before the next rep.',
    ],
    commonMistakes: [
      'Letting the hips sag, which turns tension onto the lower back instead of the upper back.',
      'Shrugging the shoulders up toward the ears instead of driving through the elbows.',
    ],
  },
  'inverted-row': {
    setup: 'A bar at roughly hip height, body straight underneath it, hands just outside shoulder width.',
    steps: [
      'Hang with arms extended, heels on the floor, body in one straight line.',
      'Pull the chest to the bar, driving the elbows down and back rather than shrugging up.',
      'Lower under control to a full arm extension before the next rep.',
    ],
    commonMistakes: [
      'Letting the hips sag or the body bend at the waist instead of staying rigid.',
      'Stopping short of the bar instead of completing the full pull.',
    ],
  },
  'feet-elevated-inverted-row': {
    setup: 'A bar at roughly hip height, feet up on a bench so the body is close to horizontal, hands just outside shoulder width.',
    steps: [
      'Hang with arms extended, body in one straight line from shoulders to the elevated feet.',
      'Pull the chest to the bar, driving the elbows down and back.',
      'Lower under control to a full arm extension before the next rep.',
    ],
    commonMistakes: [
      'Letting the hips drop below the line of the shoulders and feet, which removes tension from the pull.',
      'Using a jerky, momentum-driven pull instead of a controlled one — the flatter angle makes cheating easier, not harder.',
    ],
  },
  'sissy-squat': {
    setup: 'Standing on the balls of the feet, holding a wall or door frame lightly for balance at first.',
    steps: [
      'Rise up onto the toes, then lean the torso back as the knees drive forward, keeping hips, knees, and shoulders in one line.',
      'Lower until a full stretch is felt across the front of the thighs, going only as deep as control allows.',
      'Drive back up to standing, straightening the knees before the hips.',
    ],
    commonMistakes: [
      'Folding at the hips like a normal squat instead of keeping the knee-driven, straight-line lean.',
      'Using the hands to pull the body back up instead of the quads — the support is for balance, not assistance.',
    ],
  },
  'pistol-squat': {
    setup: 'Standing on one leg, the other leg extended straight out in front, arms free to help with balance.',
    steps: [
      'Sit back and down on the standing leg, keeping the extended leg off the floor throughout.',
      'Descend until the hip drops below the knee, staying balanced over the standing foot.',
      'Drive back up to standing without the extended leg or the other foot touching down.',
    ],
    commonMistakes: [
      'Letting the standing knee cave inward under the extra single-leg load.',
      'Rushing into full depth before ankle mobility and balance can control it — a box under the hips is a legitimate regression.',
    ],
  },
  'deficit-split-squat': {
    setup: 'Front foot on a small step or plate, rear foot back and, if there is something to put it on, elevated behind.',
    steps: [
      'Lower straight down until the front thigh drops below the level of the step.',
      'Keep the front shin close to vertical throughout the descent.',
      'Drive back up through the front heel to the starting position.',
    ],
    commonMistakes: [
      'Letting the front knee travel far past the toes instead of tracking over the foot.',
      'Using a step high enough that control breaks down at the bottom — build the depth up gradually.',
    ],
  },
  'feet-elevated-single-leg-glute-bridge': {
    setup: 'Lying on the back, one heel up on a bench or chair, the other leg extended straight out.',
    steps: [
      'Drive through the elevated heel to lift the hips off the floor.',
      'Squeeze at the top, keeping the hips square rather than letting one side rotate up.',
      'Lower under control, feeling the stretch at the hip and hamstring of the working leg before the next rep.',
    ],
    commonMistakes: [
      'Arching the lower back to reach the top instead of driving through the hip.',
      'Letting the extended leg drop and swing for momentum instead of staying controlled.',
    ],
  },
  'sliding-leg-curl': {
    setup: 'Lying on the back, heels on a towel or furniture sliders on a smooth floor, hips lifted into a bridge.',
    steps: [
      'Holding the hips up, curl the heels in toward the glutes by bending the knees.',
      'Pause briefly at full flexion.',
      'Slide the heels back out to full leg extension under control, without letting the hips drop.',
    ],
    commonMistakes: [
      'Letting the hips sag toward the floor partway through, which hands the work to the lower back instead of the hamstrings.',
      'Sliding out fast and uncontrolled instead of resisting the slide on the way out.',
    ],
  },
  'standing-calf-raise': {
    setup: 'Standing on both feet, balls of the feet on a slightly raised edge if one is available, hand lightly on a wall for balance.',
    steps: [
      'Rise up onto the toes as high as the ankle allows.',
      'Pause briefly at the top.',
      'Lower under control to a full stretch at the bottom before the next rep.',
    ],
    commonMistakes: [
      'Bouncing out of the bottom instead of pausing to feel the stretch.',
      'Only moving through a small range near the top instead of the full stretch-to-contraction path.',
    ],
  },
  'single-leg-calf-raise': {
    setup: 'Standing on one foot, the other lifted slightly behind, hand lightly on a wall for balance.',
    steps: [
      'Rise up onto the toes of the standing foot as high as the ankle allows.',
      'Pause briefly at the top.',
      'Lower under control to a full stretch at the bottom before the next rep.',
    ],
    commonMistakes: [
      'Letting the standing ankle roll outward under the single-leg load instead of tracking straight.',
      'Using the wall for real push instead of light balance support.',
    ],
  },
  'deficit-single-leg-calf-raise': {
    setup: 'Standing on one foot with the ball of that foot on the edge of a step, heel hanging free below the edge, hand lightly on a wall or rail.',
    steps: [
      'Drop the heel below the edge of the step into a full stretch.',
      'Drive up onto the toes as high as the ankle allows.',
      'Lower back through the full stretch under control before the next rep.',
    ],
    commonMistakes: [
      'Dropping into the stretch fast instead of under control, which loads the tendon rather than the muscle.',
      'Cutting the bottom range short by not letting the heel travel below the step edge.',
    ],
  },
  'toes-to-bar': {
    setup: 'Full overhand grip on the bar, hanging with arms extended, legs together and straight.',
    steps: [
      'Keeping the legs straight where possible, drive the toes up toward the bar by flexing at the hip.',
      'Touch or reach toward the bar without using a big swing to get there.',
      'Lower back to a full hang under control before the next rep.',
    ],
    commonMistakes: [
      'Swinging the whole body to build momentum instead of driving the movement from the hips and abs.',
      'Letting the shoulders lose tension at the top of the hang between reps.',
    ],
  },
  'plank-shoulder-tap': {
    setup: 'A high plank on the hands, feet set a little wider than normal for a stable base.',
    steps: [
      'Keeping the hips level and still, lift one hand and tap the opposite shoulder.',
      'Return that hand to the floor without letting the hips rock or rotate.',
      'Repeat with the other hand, alternating sides.',
    ],
    commonMistakes: [
      'Letting the hips twist toward the lifted hand — the whole point of the exercise is resisting that rotation.',
      'Rushing the taps, which turns a stability exercise into a momentum one.',
    ],
  },
  'chin-ups': {
    setup: 'Underhand grip, roughly shoulder width, hanging with arms fully extended.',
    steps: [
      'Start from a genuine dead hang, shoulders relaxed.',
      'Pull up by driving the elbows down, leading with the chest rather than the chin.',
      'Get the chin clearly over the bar, then lower back to a full hang.',
    ],
    commonMistakes: [
      'Using a half range at the bottom instead of a full hang, which cuts out the longest-length stretch on the biceps.',
      'Kipping with a leg swing to help the pull.',
    ],
  },
  'side-plank': {
    setup: 'Lying on one side, propped up on the forearm with the elbow under the shoulder, feet stacked.',
    steps: [
      'Lift the hips off the floor until the body forms a straight line from ankles to shoulders.',
      'Hold the position, keeping the hips up and square rather than rotating forward or back.',
      'Lower under control at the end of the hold, then repeat on the other side.',
    ],
    commonMistakes: [
      'Letting the hips sag toward the floor as fatigue sets in instead of holding the line.',
      'Rotating the top shoulder forward, which turns the hold into a twisted plank rather than a side one.',
    ],
  },
  'dead-hang': {
    setup: 'Full overhand grip on the bar, feet off the floor, hanging freely.',
    steps: [
      'Let the shoulders relax down away from the ears rather than staying shrugged.',
      'Hold the hang, breathing normally rather than holding the breath.',
      'Lower to the floor once the grip, not the shoulders, gives out.',
    ],
    commonMistakes: [
      'Keeping the shoulders shrugged up the whole time, which turns this into a shoulder hold instead of a grip one.',
      'Stopping the set at a fixed time instead of letting grip fatigue be the actual endpoint.',
    ],
  },
  'prone-ytw-raise': {
    setup: 'Face down on a bench or the floor, arms hanging free below the shoulders.',
    steps: [
      'Raise the arms into a Y shape overhead, thumbs up, squeezing the shoulder blades together.',
      'Lower, then raise into a T shape out to the sides.',
      'Lower, then raise into a W shape with elbows bent close to the ribs, before starting the next cycle.',
    ],
    commonMistakes: [
      'Using the lower back to arch and swing the arms up instead of isolating the shoulder blades and rear delts.',
      'Going heavier or faster than the tiny muscles involved can control — this is stability work, kept light.',
    ],
  },
  'burpees': {
    setup: 'Standing with feet roughly shoulder-width apart.',
    steps: [
      'Drop into a squat, place the hands on the floor, and kick the feet back into a plank.',
      'Perform a pushup, chest to the floor, then jump the feet back up to the hands.',
      'Stand and jump, reaching overhead, before dropping into the next rep.',
    ],
    commonMistakes: [
      'Letting the hips sag during the plank and pushup phase instead of keeping a straight line.',
      'Skipping the full squat or the full jump to save effort — the pace should come from moving faster, not from cutting range.',
    ],
  },
  'outdoor-run': {
    setup: 'Outside, on a route with room to alternate pace — a park loop, a street block, or a track.',
    steps: [
      'Walk at an easy, conversational pace for five minutes to start.',
      'Run at a hard, sustained pace for five minutes.',
      'Repeat the five-and-five cycle for the length of the session.',
    ],
    commonMistakes: [
      'Running the "hard" interval at an easy pace, which turns the session into a long walk with no cardio stimulus.',
      'Sprinting the hard interval instead of holding a sustained hard pace — this is an endurance stimulus, not a sprint one.',
    ],
  },
}
