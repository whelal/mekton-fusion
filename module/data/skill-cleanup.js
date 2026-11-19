/**
 * Skill list cleanup: which of an actor's (or the world's) skill Items to
 * delete, keep, rename, or give the PSI data fields. Pure; the Foundry side
 * is module/migrate-actors.js (Update Characters) and module/seed.js.
 */
import { PSI_POWERS, REMOVED_SKILLS, RENAMED_SKILLS, KNOWN_SKILL_NAMES, psiPowerFields } from "./skills.js";

const POWERS = new Map(PSI_POWERS.map(p => [p.name, p]));

/** True if the skill Item is in the PSI category. */
function isPsi(item) {
  return String(item.system?.category ?? "").toUpperCase() === "PSI";
}

/** A removed or renamed entry matching this item (name and PSI/non-PSI category); custom skills never match. */
function matchEntry(list, item, key = "name") {
  if (item.system?.custom) return null;
  return list.find(e => e[key] === item.name && e.psi === isPsi(item)) ?? null;
}

/**
 * The PSI fields to write onto a psionic skill named `name` (null = nothing
 * to do): only while its group is empty, so later edits survive.
 * @param {string} name - the skill's (possibly new) name
 * @param {object} system - its current system data
 */
export function psiFieldUpdate(name, system = {}) {
  const power = POWERS.get(name);
  if (!power || String(system.category ?? "").toUpperCase() !== "PSI" || system.group) return null;
  const fields = psiPowerFields(power);
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [`system.${k}`, v]));
}

/**
 * Renames only (no deletes): each RENAMED_SKILLS entry whose new name isn't
 * taken. Used by the default-skill sync, which runs on new and existing actors.
 * @param {Array<{id:string, name:string, system:object}>} items
 * @returns {Array<{_id:string, name:string}>}
 */
export function planSkillRenames(items) {
  const names = new Set(items.map(i => i.name));
  const renames = [];
  for (const item of items) {
    const entry = matchEntry(RENAMED_SKILLS, item, "from");
    if (!entry || names.has(entry.to)) continue;
    names.add(entry.to);
    renames.push({ _id: item.id, name: entry.to });
  }
  return renames;
}

/**
 * The full cleanup for one set of skill Items:
 *   - removed skills (REMOVED_SKILLS, and a rename whose new name is already
 *     taken) are deleted only at rank 0 with no IP; otherwise kept and listed
 *   - renames keep rank and IP (they're name-only updates)
 *   - psionic skills get their PSI fields (group, resistStat, costPerLevel,
 *     lensMagnifiable) while their group is empty
 * Running it again on the result changes nothing.
 * @param {Array<{id:string, name:string, system:object}>} items - skill Items
 * @returns {{updates:Array<object>, deletes:string[], kept:Array<{name:string, rank:number, ip:number}>, renamed:Array<{from:string, to:string}>}}
 */
export function planSkillCleanup(items) {
  const renameIds = new Map(planSkillRenames(items).map(r => [r._id, r.name]));
  const updates = [];
  const deletes = [];
  const kept = [];
  const renamed = [];
  for (const item of items) {
    const rank = Number(item.system?.rank) || 0;
    const ip = Number(item.system?.ip) || 0;
    const newName = renameIds.get(item.id);
    const blockedRename = !newName && matchEntry(RENAMED_SKILLS, item, "from");
    if (matchEntry(REMOVED_SKILLS, item) || blockedRename) {
      if (rank === 0 && ip === 0) deletes.push(item.id);
      else kept.push({ name: item.name, rank, ip });
      continue;
    }
    const update = { ...(newName ? { name: newName } : null), ...psiFieldUpdate(newName ?? item.name, item.system) };
    if (newName) renamed.push({ from: item.name, to: newName });
    if (Object.keys(update).length) updates.push({ _id: item.id, ...update });
  }
  return { updates, deletes, kept, renamed };
}

/** "<Actor>: kept <skill> rank N" lines for the GM (IP shown when there is some). */
export function keptSkillLines(label, kept) {
  return kept.map(k => `${label}: kept ${k.name} rank ${k.rank}${k.ip ? ` (${k.ip} IP)` : ""}`);
}

/**
 * Before 0.3.42 the skill schema had no `custom` field, so Foundry dropped the
 * marker on save. Re-mark it: a skill whose name isn't in KNOWN_SKILL_NAMES
 * gets custom = true. Skills sharing a seeded or removed name stay as they are
 * (they can't be told apart). Running it again changes nothing.
 * @param {Array<{id:string, name:string, system:object}>} items - skill Items
 * @returns {Array<{_id:string, "system.custom":true}>}
 */
export function planCustomRemarks(items) {
  return items
    .filter(i => !i.system?.custom && !KNOWN_SKILL_NAMES.has(i.name))
    .map(i => ({ _id: i.id, "system.custom": true }));
}
