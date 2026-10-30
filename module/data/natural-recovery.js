/**
 * Natural recovery (0.4): Wound Hits regained per day, by injury type and
 * BODY (MZ core, Recovery: Natural Healing / Medical Aid; Natural Recovery
 * Table; Medical Attention Table). Bruises don't use these tables: they heal
 * per hour of rest (TABLE_RULINGS.bruisesHealedPerHour). Pure: the sheet reads
 * the actor, previews the result and writes `update`.
 */
import { TABLE_RULINGS } from "../rules/table-rulings.js";
import { applyTrackDamage } from "./damage-track.js";

const LIMBS = new Set(["rArm", "lArm", "rLeg", "lLeg"]);

/** BODY columns of both tables: 2 | 3-4 | 5-7 | 8-9 | 10 (below 2 uses 2, above 10 uses 10). */
export function bodyColumn(body) {
  const b = Number(body) || 0;
  return b <= 2 ? 0 : b <= 4 ? 1 : b <= 7 ? 2 : b <= 9 ? 3 : 4;
}

/**
 * Hits regained per day, by BODY column (MZ core Natural Recovery Table). The
 * books' Bruises rows aren't used. `burns` is kept for completeness; burn
 * damage isn't tracked separately, so burns heal as `wounds`.
 */
export const NATURAL_RECOVERY = {
  internal: [-2, -1, 0, 0.5, 1],
  broken:   [-2, -1, 0, 0.5, 1],
  mangled:  [-2, -1, 0, 0, 0],
  burns:    [-1, 0, 1, 2, 3],
  wounds:   [-1, 0, 1, 2, 2]
};

/** Hits regained per day after a successful Medical roll (MZ core Medical Attention Table). */
export const MEDICAL_ATTENTION = {
  internal: [1, 1, 2, 3, 3],
  broken:   [0.5, 0.5, 1, 2, 2],
  mangled:  [0, 0, 0, 0, 0.1],
  burns:    [2, 2, 3, 4, 4],
  wounds:   [2, 2, 3, 4, 4]
};

export const INJURY_LABELS = {
  wounds: "Wounds", broken: "Broken", mangled: "Mangled", internal: "Internal",
  severed: "Severed", dead: "Dead"
};

/**
 * A location's injury type from its Wound-based Hits (INTERPRETATION, from MZ
 * human damage thresholds), re-read each day: Hits > 0 Wounds; a limb at 0 to
 * -1 Broken, -2 to -4 Mangled, -5 or below severed (doesn't heal by the
 * tables); head or torso at 0 or -1 Internal, -2 or below dead.
 */
export function injuryType(key, hits) {
  const h = Number(hits) || 0;
  if (h > 0) return "wounds";
  if (!LIMBS.has(key)) return h <= -2 ? "dead" : "internal";
  return h <= -5 ? "severed" : h <= -2 ? "mangled" : "broken";
}

/** The table rate for one injury type and BODY; 0 for types the tables don't heal. */
export function recoveryRate(type, body, { medical = false } = {}) {
  const row = (medical ? MEDICAL_ATTENTION : NATURAL_RECOVERY)[type];
  return row ? row[bodyColumn(body)] : 0;
}

/**
 * Medical-drug hooks (for the medical drugs patch), on POSITIVE rates only;
 * a negative rate is never multiplied. `speedHeal`: x2 while active.
 * `syntheFlesh`: +1/day on a treated location until it's fully healed.
 * @param {number} rate
 * @param {{speedHeal?:boolean, syntheFlesh?:boolean}} [mods]
 */
export function modifiedRate(rate, mods = {}) {
  if (!(rate > 0)) return rate;
  return (mods.speedHeal ? rate * 2 : rate) + (mods.syntheFlesh ? 1 : 0);
}

/** MZ thresholds a location's Hits can cross while worsening, with what crossing means. */
function thresholds(key) {
  return LIMBS.has(key)
    ? [[0, "Broken"], [-2, "Mangled"], [-5, "Severed"]]
    : [[0, "Internal"], [-2, "Dead"]];
}

const tenth = n => Math.round(n * 10) / 10;

