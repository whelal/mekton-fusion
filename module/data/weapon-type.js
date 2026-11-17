import { CLOSE_COMBAT_SKILLS } from "./close-combat.js";

/**
 * Weapon type, one definition for the whole system: melee, thrown, or ranged.
 * Everything that branches on it (attack dialog, parry DA, Weapon Options)
 * calls these instead of keeping its own skill list.
 * Each takes an Item-like object: { type, system: { skill, range, isMecha } }.
 */

const skillOf = item => String(item?.system?.skill ?? "").trim().toLowerCase();

/** Personal scale: not a mecha-weapon item and not flagged isMecha. */
export function isPersonalWeapon(item) {
  return item?.type !== "mecha-weapon" && !item?.system?.isMecha;
}

/** Thrown: range "T", or the Athletics skill (MZ's thrown-weapon skill). */
export function isThrownWeapon(item) {
  return String(item?.system?.range ?? "").trim().toUpperCase() === "T" || skillOf(item) === "athletics";
}

/** Melee: a close-combat skill (CLOSE_COMBAT_SKILLS), not thrown. A thrown knife is thrown. */
export function isMeleeWeapon(item) {
  return CLOSE_COMBAT_SKILLS.has(skillOf(item)) && !isThrownWeapon(item);
}

/** Weapon Options (sights, silencers, magazines): personal-scale ranged weapons only. */
export function supportsWeaponOptions(item) {
  return isPersonalWeapon(item) && !isMeleeWeapon(item) && !isThrownWeapon(item);
}
