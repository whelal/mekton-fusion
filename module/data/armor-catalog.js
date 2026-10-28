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
 *   SP -> baseSP (int). Personal Force Screen's SP is "3D6" (rolled once, not
 *     a flat value) -- that can't live in a NumberField without fabricating a
 *     number the book didn't give, so it's captured verbatim in spNote and
 *     baseSP is left at 0 for the GM to roll and fill in themselves.
 *   Location -> kind + coverage (see module/data/armor-coverage.js):
 *     "Single" location items (Ballistic Mesh, Multi-Polymer Plate) are
 *       bought as a garment SHAPE, not a fixed zone -- the book's Sample
 *       Armor Coverage table decides what that shape protects, and the same
 *       SP tier can be worn as any shape. Their coverage is picked when the
 *       piece is dropped on a character (the catalog default is a vest), and
 *       their weight/cost are per Single location, charged per covered zone.
 *     Helmets, suits, Flight Jacket and Powered Armor have fixed coverage
 *       and fixed table weight/cost.
 *   hardness: set explicitly per entry (table ruling, ROADMAP.md), never
 *     derived from SP. The force screens are hard (0.3.29: they stop Bruise
 *     attacks like plate; their other mechanics stay parked). Shield is parked
 *     (kind "other", hardness unset).
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

import { ARMOR_KINDS, effectiveCoverage } from "./armor-coverage.js";
import { seedZoneSP } from "./armor.js";

/** Build one catalog entry; keeps the array below terse and reviewable. */
function armor(name, { category, kind, tier = "", hardness = "", baseSP = 0, spNote = "", coverage = ["torso"], weight = 0, cost = 0, tl = 0, img }) {
  const zones = effectiveCoverage({ kind, coverage: ARMOR_KINDS[kind]?.coverage ?? coverage });
  return {
    name,
    type: "armor",
    img,
    system: { name, category, kind, tier, hardness, baseSP, spNote, coverage: zones, currentSP: seedZoneSP(zones, baseSP), weight, cost, tl }
  };
}

export const ARMOR_CATALOG = [
  // --- BALLISTIC MESH (soft; garment shape chosen per piece; weight/cost per Single location) ---
  armor("Light Mesh",  { category: "Ballistic Mesh", kind: "mesh", tier: "light",  hardness: "soft", baseSP: 10, weight: 0.2, cost: 38, img: "icons/equipment/chest/vest-bulletproof-body-camo.webp" }),
  armor("Medium Mesh", { category: "Ballistic Mesh", kind: "mesh", tier: "medium", hardness: "soft", baseSP: 12, weight: 0.3, cost: 47, img: "icons/equipment/chest/vest-bulletproof-body-green.webp" }),
  armor("Heavy Mesh",  { category: "Ballistic Mesh", kind: "mesh", tier: "heavy",  hardness: "soft", baseSP: 15, weight: 0.4, cost: 56, img: "icons/equipment/chest/vest-bulletproof-body-armor.webp" }),
  armor("Flak Mesh",   { category: "Ballistic Mesh", kind: "mesh", tier: "flak",   hardness: "soft", baseSP: 18, weight: 0.5, cost: 65, img: "icons/equipment/chest/bullet-proof-vest-kevlar.webp" }),

  // --- FULL UTILITY HELMET (hard; always head only) ---
  armor("Light Helmet",  { category: "Full Utility Helmet", kind: "helmet", tier: "light",  hardness: "hard", baseSP: 20, weight: 1.6, cost: 106, img: "icons/equipment/head/helmet-tech-light.webp" }),
  armor("Medium Helmet", { category: "Full Utility Helmet", kind: "helmet", tier: "medium", hardness: "hard", baseSP: 23, weight: 1.8, cost: 117, img: "icons/equipment/head/helmet-tech-tactical.webp" }),
  armor("Heavy Helmet",  { category: "Full Utility Helmet", kind: "helmet", tier: "heavy",  hardness: "hard", baseSP: 25, weight: 2.0, cost: 128, img: "icons/equipment/head/helm-armored-tech-heavy.webp" }),

  // --- MULTI-POLYMER PLATE (hard; garment shape chosen per piece; weight/cost per Single location) ---
  armor("Light Plate",  { category: "Multi-Polymer Plate", kind: "plate", tier: "light",  hardness: "hard", baseSP: 20, weight: 0.5, cost: 98,  img: "icons/equipment/chest/vest-tactical-reinforced.webp" }),
  armor("Medium Plate", { category: "Multi-Polymer Plate", kind: "plate", tier: "medium", hardness: "hard", baseSP: 23, weight: 0.6, cost: 108, img: "icons/equipment/chest/vest-improvised-plated-medium.webp" }),
  armor("Heavy Plate",  { category: "Multi-Polymer Plate", kind: "plate", tier: "heavy",  hardness: "hard", baseSP: 25, weight: 1.0, cost: 119, img: "icons/equipment/chest/vest-improvised-plated-heavy.webp" }),

  // --- SPACE SUIT (all 8 zones; Standard/Industrial soft, Military hard) ---
  armor("Standard Suit",   { category: "Space Suit", kind: "suit", tier: "standard",   hardness: "soft", baseSP: 5,  weight: 1.6, cost: 260, img: "icons/equipment/body/suit-biohazard-protection.webp" }),
  armor("Industrial Suit", { category: "Space Suit", kind: "suit", tier: "industrial", hardness: "soft", baseSP: 15, weight: 3.4, cost: 502, img: "icons/equipment/body/suit-medical-biohazard-protection.webp" }),
  armor("Military Suit",   { category: "Space Suit", kind: "suit", tier: "military",   hardness: "hard", baseSP: 25, weight: 7.0, cost: 785, img: "icons/equipment/body/suit-military-flight.webp" }),

  // --- OTHER ARMOR ---
  armor("Flight Jacket", { category: "Other Armor", kind: "flightJacket", hardness: "soft", baseSP: 12, weight: 1.2,  cost: 300,  img: "icons/equipment/chest/jacket-military-flight-green.webp" }),
  armor("Powered Armor", { category: "Other Armor", kind: "poweredArmor", hardness: "hard", baseSP: 28, weight: 43.0, cost: 1056, img: "icons/equipment/body/armor-coveralls.webp" }),
  // Parked (ROADMAP.md): shields at human scale and force screens. Kind "other", hardness unset.
  armor("Shield",                { category: "Other Armor", kind: "other", baseSP: 15, coverage: [], weight: 1.5, cost: 142,  img: "icons/equipment/shield/heater-steel-grey.webp" }),
  armor("Personal Force Screen", { category: "Other Armor", kind: "other", hardness: "hard", baseSP: 0, spNote: "3D6", coverage: ["head", "torso", "rArm", "lArm", "rThigh", "rLowerLeg", "lThigh", "lLowerLeg"], weight: 5.0, cost: 1800, img: "icons/svg/shield.svg" }),
  armor("Advanced Force Screen", { category: "Other Armor", kind: "other", hardness: "hard", baseSP: 18, coverage: ["head", "torso", "rArm", "lArm", "rThigh", "rLowerLeg", "lThigh", "lLowerLeg"], weight: 0.5, cost: 2500, img: "icons/svg/mage-shield.svg" })
];
