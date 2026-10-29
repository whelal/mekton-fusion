import { TABLE_RULINGS } from "../rules/table-rulings.js";
import { CLOSE_COMBAT_SKILLS } from "./close-combat.js";
import { woundState, shownHits } from "./damage-track.js";

/**
 * Human-scale defense after a failed Evade (MZ core, Evade Rolls / Parry
 * Rolls): the defender gets ONE further defense per attack, a weapon Parry or
 * an Arm Block. Pure helpers; the sheet (actor-sheet.js, _secondDefense) rolls
 * the dice and resolves the damage.
 *
 * Attack kinds: "melee" (a melee weapon or EMW, or a firearm used as a club),
 * "unarmed" (close-combat maneuvers), "ranged" (everything else).
 */

/** The GM's choice in the attack dialog. "auto" picks per chooseDefense. */
export const DEFENSE_MODES = {
  auto: "Auto",
  weapon: "Weapon Parry",
  arm: "Arm Block",
  none: "None"
};

/** Firearm weapon skills: a firearm can be used as an improvised club. */
export const FIREARM_SKILLS = new Set(["handgun", "rifle", "automatic-weapon"]);

const isThrown = sys => String(sys?.range ?? "").trim().toUpperCase() === "T";

/** A weapon built for melee: a close-contact skill, not thrown. */
export function isMeleeBuilt(sys) {
  return CLOSE_COMBAT_SKILLS.has(String(sys?.skill ?? "").toLowerCase()) && !isThrown(sys);
}

/** Parry DA: a melee weapon's WA; anything else is improvised (TABLE_RULINGS.improvisedParryDA). */
export function parryDA(sys) {
  return isMeleeBuilt(sys) ? Number(sys?.wa) || 0 : TABLE_RULINGS.improvisedParryDA;
}

/** A sword (TABLE_RULINGS.fencingWeapons, or a weapon on the Fencing skill) parries with max(Blade, Fencing). */
export function isSword(weapon) {
  return TABLE_RULINGS.fencingWeapons.includes(weapon?.name) || weapon?.system?.skill === "fencing";
}

/**
 * The parry skill for a weapon: Blade, or for a sword the higher of Blade and Fencing.
 * @param {{blade:number, fencing:number}} ranks
 * @returns {{label:string, rank:number}}
 */
export function parrySkill(weapon, ranks) {
  const blade = Number(ranks?.blade) || 0;
  const fencing = Number(ranks?.fencing) || 0;
  return isSword(weapon) && fencing > blade ? { label: "Fencing", rank: fencing } : { label: "Blade", rank: blade };
}

/**
 * The defender's best parrying weapon: of the weapons in hand, the highest
 * skill + DA (ties: list order). Null when nothing is in hand.
 * @returns {{weapon:object, skill:{label:string, rank:number}, da:number, improvised:boolean}|null}
 */
export function bestParryWeapon(weapons, ranks) {
  let best = null;
  for (const weapon of weapons ?? []) {
    if (!weapon?.system?.inHand) continue;
    const skill = parrySkill(weapon, ranks);
    const da = parryDA(weapon.system);
    if (!best || skill.rank + da > best.skill.rank + best.da) best = { weapon, skill, da, improvised: !isMeleeBuilt(weapon.system) };
  }
  return best;
}

/** Weapon parries only work vs melee-weapon/EMW attacks (RAW). */
export const canParry = attackKind => attackKind === "melee";

/** The Arm Block works vs melee-weapon and unarmed attacks, never ranged. */
export const canArmBlock = attackKind => attackKind === "melee" || attackKind === "unarmed";

const LIMB_OUT = new Set(["broken", "shattered", "severed"]);

/**
 * The blocking arm: of rArm/lArm, skip a broken (or worse) arm; pick the most
 * Hits remaining (shown Hits), then the best armor SP (ties: right arm). A
 * sprained arm can block at TABLE_RULINGS.sprainedLimbPenalty.
 * @param {object} locations - system.body.locations
 * @param {{rArm?:number, lArm?:number}} [armorSp] - each arm's current armor SP
 * @returns {{key:string, penalty:number}|null}
 */
export function pickBlockingArm(locations, armorSp = {}) {
  const arms = ["rArm", "lArm"]
    .filter(k => locations?.[k] && !LIMB_OUT.has(woundState(k, locations[k])))
    .map(k => ({ key: k, hits: shownHits(locations[k]), sp: Number(armorSp[k]) || 0, state: woundState(k, locations[k]) }));
  if (!arms.length) return null;
  arms.sort((a, b) => (b.hits - a.hits) || (b.sp - a.sp));
  const arm = arms[0];
  return { key: arm.key, penalty: arm.state === "sprained" ? TABLE_RULINGS.sprainedLimbPenalty : 0 };
}

/**
 * Which further defense a failed Evade gets: "weapon", "arm" or null.
 * auto: a weapon Parry if one is possible, else an Arm Block if possible.
 * A forced mode that isn't possible gives no defense.
 * @param {string} mode - DEFENSE_MODES key
 * @param {{attackKind:string, parry:object|null, arm:object|null}} opts
 */
export function chooseDefense(mode, { attackKind, parry, arm }) {
  const weaponOk = canParry(attackKind) && !!parry;
  const armOk = canArmBlock(attackKind) && !!arm;
  if (mode === "weapon") return weaponOk ? "weapon" : null;
  if (mode === "arm") return armOk ? "arm" : null;
  if (mode === "none") return null;
  return weaponOk ? "weapon" : armOk ? "arm" : null;
}

/** Weapon Parry vs attack total. Ties go to the defender. */
export function parryOutcome(parryTotal, attackTotal) {
  return Number(parryTotal) >= Number(attackTotal) ? "parried" : "failed";
}

/**
 * Arm Block vs attack total (margin = block - attack; ties block):
 * "failed" (< 0, the hit lands where it was going), "arm" (0 up to
 * armBlockCleanMargin, damage to the blocking arm), "clean" (no damage).
 */
export function armBlockOutcome(blockTotal, attackTotal) {
  const margin = Number(blockTotal) - Number(attackTotal);
  if (margin < 0) return { result: "failed", margin };
  return { result: margin < TABLE_RULINGS.armBlockCleanMargin ? "arm" : "clean", margin };
}

/**
 * Improvised club damage for a firearm (TABLE_RULINGS.improvisedClub): "small"
 * for handguns and Pocket/Jacket Auto Weapons, else "long". Null for a
 * non-firearm.
 */
export function clubDamage(sys) {
  const skill = String(sys?.skill ?? "").toLowerCase();
  if (!FIREARM_SKILLS.has(skill)) return null;
  const small = skill === "handgun" || (skill === "automatic-weapon" && ["P", "J"].includes(String(sys?.conc ?? "").toUpperCase()));
  return TABLE_RULINGS.improvisedClub.damage[small ? "small" : "long"];
}

/**
 * Knockout strike (MZ core, Knockout Damage, human scale): a melee-weapon or
 * gun-butt strike declared a knockout takes this WA and does this many Hits.
 * INTERPRETATION: the Hit is a Bruise that bypasses armor, and the target
 * always makes a Stun/Shock roll.
 */
export const KNOCKOUT = { wa: -3, hits: 1, damageType: "bruise" };
