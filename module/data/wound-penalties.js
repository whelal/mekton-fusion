/**
 * Wound penalties (0.4): MZ core, Referee's Section, Realistic Damage Table,
 * automated on top of the core Human Damage Results states (woundState();
 * only the full-torso state changes, per torsoZeroStunCheck). Wounds only: read from each location's
 * Wound-based `hits`, so Bruises never trigger them (Sprained is separate).
 * Penalties from different locations stack (INTERPRETATION). Gated by
 * TABLE_RULINGS.realisticDamagePenalties. Torso at 0 Hits (-2 and a Stun/Shock
 * roll each turn) is TABLE_RULINGS.torsoZeroStunCheck. Pure; the sheet and the
 * DataModel read the result.
 */
import { TABLE_RULINGS } from "../rules/table-rulings.js";
import { woundState } from "./damage-track.js";

const LIMBS = new Set(["rArm", "lArm", "rLeg", "lLeg"]);
const ARMS = new Set(["rArm", "lArm"]);

/** Realistic Damage Table values (MZ core, Referee's Section). */
export const REALISTIC_DAMAGE = {
  headTorsoAtOne: -1,   // head or torso at exactly 1 Hit remaining
  limbAtZero: -1,       // limb at 0 (broken and useless, per core)
  limbMangled: -3,      // limb at -1 to -4
  limbBlownOff: -5,     // limb at -5 or below; also a Stun/Shock roll every turn
  torsoAtZero: -2       // torso at 0 or -1 Wound Hits (TABLE_RULINGS.torsoZeroStunCheck)
};

/**
 * One location's Realistic Damage effect. "At 1 Hit remaining" means Wound
 * Hits of exactly 1 with at least one Wound taken.
 * @param {string} key - body location
 * @param {{hits:number, hitsMax:number}} loc
 * @returns {{penalty:number, maHalved:boolean, liftHalved:boolean, blownOff:boolean, reason:string}}
 */
export function locationWoundEffect(key, loc) {
  const out = { penalty: 0, maHalved: false, liftHalved: false, blownOff: false, reason: "" };
  if (!TABLE_RULINGS.realisticDamagePenalties) return out;
  const hits = Number(loc?.hits) || 0;
  const atOne = hits === 1 && hits < (Number(loc?.hitsMax) || 0);
  if (!LIMBS.has(key)) {
    if (atOne) Object.assign(out, { penalty: REALISTIC_DAMAGE.headTorsoAtOne, reason: "1 Hit left" });
    else if (key === "torso" && TABLE_RULINGS.torsoZeroStunCheck && (hits === 0 || hits === -1)) {
      Object.assign(out, { penalty: REALISTIC_DAMAGE.torsoAtZero, reason: `${hits} Hits` });
    }
    return out;
  }
  if (atOne) {
    if (ARMS.has(key)) Object.assign(out, { liftHalved: true, reason: "1 Hit left: Lift halved" });
    else Object.assign(out, { maHalved: true, reason: "1 Hit left: MA halved" });
  } else if (hits <= -5) {
    Object.assign(out, { penalty: REALISTIC_DAMAGE.limbBlownOff, blownOff: true, reason: "blown off: Stun/Shock every turn" });
  } else if (hits <= -1) {
    Object.assign(out, { penalty: REALISTIC_DAMAGE.limbMangled, reason: "mangled" });
  } else if (hits === 0) {
    Object.assign(out, { penalty: REALISTIC_DAMAGE.limbAtZero, reason: "broken" });
  }
  return out;
}

/**
 * The whole body's wound penalties: `total` (stacked across locations) for
 * every roll the character makes, MA/Lift halving (once each, however many
 * locations call for it), and the blown-off limbs that force a Stun/Shock
 * roll at the start of each of the character's turns.
 * @param {Record<string, {hits:number, hitsMax:number}>} locations
 * @returns {{total:number, byLocation:Record<string, ReturnType<typeof locationWoundEffect>>, maHalved:boolean, liftHalved:boolean, blownOff:string[]}}
 */
export function woundPenalties(locations) {
  const byLocation = {};
  let total = 0, maHalved = false, liftHalved = false;
  const blownOff = [];
  for (const [key, loc] of Object.entries(locations ?? {})) {
    const e = locationWoundEffect(key, loc);
    byLocation[key] = e;
    total += e.penalty;
    maHalved ||= e.maHalved;
    liftHalved ||= e.liftHalved;
    if (e.blownOff) blownOff.push(key);
  }
  return { total, byLocation, maHalved, liftHalved, blownOff };
}

/**
 * Each location's woundState() (damage-track.js), split the way the per-turn
 * Stun/Shock decision reads it.
 * @returns {{headState:string, torsoState:string, limbStates:Record<string,string>}}
 */
export function locationStates(locations) {
  const locs = locations ?? {};
  const limbStates = {};
  for (const k of LIMBS) if (locs[k]) limbStates[k] = woundState(k, locs[k]);
  return {
    headState: locs.head ? woundState("head", locs.head) : "ok",
    torsoState: locs.torso ? woundState("torso", locs.torso) : "ok",
    limbStates
  };
}

/**
 * Why the character rolls Stun/Shock at the start of its turn: a torso in the
 * "stun-check" state (full track, Wounds or Bruises;
 * TABLE_RULINGS.torsoZeroStunCheck), and each blown-off ("severed", -5 or
 * below) limb (TABLE_RULINGS.realisticDamagePenalties). None when the
 * character already has the Unconscious status (waking is manual: the GM
 * removes it), or head or torso is dead or unconscious.
 * @param {{headState?:string, torsoState?:string, limbStates?:Record<string,string>, isUnconscious?:boolean}} s
 * @returns {string[]} location keys
 */
export function turnStunCauses({ headState = "ok", torsoState = "ok", limbStates = {}, isUnconscious = false } = {}) {
  if (isUnconscious) return [];
  if ([headState, torsoState].some(st => st === "dead" || st === "unconscious")) return [];
  const causes = torsoState === "stun-check" ? ["torso"] : [];
  if (TABLE_RULINGS.realisticDamagePenalties) {
    for (const [k, st] of Object.entries(limbStates)) if (st === "severed") causes.push(k);
  }
  return causes;
}

/** Whether the character rolls Stun/Shock at the start of its turn (turnStunCauses). */
export function needsTurnStunRoll(states) {
  return turnStunCauses(states).length > 0;
}

/** The wound penalty a roll applies: the full total unless the dialog's Wounds row was unticked. */
export function appliedWoundPenalty(total, { ticked = true } = {}) {
  return ticked ? total : 0;
}

/** A movement or lift value after halving (once), unrounded. */
export function halvedIf(value, halve) {
  const n = Number(value) || 0;
  return halve ? n / 2 : n;
}
