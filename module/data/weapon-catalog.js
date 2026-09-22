/**
 * mekton-fusion: Personal Weapons Catalog (Scope: human-scale only)
 * -------------------------------------------------------------------
 * Source data for the "Personal Weapons (MZ)" compendium pack, transcribed
 * from the Mekton Zeta Personal Weapons Table. Plain data, not hand-authored
 * LevelDB -- scripts/build-packs.mjs (Node) or
 * macros/build-weapons-pack.macro.js (in-world, no Node needed) both read
 * this array to (re)generate the pack, so the catalog stays reviewable.
 *
 * Column mapping from the book table -> schema fields:
 *   WA -> wa (signed int)   Range -> range (string; "T" = thrown)
 *   Damage -> damage (string; trailing "+" is the BODY TYPE mod trigger --
 *     kept in damage, not stripped)   Shots -> shots (string; "na", "10
 *     turns", "40D6" (energy charge), etc. -- never coerced)
 *   BV -> bv (string; "na" or "(2)" preserved as-is)   Conc -> conc (P/J/L/N)
 *   Weight -> weight (kg)   TL -> tl
 *   Cost -> the book's "weapon/ammo" pair splits into two schema fields:
 *     `cost` (weapon price) and `ammoCost` (price per reload/clip).
 *   "[AP]" / "*" markers -> damageNote (mirrors mecha-weapon damageNote).
 *
 * Skill mapping (locked):
 *   MELEE section -> "blade", except Whip -> "whip". No per-item judgment.
 *   Archery (Bow/Compound Bow/Crossbow/Wrist-Crossbow) -> "archery"
 *   Handguns -> "handgun"   SMGs -> "automatic-weapon"   Rifles -> "rifle"
 *   Shotguns -> "rifle" (shoulder arm; MZ has no shotgun skill)
 *   Heavy weapons (human-scale only): Gatling Gun/Machinegun ->
 *     "automatic-weapon"; grenades are thrown/T range -- left skill:"" for
 *     GM call.
 *   EXCLUDED entirely (Mekton-scale K-damage in human hands -- can't resolve
 *     against body.locations in hits until the scale system exists):
 *     Anti-Mecha Mine (10K), Anti-Mek Beamgun (6K), Anti-Mek Missile (8K),
 *     Armor-Buster Rifle (50h-AP).
 *
 * Icons: earlier passes guessed at specific asset paths without verifying
 * they existed and shipped broken images. These are all confirmed present by
 * listing the actual Foundry install's public/icons/weapons/ tree (guns/,
 * bows/, crossbows/, thrown/, swords/, axes/, etc. all ship with core
 * Foundry). Foundry's icon set skews fantasy, so a few (Chainsaw, Energy/
 * Mono- weapons, Needle guns) are the closest available reads rather than
 * exact matches -- swap for better sci-fi art later if desired.
 */

/** Build one catalog entry; keeps the array below terse and reviewable. */
function weapon(name, { wa, range, damage, damageNote = "", shots, bv, conc = "", weight = 0, cost = 0, ammoCost = 0, tl = 0, skill, note = "", img }) {
  return {
    name,
    type: "weapon",
    img,
    system: { name, wa, range, damage, damageNote, shots, bv, conc, weight, cost, ammoCost, tl, skill, isMecha: false, note }
  };
}

