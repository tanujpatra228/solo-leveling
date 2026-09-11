/**
 * Help copy shown via `HelpDisclosure` (inline, per section) and `HelpPanel`
 * (the central Help summon window). Plain data, no React, so it stays easy
 * to audit against the domain formulas it describes — `stats.ts`,
 * `shadows.ts` and `tower.ts` are the source of truth; this only restates
 * their effects in plain language. If those files change, this file is
 * wrong until it is updated to match.
 */
export interface HelpTopic {
  title: string
  body: readonly string[]
}

export const HELP_TOPICS: Record<'leveling' | 'army' | 'castle', HelpTopic> = {
  leveling: {
    title: 'Ability Points',
    body: [
      'Every level-up pays 3 ability points. They keep until you spend them — there is no rush and no penalty for sitting on a pile.',
      "Spending a point does not inflate the stat's own number. STR, VIT, AGI, INT and PER are earned mostly by what you actually log over the last 28 days; allocation only leans the System's quest-writing toward that stat's kind of work.",
      'STR — more heavy, low-rep prescriptions. VIT — more volume and tonnage days. AGI — more conditioning work. INT — stricter adherence to the plan you already wrote. PER — more technique and accessory work.',
      'INT is the one stat with a direct numeric payoff: your total INT, derived plus allocated, sets how many shadows you can keep active at once — 1 slot, plus one more for every 20 INT.',
      '"Revoke allocation" resets every point you have spent, in case you want to rethink the split from zero.',
    ],
  },
  army: {
    title: 'Shadow Army',
    body: [
      'Shadows are not built or upgraded. One is extracted automatically the moment a lift crosses into a strength tier you have not reached before — a PR earns you a shadow, not a purchase or a grind.',
      'Each shadow carries a small passive buff tied to its rank: E and D rank add a slice of bonus XP on that one lift, C shortens its rest timer, B adds a spare set of recovery on that muscle group, A adds a bigger XP bonus, and S rank shields your streak from one missed day. The buffs are deliberately modest — the army is not meant to out-earn honest training.',
      'Your active roster is capped by total INT, not by anything you build. Raise INT, mostly by sticking to your written plan, to raise the cap.',
      '"Return" next to an active shadow never deletes it — it only stands the shadow down, the same as when the cap bumps one out on its own. "Summon" brings any returned or dormant shadow straight back, no confirmation needed, because nothing about it is destructive.',
    ],
  },
  castle: {
    title: 'Demon Castle',
    body: [
      'The castle is a fixed ladder of 100 floors, generated once and identical for every hunter — there is nothing here to build or upgrade.',
      'Each floor asks for one thing: a lift-to-bodyweight ratio, a rep target, a streak length, weekly consistency, lifetime tonnage, or a player level. Difficulty climbs from clearable in week one to elite by floor 100.',
      'A floor clears itself the instant your training data meets its requirement — there is no button to press. Every 10th floor is a boss fight against a named Monarch, worth triple gold and six times the XP of a normal floor.',
    ],
  },
}
