import { ARMOR_ZONES, ZONE_KEYS, ARMOR_KINDS, LEGACY_COVERAGE, cleanZones, effectiveCoverage, defaultHardness } from "./armor-coverage.js";

const LOCATIONS = ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"];

/**
 * Per body location, the armor Item that currently provides its SP: the
 * highest `baseSP` among all armor Items covering any of that location's
 * zones (no stacking, no proportional layering). Owning an armor Item =
 * wearing it (no separate equipped flag in v1).
 * Interim (0.3.24): a leg counts as covered if either of its zones is, and
 * ablation still lives on system.body.locations.*.sp. Per-zone protection
 * from each piece's currentSP replaces this in 0.3.25.
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
    src.hardness = defaultHardness(src.kind, src.tier);
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
