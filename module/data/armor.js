import { ARMOR_ZONES, ZONE_KEYS, ARMOR_KINDS, LEGACY_COVERAGE, cleanZones, effectiveCoverage, defaultHardness } from "./armor-coverage.js";
import { TABLE_RULINGS } from "../rules/table-rulings.js";

const LOCATIONS = ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"];

/**
 * Personal armor SP after one hit (TABLE_RULINGS.personalArmorAblationThreshold):
 * -1 SP only when the hit's pre-armor damage meets the threshold, never more
 * than 1 per hit. Soft and hard armor alike. Mecha armor doesn't use this.
 * @param {number} sp - current SP
 * @param {number} dmg - the hit's damage before armor
 * @returns {{spNow:number, ablated:boolean, belowThreshold:boolean}}
 */
export function ablatePersonalArmor(sp, dmg) {
  const threshold = TABLE_RULINGS.personalArmorAblationThreshold;
  const belowThreshold = sp > 0 && dmg >= 1 && dmg < threshold;
  const ablated = sp > 0 && dmg >= threshold;
  return { spNow: ablated ? sp - 1 : sp, ablated, belowThreshold };
}

/**
 * The armor pieces an actor wears, in list order (Item sort), as the plain
 * shape pickActivePiece/resolveZoneHit read.
 * @returns {{id:string, name:string, baseSP:number, coverage:string[], currentSP:Record<string,number>}[]}
 */
export function armorPieces(actor) {
  return actor.items.filter(i => i.type === "armor")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map(i => ({
      id: i.id, name: i.name, baseSP: Number(i.system?.baseSP) || 0, hardness: i.system?.hardness ?? "",
      coverage: effectiveCoverage(i.system), currentSP: { ...(i.system?.currentSP ?? {}) }
    }));
}

/**
 * One Bruise hit on a zone (0.3.29, H4): soft pieces are ignored completely (no
 * protection, no ablation). The covering HARD piece with the highest current SP
 * there (tie: list order) soaks and ablates per ablatePersonalArmor. It neither
 * reads nor changes the zone's wound activeArmorId. A piece with no hardness set
 * counts as soft. `softIgnored`: a soft piece covered the zone and was skipped.
 * @returns {{piece:object|null, sp:number, spNow:number, belowThreshold:boolean, through:number, softIgnored:boolean}}
 */
export function resolveBruiseZoneHit(pieces, zone, dmg) {
  const covering = pieces.filter(p => p.coverage.includes(zone));
  const sp = p => Number(p.currentSP?.[zone]) || 0;
  let piece = null;
  for (const p of covering) if (p.hardness === "hard" && sp(p) > 0 && (!piece || sp(p) > sp(piece))) piece = p;
  const cur = piece ? sp(piece) : 0;
  const { spNow, belowThreshold } = ablatePersonalArmor(cur, dmg);
  return {
    piece, sp: cur, spNow, belowThreshold, through: Math.max(0, dmg - cur),
    softIgnored: covering.some(p => p.hardness !== "hard")
  };
}

/**
 * Sticky active piece for a zone (ROADMAP 0.3.28, spec G): the stored piece
 * while it still covers the zone with SP > 0 there, even if it has worn below a
 * backup; otherwise the covering piece with the highest current SP > 0 (tie:
 * list order). Layers never add. "" when nothing on the zone has SP left.
 */
export function pickActivePiece(pieces, zone, activeId) {
  const sp = p => Number(p.currentSP?.[zone]) || 0;
  const covering = pieces.filter(p => p.coverage.includes(zone));
  const current = covering.find(p => p.id === activeId);
  if (current && sp(current) > 0) return current.id;
  let best = null;
  for (const p of covering) if (sp(p) > 0 && (!best || sp(p) > sp(best))) best = p;
  return best?.id ?? "";
}

