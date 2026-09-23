/**
 * mekton-fusion: Mecha Weapon & Shield Tables
 * -------------------------------------------
 * Verified against the Mekton Weapon Table. These are stat values (game
 * mechanics), implemented as data so weapon fields auto-fill on selection.
 * No rulebook prose reproduced.
 *
 * Field meanings (write your own UI tooltips):
 *   range     - in 50m hexes
 *   wa        - weapon accuracy modifier
 *   damageK   - damage in Kills (number). damageNote holds special markers.
 *   kills     - Kills (structural) value
 *   bv        - burst value (null = "na")
 *   shots     - number, "inf" (∞), or a note object
 *   weightTons, spaces, cost as listed
 */

// ∞ shots represented as the string "inf".
export const BEAM_WEAPONS = {
  lightBeamGun:    { label: "Light Beam Gun",    range: 4,  wa: 1,  damageK: 1,  kills: 1,  bv: null, shots: "inf", weightTons: 0.5, spaces: 1,  cost: 2  },
  mediumBeamGun:   { label: "Medium Beam Gun",   range: 7,  wa: 1,  damageK: 3,  kills: 3,  bv: null, shots: "inf", weightTons: 1.5, spaces: 4,  cost: 5  },
  heavyBeamGun:    { label: "Heavy Beam Gun",    range: 10, wa: 1,  damageK: 6,  kills: 6,  bv: null, shots: "inf", weightTons: 3,   spaces: 9,  cost: 9  },
  beamCannon:      { label: "Beam Cannon",       range: 8,  wa: 2,  damageK: 4,  kills: 4,  bv: null, shots: "inf", weightTons: 2,   spaces: 9,  cost: 9  },
  heavyBeamCannon: { label: "Heavy Beam Cannon", range: 8,  wa: 2,  damageK: 8,  kills: 8,  bv: null, shots: "inf", weightTons: 4,   spaces: 15, cost: 16 },
  novaCannon:      { label: "Nova Cannon",       range: 15, wa: 1,  damageK: 15, kills: 15, bv: null, shots: 1,     weightTons: 0.5, spaces: 10, cost: 29, damageNote: "once per battle" },
  pulseCannon:     { label: "Pulse Cannon",      range: 8,  wa: 0,  damageK: 4,  kills: 4,  bv: 6,    shots: "inf", weightTons: 2,   spaces: 11, cost: 20, damageNote: "one burst every other turn" },
  beamSweeper:     { label: "Beam Sweeper",      range: 4,  wa: -1, damageK: 2,  kills: 2,  bv: "inf",shots: "inf", weightTons: 1,   spaces: 6,  cost: 15, damageNote: "continuous beam, no max hit limit" },
};

export const PROJECTILE_WEAPONS = {
  lightCannon:     { label: "Light Cannon",     range: 5,  wa: 0,  damageK: 3,  kills: 3,  bv: null, shots: 10,          weightTons: 1.5, spaces: 3,  cost: 3  },
  mediumCannon:    { label: "Medium Cannon",    range: 7,  wa: 0,  damageK: 6,  kills: 6,  bv: null, shots: 10,          weightTons: 3,   spaces: 6,  cost: 6  },
  heavyCannon:     { label: "Heavy Cannon",     range: 9,  wa: 0,  damageK: 9,  kills: 9,  bv: null, shots: 10,          weightTons: 4.5, spaces: 9,  cost: 9  },
  giantCannon:     { label: "Giant Cannon",     range: 17, wa: 0,  damageK: 12, kills: 12, bv: null, shots: 10,          weightTons: 6,   spaces: 15, cost: 15 },
  autocannon:      { label: "Autocannon",       range: 4,  wa: -2, damageK: 2,  kills: 2,  bv: 8,    shots: "10 bursts", weightTons: 1,   spaces: 6,  cost: 5  }, // cost/spaces were transposed (6/5) -- verified against a book worked example (Cost 5, Space 6)
  heavyAutocannon: { label: "Heavy Autocannon", range: 7,  wa: -1, damageK: 6,  kills: 6,  bv: 4,    shots: "10 bursts", weightTons: 3,   spaces: 10, cost: 13 },
  epoxyGun:        { label: "Epoxy Gun",        range: 5,  wa: 2,  damageK: 0,  kills: 6,  bv: null, shots: 3,           weightTons: 3,   spaces: 7,  cost: 12, damageNote: "no damage; grapples (Mecha Fighting vs 18 to escape)" },
};
// Reloads cost 10% of weapon's cost, per 10-shot magazine.

