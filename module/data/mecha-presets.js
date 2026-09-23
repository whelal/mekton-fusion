/**
 * mekton-fusion: NPC / Mook Presets (original homebrew content)
 * ------------------------------------------------------------
 * Key-based enemy templates that load through the derive pipeline
 * (deriveServo / getWeapon). Each preset lists SELECTION KEYS only; the
 * sheet's change handlers compute Space/Kills/Cost/Weight from the data
 * modules, so a preset stays correct if any underlying value changes.
 *
 * These are ORIGINAL designs -- names and configurations chosen for this
 * module. They are not reproductions of any published mecha (published
 * mecha and their names are copyrighted; do NOT add transcriptions of
 * them here). Built from the game's construction mechanics only.
 *
 * Preset shape:
 *   { id, label, kind: "mecha"|"creature", bodyPlan,
 *     servos: [{ location, class, extremity?, armor? }],
 *     movement: [{ system, location, ma }],
 *     weapons: [{ category, key, loc, notes? }],
 *     shields?: [{ key, loc }],
 *     sensors?, cockpit?, notes }
 */

import { SERVO_ROW_LOCATIONS } from "./mecha-construction.js";

const MECHA_PRESETS = {
  // --- Light rocket-striker: fast, fragile, rocket harasser -------------
  vesper: {
    id: "vesper",
    label: "Vesper-class Skirmisher",
    kind: "mecha",
    bodyPlan: "humanoid",
    servos: [
      { location: "head",  class: "mediumstriker", armor: "mediumstriker" },
      { location: "arm",   class: "heavystriker",  extremity: "hand", armor: "heavystriker", side: "right" },
      { location: "arm",   class: "heavystriker",  extremity: "hand", armor: "heavystriker", side: "left" },
      { location: "leg",   class: "lightheavy",    extremity: "foot", armor: "lightheavy", side: "right" },
      { location: "leg",   class: "lightheavy",    extremity: "foot", armor: "lightheavy", side: "left" },
      { location: "torso", class: "mediumweight",  armor: "mediumweight" },
    ],
    movement: [
      { system: "Main Thrusters", location: "torso", ma: 9 },
      { system: "Sub-Thruster",   location: "leg",   ma: 3, side: "right" },
      { system: "Sub-Thruster",   location: "leg",   ma: 3, side: "left" },
    ],
    weapons: [
      { category: "missile", key: "rocketLauncher", loc: "R Arm" },
      { category: "missile", key: "rocketLauncher", loc: "L Arm" },
      { category: "projectile", key: "autocannon",  loc: "Torso", notes: "Linked pair; BV 8" },
      { category: "projectile", key: "autocannon",  loc: "Torso", notes: "Linked pair; BV 8" },
    ],
    powerplant: { charge: "standard", source: "fusion", hot: false },
    notes: "Fast harasser. Low armor; relies on speed and rocket volleys.",
  },

  // --- Heavy shielded assault: slow bruiser, big gun, twin shields -------
  bulwark: {
    id: "bulwark",
    label: "Bulwark-class Assault",
    kind: "mecha",
    bodyPlan: "humanoid",
    servos: [
      { location: "head",  class: "heavystriker", armor: "lightheavy" },
      { location: "arm",   class: "mediumweight", extremity: "hand", armor: "lightheavy", side: "right" },
      { location: "arm",   class: "mediumweight", extremity: "hand", armor: "lightheavy", side: "left" },
      { location: "leg",   class: "mediumheavy",  extremity: "foot", armor: "lightheavy", side: "right" },
      { location: "leg",   class: "mediumheavy",  extremity: "foot", armor: "lightheavy", side: "left" },
      { location: "torso", class: "lightheavy",   armor: "lightheavy" },
    ],
    movement: [
      { system: "Main Thruster", location: "leg", ma: 9, side: "right" },
      { system: "Main Thruster", location: "leg", ma: 9, side: "left" },
    ],
    weapons: [
      { category: "missile",    key: "rocketLauncher", loc: "Torso", notes: "Linked pair" },
      { category: "missile",    key: "rocketLauncher", loc: "Torso", notes: "Linked pair" },
      { category: "projectile", key: "autocannon",     loc: "hand",  notes: "BV 8" },
      { category: "projectile", key: "giantCannon",    loc: "2 hand", notes: "Two-handed bazooka" },
    ],
    shields: [
      { key: "mediumShield", loc: "R Arm" },
      { key: "mediumShield", loc: "L Arm" },
    ],
    powerplant: { charge: "standard", source: "fusion", hot: false },
    notes: "Slow, heavily shielded gun platform. Frontline anchor.",
  },
};

// --- Creatures: non-humanoid, no full sheet -------------------------------
// Uses the character body-plan/enemy model (makeEnemy) rather than mecha
// construction. BOD-driven, with natural weapons/armor.
const CREATURE_PRESETS = {
  direWolf: {
    id: "direWolf",
    label: "Dire Wolf",
    kind: "creature",
    bodyPlan: "quadruped",
    bod: 8,
    armorSP: 2,
    naturalWeapons: [
      { name: "Bite", damage: "1D6+1", type: "melee" },
      { name: "Claw", damage: "1D6",   type: "melee" },
    ],
    notes: "Pack hunter. Fast, low armor, dangerous in numbers.",
  },
};

// --- Fixed row counts the mecha schema's ArrayFields are built to. Kept in
// sync with actor-data-model.js's `initial` arrays so a loaded preset always
// produces exactly as many rows as the sheet renders.
const WEAPON_SLOTS = 4;
const SHIELD_SLOTS = 2;
const MOVEMENT_SLOTS = 3;
const NATURAL_WEAPON_SLOTS = 4;

