/**
 * mekton-fusion: catalog icon replacement (personal armor and weapons)
 * --------------------------------------------------------------------
 * The armor and weapon catalogs' icons now use only paths verified in the
 * local Foundry v13.351 install (tests/fixtures/verified-icons-v13.txt). Most
 * of the earlier paths don't exist in v13 and showed broken images.
 *
 * OLD_CATALOG_IMGS keeps each replaced entry's previous img, so Update
 * Characters can move owned copies onto the new icon (catalogIconUpdates)
 * without touching an image the GM picked.
 */

import { ARMOR_CATALOG } from "./armor-catalog.js";
import { WEAPON_CATALOG } from "./weapon-catalog.js";

/** Previous catalog img per entry name, for the entries whose icon changed. */
export const OLD_CATALOG_IMGS = Object.freeze({
  "Light Mesh": "icons/equipment/chest/vest-bulletproof-body-camo.webp",
  "Medium Mesh": "icons/equipment/chest/vest-bulletproof-body-green.webp",
  "Heavy Mesh": "icons/equipment/chest/vest-bulletproof-body-armor.webp",
  "Flak Mesh": "icons/equipment/chest/bullet-proof-vest-kevlar.webp",
  "Light Helmet": "icons/equipment/head/helmet-tech-light.webp",
  "Medium Helmet": "icons/equipment/head/helmet-tech-tactical.webp",
  "Heavy Helmet": "icons/equipment/head/helm-armored-tech-heavy.webp",
  "Light Plate": "icons/equipment/chest/vest-tactical-reinforced.webp",
  "Medium Plate": "icons/equipment/chest/vest-improvised-plated-medium.webp",
  "Heavy Plate": "icons/equipment/chest/vest-improvised-plated-heavy.webp",
  "Standard Suit": "icons/equipment/body/suit-biohazard-protection.webp",
  "Industrial Suit": "icons/equipment/body/suit-medical-biohazard-protection.webp",
  "Military Suit": "icons/equipment/body/suit-military-flight.webp",
  "Flight Jacket": "icons/equipment/chest/jacket-military-flight-green.webp",
  "Powered Armor": "icons/equipment/body/armor-coveralls.webp",
  "Personal Force Screen": "icons/svg/shield.svg",
  "Advanced Force Screen": "icons/svg/mage-shield.svg",
  "Boomerang": "icons/weapons/thrown/boomerang.webp",
  "Chainsaw": "icons/weapons/swords/machete.webp",
  "Combat Knife": "icons/weapons/daggers/knife-simple.webp",
  "Hand Taser (Shock)": "icons/weapons/clubs/baton-energy-stun-silver-yellow.webp",
  "Nunchaku/Tonfa": "icons/weapons/misc/nunchaku.webp",
  "Whip": "icons/weapons/misc/whip-leather.webp",
  "Bow": "icons/weapons/bows/bow-simple-small.webp",
  "AutoMag": "icons/weapons/guns/pistol-handgun-large.webp",
  "Combat Pistol": "icons/weapons/guns/pistol-automatic.webp",
  "Energy Pistol": "icons/weapons/guns/pistol-energy-blaster.webp",
  "Heavy Energy Pistol": "icons/weapons/guns/pistol-energy-plasma.webp",
  "Hideout Pistol": "icons/weapons/guns/pistol-handgun-small.webp",
  "Magnum Revolver": "icons/weapons/guns/pistol-revolver-steel.webp",
  "Needle Pistol": "icons/weapons/guns/pistol-tech-auto-snub-steel.webp",
  "Machinepistol": "icons/weapons/guns/machine-pistol-silver-orange.webp",
  "Needle SMG": "icons/weapons/guns/submachine-gun-scope.webp",
  "SMG": "icons/weapons/guns/machine-gun-sub-large.webp",
  "Assault Rifle": "icons/weapons/guns/rifle-assault-carbine.webp",
  "Energy Rifle": "icons/weapons/guns/rifle-energy-blaster.webp",
  "Heavy Energy Rifle": "icons/weapons/guns/rifle-energy-plasma.webp",
  "Needle Rifle": "icons/weapons/guns/rifle-tech-green.webp",
  "Sniper Rifle": "icons/weapons/guns/rifle-sniper-long.webp",
  "Auto Shotgun": "icons/weapons/guns/shotgun-tech-green-yellow.webp",
  "Shotgun": "icons/weapons/guns/shotgun-pump.webp",
  "Gatling Gun": "icons/weapons/guns/gun-chain-gatling-heavy.webp",
  "Machinegun": "icons/weapons/guns/machine-gun-silver.webp",
  "Frag Grenade": "icons/weapons/thrown/grenade-frag-green.webp",
  "Incendiary Grenade": "icons/weapons/thrown/grenade-incendiary.webp",
  "Sleep Grenade": "icons/weapons/thrown/grenade-tech-stun-cannister.webp"
});

/** Current catalog img by `${type}:${name}`, armor and weapons. */
const CATALOG_IMGS = new Map(
  [...ARMOR_CATALOG, ...WEAPON_CATALOG].map(e => [`${e.type}:${e.name}`, e.img])
);

/**
 * Item updates moving owned catalog armor/weapons onto the new icons: an item
 * whose type and name match a catalog entry, and whose img is still that
 * entry's OLD img, gets the current catalog img. Anything else (a GM-chosen
 * image, a non-catalog item) is left alone.
 * @param {Iterable<{id:string, type:string, name:string, img:string}>} items
 * @returns {{_id:string, img:string}[]}
 */
export function catalogIconUpdates(items) {
  const updates = [];
  for (const item of items) {
    if (item.type !== "armor" && item.type !== "weapon") continue;
    const old = OLD_CATALOG_IMGS[item.name];
    const img = CATALOG_IMGS.get(`${item.type}:${item.name}`);
    if (old && img && item.img === old && img !== old) updates.push({ _id: item.id, img });
  }
  return updates;
}
