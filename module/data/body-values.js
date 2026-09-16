/**
 * mekton-fusion: Body Type & Secondary Stat Values
 * ------------------------------------------------
 * BOD-derived combat/derived stats for the full 2-20 range.
 *
 * These are game mechanics (facts/numbers), implemented as computable data.
 * No rulebook prose, layout, or flavor text is reproduced here — write your
 * own UI labels/tooltips for STUN/LIFT/THROW/DMG/EV in the sheet.
 *
 * Assumes a humanoid of roughly human size/toughness. Non-humanoid enemies
 * reuse these hit values via BODY_PLANS (Mekton Z defines no separate
 * non-humanoid hit-location numbers).
 *
 * Damage is structured so the sheet can render/roll it:
 *   { type: "flat", value: n }  -> a flat +n modifier
 *   { type: "dice", value: "xD6" } -> bonus damage dice
 *
 * Hit values are { hits, kills } where kills is null until high BOD tiers.
 * The book expresses e.g. "25H (1K)"; here hits=25, kills=1.
 */

// --- Primary body-type lookup, BOD 2..20 -----------------------------------
// Ranges from the book are expanded to individual integer BOD keys so callers
// can index by exact BOD.
export const BOD_VALUES = {
  //          STUN LIFT  THROW  DMG                          EV   HEAD          TORSO             LIMBS
  2:  { stun: 4,  lift: 20,   throwM: 6,   dmg: { type: "flat", value: -2 }, ev: 2,   hits: { head: { hits: 4,  kills: null }, torso: { hits: 8,   kills: null }, limbs: { hits: 6,  kills: null } } },
  3:  { stun: 5,  lift: 40,   throwM: 12,  dmg: { type: "flat", value: -1 }, ev: 2,   hits: { head: { hits: 5,  kills: null }, torso: { hits: 10,  kills: null }, limbs: { hits: 7,  kills: null } } },
  4:  { stun: 5,  lift: 40,   throwM: 12,  dmg: { type: "flat", value: -1 }, ev: 2,   hits: { head: { hits: 5,  kills: null }, torso: { hits: 10,  kills: null }, limbs: { hits: 7,  kills: null } } },
  5:  { stun: 6,  lift: 60,   throwM: 20,  dmg: { type: "flat", value: 0 },  ev: 4,   hits: { head: { hits: 6,  kills: null }, torso: { hits: 12,  kills: null }, limbs: { hits: 9,  kills: null } } },
  6:  { stun: 6,  lift: 60,   throwM: 20,  dmg: { type: "flat", value: 0 },  ev: 4,   hits: { head: { hits: 6,  kills: null }, torso: { hits: 12,  kills: null }, limbs: { hits: 9,  kills: null } } },
  7:  { stun: 6,  lift: 60,   throwM: 20,  dmg: { type: "flat", value: 0 },  ev: 4,   hits: { head: { hits: 6,  kills: null }, torso: { hits: 12,  kills: null }, limbs: { hits: 9,  kills: null } } },
  8:  { stun: 7,  lift: 90,   throwM: 26,  dmg: { type: "flat", value: 1 },  ev: 6,   hits: { head: { hits: 7,  kills: null }, torso: { hits: 14,  kills: null }, limbs: { hits: 10, kills: null } } },
  9:  { stun: 7,  lift: 90,   throwM: 26,  dmg: { type: "flat", value: 1 },  ev: 6,   hits: { head: { hits: 7,  kills: null }, torso: { hits: 14,  kills: null }, limbs: { hits: 10, kills: null } } },
  10: { stun: 8,  lift: 120,  throwM: 30,  dmg: { type: "flat", value: 2 },  ev: 8,   hits: { head: { hits: 8,  kills: null }, torso: { hits: 16,  kills: null }, limbs: { hits: 12, kills: null } } },

  // --- >10 tables (superhuman / high-BOD) ---
  // Hit points, secondary stats, from the ">10 STAT TABLES" page.
  11: { stun: 9,  lift: 185,  throwM: 45,  dmg: { type: "flat", value: 3 },   ev: 13,  hits: { head: { hits: 9,  kills: null }, torso: { hits: 18,  kills: null }, limbs: { hits: 13, kills: null } } },
  12: { stun: 9,  lift: 185,  throwM: 45,  dmg: { type: "flat", value: 3 },   ev: 13,  hits: { head: { hits: 9,  kills: null }, torso: { hits: 18,  kills: null }, limbs: { hits: 13, kills: null } } },
  13: { stun: 10, lift: 250,  throwM: 66,  dmg: { type: "dice", value: "1D6" }, ev: 17,  hits: { head: { hits: 10, kills: null }, torso: { hits: 21,  kills: null }, limbs: { hits: 15, kills: null } } },
  14: { stun: 10, lift: 250,  throwM: 66,  dmg: { type: "dice", value: "1D6" }, ev: 17,  hits: { head: { hits: 10, kills: null }, torso: { hits: 21,  kills: null }, limbs: { hits: 15, kills: null } } },
  15: { stun: 11, lift: 500,  throwM: 100, dmg: { type: "dice", value: "2D6" }, ev: 33,  hits: { head: { hits: 12, kills: 1 },    torso: { hits: 24,  kills: 1 },    limbs: { hits: 18, kills: null } } },
  16: { stun: 11, lift: 500,  throwM: 100, dmg: { type: "dice", value: "2D6" }, ev: 33,  hits: { head: { hits: 12, kills: 1 },    torso: { hits: 24,  kills: 1 },    limbs: { hits: 18, kills: null } } },
  17: { stun: 11, lift: 500,  throwM: 100, dmg: { type: "dice", value: "2D6" }, ev: 33,  hits: { head: { hits: 12, kills: 1 },    torso: { hits: 24,  kills: 1 },    limbs: { hits: 18, kills: null } } },
  18: { stun: 12, lift: 1000, throwM: 150, dmg: { type: "dice", value: "4D6" }, ev: 67,  hits: { head: { hits: 25, kills: 1 },    torso: { hits: 50,  kills: 2 },    limbs: { hits: 34, kills: 1.5 } } },
  19: { stun: 12, lift: 1000, throwM: 150, dmg: { type: "dice", value: "4D6" }, ev: 67,  hits: { head: { hits: 25, kills: 1 },    torso: { hits: 50,  kills: 2 },    limbs: { hits: 34, kills: 1.5 } } },
  20: { stun: 13, lift: 5000, throwM: 225, dmg: { type: "dice", value: "8D6" }, ev: 333, hits: { head: { hits: 50, kills: 2 },    torso: { hits: 100, kills: 5 },    limbs: { hits: 67, kills: 3 } } },
};

