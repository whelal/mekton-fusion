import { TABLE_RULINGS } from "../rules/table-rulings.js";

/**
 * Human-scale close combat (brawling maneuvers and melee weapon strikes): the
 * player picks the hit location instead of rolling it. Pure data + helpers;
 * the dialog lives in actor-sheet.js (_rollCloseCombat / _rollWeaponItem).
 *
 * MZ core makes every close-contact attack a free called shot; the table
 * prices non-default locations instead (TABLE_RULINGS.closeCombatCalledPenalty).
 */

/**
 * What the player can aim at. `group` keys the called-shot penalty and the
 * maneuver's reachable list; `location` is the body location damaged.
 * Eyes/sensors damage the head.
 */
export const CLOSE_TARGETS = {
  torso: { label: "Torso",        group: "torso", location: "torso" },
  head:  { label: "Head",         group: "head",  location: "head" },
  rArm:  { label: "Right Arm",    group: "arm",   location: "rArm" },
  lArm:  { label: "Left Arm",     group: "arm",   location: "lArm" },
  rLeg:  { label: "Right Leg",    group: "leg",   location: "rLeg" },
  lLeg:  { label: "Left Leg",     group: "leg",   location: "lLeg" },
  eyes:  { label: "Eyes/Sensors", group: "eyes",  location: "head" }
};

/**
 * Brawling maneuvers (MZ core, Strike and Kick lists). `targets` = location
 * groups the maneuver can reach. `defaultGroup` overrides the free location
 * (legs, for a multi-location sweep/trip); otherwise torso is free when
 * reachable, and a single-location maneuver's one location is always free.
 * `damage`: men-scale formula (MZ core, Hand-to-Hand Attack Table; "Punch,
 * etc." covers Claw/Elbow/Backhand); a trailing "+" adds the BODY damage
 * modifier. `effect`: what a no-damage maneuver (Chop) does instead; not automated.
 * `damageType` ("Fists From Hell" Bruise Damage addendum, 0.3.29): unarmed
 * strikes and kicks are "bruise"; Claw and Bite cut or puncture, so "wound".
 * `positions`: reach that depends on the attacker's position (Bite), keyed by
 * MOUTH_POSITIONS; `targets` is then the default position's reach.
 */
