import { ARMOR_COVERAGE } from "./armor-coverage.js";

const LOCATIONS = ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"];

/**
 * Per body location, the armor Item that currently provides its SP: the
 * highest `sp` among all armor Items on the actor whose coverage includes
 * that location (MZ default -- no stacking, no proportional layering; to add
 * layering later, change the `sp > best.sp` comparison below into a combine).
 * Handheld coverage (no locations) contributes to nothing. Owning an armor
 * Item = wearing it (no separate equipped flag in v1).
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
    const cov = ARMOR_COVERAGE[item.system?.coverage];
    if (!cov?.locations?.length) continue;
    const sp = Number(item.system?.sp) || 0;
    for (const loc of cov.locations) {
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
