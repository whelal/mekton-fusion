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
  excessKills: "lost"
};
