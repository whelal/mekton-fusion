/**
 * mekton-fusion: Armor Coverage (Sample Armor Coverage table)
 * ---------------------------------------------------------------
 * A piece of "Single"-location armor (Ballistic Mesh, Multi-Polymer Plate)
 * isn't bought for a specific hit-zone -- it's bought as a garment SHAPE
 * (Hat, Vest, Jacket, Overcoat, Pants, Shorts, Boots), and the book's Sample
 * Armor Coverage table fixes which hit-zone(s) each shape actually protects.
 * The same SP tier (e.g. "Medium Mesh") can be worn as any shape -- a
 * player can have "Light Mesh" pants and a "Medium Mesh" shirt at once,
 * each covering its own zones. This is per-item, not per-tier, so it lives
 * on the Item (system.coverage), not baked into which catalog entry it is.
 *
 * "All" (Space Suit, Powered Armor, both Force Screens) and "Handheld"
 * (Shield -- not tied to a hit-zone at all) aren't in the book's coverage
 * table but need a slot in this same vocabulary since they drive the same
 * equip logic (see _equipArmorToBody in actor-sheet.js).
 *
 * Known simplification: the book's table distinguishes R./L. Thigh (7, 9)
 * from R./L. Lower Leg (8, 10), so Pants (7-8/9-10, full leg), Shorts
 * (7/9, thigh only) and Boots (8/10, lower leg only) are three genuinely
 * different coverage areas in the book. This system's body model only
 * tracks whole legs (rLeg/lLeg, matching the Human Random Hit Chart's
 * 7-8/9-10 split) -- no thigh/lower-leg distinction exists to map onto, so
 * all three resolve to the same locations here. They're kept as distinct,
 * separately-labeled options anyway (for correct naming/flavor and so a
 * future thigh/lower-leg split doesn't need new vocabulary, just updated
 * location arrays here) rather than collapsed into one option.
 */

export const ARMOR_COVERAGE = {
  hat:      { label: "Hat, Cap, Helmet",         locations: ["head"] },
  vest:     { label: "T-Shirt, Vest",            locations: ["torso"] },
  jacket:   { label: "Shirt, Jacket, Coat",      locations: ["torso", "rArm", "lArm"] },
  overcoat: { label: "Overcoat, Cloak",          locations: ["torso", "rArm", "lArm", "rLeg", "lLeg"] },
  pants:    { label: "Pants, Slacks, Long Skirt", locations: ["rLeg", "lLeg"] },
  shorts:   { label: "Shorts, Tunic, Skirt",     locations: ["rLeg", "lLeg"] },
  boots:    { label: "Boots, Leggings",          locations: ["rLeg", "lLeg"] },
  all:      { label: "All (every hit-zone)",     locations: ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"] },
  handheld: { label: "Handheld (not slotted)",   locations: [] }
};
