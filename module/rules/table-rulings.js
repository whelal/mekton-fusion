// Table rulings: this table's HOUSE deviations from RAW, and nothing else (see
// ROADMAP.md "Rules policy"). RAW behavior gets no entry here. Code never hardcodes
// a ruling inline -- it reads the named entry, so moving these to game.settings
// toggles later (post-1.0) is a one-file change. Cite the book + section only;
// never quote rule text.

export const TABLE_RULINGS = {
  /**
   * Mecha ammo per burst (MZ core, Burst Fire): a burst spends this many shots,
   * whatever its BV. Missile salvos are not bursts -- they spend 1 per missile fired.
   */
  burstAmmoCost: 1,

  /**
   * Single-attack Hit Location Chart (MZ core, Resolving Damage) row 9 (Other) when
   * the target has no wing or tail.
   * "reroll" -- HOUSE: roll the location again.
   * "torso"  -- the pre-0.3.15 behavior (Other -> Torso).
   */
  otherWithoutWingTail: "reroll",

  /**
   * Missile salvo walk (MZ ATM, Missiles / Missile Hit Determination) landing on
   * row 9 (Other) when the target has no wing or tail.
   * "skip"   -- HOUSE: skip to row 10 and keep walking.
   * "reroll" -- that missile alone rerolls a fresh d10 (the 0.3.18 behavior).
   * RAW doesn't cover this case. A single attack's row 9 is otherWithoutWingTail.
   */
  salvoWalkEmptyOther: "skip",

  /**
   * Hit Location Chart side rows (5-6 right, 7-8 left) when that side has more than
   * one arm/leg servo: "uniform" -- HOUSE: pick one at random, all equally likely
   * (on a humanoid, the table's 1d2 arm-or-leg roll). Only "uniform" is implemented.
   */
  sideLimbPick: "uniform",

  /**
   * Damage past a servo's 0 Kills (MZ core, Resolving Damage): "lost" -- HOUSE: the
   * excess goes nowhere. Only "lost" is implemented (see applyHit).
   */
  excessKills: "lost",

  /**
   * Human-scale close combat (MZ core, brawling / melee): HOUSE, playtest values.
   * RAW makes every close-contact attack a free called shot. Instead, the
   * attack's default location (torso, or legs for sweeps) is free and any other
   * reachable location costs this much, on top of the maneuver's WA.
   * Single-location maneuvers take no extra penalty (see module/data/close-combat.js).
   * Bite included: this overrides core's no-penalty Bite.
   */
  closeCombatCalledPenalty: { head: -4, arm: -2, leg: -2, torso: 0 },

  /**
   * Bite reach by where the attacker's mouth is (HOUSE). Level with the target
   * (e.g. two standing humans): reaches like a Punch, torso free. On the ground
   * below a standing target: legs only, so legs are free. Either leg.
   */
  biteReach: { level: ["torso", "head", "arm"], ground: ["leg"] },

  /**
   * Personal armor ablation (INTERPRETATION, MZ ATM Scaling, human scale: armor
   * loses 1 per successful attack of 5 Hit-increments, read as a threshold, the
   * way the Corvette-scale line restates MZ core's 1K rule). A human-scale hit
   * ablates 1 SP only if its pre-armor damage is >= this many Hits; never more
   * than 1 per hit. All personal armor, soft and hard. Burning never ablates.
   * Mecha armor is unchanged (MZ core RAW: any 1K+ hit). Table may tune it.
   */
  personalArmorAblationThreshold: 5
};
