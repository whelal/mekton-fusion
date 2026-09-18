/**
 * mekton-fusion: Mecha Powerplant (Scope A, final multiplier layer)
 * ----------------------------------------------------------------
 * Verified against the Powerplants table. Applies cost multipliers and combat
 * modifiers on top of the base construction cost. No rulebook prose reproduced.
 *
 * A powerplant = a CHARGE level + a SOURCE. Their cost modifiers combine.
 * Charge also grants combat modifiers (MV / MA / Maneuver Pool) and an
 * "if Hot" variant.
 *
 * XS = EXPLOSION SAVE: the D10 roll-or-under on which the powerplant explodes
 * when hit. Cool = 1 (explodes on a 1); Hot = 5 (explodes on 1-5). Hot plants
 * grant a Maneuver Pool bonus (except Standard-Hot) but are more fragile.
 * Powerplants take NO Spaces regardless of size or type.
 *
 * Base Maneuver Pool per the rules = (Piloting Skill - 5); the Charge's MP
 * modifier multiplies THAT, not the pool-table lookup.
 *
 * Cost: Charge and Source are cost multipliers on the mecha's cost. The exact
 * order of combination is not shown by a worked example in the rules text seen
 * -- applyPowerplant's model is an interpretation; verify before trusting.
 */

// CHARGE: explosionSave (cool/hot), costMod (normal/hot), combat modifiers.
// explosionSave = roll-or-under on 1D10 to explode when hit (Cool 1 / Hot 5).
// mpMod multiplies the pilot's BASE Maneuver Pool = (Piloting Skill - 5).
const CHARGE_LEVELS = {
  undercharged:   { label: "Undercharged",    explosionSave: 1, explosionSaveHot: 5, costMod: -0.15, costModHot: -0.15, mv: -1, ma: -1, mpMod: -1.00 }, // -1 MP
  standard:       { label: "Standard Charge",  explosionSave: 1, explosionSaveHot: 5, costMod:  0.0,  costModHot: -0.1,  mv:  0, ma:  0, mpMod:  0.0  }, //  0 MP
  overcharged:    { label: "Overcharged",      explosionSave: 1, explosionSaveHot: 5, costMod:  0.15, costModHot:  0.15, mv:  1, ma:  1, mpMod:  0.33 }, // +33% MP
  supercharged:   { label: "Supercharged",     explosionSave: 1, explosionSaveHot: 5, costMod:  0.3,  costModHot:  0.3,  mv:  2, ma:  2, mpMod:  0.67 }, // +67% MP
};

// SOURCE: cost multiplier/modifier.
const POWER_SOURCES = {
  bioenergy:   { label: "Bioenergy",   cost:  1.5  },
  fusion:      { label: "Fusion",      cost:  1.0  },
  powerCell:   { label: "Power Cell",  cost: -0.15 },
  combustion:  { label: "Combustion",  cost: -0.33 },
};

// OPTION noted in the table (no numeric value given here).
const POWERPLANT_OPTIONS = { splitting: { label: "Splitting" } };

/**
 * Combine a charge + source into a powerplant descriptor.
 * @param {string} chargeKey
 * @param {string} sourceKey
 * @param {boolean} [hot=false] - use the "if Hot" column
 */
function getPowerplant(chargeKey, sourceKey, hot = false) {
  const charge = CHARGE_LEVELS[chargeKey];
  const source = POWER_SOURCES[sourceKey];
  if (!charge || !source) return null;
  return {
    charge: chargeKey,
    source: sourceKey,
    hot,
    explosionSave: hot ? charge.explosionSaveHot : charge.explosionSave,
    chargeCostMod: hot ? charge.costModHot : charge.costMod,
    sourceCost: source.cost,
    // Standard-Hot grants no MP bonus (per rules); zero it in that case.
    combat: {
      mv: charge.mv,
      ma: charge.ma,
      mpMod: (hot && chargeKey === "standard") ? 0 : charge.mpMod,
    },
  };
}

/**
 * Powerplant multiplier CONTRIBUTIONS for the unified cost engine.
 * Per the Additive-vs-Multiplier rule, multiplier systems ADD their values
 * into one sum, then Base Cost x (1 + sum) is applied ONCE. So the powerplant
 * does NOT multiply cost on its own -- it contributes values to that sum.
 *
 * chargeMod is a confirmed multiplier value (Undercharged -0.15 ...
 * Supercharged +0.3) -> include directly.
 *
 * sourceContribution is NOT confirmed: the Source column (Bioenergy 1.5,
 * Fusion 1.0, Power Cell -0.15, Combustion -0.33) may be an additive
 * contribution or Fusion 1.0 may mean neutral x1.0 (contributes 0). Returned
 * separately and flagged so the caller decides, rather than baking in a guess.
 *
 * @param {object} pp - from getPowerplant
 * @returns {{ chargeMod:number, sourceRaw:number, sourceContributionProvisional:number }}
 */
function powerplantMultipliers(pp) {
  if (!pp) return { chargeMod: 0, sourceRaw: 0, sourceContributionProvisional: 0 };
  return {
    chargeMod: pp.chargeCostMod,
    sourceRaw: pp.sourceCost,
    // Provisional reading: treat the source value as an additive contribution.
    // Verify against a book example that sums a powerplant into total cost.
    sourceContributionProvisional: pp.sourceCost,
  };
}

/**
 * Adjusted Maneuver Pool from Piloting skill and the powerplant.
 * Per the rules, BASE Maneuver Pool = (Piloting Skill - 5). The Charge's MP
 * modifier then applies: Undercharged is a flat -1; Over/Supercharged scale
 * the base by +33% / +67%; Standard (and Standard-Hot) leave it unchanged.
 * @param {number} pilotingSkill
 * @param {object} pp - from getPowerplant
 * @returns {number} adjusted Maneuver Pool (floored at 0)
 */
function adjustManeuverPool(pilotingSkill, pp) {
  const base = Math.max(0, pilotingSkill - 5);
  if (!pp) return base;
  const mod = pp.combat.mpMod;
  if (mod === -1) return Math.max(0, base - 1);        // undercharged: flat -1 MP
  return Math.max(0, Math.round(base * (1 + mod)));    // percentage mods (0 => unchanged)
}

export {
  CHARGE_LEVELS,
  POWER_SOURCES,
  POWERPLANT_OPTIONS,
  getPowerplant,
  powerplantMultipliers,
  adjustManeuverPool,
};
