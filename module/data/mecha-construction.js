/**
 * mekton-fusion: Mecha Construction Data (Scope A)
 * -----------------------------------------------
 * Verified against Construction Table 1 & 2. Derived Cost/Space/Kills/Weight
 * per servo location, so these stop being manual fields.
 *
 * IMPORTANT: each location has its OWN column values -- Torso, Arm, Leg,
 * Head/Wing/Tail, and Pod do NOT share one progression. Do not collapse them.
 *
 * `abbr` is a 1-3 char label for tight dropdowns (e.g. "LH" = Light Heavy).
 * Values are game mechanics (numbers); no rulebook prose reproduced.
 */

// Canonical class order + short labels. Used by every location table.
export const SERVO_CLASS_META = [
  { key: "superlight",    label: "Superlight",     abbr: "SL"  },
  { key: "lightweight",   label: "Light Weight",   abbr: "LW"  },
  { key: "striker",       label: "Striker",        abbr: "St"  },
  { key: "mediumstriker", label: "Medium Striker", abbr: "MSt" },
  { key: "heavystriker",  label: "Heavy Striker",  abbr: "HSt" },
  { key: "mediumweight",  label: "Medium Weight",  abbr: "MW"  },
  { key: "lightheavy",    label: "Light Heavy",    abbr: "LH"  },
  { key: "mediumheavy",   label: "Medium Heavy",   abbr: "MH"  },
  { key: "armoredheavy",  label: "Armored Heavy",  abbr: "AH"  },
  { key: "superheavy",    label: "Super Heavy",    abbr: "SH"  },
  { key: "megaheavy",     label: "Mega Heavy",     abbr: "MgH" },
];

export const SERVO_CLASS_INDEX = Object.fromEntries(SERVO_CLASS_META.map((c, i) => [c.key, i]));

// Build a per-location table from parallel arrays (index-aligned to
// SERVO_CLASS_META). Keeps the numbers readable as columns.
function buildTable(cols) {
  const out = {};
  SERVO_CLASS_META.forEach((meta, i) => {
    const row = { ...meta };
    for (const [field, arr] of Object.entries(cols)) row[field] = arr[i];
    out[meta.key] = row;
  });
  return out;
}

// TORSO SERVO -- cost/space/kills all equal, step 2; weight 1..11 tons.
export const TORSO_SERVO = buildTable({
  cost:       [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  space:      [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  kills:      [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  weightTons: [1, 2, 3, 4, 5,  6,  7,  8,  9,  10, 11],
});

// ARM SERVO -- cost/space/kills step 1 (2..12); plus damage Add and Throw hexes.
export const ARM_SERVO = buildTable({
  cost:       [2,   3, 4,   5, 6,   7, 8,   9, 10,  11, 12 ],
  space:      [2,   3, 4,   5, 6,   7, 8,   9, 10,  11, 12 ],
  kills:      [2,   3, 4,   5, 6,   7, 8,   9, 10,  11, 12 ],
  add:        [0,   0, 0,   1, 1,   1, 2,   2, 2,   3,  3  ],
  throwHexes: [3,   3, 4,   4, 5,   5, 6,   6, 7,   7,  8  ],
  weightTons: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,  5.5],
});

// LEG SERVO -- cost/space/kills step 1 (2..12); plus kick Add.
export const LEG_SERVO = buildTable({
  cost:       [2,   3, 4,   5, 6,   7, 8,   9, 10,  11, 12 ],
  space:      [2,   3, 4,   5, 6,   7, 8,   9, 10,  11, 12 ],
  kills:      [2,   3, 4,   5, 6,   7, 8,   9, 10,  11, 12 ],
  add:        [0,   0, 1,   1, 2,   2, 3,   3, 4,   4,  5  ],
  weightTons: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,  5.5],
});

// HEAD / WING / TAIL SERVO -- own progression. Cost 1,2,3..11 per book column;
// space & kills 1..11; weight 0.5..5.5.
export const HEAD_WING_TAIL_SERVO = buildTable({
  cost:       [1,   2, 3,   4, 5,   6, 7,   8, 9,   10, 11 ],
  space:      [1,   2, 3,   4, 5,   6, 7,   8, 9,   10, 11 ],
  kills:      [1,   2, 3,   4, 5,   6, 7,   8, 9,   10, 11 ],
  weightTons: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,  5.5],
});

// POD SERVO -- cost 1..11, space is DOUBLE cost, kills always 0, weight 0.
export const POD_SERVO = buildTable({
  cost:       [1, 2, 3, 4,  5,  6,  7,  8,  9,  10, 11],
  space:      [2, 4, 6, 8,  10, 12, 14, 16, 18, 20, 22],
  kills:      [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0 ],
  weightTons: [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0 ],
});

// ARMOR -- cost = SP = 1..11, weight 0.5..5.5. Bought per servo separately.
export const ARMOR = buildTable({
  cost:       [1,   2, 3,   4, 5,   6, 7,   8, 9,   10, 11 ],
  sp:         [1,   2, 3,   4, 5,   6, 7,   8, 9,   10, 11 ],
  weightTons: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,  5.5],
});