// --- Movement Allowance, keyed by the MA stat (>10 table) ------------------
// This table is keyed by the MA stat itself, NOT by BOD — BOD has no effect
// on movement. At MA 10 and below, Run/Jump come from the standard MA-stat
// formula (see getStandardMovement); this table only covers MA 11-20, the
// rows the ">10" page specifies. Values in meters.
export const MOVEMENT_ALLOWANCE = {
  11: { run: 36, jump: 3,   animeLeap: 12 },
  12: { run: 36, jump: 3,   animeLeap: 12 },
  13: { run: 42, jump: 3.5, animeLeap: 14 },
  14: { run: 42, jump: 3.5, animeLeap: 14 },
  15: { run: 48, jump: 4,   animeLeap: 16 },
  16: { run: 48, jump: 4,   animeLeap: 16 },
  17: { run: 48, jump: 4,   animeLeap: 16 },
  18: { run: 55, jump: 4.5, animeLeap: 28 },
  19: { run: 55, jump: 4.5, animeLeap: 28 },
  20: { run: 60, jump: 5,   animeLeap: 20 },
};

// --- Skill Points from combined INT & EDU ----------------------------------
// Total = INT + EDU; result is a per-point multiplier for skill points.
export const SKILL_POINT_TIERS = [
  { min: 21, max: 25, value: 0.35 },
  { min: 26, max: 30, value: 0.40 },
  { min: 31, max: 35, value: 0.45 },
  { min: 36, max: 40, value: 0.50 },
];

// --- Non-humanoid body plans (house-rule extension) ------------------------
// Mekton Z has NO non-humanoid hit-location rules, so these are your own
// templates. Each plan lists locations and maps them onto the humanoid
// head/torso/limbs hit values (the only ones the book provides).
export const BODY_PLANS = {
  humanoid:   { label: "Humanoid",                locations: ["head", "torso", "arms", "legs"] },
  quadruped:  { label: "Quadruped (wolf, beast)", locations: ["head", "torso", "legs"] },
  serpentine: { label: "Serpentine / no limbs",   locations: ["head", "body"] },
};