export const CLOSE_MANEUVERS = {
  punch:    { label: "Punch",    wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+",   damageType: "bruise" },
  claw:     { label: "Claw",     wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+",   damageType: "wound" },
  elbow:    { label: "Elbow",    wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+",   damageType: "bruise" },
  backhand: { label: "Backhand", wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+",   damageType: "bruise" },
  // INTERPRETATION: Chop and Crescent can't reach the torso, so no location is free.
  chop:     { label: "Chop",     wa: -2, targets: ["head", "arm"],          damage: null, effect: "Stun" },
  crescent: { label: "Crescent", wa: -2, targets: ["head", "arm"],          damage: "1D6+1+", damageType: "bruise" },
  kick:     { label: "Kick",     wa: 0,  targets: ["leg"],                  damage: "1D3+",   damageType: "bruise" },
  wheel:    { label: "Wheel",    wa: -1, targets: ["torso"],                damage: "1D6+",   damageType: "bruise" },
  thrust:   { label: "Thrust",   wa: -3, targets: ["torso"],                damage: "1D6+2+", damageType: "bruise" },
  spin:     { label: "Spin",     wa: -4, targets: ["head"],                 damage: "1D6+3+", damageType: "bruise" },
  jab:      { label: "Jab",      wa: -5, targets: ["eyes"],                 damage: "1D3+",   damageType: "bruise" },
  // MZ core Hand-to-Hand Attack Table, 1D3 + BODY. WA 0 per MZ core errata p.99
  // (the table's +1 is wrong; the text's +0 is correct).
  bite:     { label: "Bite",     wa: 0,  targets: TABLE_RULINGS.biteReach.level, positions: TABLE_RULINGS.biteReach, damage: "1D3+", damageType: "wound" }
};

/** Where the attacker's mouth is, for a maneuver with `positions` (Bite). */
export const MOUTH_POSITIONS = { level: "Level with target", ground: "On the ground" };

/** Location groups a maneuver reaches from `position` (ignored without `positions`). */
export function maneuverTargets(m, position) {
  return m.positions?.[position] ?? m.targets;
}

/** Whether a CLOSE_MANEUVERS key is Quick (TABLE_RULINGS.quickManeuvers). */
export function isQuickManeuver(key) {
  return TABLE_RULINGS.quickManeuvers.includes(key);
}

/**
 * The attacks one Action makes (MZ+ ATM, Melee Weapons, Quick): one, or two
 * when `quick` is on. Each attack is its own called shot on its own target key
 * (`targets[i]`; a missing second one repeats the first), so each carries its
 * own location penalty.
 * @returns {{target:string, locPenalty:number}[]}
 */
export function closeAttackPlan(quick, targets, groups, defaultGroup) {
  const keys = quick ? [targets[0], targets[1] ?? targets[0]] : [targets[0]];
  return keys.map(target => ({ target, locPenalty: closeCalledPenalty(groups, target, defaultGroup) }));
}

/**
 * Run each planned attack in order, each on its own (its own attack roll,
 * defense, location and damage): a miss never stops the next one. Sequential,
 * so the second attack sees the first one's damage already applied.
 * @param {object[]} plan - from closeAttackPlan
 * @param {(attack:object, n:number) => Promise<any>} attackOnce - n is 1-based
 */
export async function runAttackPlan(plan, attackOnce) {
  const out = [];
  for (const [i, attack] of plan.entries()) out.push(await attackOnce(attack, i + 1));
  return out;
}

/** A melee weapon strike: any location, torso free. WA comes from the weapon. */
export const MELEE_STRIKE_TARGETS = ["torso", "head", "arm", "leg"];

/** Weapon skills that make an attack close contact (thrown/Athletics is ranged). */
export const CLOSE_COMBAT_SKILLS = new Set(["blade", "fencing", "whip", "hand-to-hand", "martial-art"]);

/** Target keys (CLOSE_TARGETS) reachable by a list of location groups. */
export function closeTargetsFor(groups) {
  return Object.keys(CLOSE_TARGETS).filter(k => groups.includes(CLOSE_TARGETS[k].group));
}

/** The free location group, or null when every reachable location is a called shot. */
export function freeGroup(groups, defaultGroup) {
  if (groups.length === 1) return groups[0];
  if (defaultGroup && groups.includes(defaultGroup)) return defaultGroup;
  return groups.includes("torso") ? "torso" : null;
}

/** Called-shot penalty for hitting `targetKey`, stacked on the maneuver's WA. */
export function closeCalledPenalty(groups, targetKey, defaultGroup) {
  const group = CLOSE_TARGETS[targetKey]?.group;
  if (!group || group === freeGroup(groups, defaultGroup)) return 0;
  return TABLE_RULINGS.closeCombatCalledPenalty[group] ?? 0;
}

/** Pre-selected target: the first one in the free group, else the first reachable. */
export function defaultCloseTarget(groups, defaultGroup) {
  const keys = closeTargetsFor(groups);
  const free = freeGroup(groups, defaultGroup);
  return keys.find(k => CLOSE_TARGETS[k].group === free) ?? keys[0];
}

/**
 * Armor zone (ARMOR_ZONES key) a chosen target lands on. INTERPRETATION: a leg
 * hit is thigh or lower leg 50/50, on the side the attacker chose, so partial
 * leg armor (Shorts, Boots) matters. `rand` is injectable for tests.
 */
export function closeHitZone(targetKey, rand = Math.random) {
  if (targetKey === "rLeg") return rand() < 0.5 ? "rThigh" : "rLowerLeg";
  if (targetKey === "lLeg") return rand() < 0.5 ? "lThigh" : "lLowerLeg";
  return CLOSE_TARGETS[targetKey]?.location ?? "torso";
}