/**
 * One wound hit on a zone: the active piece's current SP there soaks the hit,
 * the rest goes to the body location, and the piece ablates per
 * ablatePersonalArmor (1 SP at most, only at the threshold). Pure: the caller
 * writes `activeId` back to the actor and `spNow` to the piece.
 * @returns {{activeId:string, piece:object|null, sp:number, spNow:number, belowThreshold:boolean, through:number}}
 */
export function resolveZoneHit(pieces, zone, activeId, dmg) {
  const id = pickActivePiece(pieces, zone, activeId);
  const piece = pieces.find(p => p.id === id) ?? null;
  const sp = piece ? Number(piece.currentSP?.[zone]) || 0 : 0;
  const { spNow, belowThreshold } = ablatePersonalArmor(sp, dmg);
  return { activeId: id, piece, sp, spNow, belowThreshold, through: Math.max(0, dmg - sp) };
}

/**
 * Per-zone current SP for a piece that never had it (every covered zone 0, as
 * armor from before 0.3.24 is): base SP everywhere, except that the piece that
 * was providing a body location's SP (locations.*.itemId) keeps that
 * location's ablated SP on its zones there. null when the piece already has SP
 * on some zone (worn or not) -- it's left alone, so this is safe to re-run.
 * @param {object} sys - the armor Item's system source
 * @param {string} itemId
 * @param {Record<string, {sp:number, itemId:string}>} [locations] - the wearer's body locations
 * @returns {Record<string, number>|null}
 */
export function seedUnfilledPiece(sys, itemId, locations = {}) {
  const zones = effectiveCoverage(sys);
  const base = Number(sys?.baseSP) || 0;
  if (base <= 0 || !zones.length || zones.some(z => Number(sys?.currentSP?.[z]) > 0)) return null;
  const sp = seedZoneSP(zones, base);
  for (const z of zones) {
    const loc = locations?.[ARMOR_ZONES[z].location];
    if (loc?.itemId === itemId) sp[z] = Math.min(base, Math.max(0, Number(loc.sp) || 0));
  }
  return sp;
}

/**
 * Two-layer limit (TABLE_RULINGS.maxArmorLayers): the zones where adding a
 * piece with `coverage` would put more than the limit of pieces on one zone.
 * `excludeId` leaves out the piece being re-covered. Empty = allowed.
 * @param {{id:string, coverage:string[]}[]} pieces - the wearer's current pieces
 * @param {string[]} coverage - the new or changed piece's zones
 * @returns {string[]} ZONE_KEYS over the limit
 */
export function armorLayerViolations(pieces, coverage, excludeId) {
  const max = TABLE_RULINGS.maxArmorLayers;
  return cleanZones(coverage).filter(z =>
    pieces.filter(p => p.id !== excludeId && p.coverage.includes(z)).length >= max);
}

/**
 * 0.3.28 migration: before per-piece SP, wear was recorded on the body
 * location (locations.*.sp below spMax) against the piece providing it
 * (locations.*.itemId). Move it onto that piece's zones there and make that
 * piece the zones' active piece; the location then reads intact, so re-running
 * finds nothing to move. Pure: returns the writes for the caller.
 * @param {Record<string, {sp:number, spMax:number, itemId:string}>} locations
 * @param {ReturnType<typeof armorPieces>} pieces
 * @returns {{itemUpdates: object[], actorUpdate: object, moved: number}}
 */
export function locationWearMoves(locations, pieces) {
  const itemUpdates = {};
  const actorUpdate = {};
  let moved = 0;
  for (const [loc, l] of Object.entries(locations ?? {})) {
    const sp = Number(l?.sp) || 0;
    const max = Number(l?.spMax) || 0;
    const piece = pieces.find(p => p.id === l?.itemId);
    if (!piece || sp >= max) continue;
    for (const z of ZONE_KEYS.filter(z => ARMOR_ZONES[z].location === loc && piece.coverage.includes(z))) {
      (itemUpdates[piece.id] ??= { _id: piece.id })[`system.currentSP.${z}`] = Math.min(Number(piece.currentSP?.[z]) || 0, sp);
      actorUpdate[`system.body.armorZones.${z}.activeArmorId`] = piece.id;
    }
    actorUpdate[`system.body.locations.${loc}.sp`] = max;
    moved++;
  }
  return { itemUpdates: Object.values(itemUpdates), actorUpdate, moved };
}

