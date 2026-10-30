// Table rulings: this table's HOUSE deviations from RAW, and nothing else (see
// ROADMAP.md "Rules policy"). RAW behavior gets no entry here. Code never hardcodes
// a ruling inline -- it reads the named entry, so moving these to game.settings
// toggles later (post-1.0) is a one-file change. Cite the book + section only;
// never quote rule text.

export const TABLE_RULINGS = {
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
   * Quick brawling maneuvers (HOUSE: MZ+ ATM's Quick "Claws and Hands" applied to
   * characters): these CLOSE_MANEUVERS keys may make two attacks in one Action
   * (see closeAttackPlan in close-combat.js). Kicks and Bite are not Quick.
   * Quick weapons are the weapon items' own `quick` field (catalog: Quarterstaff,
   * Nunchaku/Tonfa).
   */
  quickManeuvers: ["punch", "claw", "elbow", "backhand", "chop", "jab"],

  /**
   * Parry skill (HOUSE; MZ core, Parry Rolls): a human-scale weapon Parry uses
   * Blade; these swords (or any weapon whose skill is Fencing) use the higher of
   * Blade and Fencing. Catalog names.
   */
  fencingWeapons: ["Broadsword", "Sword", "Rapier", "Monosword", "Energy Sword"],

  /**
   * Improvised parry (HOUSE): an item not built for melee (firearm, thrown
   * weapon, tool) parries at this DA, whatever its WA. A weapon's shooting WA
   * never applies to parrying. See parryDA in defense.js.
   */
  improvisedParryDA: -2,

  /**
   * Improvised clubbing with a firearm (HOUSE, playtest values): WA, damage
   * type, skill (Blade, the catalog's blunt weapons' skill) and damage by size.
   * "small": handguns, and Auto Weapons of Pocket/Jacket concealability;
   * "long": rifles, shotguns, larger Auto Weapons. "+" adds the BODY damage mod.
   * It counts as a melee-weapon attack (it can be parried).
   */
  improvisedMeleeWA: -2,
  improvisedClub: { skill: "blade", damageType: "bruise", damage: { small: "1D3+", long: "1D6+" } },

  /**
   * Arm Block (HOUSE, adapted from Interlock Unlimited's Block/Parry; MZ has no
   * unarmed block). After a failed Evade vs a melee-weapon or unarmed attack:
   * block total - attack total < 0 fails; 0 up to this margin (exclusive)
   * blocks but the damage goes to the blocking arm; this margin or more blocks
   * cleanly. Playtest value. See armBlockOutcome in defense.js.
   */
  armBlockCleanMargin: 5,

  /**
   * Personal armor ablation (INTERPRETATION, MZ ATM Scaling, human scale: armor
   * loses 1 per successful attack of 5 Hit-increments, read as a threshold, the
   * way the Corvette-scale line restates MZ core's 1K rule). A human-scale hit
   * ablates 1 SP only if its pre-armor damage is >= this many Hits; never more
   * than 1 per hit. All personal armor, soft and hard. Burning never ablates.
   * Mecha armor is unchanged (MZ core RAW: any 1K+ hit). Table may tune it.
   */
  personalArmorAblationThreshold: 5,

  /**
   * Armor piercing, human scale (MZ core Personal Weapons Table [AP] + Armor
   * Piercing Attacks; MZ+ ATM Armor-Piercing melee; INTERPRETATION: AP at human
   * scale = the melee weapons marked [AP]). The armor an AP hit meets counts
   * as SP / this, rounded down, for that hit only. Ablation is unchanged.
   * See piercedSP in armor.js.
   */
  armorPiercingDivisor: 2,

  /**
   * Personal armor layers (HOUSE): at most this many armor pieces may cover any
   * one zone. Layers still never add -- one active piece protects a zone (see
   * resolveZoneHit) -- this only limits how many can be worn there. Adding or
   * re-covering a piece past the limit is refused (preCreateItem/preUpdateItem
   * hooks in mekton-fusion.js); pieces already worn are kept.
   */
  maxArmorLayers: 2,

  /**
   * Sprained limb (INTERPRETATION of the "Fists From Hell" Bruise Damage
   * addendum, H2): a limb whose damage track is full and holds at least one
   * Bruise. This modifier applies to each roll that uses that limb, cumulative
   * per sprained limb. Roll dialogs list the roller's sprained limbs; the player
   * ticks the ones the roll uses (the sheet can't tell which limb a roll uses).
   */
  sprainedLimbPenalty: -3,

  /**
   * Bruise recovery (HOUSE, after the "Fists From Hell" Bruise Damage
   * addendum): each location heals this many Bruises per full hour of rest.
   * MZ core's Natural Recovery / Medical Attention tables' Bruises rows are
   * unused; those tables heal Wounds only (natural-recovery.js). Used by Rest
   * and Recover.
   */
  bruisesHealedPerHour: 1
};
