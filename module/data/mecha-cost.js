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
 * NOTE ON POWERPLANT SOURCE: the powerplant Charge cost modifier
 * (Undercharged -0.15 ... Supercharged +0.3) is a multiplier value and goes
 * in this list directly. The Source column (Bioenergy 1.5, Fusion 1.0, Power
 * Cell -0.15, Combustion -0.33) is NOT confirmed to be on the same "add to
 * the sum" footing -- Fusion 1.0 may mean a neutral x1.0 (contributes 0) or
 * an additive +1.0. Pass sourceContribution explicitly once verified against
 * a book example that includes a powerplant in the multiplier sum. Until
 * then this engine does not assume one.
 *
 * @param {object} opts
 * @param {number} [opts.chargeMod] - powerplant charge cost modifier
 * @param {number} [opts.sourceContribution] - verified source contribution (see note)
 * @param {number[]} [opts.transformationMults] - each purchased form's multiplier
 * @param {number[]} [opts.otherMults] - stealth, energy absorption, etc.
 * @returns {number[]}
 */
function collectMultipliers(opts = {}) {
  const list = [];
  if (typeof opts.chargeMod === "number") list.push(opts.chargeMod);
  if (typeof opts.sourceContribution === "number") list.push(opts.sourceContribution);
  if (Array.isArray(opts.transformationMults)) list.push(...opts.transformationMults);
  if (Array.isArray(opts.otherMults)) list.push(...opts.otherMults);
  return list;
}

export { roundTenth, finalCost, collectMultipliers };
