import { zonesOfLocation } from "./armor-coverage.js";

const LOCATIONS = ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"];

/**
 * Natural armor is explicit: only a creature with natural armor set
 * (system.creature.armorSP > 0, which a creature preset stamps along with its
 * per-location values) has any. A location's own sp/spMax never counts as
 * armor by itself -- before 0.3.39 every new actor got 10 there from the old
 * schema default.
 * @param {object} system - the actor's system data
 * @returns {number} the creature's natural armor SP (0 = none)
 */
export function naturalArmorSP(system) {
  return Math.max(0, Number(system?.creature?.armorSP) || 0);
}

export function hasNaturalArmor(system) {
  return naturalArmorSP(system) > 0;
}

/**
 * The natural armor at a body location no worn piece covers: the location's
 * own sp/spMax (stamped by the preset, tracks ablation), or the creature's
 * armorSP when the location was never stamped (spMax 0, armorSP typed in by
 * hand). 0/0 for an actor without natural armor, whatever the location holds.
 * @returns {{sp:number, spMax:number}}
 */
export function naturalArmorAt(system, key) {
  const nat = naturalArmorSP(system);
  if (!nat) return { sp: 0, spMax: 0 };
  const loc = system?.body?.locations?.[key];
  const spMax = Number(loc?.spMax) || 0;
  if (!spMax) return { sp: nat, spMax: nat };
  return { sp: Math.min(Math.max(Number(loc?.sp) || 0, 0), spMax), spMax };
}

/**
 * 0.3.39 migration: an actor without natural armor gets sp/spMax 0 on every
 * location no armor piece covers (the old schema default of 10 left behind).
 * Creatures are untouched. Pure: returns the actor update and the locations
 * it changes; re-running on the result finds nothing.
 * @param {object} system - the actor's system data
 * @param {{coverage:string[]}[]} pieces - armorPieces(actor)
 * @returns {{update: object, locations: string[]}}
 */
export function strayLocationSPUpdate(system, pieces = []) {
  const update = {};
  const locations = [];
  if (hasNaturalArmor(system)) return { update, locations };
  for (const key of LOCATIONS) {
    const loc = system?.body?.locations?.[key];
    if (!loc) continue;
    if (pieces.some(p => zonesOfLocation(key).some(z => p.coverage?.includes(z)))) continue;
    if (!(Number(loc.sp) || 0) && !(Number(loc.spMax) || 0)) continue;
    update[`system.body.locations.${key}.sp`] = 0;
    update[`system.body.locations.${key}.spMax`] = 0;
    locations.push(key);
  }
  return { update, locations };
}
