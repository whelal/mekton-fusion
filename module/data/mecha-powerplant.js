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
 * Cost (ATM p.68, verified): Source's cost value is a FACTOR that multiplies the
 * Charge's cost modifier; the single resulting product is the powerplant's whole
 * contribution to the cost-multiplier sum. Worked example: Hot Overcharged
 * Combustion = chargeCostMod 0.15 x sourceFactor 0.67 = 0.1.
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

// SOURCE: cost is the book's column value (kept for display); factor is the
// verified multiplier applied to the Charge cost modifier (ATM p.68).
const POWER_SOURCES = {
  bioenergy:   { label: "Bioenergy",   cost:  1.5,  factor: 1.5  }, // table x1.5 (direct factor)
  fusion:      { label: "Fusion",      cost:  1.0,  factor: 1.0  }, // table x1.0 (neutral standard)
  powerCell:   { label: "Power Cell",  cost: -0.15, factor: 0.85 }, // -x0.15 -> x(1-0.15)
  combustion:  { label: "Combustion",  cost: -0.33, factor: 0.67 }, // -x0.33 -> x(1-0.33)
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
    sourceFactor: source.factor,
    // Standard-Hot grants no MP bonus (per rules); zero it in that case.
    combat: {
      mv: charge.mv,
      ma: charge.ma,
      mpMod: (hot && chargeKey === "standard") ? 0 : charge.mpMod,
    },
  };
}

/**
 * Powerplant multiplier CONTRIBUTION for the unified cost engine.
 * Per the Additive-vs-Multiplier rule, multiplier systems ADD their values into
 * one sum, then Base Cost x (1 + sum) is applied ONCE. The powerplant's own
 * contribution to that sum is Charge cost modifier x Source factor (ATM p.68,
 * verified) -- a single combined value, not two separate ones.
 * Worked example: Hot Overcharged Combustion = 0.15 x 0.67 = 0.1.
 *
 * @param {object} pp - from getPowerplant
 * @returns {{ costMult:number, chargeMod:number, sourceFactor:number }}
 */
function powerplantMultipliers(pp) {
  if (!pp) return { costMult: 0, chargeMod: 0, sourceFactor: 1 };
  const costMult = pp.chargeCostMod * pp.sourceFactor;
  return { costMult, chargeMod: pp.chargeCostMod, sourceFactor: pp.sourceFactor };
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