/**
 * Per body location, the armor Item that currently provides its SP: the
 * highest `baseSP` among all armor Items covering any of that location's
 * zones (no stacking, no proportional layering). Owning an armor Item =
 * wearing it (no separate equipped flag in v1).
 * A leg counts as covered if either of its zones is. Since 0.3.28 hits resolve
 * per zone on each piece's currentSP (resolveZoneHit); this location-level view
 * only feeds the paperdoll icon and the natural-armor fallback (a location no
 * piece covers uses system.body.locations.*.sp).
 * @param {Actor} actor
 * @param {string} [excludeId] - ignore this Item id (a delete hook can fire
 *   before/after the collection drops the Item; excluding it makes the
 *   result correct either way)
 * @returns {Record<string, {sp:number, itemId:string}>}
 */
export function deriveArmorByLocation(actor, excludeId) {
  const out = Object.fromEntries(LOCATIONS.map(l => [l, { sp: 0, itemId: "" }]));
  for (const item of actor.items) {
    if (item.type !== "armor" || item.id === excludeId) continue;
    const sp = Number(item.system?.baseSP) || 0;
    const locs = new Set(effectiveCoverage(item.system).map(z => ARMOR_ZONES[z].location));
    for (const loc of locs) {
      if (sp > out[loc].sp) out[loc] = { sp, itemId: item.id };
    }
  }
  return out;
}

/** Highest-SP-wins armor SP per location: { head, torso, rArm, lArm, rLeg, lLeg } -> spMax. */
export function deriveArmorSpMax(actor, excludeId) {
  const by = deriveArmorByLocation(actor, excludeId);
  return Object.fromEntries(LOCATIONS.map(l => [l, by[l].sp]));
}

/**
 * Per-zone current SP for a piece whose coverage changes: zones it already
 * covered keep their current SP, newly covered zones start at baseSP, and
 * uncovered zones are 0. Returns all 8 zones.
 */
export function seedZoneSP(coverage, baseSP, { oldCoverage = [], oldSP = {} } = {}) {
  const cov = new Set(cleanZones(coverage));
  const had = new Set(cleanZones(oldCoverage));
  const base = Math.max(0, Number(baseSP) || 0);
  return Object.fromEntries(ZONE_KEYS.map(z => [z,
    !cov.has(z) ? 0 : had.has(z) ? Math.max(0, Number(oldSP?.[z]) || 0) : base]));
}

const KIND_BY_CATEGORY = {
  "Ballistic Mesh": "mesh",
  "Multi-Polymer Plate": "plate",
  "Full Utility Helmet": "helmet",
  "Space Suit": "suit"
};
const KIND_BY_NAME = {
  "Flight Jacket": "flightJacket",
  "Powered Armor": "poweredArmor",
  "Shield": "other",
  "Personal Force Screen": "other",
  "Advanced Force Screen": "other"
};
const TIER_RE = /^(light|medium|heavy|flak|standard|industrial|military)\b/i;

/**
 * Hardness for "other"-kind pieces whose kind gives none (0.3.29): the force
 * screens are hard. The Shield stays unset (parked) and counts as soft.
 */
export const HARDNESS_BY_NAME = {
  "Personal Force Screen": "hard",
  "Advanced Force Screen": "hard"
};

/**
 * Migrate a pre-0.3.24 armor `system` source in place (ArmorDataModel.migrateData):
 * sp -> baseSP, coverage string -> zone set, and kind/tier/hardness filled from
 * the category and name. Only touches legacy data, so it's safe to run on any
 * source. Anything it can't map is left empty and described in migrationNote
 * (the Update Characters macro reports and clears it) -- it never guesses.
 */