/**
 * Several days of recovery on one location. Each day: Bruises heal per hour
 * rested, then the location's injury type is re-read and its table rate
 * applied to Wounds. Only a location with Wounds changes. A positive rate
 * heals whole Hits, never above hitsMax; fractions build up in
 * `recoveryRemainder` and give a Hit at 1 (reset once fully healed). A
 * negative rate loses Hits, only with `allowDeterioration`; otherwise the
 * location is held (`held`: its Wounds don't change, so neither does its rate).
 * @param {string} key - body location
 * @param {{hits:number, hitsMax:number, bruises?:number, recoveryRemainder?:number}} loc
 * @param {{body:number, days:number, hoursPerDay?:number, medical?:boolean, allowDeterioration?:boolean, mods?:object}} opts
 * @returns {{hits:number, bruises:number, remainder:number, types:string[], rates:number[], deteriorates:boolean, held:boolean, crossed:string[], skipped:string}}
 */
export function recoverLocation(key, loc, { body, days, hoursPerDay = 0, medical = false, allowDeterioration = false, mods = {} }) {
  const hitsMax = Number(loc.hitsMax) || 0;
  let hits = Number(loc.hits) || 0;
  let bruises = Math.max(0, Number(loc.bruises) || 0);
  let remainder = hits >= hitsMax ? 0 : Math.max(0, Number(loc.recoveryRemainder) || 0);
  const bruisesPerDay = Math.min(24, Math.max(0, Math.floor(Number(hoursPerDay) || 0))) * TABLE_RULINGS.bruisesHealedPerHour;
  const types = [], rates = [], crossed = [];
  let deteriorates = false, held = false, skipped = "";

  for (let d = 0; d < Math.max(0, Math.floor(Number(days) || 0)); d++) {
    bruises = Math.max(0, bruises - bruisesPerDay);
    if (hits >= hitsMax) { remainder = 0; continue; }
    const type = injuryType(key, hits);
    if (type === "severed" || type === "dead") { skipped = type; continue; }
    const rate = modifiedRate(recoveryRate(type, body, { medical }), mods);
    types.push(type);
    rates.push(rate);
    if (rate < 0) {
      deteriorates = true;
      if (!allowDeterioration) { held = true; continue; }
      const next = applyTrackDamage({ hits, hitsMax, bruises }, -rate, "wound");
      for (const [t, label] of thresholds(key)) if (hits > t && next.hits <= t) crossed.push(label);
      ({ hits, bruises } = next);
    } else if (rate > 0) {
      remainder = tenth(remainder + rate);
      const whole = Math.floor(remainder);
      remainder = tenth(remainder - whole);
      hits = Math.min(hitsMax, hits + whole);
      if (hits >= hitsMax) remainder = 0;
    }
  }
  return { hits, bruises, remainder, types, rates, deteriorates, held, crossed, skipped };
}

/**
 * Recovery for every body location: per-location preview rows plus the actor
 * update. A held location also gets `ifAllowed` (the result with
 * deterioration allowed), so the preview can show what ticking it would do.
 * @param {Record<string, object>} locations - system.body.locations
 * @param {object} opts - recoverLocation's options
 * @param {Record<string, {speedHeal?:boolean, syntheFlesh?:boolean}>} [modsByLoc]
 */
export function recoverActor(locations, opts, modsByLoc = {}) {
  const update = {};
  const rows = [];
  for (const [key, loc] of Object.entries(locations ?? {})) {
    const r = recoverLocation(key, loc, { ...opts, mods: modsByLoc[key] ?? {} });
    const ifAllowed = r.held ? recoverLocation(key, loc, { ...opts, allowDeterioration: true, mods: modsByLoc[key] ?? {} }) : null;
    const path = `system.body.locations.${key}`;
    const before = { hits: Number(loc.hits) || 0, bruises: Math.max(0, Number(loc.bruises) || 0), remainder: Math.max(0, Number(loc.recoveryRemainder) || 0) };
    if (r.hits !== before.hits) update[`${path}.hits`] = r.hits;
    if (r.bruises !== before.bruises) update[`${path}.bruises`] = r.bruises;
    if (r.remainder !== before.remainder) update[`${path}.recoveryRemainder`] = r.remainder;
    rows.push({ key, hitsMax: Number(loc.hitsMax) || 0, before, ...r, ifAllowed });
  }
  return { update, rows };
}
