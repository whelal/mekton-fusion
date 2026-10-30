/**
 * GM recovery tools (0.4): the character counterpart of mecha Depot
 * Maintenance. Natural Wound recovery stays manual (the location editor's
 * steppers); nothing here is time-driven except Rest's Bruise healing. Pure:
 * each returns the writes plus what changed, for the caller's chat card.
 */
import { ZONE_KEYS, zonesOfLocation } from "./armor-coverage.js";
import { woundsOf, woundState } from "./damage-track.js";
import { seedZoneSP } from "./armor.js";
import { TABLE_RULINGS } from "../rules/table-rulings.js";

/**
 * Full Recovery: every location's Wounds and Bruises cleared (Hits back to
 * hitsMax). Sprained is derived from the track, so it clears with it. Armor and
 * burning aren't touched here (burning is a flag; the sheet clears it).
 * @param {Record<string, {hits:number, hitsMax:number, bruises?:number, label?:string}>} locations
 * @returns {{update: object, changes: {key:string, wounds:number, bruises:number, state:string}[]}}
 */
export function fullRecoveryUpdate(locations) {
  const update = {};
  const changes = [];
  for (const [key, loc] of Object.entries(locations ?? {})) {
    const wounds = woundsOf(loc);
    const bruises = Math.max(0, Number(loc?.bruises) || 0);
    if (!wounds && !bruises) continue;
    update[`system.body.locations.${key}.hits`] = Number(loc.hitsMax) || 0;
    update[`system.body.locations.${key}.bruises`] = 0;
    changes.push({ key, wounds, bruises, state: woundState(key, loc) });
  }
  return { update, changes };
}

/**
 * Repair Armor: every piece's currentSP back to its baseSP on every zone it
 * covers, and every zone's activeArmorId cleared so the next hit re-picks the
 * best piece (pickActivePiece). Natural armor -- a location no piece covers --
 * goes back to its spMax. Wounds aren't touched.
 * @param {ReturnType<import("./armor.js").armorPieces>} pieces
 * @param {Record<string, {sp:number, spMax:number}>} locations
 * @param {Record<string, {activeArmorId:string}>} [armorZones]
 * @returns {{itemUpdates: object[], actorUpdate: object, pieces: {name:string, zones:{zone:string, from:number, to:number}[]}[], natural: {key:string, from:number, to:number}[]}}
 */
export function repairArmorUpdates(pieces, locations, armorZones = {}) {
  const itemUpdates = [];
  const repaired = [];
  for (const p of pieces ?? []) {
    const full = seedZoneSP(p.coverage, p.baseSP);
    const zones = p.coverage
      .map(z => ({ zone: z, from: Number(p.currentSP?.[z]) || 0, to: full[z] }))
      .filter(z => z.from !== z.to);
    if (!zones.length) continue;
    itemUpdates.push({ _id: p.id, "system.currentSP": full });
    repaired.push({ name: p.name, zones });
  }

  const actorUpdate = {};
  for (const z of ZONE_KEYS) {
    if (armorZones?.[z]?.activeArmorId) actorUpdate[`system.body.armorZones.${z}.activeArmorId`] = "";
  }
  const natural = [];
  for (const [key, loc] of Object.entries(locations ?? {})) {
    if (pieces?.some(p => zonesOfLocation(key).some(z => p.coverage.includes(z)))) continue;
    const from = Number(loc?.sp) || 0;
    const to = Number(loc?.spMax) || 0;
    if (from === to) continue;
    actorUpdate[`system.body.locations.${key}.sp`] = to;
    natural.push({ key, from, to });
  }
  return { itemUpdates, actorUpdate, pieces: repaired, natural };
}

/**
 * Rest: each location heals TABLE_RULINGS.bruisesHealedPerHour Bruises per full hour,
 * never below 0. Wounds aren't touched.
 * @param {Record<string, {bruises?:number}>} locations
 * @param {number} hours - partial hours are dropped
 * @returns {{hours:number, update: object, healed: {key:string, from:number, to:number}[]}}
 */
export function restUpdate(locations, hours) {
  const full = Math.max(0, Math.floor(Number(hours) || 0));
  const update = {};
  const healed = [];
  for (const [key, loc] of Object.entries(locations ?? {})) {
    const from = Math.max(0, Number(loc?.bruises) || 0);
    const to = Math.max(0, from - full * TABLE_RULINGS.bruisesHealedPerHour);
    if (to === from) continue;
    update[`system.body.locations.${key}.bruises`] = to;
    healed.push({ key, from, to });
  }
  return { hours: full, update, healed };
}
