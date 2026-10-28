/**
 * Human-scale damage track per body location: Wounds and Bruises share one
 * track (0.3.29, "Fists From Hell" Bruise Damage addendum, core rule only).
 *
 * Stored on system.body.locations.<loc>: `hits` stays Wounds-based (hitsMax
 * minus Wounds, may go negative per MZ's negative Hits), `bruises` counts
 * Bruises. The track's capacity is hitsMax; shown current Hits = hits - bruises.
 * Pure helpers; the sheet reads and writes the actor.
 */

const LIMBS = new Set(["rArm", "lArm", "rLeg", "lLeg"]);

/** Wounds on a location (hitsMax - hits). */
export function woundsOf({ hits, hitsMax }) {
  return (Number(hitsMax) || 0) - (Number(hits) || 0);
}

/** Shown current Hits: what's left of the track after Wounds and Bruises. */
export function shownHits({ hits, bruises }) {
  return (Number(hits) || 0) - (Number(bruises) || 0);
}

/** The track is full (any mix of Wounds and Bruises). */
export function trackFull(loc) {
  return shownHits(loc) <= 0;
}

/**
 * Add one hit's damage of `type` ("wound" | "bruise") to a location's track.
 * While there's room it goes on as its own type. Past capacity (FFH
 * wraparound) each further point, of either type, turns one existing Bruise
 * into a Wound so the track stays full; only with no Bruises left do Wounds go
 * past capacity into negative Hits.
 * Example: capacity 10 with 5 Wounds, then 7 Bruises -> 7 Wounds / 3 Bruises.
 * @param {{hits:number, hitsMax:number, bruises?:number}} loc
 * @param {number} dmg - damage that got past armor
 * @param {"wound"|"bruise"} type
 * @returns {{hits:number, bruises:number}}
 */
export function applyTrackDamage(loc, dmg, type) {
  const cap = Number(loc.hitsMax) || 0;
  let wounds = woundsOf(loc);
  let bruises = Math.max(0, Number(loc.bruises) || 0);
  let left = Math.max(0, Number(dmg) || 0);

  const fit = Math.min(left, Math.max(0, cap - wounds - bruises));
  if (type === "bruise") bruises += fit; else wounds += fit;
  left -= fit;

  const converted = Math.min(left, bruises);
  bruises -= converted;
  wounds += converted + (left - converted);
  return { hits: cap - wounds, bruises };
}

/**
 * Wound state of a location. Death and limb results follow MZ's thresholds on
 * Wounds only (`hits`), so a track full of Bruises never kills or breaks.
 * Head or torso with a full track (any mix): unconscious. A limb whose track
 * is full and holds at least one Bruise, with no worse Wound result: sprained
 * (INTERPRETATION, H2).
 * @returns {"ok"|"unconscious"|"dead"|"sprained"|"broken"|"shattered"|"severed"}
 */
export function woundState(key, loc) {
  const hits = Number(loc.hits) || 0;
  if (!LIMBS.has(key)) return hits <= -2 ? "dead" : trackFull(loc) ? "unconscious" : "ok";
  if (hits <= -5) return "severed";
  if (hits <= -2) return "shattered";
  if (hits <= 0) return "broken";
  return trackFull(loc) && (Number(loc.bruises) || 0) > 0 ? "sprained" : "ok";
}

/** Limb keys currently sprained, for the -3 per sprained limb roll modifier. */
export function sprainedLimbs(locations) {
  return Object.entries(locations ?? {})
    .filter(([key, loc]) => LIMBS.has(key) && woundState(key, loc) === "sprained")
    .map(([key]) => key);
}