export const MISSILES = {
  rocketPod:      { label: "Rocket Pod",      range: 5,  wa: -1, damageK: 2,  kills: 3, shots: 20, weightTons: 1.5, spaces: 4, cost: 4 },
  rocketLauncher: { label: "Rocket Launcher", range: 7,  wa: 0,  damageK: 4,  kills: 3, shots: 10, weightTons: 1.5, spaces: 4, cost: 4 },
  missilePod:     { label: "Missile Pod",     range: 13, wa: 1,  damageK: 6,  kills: 2, shots: 5,  weightTons: 1,   spaces: 5, cost: 5 },
  heavyMissile:   { label: "Heavy Missile",   range: 24, wa: 2,  damageK: 12, kills: 1, shots: 1,  weightTons: 0.5, spaces: 3, cost: 3 },
};

// Melee: damageK plus damageMod for special (AP / shocking). shots ∞.
export const MELEE_WEAPONS = {
  sword:     { label: "Sword",      range: 1, wa: 1,  damageK: 5, kills: 5, shots: "inf", weightTons: 2.5, spaces: 4, cost: 4 },
  axe:       { label: "Axe",        range: 1, wa: 0,  damageK: 6, kills: 6, shots: "inf", weightTons: 3,   spaces: 3, cost: 3 },
  mace:      { label: "Mace",       range: 1, wa: 0,  damageK: 8, kills: 8, shots: "inf", weightTons: 4,   spaces: 4, cost: 4 },
  drill:     { label: "Drill",      range: 1, wa: -1, damageK: 4, kills: 4, shots: "inf", weightTons: 2,   spaces: 3, cost: 3, damageNote: "AP (armor-piercing)" },
  saw:       { label: "Saw",        range: 1, wa: -1, damageK: 6, kills: 6, shots: "inf", weightTons: 3,   spaces: 5, cost: 5, damageNote: "AP (armor-piercing)" },
  shockWhip: { label: "Shock-Whip", range: 1, wa: -2, damageK: 2, kills: 2, shots: "inf", weightTons: 1,   spaces: 7, cost: 12, damageNote: "shocking effect" },
};

export const ENERGY_MELEE = {
  energySword: { label: "Energy Sword", range: 1, wa: 1, damageK: 6,  kills: 2, shots: "inf", weightTons: 1, spaces: 6, cost: 6  },
  energyAxe:   { label: "Energy Axe",   range: 1, wa: 0, damageK: 7,  kills: 2, shots: "inf", weightTons: 1, spaces: 6, cost: 6  },
  energyLance: { label: "Energy Lance", range: 1, wa: 2, damageK: 8,  kills: 2, shots: "inf", weightTons: 1, spaces: 8, cost: 14 },
  novaSword:   { label: "Nova Sword",   range: 1, wa: 3, damageK: 15, kills: 4, shots: 2,     weightTons: 2, spaces: 8, cost: 14, damageNote: "2 turns before out of energy" },
};

// Shields: DA (defense mod), SP, Cost, Weight. Notes: mounted shields take
// 1 space; hand-held shields must have SP lower than the hand's arm spaces.
export const SHIELDS = {
  smallShield:  { label: "Small Shield",  da: -1, sp: 6,  cost: 7.5, weightTons: 3   },
  mediumShield: { label: "Medium Shield", da: -2, sp: 9,  cost: 9,   weightTons: 4.5 },
  largeShield:  { label: "Large Shield",  da: 0,  sp: 12, cost: 18,  weightTons: 6   },
};

// All weapon categories keyed for a unified picker.
export const WEAPON_CATEGORIES = {
  beam:        { label: "Beam Weapons",       items: BEAM_WEAPONS },
  projectile:  { label: "Projectile Weapons", items: PROJECTILE_WEAPONS },
  missile:     { label: "Missiles",           items: MISSILES },
  melee:       { label: "Melee Weapons",      items: MELEE_WEAPONS },
  energyMelee: { label: "Energy Melee",       items: ENERGY_MELEE },
};

/**
 * Look up a weapon's full stat block by category + key.
 * @returns {object|null}
 */
export function getWeapon(categoryKey, weaponKey) {
  const cat = WEAPON_CATEGORIES[categoryKey];
  if (!cat) return null;
  return cat.items[weaponKey] ?? null;
}