// Free-text location aliases from the presets onto the sheet's fixed Loc
// picker keys (head/torso/rArm/lArm/rLeg/lLeg). "hand"/"2 hand" describe a
// hand-held weapon without specifying a side, so they default to the right arm.
const LOC_ALIASES = {
  head: "head", torso: "torso",
  "r arm": "rArm", "right arm": "rArm",
  "l arm": "lArm", "left arm": "lArm",
  "r leg": "rLeg", "right leg": "rLeg",
  "l leg": "lLeg", "left leg": "lLeg",
  hand: "rArm", "2 hand": "rArm", "two hand": "rArm", "two-handed": "rArm",
};

/** Normalize a preset location string (optionally paired with a side) to a sheet Loc key. */
function normalizeMechaLoc(location, side) {
  if (!location) return "";
  const loc = String(location).trim().toLowerCase();
  if (loc === "arm") return side === "left" ? "lArm" : "rArm";
  if (loc === "leg") return side === "left" ? "lLeg" : "rLeg";
  return LOC_ALIASES[loc] ?? "";
}

/** Row index into the 6-slot servos array for a preset servo's location/side. */
function servoRowIndex(location, side) {
  const loc = String(location ?? "").trim().toLowerCase();
  let key;
  if (loc === "arm") key = side === "left" ? "lArm" : "rArm";
  else if (loc === "leg") key = side === "left" ? "lLeg" : "rLeg";
  else key = loc; // "head" / "torso"
  return SERVO_ROW_LOCATIONS.findIndex(r => r.key === key);
}

// Pads UP to len if the preset has fewer rows than the sheet's default slot
// count -- never truncates. A preset legitimately needing more rows than the
// default (e.g. 7 armament entries against a 4-slot default) keeps every row; ArrayFields here have no schema-enforced max
// length, and the sheet's {{#each}} tables render however many rows exist.
function padTo(arr, len, makeEmpty) {
  const out = arr.slice();
  while (out.length < len) out.push(makeEmpty());
  return out;
}

/**
 * Build a `system.<mechKey>` partial-update payload from a MECHA_PRESETS entry.
 * Only selection keys are stamped -- Space/Cost/Kills/Weight/WA/etc. are left
 * for `ActorDataModel#_deriveMecha` to fill on the next data-prep pass.
 * @param {object} preset - an entry from MECHA_PRESETS
 * @returns {{name: string, servos: object[], weapons: object[], shields: object[], movementSystems: object[]}}
 */
export function buildMechaPresetUpdate(preset) {
  const servos = SERVO_ROW_LOCATIONS.map(() => ({ level: "", extremityKey: "", armor: "" }));
  for (const s of preset.servos ?? []) {
    const idx = servoRowIndex(s.location, s.side);
    if (idx >= 0) servos[idx] = { level: s.class ?? "", extremityKey: s.extremity ?? "", armor: s.armor ?? "" };
  }

  const weapons = padTo(
    (preset.weapons ?? []).map(w => ({
      category: w.category ?? "", weaponKey: w.key ?? "", loc: normalizeMechaLoc(w.loc), notes: w.notes ?? "",
    })),
    WEAPON_SLOTS,
    () => ({ category: "", weaponKey: "", loc: "", notes: "" })
  );

  const shields = padTo(
    (preset.shields ?? []).map(s => ({ key: s.key ?? "", loc: normalizeMechaLoc(s.loc) })),
    SHIELD_SLOTS,
    () => ({ key: "", loc: "" })
  );

  const movementSystems = padTo(
    (preset.movement ?? []).map(m => ({
      system: m.system ?? "", type: "thruster", targetMA: m.ma ?? 0, loc: normalizeMechaLoc(m.location, m.side),
    })),
    MOVEMENT_SLOTS,
    () => ({ system: "", type: "", targetMA: 0, loc: "" })
  );

  const powerplant = preset.powerplant
    ? { charge: preset.powerplant.charge ?? "", source: preset.powerplant.source ?? "", hot: !!preset.powerplant.hot }
    : null;

  return { name: preset.label ?? "", servos, weapons, shields, movementSystems, powerplant };
}

/**
 * Build an update payload from a CREATURE_PRESETS entry, following the
 * character body-plan/enemy model (bodyPlan + BOD + naturalWeapons) rather
 * than mecha construction. Natural armor SP is stamped once onto all six
 * body locations (flat, per the book's only creature-armor rule); BOD-driven
 * hit points still come from the existing prepareDerivedData pass.
 * @param {object} preset - an entry from CREATURE_PRESETS
 */
export function buildCreaturePresetUpdate(preset) {
  const naturalWeapons = padTo(
    (preset.naturalWeapons ?? []).map(w => ({ name: w.name ?? "", damage: w.damage ?? "", type: w.type ?? "" })),
    NATURAL_WEAPON_SLOTS,
    () => ({ name: "", damage: "", type: "" })
  );
  const sp = Number(preset.armorSP) || 0;
  const locations = {};
  for (const key of ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"]) locations[key] = { sp, spMax: sp };

  return {
    name: preset.label ?? "",
    bod: preset.bod ?? 5,
    bodyPlan: preset.bodyPlan ?? "",
    armorSP: sp,
    naturalWeapons,
    locations,
  };
}

export { MECHA_PRESETS, CREATURE_PRESETS };