// Map an arbitrary plan location onto a humanoid hit-value source.
function mapLocationToSource(loc) {
  if (loc === "head") return "head";
  if (loc === "torso" || loc === "body") return "torso";
  return "limbs"; // arms, legs, tentacles, wings, etc.
}

// --- Public helpers --------------------------------------------------------

/**
 * Body-type values for a given BOD (clamped to 2..20, rounded).
 * @param {number} bod
 * @returns {object} { stun, lift, throwM, dmg, ev, hits: { head, torso, limbs } }
 */
export function getBodyValues(bod) {
  const b = Math.max(2, Math.min(20, Math.round(bod)));
  return BOD_VALUES[b];
}

/**
 * High-MA movement allowance, or null if MA <= 10 (use getStandardMovement instead).
 * Keyed by the MA stat, NOT BOD.
 * @param {number} maValue
 * @returns {object|null} { run, jump, animeLeap }
 */
export function getMovementAllowance(maValue) {
  const m = Math.max(2, Math.min(20, Math.round(maValue)));
  return MOVEMENT_ALLOWANCE[m] ?? null;
}

/**
 * Standard (MA <= 10) movement allowance, derived from the MA stat itself
 * rather than the ">10" table:
 *   Run = MA x 3, Walk = MA, Jump = MA / 4, Running Jump = Run / 4,
 *   Anime Leap = MA x 1 (errata: alternately listed as 1x/2x MA; correct is 1x).
 * @param {number} maValue
 * @returns {object} { run, walk, jump, runningJump, animeLeap }
 */
export function getStandardMovement(maValue) {
  const ma = Number(maValue) || 0;
  const run = ma * 3;
  return { run, walk: ma, jump: ma / 4, runningJump: run / 4, animeLeap: ma };
}

/**
 * Skill-point multiplier from INT + EDU. Returns 0 below the table's floor.
 * @param {number} intStat
 * @param {number} eduStat
 * @returns {number} per-point multiplier (0 if total < 21)
 */
export function getSkillPointMultiplier(intStat, eduStat) {
  const total = Math.round(intStat) + Math.round(eduStat);
  const tier = SKILL_POINT_TIERS.find(t => total >= t.min && total <= t.max);
  return tier ? tier.value : 0;
}

/**
 * Encumbrance-adjusted MA: floor(totalWeight / EV) subtracted from base MA.
 * @param {number} totalWeightKg
 * @param {number} bod
 * @param {number} baseMA
 * @returns {number} adjusted MA (not below 0)
 */
export function encumberedMA(totalWeightKg, bod, baseMA) {
  const { ev } = getBodyValues(bod);
  return Math.max(0, baseMA - Math.floor(totalWeightKg / ev));
}

/**
 * Build a lightweight enemy/creature stat block — no character sheet needed.
 * Natural armor (SP all locations) and natural weapons come from the Aliens
 * "Advantages" traits, the only creature-relevant rules Mekton Z defines.
 *
 * @param {string} planKey - key into BODY_PLANS
 * @param {number} bod
 * @param {object} [opts]
 * @param {string} [opts.label]
 * @param {number} [opts.armorSP=0] - flat SP applied to all locations
 * @param {Array}  [opts.naturalWeapons=[]] - e.g. [{ name, damage, type }]
 * @returns {object}
 */
export function makeEnemy(planKey, bod, opts = {}) {
  const plan = BODY_PLANS[planKey] ?? BODY_PLANS.humanoid;
  const base = getBodyValues(bod);

  const locations = {};
  for (const loc of plan.locations) {
    const src = mapLocationToSource(loc);
    locations[loc] = {
      hits: base.hits[src].hits,
      kills: base.hits[src].kills,
      sp: opts.armorSP ?? 0,
    };
  }

  return {
    label: opts.label ?? plan.label,
    plan: planKey,
    bod,
    stun: base.stun,
    dmg: base.dmg,
    ev: base.ev,
    locations,
    naturalWeapons: opts.naturalWeapons ?? [],
  };
}
