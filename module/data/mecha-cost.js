/**
 * mekton-fusion: Unified Cost Engine (Additive vs Multiplier)
 * ----------------------------------------------------------
 * Verified against the "Additive vs Multipliers" rules + worked example.
 *
 * RULE (certain):
 *   Base Cost = sum of all ADDITIVE system costs (servos, armor, weapons,
 *               options, etc.).
 *   Multiplier systems have NO cost of their own; they scale the whole unit.
 *   Final Cost = Base Cost x (1 + sum(all multiplier values)).
 *   Multipliers ADD together first, then apply once -- they do NOT chain.
 *   Worked example: multipliers 0.1 + 0.2 + 0.8 = 1.1; 1 + 1.1 = 2.1;
 *   base 150 x 2.1 = 315.
 *
 * Rounding: to the nearest 0.1 (tenths), per the rules note.
 * Multiplier systems do NOT add weight.
 */

/** Round to nearest 0.1 per the rules' rounding note. */
function roundTenth(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Final cost from a base cost and a list of multiplier VALUES.
 * @param {number} baseCost - sum of additive system costs
 * @param {number[]} multipliers - each multiplier system's value (e.g. 0.2)
 * @returns {number} final cost, rounded to 0.1
 */
function finalCost(baseCost, multipliers = []) {
  const sum = multipliers.reduce((a, b) => a + b, 0);
  return roundTenth(baseCost * (1 + sum));
}

/**
 * Collect multiplier values from the systems on a mecha. Each entry is a
 * number = that system's multiplier contribution to the sum.
 *
 * NOTE ON POWERPLANT: Charge and Source combine into ONE value before they
 * ever reach this engine -- Charge cost modifier x Source factor (ATM p.68,
 * verified; see mecha-powerplant.js's powerplantMultipliers()). Pass that
 * single product as powerplantMult; there is no separate Source term here.
 *
 * @param {object} opts
 * @param {number} [opts.powerplantMult] - combined Charge x Source cost multiplier
 * @param {number[]} [opts.transformationMults] - each purchased form's multiplier
 * @param {number[]} [opts.otherMults] - stealth, energy absorption, etc.
 * @returns {number[]}
 */
function collectMultipliers(opts = {}) {
  const list = [];
  if (typeof opts.powerplantMult === "number") list.push(opts.powerplantMult);
  if (Array.isArray(opts.transformationMults)) list.push(...opts.transformationMults);
  if (Array.isArray(opts.otherMults)) list.push(...opts.otherMults);
  return list;
}

export { roundTenth, finalCost, collectMultipliers };