export function migrateArmorSource(src) {
  if (!src || typeof src !== "object") return src;
  const legacySp = "sp" in src && !("baseSP" in src);
  const legacyCov = typeof src.coverage === "string"
    || (Array.isArray(src.coverage) && src.coverage.some(z => !ARMOR_ZONES[z]));
  if (!legacySp && !legacyCov) return src;

  const notes = [];
  if (legacySp) src.baseSP = Number(src.sp) || 0;

  if (!src.kind) {
    const kind = KIND_BY_NAME[src.name] ?? KIND_BY_CATEGORY[src.category];
    if (kind) src.kind = kind;
    else notes.push(`kind unknown (category "${src.category ?? ""}")`);
  }
  if (src.tier === undefined) src.tier = TIER_RE.exec(src.name ?? "")?.[1]?.toLowerCase() ?? "";

  if (legacyCov) {
    const zones = new Set();
    for (const v of Array.isArray(src.coverage) ? src.coverage : [src.coverage]) {
      if (ARMOR_ZONES[v]) zones.add(v);
      else if (LEGACY_COVERAGE[v]) LEGACY_COVERAGE[v].forEach(z => zones.add(z));
      else notes.push(`coverage "${v}" unknown`);
    }
    src.coverage = cleanZones([...zones]);
  }
  const fixed = ARMOR_KINDS[src.kind]?.coverage;
  if (fixed && cleanZones(fixed).join() !== cleanZones(src.coverage).join()) {
    notes.push(`coverage set to the ${ARMOR_KINDS[src.kind].label}'s fixed zones`);
    src.coverage = cleanZones(fixed);
  }

  if (!src.hardness) {
    src.hardness = defaultHardness(src.kind, src.tier) || HARDNESS_BY_NAME[src.name] || "";
    if (!src.hardness && src.kind && src.kind !== "other") notes.push("hardness unknown");
  }
  if (notes.length) src.migrationNote = [src.migrationNote, ...notes].filter(Boolean).join("; ");
  return src;
}

async function applyRecompute(actor, excludeId) {
  const derived = deriveArmorByLocation(actor, excludeId);
  const updates = {};
  for (const loc of LOCATIONS) {
    const cur = actor.system?.body?.locations?.[loc];
    if (!cur) continue;
    const oldMax = Number(cur.spMax) || 0;
    const oldSp = Number(cur.sp) || 0;
    const newMax = derived[loc].sp;
    // Intact armor (sp at its old ceiling) tracks the new ceiling -- equipping
    // better armor raises it, removing armor lowers it. Already-ablated armor
    // keeps the damage it took, just clamped under the new ceiling.
    const newSp = oldSp === oldMax ? newMax : Math.min(oldSp, newMax);
    const path = `system.body.locations.${loc}`;
    if (newMax !== oldMax) updates[`${path}.spMax`] = newMax;
    if (newSp !== oldSp) updates[`${path}.sp`] = newSp;
    if ((cur.itemId ?? "") !== derived[loc].itemId) updates[`${path}.itemId`] = derived[loc].itemId;
  }
  if (Object.keys(updates).length) await actor.update(updates);
}

// Per-actor queue: a batch of armor creates/deletes fires one hook each, and
// overlapping recomputes would read a stale sp/spMax before the previous
// write landed. Chaining them makes each run see the last one's result.
const queues = new Map();

/**
 * Recompute every location's spMax (and current sp, per the clamp rule) plus
 * the paperdoll icon's itemId from the actor's armor Items. Runs on armor
 * create/delete/update (see the hooks in mekton-fusion.js); never hand-patch
 * these fields from equip/unequip code.
 */
export function recomputeActorArmorSp(actor, { excludeId } = {}) {
  const key = actor.uuid;
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(() => applyRecompute(actor, excludeId));
  queues.set(key, next);
  next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}