export const WEAPON_CATALOG = [
  // --- MELEE WEAPONS -> "blade" except Whip -> "whip" ---
  weapon("Battleaxe",           { wa: -1, range: "2", damage: "2D10+", damageNote: "[AP]", shots: "na", bv: "na", conc: "N", weight: 3.5,   cost: 70,   tl: 2, skill: "blade", img: "icons/weapons/axes/axe-battle-simple.webp" }),
  weapon("Boomerang",           { wa: -1, range: "T", damage: "1D6+",  shots: "na", bv: "na", conc: "L", weight: 0.6,   cost: 48,   tl: 2, skill: "blade", img: "icons/weapons/thrown/boomerang.webp" }),
  weapon("Broadsword",          { wa: 0,  range: "2", damage: "3D6+",  damageNote: "[AP]", shots: "na", bv: "na", conc: "N", weight: 3.0,   cost: 84,   tl: 2, skill: "blade", img: "icons/weapons/swords/sword-broad-worn.webp" }),
  weapon("Chainsaw",            { wa: -1, range: "2", damage: "3D6+",  damageNote: "[AP]", shots: "10", bv: "na", conc: "N", weight: 3.0,   cost: 54,   tl: 5, skill: "blade", img: "icons/weapons/swords/machete.webp" }),
  weapon("Combat Knife",        { wa: 0,  range: "1", damage: "1D6+",  damageNote: "[AP]", shots: "na", bv: "na", conc: "J", weight: 0.5,   cost: 50,   tl: 3, skill: "blade", img: "icons/weapons/daggers/knife-simple.webp" }),
  weapon("Dagger",              { wa: 0,  range: "1", damage: "1D6/2+", damageNote: "[AP]", shots: "na", bv: "na", conc: "P", weight: 0.3,   cost: 18,   tl: 2, skill: "blade", img: "icons/weapons/daggers/dagger-simple-black.webp" }),
  weapon("Energy Sword",        { wa: 1,  range: "2", damage: "5D6",   shots: "10", bv: "na", conc: "J", weight: 0.25,  cost: 470,  tl: 7, skill: "blade", img: "icons/weapons/swords/sword-runed-glowing.webp" }),
  weapon("Force Staff",         { wa: 2,  range: "4", damage: "5D6",   shots: "10 turns", bv: "na", conc: "P", weight: 0.25,  cost: 1010, tl: 8, skill: "blade", img: "icons/weapons/staves/staff-simple.webp" }),
  weapon("Hand Taser (Shock)",  { wa: 0,  range: "2", damage: "-2",    shots: "10 shots", bv: "1", conc: "J", weight: 1.0,   cost: 210,  tl: 5, skill: "blade", img: "icons/weapons/clubs/baton-energy-stun-silver-yellow.webp" }),
  weapon("Mace",                { wa: -1, range: "2", damage: "3D6+",  shots: "na", bv: "na", conc: "N", weight: 3.0,   cost: 60,   tl: 2, skill: "blade", img: "icons/weapons/maces/mace-round-steel.webp" }),
  weapon("Monoknife",           { wa: 0,  range: "1", damage: "2D6+",  damageNote: "[AP]", shots: "na", bv: "na", conc: "J", weight: 0.5,   cost: 240,  tl: 6, skill: "blade", img: "icons/weapons/daggers/dagger-straight-thin-black.webp" }),
  weapon("Monosword",           { wa: 1,  range: "2", damage: "4D6+",  damageNote: "[AP]", shots: "na", bv: "na", conc: "J", weight: 1.0,   cost: 600,  tl: 6, skill: "blade", img: "icons/weapons/swords/sword-hilt-steel-green.webp" }),
  weapon("Nunchaku/Tonfa",      { wa: 0,  range: "2", damage: "1D10+", shots: "na", bv: "na", conc: "L", weight: 0.75,  cost: 105,  tl: 2, skill: "blade", img: "icons/weapons/misc/nunchaku.webp" }),
  weapon("Quarterstaff",        { wa: 2,  range: "4", damage: "1D6+",  shots: "na", bv: "na", conc: "N", weight: 1.0,   cost: 120,  tl: 1, skill: "blade", img: "icons/weapons/staves/staff-simple-brown.webp" }),
  weapon("Rapier",              { wa: 1,  range: "2", damage: "1D10+", damageNote: "[AP]", shots: "na", bv: "na", conc: "L", weight: 0.75,  cost: 75,   tl: 3, skill: "blade", img: "icons/weapons/swords/sword-simple-white.webp" }),
  weapon("Shuriken",            { wa: 0,  range: "T", damage: "1D6/2+", damageNote: "[AP]", shots: "na", bv: "na", conc: "P", weight: 0.2,   cost: 21,   tl: 2, skill: "blade", img: "icons/weapons/thrown/shuriken-blue.webp" }),
  weapon("Spear",               { wa: 2,  range: "4", damage: "2D6+",  damageNote: "[AP]", shots: "na", bv: "na", conc: "N", weight: 2.0,   cost: 120,  tl: 1, skill: "blade", img: "icons/weapons/polearms/spear-flared-steel.webp" }),
  weapon("Sword",               { wa: 1,  range: "2", damage: "2D6+",  damageNote: "[AP]", shots: "na", bv: "na", conc: "L", weight: 1.0,   cost: 100,  tl: 2, skill: "blade", img: "icons/weapons/swords/sword-guard.webp" }),
  weapon("Whip",                { wa: -1, range: "4", damage: "1D6/2+", shots: "na", bv: "na", conc: "L", weight: 0.125, cost: 15,   tl: 2, skill: "whip", img: "icons/weapons/misc/whip-leather.webp" }),

  // --- ARCHERY WEAPONS -> "archery" ---
  weapon("Bow",             { wa: -1, range: "12-72",  damage: "2D6",  shots: "1", bv: "1", conc: "N", weight: 1.0,  cost: 64,  tl: 3, skill: "archery", ammoCost: 3, img: "icons/weapons/bows/bow-simple-small.webp" }),
  weapon("Compound Bow",    { wa: -1, range: "20-200", damage: "3D6",  shots: "1", bv: "1", conc: "N", weight: 0.7,  cost: 304, tl: 4, skill: "archery", ammoCost: 15, img: "icons/weapons/bows/longbow-recurve.webp" }),
  weapon("Crossbow",        { wa: 0,  range: "15-100", damage: "2D6",  shots: "1", bv: "1", conc: "N", weight: 1.0,  cost: 90,  tl: 3, skill: "archery", ammoCost: 4.5, img: "icons/weapons/crossbows/crossbow-simple-brown.webp" }),
  weapon("Wrist-Crossbow",  { wa: -2, range: "8-32",   damage: "1D10", shots: "1", bv: "1", conc: "P", weight: 0.38, cost: 107, tl: 4, skill: "archery", ammoCost: 5, img: "icons/weapons/crossbows/handcrossbow-black.webp" }),

  // --- HANDGUNS -> "handgun" ---
  weapon("AutoMag",             { wa: 1, range: "15-100", damage: "3D6",   shots: "8",  bv: "1", conc: "J", weight: 1.5, cost: 437,  tl: 5, skill: "handgun", ammoCost: 22, img: "icons/weapons/guns/pistol-handgun-large.webp" }),
  weapon("Combat Pistol",       { wa: 0, range: "15-100", damage: "2D6",   shots: "15", bv: "1", conc: "J", weight: 1.0, cost: 310,  tl: 5, skill: "handgun", ammoCost: 19, img: "icons/weapons/guns/pistol-automatic.webp" }),
  weapon("Energy Pistol",       { wa: 2, range: "16-130", damage: "1-4D6", shots: "40D6", bv: "1", conc: "J", weight: 1.0, cost: 1256, tl: 7, skill: "handgun", ammoCost: 63, img: "icons/weapons/guns/pistol-energy-blaster.webp" }),
  weapon("Heavy Energy Pistol", { wa: 2, range: "18-160", damage: "5D6",   shots: "5",  bv: "1", conc: "J", weight: 1.1, cost: 1712, tl: 7, skill: "handgun", ammoCost: 86, img: "icons/weapons/guns/pistol-energy-plasma.webp" }),
  weapon("Hideout Pistol",      { wa: 0, range: "10-50",  damage: "1D10",  shots: "7",  bv: "1", conc: "P", weight: 0.75, cost: 96,  tl: 5, skill: "handgun", ammoCost: 5, img: "icons/weapons/guns/pistol-handgun-small.webp" }),
  weapon("Magnum Revolver",     { wa: 2, range: "16-130", damage: "4D6",   shots: "6",  bv: "1", conc: "J", weight: 2.0, cost: 1000, tl: 5, skill: "handgun", ammoCost: 50, img: "icons/weapons/guns/pistol-revolver-steel.webp" }),
  weapon("Needle Pistol",       { wa: 0, range: "10-50",  damage: "2D6",   damageNote: "*", shots: "20", bv: "1", conc: "J", weight: 0.5, cost: 344, tl: 6, skill: "handgun", ammoCost: 17, img: "icons/weapons/guns/pistol-tech-auto-snub-steel.webp" }),

  // --- SUBMACHINEGUNS -> "automatic-weapon" ---
  weapon("Machinepistol", { wa: 0, range: "15-100", damage: "2D6", shots: "20", bv: "5", conc: "J", weight: 1.0, cost: 472,  tl: 5, skill: "automatic-weapon", ammoCost: 24, img: "icons/weapons/guns/machine-pistol-silver-orange.webp" }),
  weapon("Needle SMG",    { wa: 0, range: "15-100", damage: "2D6", damageNote: "*", shots: "66", bv: "8", conc: "L", weight: 1.0, cost: 1120, tl: 6, skill: "automatic-weapon", ammoCost: 56, img: "icons/weapons/guns/submachine-gun-scope.webp" }),
  weapon("SMG",           { wa: 1, range: "20-200", damage: "2D6", shots: "50", bv: "5", conc: "L", weight: 2.0, cost: 945,  tl: 5, skill: "automatic-weapon", ammoCost: 47, img: "icons/weapons/guns/machine-gun-sub-large.webp" }),

  // --- RIFLES -> "rifle" ---
  weapon("Assault Rifle",      { wa: 0, range: "28-400", damage: "4D6",   shots: "50", bv: "5", conc: "N", weight: 4.0, cost: 1155, tl: 5, skill: "rifle", ammoCost: 58, img: "icons/weapons/guns/rifle-assault-carbine.webp" }),
  weapon("Energy Rifle",       { wa: 2, range: "30-450", damage: "1-6D6", shots: "60D6", bv: "1", conc: "N", weight: 3.0, cost: 756,  tl: 7, skill: "rifle", ammoCost: 38, img: "icons/weapons/guns/rifle-energy-blaster.webp" }),
  weapon("Heavy Energy Rifle", { wa: 2, range: "34-580", damage: "8D6",   shots: "5",  bv: "1", conc: "N", weight: 3.5, cost: 1454, tl: 7, skill: "rifle", ammoCost: 73, img: "icons/weapons/guns/rifle-energy-plasma.webp" }),
  weapon("Needle Rifle",       { wa: 1, range: "20-200", damage: "3D6",   damageNote: "*", shots: "66", bv: "8", conc: "N", weight: 1.5, cost: 1681, tl: 5, skill: "rifle", ammoCost: 84, img: "icons/weapons/guns/rifle-tech-green.webp" }),
  weapon("Sniper Rifle",       { wa: 2, range: "32-500", damage: "5D6",   shots: "10", bv: "1", conc: "N", weight: 5.0, cost: 775,  tl: 5, skill: "rifle", ammoCost: 39, img: "icons/weapons/guns/rifle-sniper-long.webp" }),

  // --- SHOTGUNS -> "rifle" (shoulder arm; MZ has no shotgun skill) ---
  weapon("Auto Shotgun",     { wa: 0, range: "15-100", damage: "2D10",   shots: "10", bv: "3", conc: "N", weight: 2.5, cost: 1040, tl: 5, skill: "rifle", ammoCost: 52, img: "icons/weapons/guns/shotgun-tech-green-yellow.webp" }),
  weapon("Shotgun",          { wa: 0, range: "15-100", damage: "2D10",   shots: "6",  bv: "1", conc: "L", weight: 2.5, cost: 742,  tl: 4, skill: "rifle", ammoCost: 37, img: "icons/weapons/guns/shotgun-pump.webp" }),
  weapon("2-Barrel Shotgun", { wa: 0, range: "10-50",  damage: "2D10x2", shots: "2",  bv: "(2)", conc: "J", weight: 2.5, cost: 286, tl: 5, skill: "rifle", ammoCost: 14, img: "icons/weapons/guns/gun-double-barrel.webp" }),

  // --- HEAVY WEAPONS (human-scale only) ---
  // Anti-Mecha Mine (10K), Anti-Mek Beamgun (6K), Anti-Mek Missile (8K), and
  // Armor-Buster Rifle (50h-AP) are EXCLUDED -- Mekton-scale damage in human
  // hands; they wait for the scale-conversion system.
  weapon("Gatling Gun", { wa: -1, range: "28-400", damage: "5D6", shots: "100", bv: "8", conc: "N", weight: 5.0, cost: 6336, tl: 4, skill: "automatic-weapon", ammoCost: 317, img: "icons/weapons/guns/gun-chain-gatling-heavy.webp" }),
  weapon("Machinegun",  { wa: 0,  range: "32-500", damage: "5D6", shots: "100", bv: "5", conc: "N", weight: 5.0, cost: 5040, tl: 5, skill: "automatic-weapon", ammoCost: 252, img: "icons/weapons/guns/machine-gun-silver.webp" }),
  weapon("Frag Grenade",       { wa: 0, range: "T", damage: "5D6/6m",   shots: "1", bv: "na", conc: "P", weight: 0.25, cost: 50,  tl: 4, skill: "", img: "icons/weapons/thrown/grenade-frag-green.webp" }),
  weapon("Incendiary Grenade", { wa: 0, range: "T", damage: "1D6/6m",   damageNote: "*", shots: "1", bv: "na", conc: "P", weight: 0.3,  cost: 100, tl: 4, skill: "", img: "icons/weapons/thrown/grenade-incendiary.webp" }),
  weapon("Sleep Grenade",      { wa: 0, range: "T", damage: "-3/6m",    shots: "1", bv: "na", conc: "P", weight: 0.15, cost: 10,  tl: 4, skill: "", img: "icons/weapons/thrown/grenade-tech-stun-cannister.webp" })
];
