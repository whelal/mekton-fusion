/**
 * mekton-fusion: Armor Coverage (MZ core, Personal Armor / Sample Armor Coverage)
 * ---------------------------------------------------------------
 * Armor is tracked on 8 zones keyed by the Human Random Hit Chart number;
 * damage still lands on the 6 body locations (`location` below). Hits on 7
 * and 8 both damage rLeg, 9 and 10 damage lLeg -- but a thigh-only garment
 * (Shorts) doesn't protect a hit on 8.
 *
 * `charge` is how many "Single"-location units a zone costs: Ballistic Mesh
 * and Multi-Polymer Plate list weight and cost per Single location, and a
 * thigh or lower leg is half a location (so Pants = 2, Shorts = 1).
 */

export const ARMOR_ZONES = {
  head:      { label: "Head",            hit: "1",   location: "head",  charge: 1 },
  torso:     { label: "Torso",           hit: "2-4", location: "torso", charge: 1 },
  rArm:      { label: "Right Arm",       hit: "5",   location: "rArm",  charge: 1 },
  lArm:      { label: "Left Arm",        hit: "6",   location: "lArm",  charge: 1 },
  rThigh:    { label: "Right Thigh",     hit: "7",   location: "rLeg",  charge: 0.5 },
  rLowerLeg: { label: "Right Lower Leg", hit: "8",   location: "rLeg",  charge: 0.5 },
  lThigh:    { label: "Left Thigh",      hit: "9",   location: "lLeg",  charge: 0.5 },
  lLowerLeg: { label: "Left Lower Leg",  hit: "10",  location: "lLeg",  charge: 0.5 }
};

export const ZONE_KEYS = Object.keys(ARMOR_ZONES);

/** Garment shapes a mesh or plate piece can be worn as. Anything else is "custom". */
export const COVERAGE_PRESETS = {
  hat:      { label: "Hat, Cap, Helmet",          zones: ["head"] },
  vest:     { label: "T-Shirt, Vest",             zones: ["torso"] },
  jacket:   { label: "Shirt, Jacket, Coat",       zones: ["torso", "rArm", "lArm"] },
  overcoat: { label: "Overcoat, Cloak",           zones: ["torso", "rArm", "lArm", "rThigh", "lThigh"] },
  pants:    { label: "Pants, Slacks",             zones: ["rThigh", "rLowerLeg", "lThigh", "lLowerLeg"] },
  shorts:   { label: "Shorts, Tunic, Skirt",      zones: ["rThigh", "lThigh"] },
  boots:    { label: "Boots, Leggings",           zones: ["rLowerLeg", "lLowerLeg"] }
};

/**
 * Armor kinds. `choosable`: coverage comes from the preset/custom picker
 * (mesh and plate only); otherwise `coverage` is fixed (null = whatever the
 * item has, for "other"). `pricing`: "perZone" charges weight/cost per zone
 * (see ARMOR_ZONES.charge), "fixed" uses the table value as-is. `hardness`
 * is only the default the migration and catalog use -- the item's own
 * system.hardness field is what counts (never derived from SP).
 * "other" holds the parked pieces (Shield, force screens): hardness unset.
 */
export const ARMOR_KINDS = {
  mesh:         { label: "Ballistic Mesh",      choosable: true,  coverage: null,                      pricing: "perZone", hardness: "soft" },
  plate:        { label: "Multi-Polymer Plate", choosable: true,  coverage: null,                      pricing: "perZone", hardness: "hard" },
  helmet:       { label: "Full Utility Helmet", choosable: false, coverage: ["head"],                  pricing: "fixed",   hardness: "hard" },
  suit:         { label: "Space Suit",          choosable: false, coverage: ZONE_KEYS,                 pricing: "fixed",   hardness: { standard: "soft", industrial: "soft", military: "hard" } },
  flightJacket: { label: "Flight Jacket",       choosable: false, coverage: ["torso", "rArm", "lArm"], pricing: "fixed",   hardness: "soft" },
  poweredArmor: { label: "Powered Armor",       choosable: false, coverage: ZONE_KEYS,                 pricing: "fixed",   hardness: "hard" },
  other:        { label: "Other",               choosable: false, coverage: null,                      pricing: "fixed",   hardness: "" }
};

/** Default hardness for a kind (+ tier, for suits); "" when there isn't one. */
export function defaultHardness(kind, tier) {
  const h = ARMOR_KINDS[kind]?.hardness;
  if (h && typeof h === "object") return h[tier] ?? "";
  return h ?? "";
}

/** Keep only real zone keys, in ZONE_KEYS order, no duplicates. */
export function cleanZones(zones) {
  const set = new Set(Array.isArray(zones) ? zones : []);
  return ZONE_KEYS.filter(z => set.has(z));
}

/** The preset key whose zones exactly match, or "custom". Empty coverage is "custom" too. */
export function presetForZones(zones) {
  const key = cleanZones(zones).join(",");
  for (const [k, p] of Object.entries(COVERAGE_PRESETS)) {
    if (cleanZones(p.zones).join(",") === key) return k;
  }
  return "custom";
}

/** Coverage an armor item ends up with: the kind's fixed set, or its own zones. */
export function effectiveCoverage(system) {
  const fixed = ARMOR_KINDS[system?.kind]?.coverage;
  return cleanZones(fixed ?? system?.coverage);
}

/**
 * Total weight and cost of an armor item. Mesh/plate: the table value is per
 * Single location, charged per covered zone. Everything else: the table value.
 */
export function armorTotals(system) {
  const weight = Number(system?.weight) || 0;
  const cost = Number(system?.cost) || 0;
  if (ARMOR_KINDS[system?.kind]?.pricing !== "perZone") return { units: null, weight, cost };
  const units = effectiveCoverage(system).reduce((n, z) => n + ARMOR_ZONES[z].charge, 0);
  return {
    units,
    weight: Math.round(weight * units * 100) / 100,
    cost: Math.round(cost * units * 100) / 100
  };
}

/** Pre-0.3.24 coverage strings -> zone sets. "handheld" covered nothing. */
export const LEGACY_COVERAGE = {
  ...Object.fromEntries(Object.entries(COVERAGE_PRESETS).map(([k, p]) => [k, p.zones])),
  all: ZONE_KEYS,
  handheld: []
};
