// Mecha Random Hit Chart (Mekton Zeta, 1d10), mapped onto this system's 6 servo locations.
// Side limb -> 1d2 arm/leg confirmed by the maintainer (table group's house ruling).
// HOUSE ASSUMPTION (unconfirmed): Pod and Other -> Torso (model has neither).
const SIDE = { r: ["rArm", "rLeg"], l: ["lArm", "lLeg"] };
const LABEL = { head: "Head", torso: "Torso", rArm: "R Arm", lArm: "L Arm", rLeg: "R Leg", lLeg: "L Leg" };

// Special/Cinematic results are displayed only, not automated in this pass.
const SPECIAL = [
  [2, "Weapon (random; armor applies)"],
  [3, "Sensors (armor applies)"],
  [4, "Flight system (armor applies)"],
  [5, "Shield mount (no armor; shield severed)"],
  [6, "Subassembly (random; its servo takes ½ dmg)"],
  [7, "Cockpit (armor applies; remainder to pilot)"],
  [9, "CINEMATIC"],
  [10, "Powerplant (armor applies; ½ dmg to Torso)"]
];
const CINEMATIC = [
  "Hydraulics: random limb ½ dmg, stops working",
  "Blunt hit: double for knockback, ½ dmg to Torso",
  "Sensor overload: blind 1d6 turns, sensor servo ½ dmg",
  "Flight cuts out 1d6 turns, Torso ½ dmg",
  "Thruster malfunction: forced full flight MA forward next turn, Torso ½ dmg",
  "Ammo explosion: internal missiles/ammo destroy a random servo",
  "Weapon malfunction 1d6 turns, its servo ½ dmg",
  "Control jam: −2 all actions until repaired (Basic repair vs 15), Torso ½ dmg",
  "Systems shutdown next turn, Torso ½ dmg",
  "Powerplant overload: shut down for the battle, Torso ½ dmg"
];

async function d(n) { return (await new Roll(`1d${n}`).evaluate()).total; }

/** Returns { roll, key, label } for a servo hit, or { roll, special } for a Special/Cinematic result. */
export async function rollMechaHitLocation() {
  const roll = await d(10);
  let key = null;
  if (roll === 1) key = "head";
  else if (roll <= 4) key = "torso";              // 2-3 Torso, 4 Pod -> Torso
  else if (roll <= 6) key = SIDE.r[(await d(2)) - 1];
  else if (roll <= 8) key = SIDE.l[(await d(2)) - 1];
  else if (roll === 9) key = "torso";             // Other -> Torso
  if (key) return { roll, key, label: LABEL[key] };

  const s = await d(10);
  let text = SPECIAL.find(([max]) => s <= max)[1];
  if (text === "CINEMATIC") text = `Cinematic: ${CINEMATIC[(await d(10)) - 1]}`;
  return { roll, special: `Special (${s}): ${text}` };
}
