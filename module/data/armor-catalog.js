/**
 * mekton-fusion: Personal Armor Catalog
 * ---------------------------------------
 * Source data for the "Personal Armor (MZ)" compendium pack, transcribed
 * from the Mekton Zeta Personal Armor Table. Plain data, not hand-authored
 * LevelDB -- module/build-armor-pack.js reads this array to (re)generate the
 * pack (via macros/build-armor-pack.macro.js, in-world, no tooling needed),
 * so the catalog stays reviewable.
 *
 * Column mapping from the book table -> schema fields:
 *   SP -> sp (int). Personal Force Screen's SP is "3D6" (rolled once, not a
 *     flat value) -- that can't live in a NumberField without fabricating a
 *     number the book didn't give, so it's captured verbatim in spNote and
 *     sp is left at 0 for the GM to roll and fill in themselves.
 *   Location -> coverage (see module/data/armor-coverage.js, ARMOR_COVERAGE,
 *     for the full vocabulary and what hit-zones each value resolves to):
 *     "Single" location items (Ballistic Mesh, Multi-Polymer Plate) are
 *       bought as a garment SHAPE, not a fixed zone -- the book's Sample
 *       Armor Coverage table (Hat/Vest/Jacket/Overcoat/Pants/Shorts/Boots)
 *       decides what that shape actually protects, and the same SP tier can
 *       be worn as any shape (a player's "Medium Mesh" could be a shirt
 *       while their "Light Mesh" is pants). The catalog default below
 *       (`vest`, torso only) is just a starting point -- change it on the
 *       Item sheet's Coverage field per how a given piece is actually worn.
 *       Full Utility Helmets are the one "Single" category that's NOT
 *       freely choosable -- a helmet is always `hat` (head only).
 *     "All" -> "all"   "Handheld" -> "handheld"
 *     Flight Jacket (book: "Torso & Arms") maps onto `jacket`, which
 *       ARMOR_COVERAGE already defines as torso+both arms -- same coverage,
 *       reusing the shared vocabulary instead of a one-off value.
 *   Weight (kg) -> weight   Cost -> cost   TL -> not given per-item in this
 *     table (left 0; unlike the Personal Weapons Table, this table has no TL
 *     column).
 *
 * Icons: verified against the actual Foundry install's
 * public/icons/equipment/{chest,head,body,shield}/ and public/icons/svg/
 * trees (same methodology as weapon-catalog.js, after two earlier
 * guessed-path failures there). Foundry's set skews fantasy/modern-mundane,
 * so exact "personal force screen" art doesn't exist -- the two Force
 * Screen entries use svg/shield.svg and svg/mage-shield.svg as the closest
 * available reads.
 */

/** Build one catalog entry; keeps the array below terse and reviewable. */
function armor(name, { category, sp = 0, spNote = "", coverage = "vest", weight = 0, cost = 0, tl = 0, img }) {
  return {
    name,
    type: "armor",
    img,
    system: { name, category, sp, spNote, coverage, weight, cost, tl }
  };
}

export const ARMOR_CATALOG = [
  // --- BALLISTIC MESH (garment shape chosen per-piece; defaults to a vest/shirt) ---
  armor("Light Mesh",  { category: "Ballistic Mesh", sp: 10, coverage: "vest", weight: 0.2, cost: 38, img: "icons/equipment/chest/vest-bulletproof-body-camo.webp" }),
  armor("Medium Mesh", { category: "Ballistic Mesh", sp: 12, coverage: "vest", weight: 0.3, cost: 47, img: "icons/equipment/chest/vest-bulletproof-body-green.webp" }),
  armor("Heavy Mesh",  { category: "Ballistic Mesh", sp: 15, coverage: "vest", weight: 0.4, cost: 56, img: "icons/equipment/chest/vest-bulletproof-body-armor.webp" }),
  armor("Flak Mesh",   { category: "Ballistic Mesh", sp: 18, coverage: "vest", weight: 0.5, cost: 65, img: "icons/equipment/chest/bullet-proof-vest-kevlar.webp" }),

  // --- FULL UTILITY HELMET (always head-only) ---
  armor("Light Helmet",  { category: "Full Utility Helmet", sp: 20, coverage: "hat", weight: 1.6, cost: 106, img: "icons/equipment/head/helmet-tech-light.webp" }),
  armor("Medium Helmet", { category: "Full Utility Helmet", sp: 23, coverage: "hat", weight: 1.8, cost: 117, img: "icons/equipment/head/helmet-tech-tactical.webp" }),
  armor("Heavy Helmet",  { category: "Full Utility Helmet", sp: 25, coverage: "hat", weight: 2.0, cost: 128, img: "icons/equipment/head/helm-armored-tech-heavy.webp" }),

  // --- MULTI-POLYMER PLATE (garment shape chosen per-piece; defaults to a vest/shirt) ---
  armor("Light Plate",  { category: "Multi-Polymer Plate", sp: 20, coverage: "vest", weight: 0.5, cost: 98,  img: "icons/equipment/chest/vest-tactical-reinforced.webp" }),
  armor("Medium Plate", { category: "Multi-Polymer Plate", sp: 23, coverage: "vest", weight: 0.6, cost: 108, img: "icons/equipment/chest/vest-improvised-plated-medium.webp" }),
  armor("Heavy Plate",  { category: "Multi-Polymer Plate", sp: 25, coverage: "vest", weight: 1.0, cost: 119, img: "icons/equipment/chest/vest-improvised-plated-heavy.webp" }),

  // --- SPACE SUIT (every hit-zone, including head) ---
  armor("Standard Suit",   { category: "Space Suit", sp: 5,  coverage: "all", weight: 1.6, cost: 260, img: "icons/equipment/body/suit-biohazard-protection.webp" }),
  armor("Industrial Suit", { category: "Space Suit", sp: 15, coverage: "all", weight: 3.4, cost: 502, img: "icons/equipment/body/suit-medical-biohazard-protection.webp" }),
  armor("Military Suit",   { category: "Space Suit", sp: 25, coverage: "all", weight: 7.0, cost: 785, img: "icons/equipment/body/suit-military-flight.webp" }),

  // --- OTHER ARMOR ---
  armor("Shield",                 { category: "Other Armor", sp: 15, coverage: "handheld", weight: 1.5,  cost: 142,  img: "icons/equipment/shield/heater-steel-grey.webp" }),
  armor("Flight Jacket",          { category: "Other Armor", sp: 12, coverage: "jacket",    weight: 1.2, cost: 300,  img: "icons/equipment/chest/jacket-military-flight-green.webp" }),
  armor("Powered Armor",          { category: "Other Armor", sp: 28, coverage: "all",       weight: 43.0, cost: 1056, img: "icons/equipment/body/armor-coveralls.webp" }),
  armor("Personal Force Screen",  { category: "Other Armor", sp: 0, spNote: "3D6", coverage: "all", weight: 5.0, cost: 1800, img: "icons/svg/shield.svg" }),
  armor("Advanced Force Screen",  { category: "Other Armor", sp: 18, coverage: "all", weight: 0.5, cost: 2500, img: "icons/svg/mage-shield.svg" })
];
