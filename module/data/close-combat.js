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
 */
export const CLOSE_MANEUVERS = {
  punch:    { label: "Punch",    wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+" },
  claw:     { label: "Claw",     wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+" },
  elbow:    { label: "Elbow",    wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+" },
  backhand: { label: "Backhand", wa: 0,  targets: ["torso", "head", "arm"], damage: "1D2+" },
  // INTERPRETATION: Chop and Crescent can't reach the torso, so no location is free.
  chop:     { label: "Chop",     wa: -2, targets: ["head", "arm"],          damage: null, effect: "Stun" },
  crescent: { label: "Crescent", wa: -2, targets: ["head", "arm"],          damage: "1D6+1+" },
  kick:     { label: "Kick",     wa: 0,  targets: ["leg"],                  damage: "1D3+" },
  wheel:    { label: "Wheel",    wa: -1, targets: ["torso"],                damage: "1D6+" },
  thrust:   { label: "Thrust",   wa: -3, targets: ["torso"],                damage: "1D6+2+" },
  spin:     { label: "Spin",     wa: -4, targets: ["head"],                 damage: "1D6+3+" },
  jab:      { label: "Jab",      wa: -5, targets: ["eyes"],                 damage: "1D3+" }
};

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