// Mecha servo rows are a fixed 6-slot array on the actor; this is the location
// each slot represents and the deriveServo() "location" kind it maps to. Each
// location has its own construction table (Torso/Arm/Leg/Head all differ), so
// this mapping matters -- shared by ActorDataModel and the preset loader.
export const SERVO_ROW_LOCATIONS = [
  { key: "head", label: "Head", kind: "head" },
  { key: "torso", label: "Torso", kind: "torso" },
  { key: "rArm", label: "R Arm", kind: "arm" },
  { key: "lArm", label: "L Arm", kind: "arm" },
  { key: "rLeg", label: "R Leg", kind: "leg" },
  { key: "lLeg", label: "L Leg", kind: "leg" },
];

// Location -> table lookup.
export const LOCATION_TABLES = {
  torso: TORSO_SERVO,
  arm:   ARM_SERVO,
  leg:   LEG_SERVO,
  head:  HEAD_WING_TAIL_SERVO,
  wing:  HEAD_WING_TAIL_SERVO,
  tail:  HEAD_WING_TAIL_SERVO,
  pod:   POD_SERVO,
};

// ARM extremities: Cost / Space / Damage(K) / Kills / manipulation / weight.
// Verified against the book's ARM EXT. table -- Hand is the only one with
// fine manipulation ("Yes"); Claw/Talon/Pincer are all "No".
export const ARM_EXTREMITIES = {
  hand:   { label: "Hand",   abbr: "Hd", cost: 2, space: 1, damageK: 1, kills: 1, manipulation: true,  weightTons: 0.5 },
  claw:   { label: "Claw",   abbr: "Cl", cost: 4, space: 1, damageK: 2, kills: 2, manipulation: false, weightTons: 1   },
  talon:  { label: "Talon",  abbr: "Tl", cost: 1, space: 1, damageK: 2, kills: 2, manipulation: false, weightTons: 1   },
  pincer: { label: "Pincer", abbr: "Pn", cost: 2, space: 1, damageK: 3, kills: 3, manipulation: false, weightTons: 1.5 },
};

// LEG extremities: Cost / Space(0) / Damage(K) / Kills / MA penalty / weight.
// Legs must have Feet (free).
export const LEG_EXTREMITIES = {
  foot:  { label: "Foot",  abbr: "Ft", cost: 0, space: 0, damageK: 2, kills: 0, maPenalty: 0,  weightTons: 0   },
  claw:  { label: "Claw",  abbr: "Cl", cost: 1, space: 0, damageK: 3, kills: 1, maPenalty: -1, weightTons: 0.5 },
  talon: { label: "Talon", abbr: "Tl", cost: 2, space: 0, damageK: 5, kills: 3, maPenalty: -2, weightTons: 1.5 },
};

// SENSORS -- Cost / Space / Kills / Weight.
export const SENSORS = {
  main:   { label: "Main Sensors",   cost: 4, space: 1, kills: 2, weightTons: 1 },
  backup: { label: "Backup Sensors", cost: 2, space: 2, kills: 2, weightTons: 1 },
};

// COCKPIT -- Cost / Space / Crew / Weight.
export const COCKPIT = {
  main:      { label: "Main Cockpit",    cost: 0, space: 1, crew: 1,    weightTons: 0 },
  passenger: { label: "Passenger Space", cost: 1, space: 1, crewMod: 1, weightTons: 0 },
};

// --- Helpers ---------------------------------------------------------------

export function getServoRow(location, classKey) {
  const table = LOCATION_TABLES[location] ?? TORSO_SERVO;
  return table[classKey] ?? null;
}

/**
 * Derive a fully-specified servo for a location, including extremity.
 * @param {string} classKey
 * @param {"torso"|"arm"|"leg"|"head"|"wing"|"tail"|"pod"} location
 * @param {string} [extremityKey]
 */
export function deriveServo(classKey, location, extremityKey) {
  const base = getServoRow(location, classKey);
  if (!base) return null;

  const out = {
    class: classKey,
    abbr: base.abbr,
    location,
    cost: base.cost,
    space: base.space,
    kills: base.kills,
    weightTons: base.weightTons,
  };
  if (base.add !== undefined) out.add = base.add;
  if (base.throwHexes !== undefined) out.throwHexes = base.throwHexes;

  if (location === "arm" && extremityKey && ARM_EXTREMITIES[extremityKey]) {
    const e = ARM_EXTREMITIES[extremityKey];
    out.extremity = { key: extremityKey, ...e };
    out.cost += e.cost;
    out.weightTons += e.weightTons;
    // extremity Space is tracked separately in the book; expose it, don't fold.
    out.extremitySpace = e.space;
  } else if (location === "leg") {
    const ek = (extremityKey && LEG_EXTREMITIES[extremityKey]) ? extremityKey : "foot";
    const e = LEG_EXTREMITIES[ek];
    out.extremity = { key: ek, ...e };
    out.cost += e.cost;
    out.weightTons += e.weightTons;
    out.maPenalty = e.maPenalty;
  }
  return out;
}

/** Armor row (cost/SP/weight) for a class applied to a servo. */
export function deriveArmor(classKey) {
  return ARMOR[classKey] ?? null;
}

/** Leg must be at least one level below torso to walk. */
export function legIsLegalForTorso(legClassKey, torsoClassKey) {
  const leg = SERVO_CLASS_INDEX[legClassKey];
  const torso = SERVO_CLASS_INDEX[torsoClassKey];
  if (leg === undefined || torso === undefined) return false;
  return leg <= torso - 1;
}
