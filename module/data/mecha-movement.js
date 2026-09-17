/**
 * mekton-fusion: Mecha Movement, Weight & Statistics (Scope A, final layer)
 * -----------------------------------------------------------------------
 * Verified against the Final Weight, Thruster/GES Lift Point, Speedlines,
 * and Mekton Statistics tables. All computation (formulas + lookups) so these
 * stop being manual fields. No rulebook prose reproduced.
 *
 * Dependency chain:
 *   totalKills (from servos + structural systems)  ->  finalWeight = totalKills/2
 *   finalWeight + desired MA                        ->  thruster/GES lift points (CP & Spaces)
 *   finalWeight (tonnage)                           ->  Ground MA, Maneuver Value
 */

// --- Final weight ----------------------------------------------------------
/**
 * Final weight in tons = total structural Kills / 2.
 * Pass the summed Kills of all servos + systems that have structural Kills.
 * @param {number} totalKills
 * @returns {number} tons
 */
export function finalWeight(totalKills) {
  return totalKills / 2;
}

// --- Propulsion: thrusters & GES ------------------------------------------
// Lift Points (= CP cost AND Spaces) = finalWeight * perMA multiple * MA.
// The book gives per-MA multiples via tables; the underlying rate is:
//   thruster: 0.0375 per 1 MA,  GES: 0.025 per 1 MA.
// Multiplying rate*MA reproduces the table's Weight Multiple exactly.
export const THRUSTER_RATE_PER_MA = 0.0375;
export const GES_RATE_PER_MA = 0.025;

/**
 * Lift points for a propulsion system at a target MA.
 * Book advises rounding to nearest 0.5 for ease of play.
 * @param {number} weightTons - final weight
 * @param {number} targetMA
 * @param {"thruster"|"ges"} type
 * @param {boolean} [round=true] - round to nearest 0.5
 * @returns {number} lift points (CP and Spaces, equal)
 */
export function propulsionLiftPoints(weightTons, targetMA, type = "thruster", round = true) {
  const rate = type === "ges" ? GES_RATE_PER_MA : THRUSTER_RATE_PER_MA;
  const raw = weightTons * rate * targetMA;
  return round ? Math.round(raw * 2) / 2 : raw;
}

// Weight-multiple lookup tables (per the book), for display/verification.
// multiple = rate * MA. Provided so a UI can show "xN" like the book pages.
export const THRUSTER_WEIGHT_MULTIPLE = {
  2: 0.075, 3: 0.1125, 4: 0.15, 5: 0.1875, 6: 0.225, 7: 0.2625, 8: 0.3,
  9: 0.3375, 10: 0.375, 11: 0.4125, 12: 0.45, 13: 0.4875, 14: 0.525,
  15: 0.5625, 16: 0.6, 17: 0.6375, 18: 0.675, 19: 0.7125, 20: 0.75,
  22: 0.825, 24: 0.9, 26: 0.975, 28: 1.05, 30: 1.125,
};
export const GES_WEIGHT_MULTIPLE = {
  2: 0.05, 3: 0.075, 4: 0.1, 5: 0.125, 6: 0.15, 7: 0.175, 8: 0.2,
  9: 0.225, 10: 0.25, 11: 0.275, 12: 0.3,
};

// --- Ground MA & Maneuver Value by tonnage ---------------------------------
// Both keyed by final weight (tonnage) bands.
export const GROUND_MA_BANDS = [
  { min: 0,  max: 19, hexes: 6 },
  { min: 20, max: 39, hexes: 5 },
  { min: 40, max: 59, hexes: 4 },
  { min: 60, max: 79, hexes: 3 },
  { min: 80, max: Infinity, hexes: 2 },
];

export const MANEUVER_VALUE_BANDS = [
  { min: 1,   max: 19,  mv: -1  },
  { min: 20,  max: 29,  mv: -2  },
  { min: 30,  max: 39,  mv: -3  },
  { min: 40,  max: 49,  mv: -4  },
  { min: 50,  max: 59,  mv: -5  },
  { min: 60,  max: 69,  mv: -6  },
  { min: 70,  max: 79,  mv: -7  },
  { min: 80,  max: 89,  mv: -8  },
  { min: 90,  max: 99,  mv: -9  },
  { min: 100, max: Infinity, mv: -10 },
];

export function groundMA(weightTons) {
  const b = GROUND_MA_BANDS.find(x => weightTons >= x.min && weightTons <= x.max);
  return b ? b.hexes : null;
}
export function maneuverValue(weightTons) {
  const b = MANEUVER_VALUE_BANDS.find(x => weightTons >= x.min && weightTons <= x.max);
  return b ? b.mv : null;
}

/**
 * Mecha Reflex (MR) = pilot Reflex - Maneuver Value magnitude.
 * MV is stored negative; MR subtracts its magnitude from REF.
 * @param {number} pilotRef
 * @param {number} mv - the (negative) maneuver value
 */
export function mechaReflex(pilotRef, mv) {
  return pilotRef + mv; // mv already negative, so this subtracts
}

// --- Maneuver Pool by Piloting skill --------------------------------------
export const MANEUVER_POOL = { 6: 1, 7: 2, 8: 3, 9: 4, 10: 5 };
export function maneuverPool(pilotingSkill) {
  const s = Math.floor(pilotingSkill);
  if (s < 6) return 0;
  if (s >= 10) return 5;
  return MANEUVER_POOL[s] ?? 0;
}

// --- Speedlines: MA -> velocity -------------------------------------------
/**
 * Convert MA to speed. For MA 0-10 it's linear (MAx18 kph); for MA>=11 the
 * acceleration formula applies.
 * @param {number} ma
 * @returns {{ kph: number, mph: number }}
 */
export function maToVelocity(ma) {
  let kph, mph;
  if (ma <= 10) {
    kph = ma * 18;
    mph = ma * 11.2;
  } else {
    // ((MA/10 * 2) - 1) * MA, then * unit factor. Verified vs. book table.
    const factor = ((ma / 10) * 2 - 1) * ma;
    kph = factor * 18;
    mph = factor * 11.2;
  }
  return { kph: Math.round(kph), mph: Math.round(mph) };
}
