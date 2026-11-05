/**
 * Fumbles (HOUSE, from Interlock Unlimited p.37; playtest; TABLE_RULINGS
 * fumble*). MZ core already rolls a second d10 after a natural 1 and
 * subtracts it from the total; that SAME die also confirms the fumble: at or
 * below the roll's skill rank it's just a bad roll, above it's a FUMBLE
 * (no third die). A roll with no skill (stat-only, or rank 0) fumbles on
 * every natural 1 (INTERPRETATION). A confirmed fumble then rolls 1D10 on the
 * table picked by fumbleTableFor(). Pure; the sheet rolls the dice and applies
 * the Combat and Athletics effects.
 */
import { TABLE_RULINGS } from "../rules/table-rulings.js";

/** Whether an exploding-d10 roll's first (natural) die is a 1. */
export const isNaturalOne = plusDice => Number(plusDice?.[0]) === 1;

/**
 * Confirm a natural 1 with the die MZ already subtracts (minusDice[0]).
 * @param {{plusDice:number[], minusDice:number[], rank?:number}} r
 * @returns {null|{die:number, rank:number, fumble:boolean}} null when the natural die isn't a 1
 */
export function confirmFumble({ plusDice, minusDice, rank = 0 }) {
  if (!TABLE_RULINGS.fumbles || !isNaturalOne(plusDice)) return null;
  const die = Number(minusDice?.[0]) || 0;
  const r = Math.max(0, Number(rank) || 0);
  return { die, rank: r, fumble: r <= 0 || die > r };
}

/**
 * Which fumble table a roll uses (TABLE_RULINGS.fumbleTableByStat /
 * fumbleCombatCategories / fumbleNonCombatSkills).
 * @param {{kind:"attack"|"defense"|"skill"|"stat", stat?:string, skillName?:string, category?:string}} r
 * @returns {"combat"|"athletics"|"tech"|"social"|"int"|"plain"}
 */
export function fumbleTableFor({ kind, stat = "", skillName = "", category = "" }) {
  if (kind === "attack") return "combat";
  if (kind === "defense") return TABLE_RULINGS.fumbleDefenseTable;
  if (kind === "skill" && !TABLE_RULINGS.fumbleNonCombatSkills.includes(skillName)) {
    const cat = String(category).toUpperCase();
    if (TABLE_RULINGS.fumbleCombatCategories.some(c => c.toUpperCase() === cat)) return "combat";
  }
  return TABLE_RULINGS.fumbleTableByStat[String(stat).toUpperCase()] ?? "plain";
}

/** Table names for the card. */
export const FUMBLE_TABLE_LABELS = { combat: "Combat", athletics: "Athletics", tech: "Tech", social: "Social", int: "INT", plain: "Plain fumble" };

/**
 * A fumble table's result for its 1D10 `die`.
 * Effects the sheet automates: "drop", "jam", "selfWound", "partyWound"
 * (Combat), "selfHits" (Athletics: `hits` formula, Stun/Shock at `stunMod`).
 * Everything else ("note") is a chat line only.
 * @param {string} table - from fumbleTableFor
 * @param {number} die - 1D10
 * @param {{unarmed?:boolean, weaponName?:string, secondDie?:number}} [o] -
 *   unarmed: drop and jam become a plain screw-up. secondDie: Social 7-10's follow-up 1D10.
 * @returns {{table:string, die:number|null, effect:string, text:string, hits?:string, stunMod?:number}}
 */
export function fumbleResult(table, die, { unarmed = false, weaponName = "the weapon", secondDie = null } = {}) {
  const d = Number(die) || 0;
  const out = (effect, text, extra = {}) => ({ table, die: table === "plain" ? null : d, effect, text, ...extra });
  switch (table) {
    case "combat":
      if (d <= 4) return out("note", "just a screw-up");
      if (d === 5) return unarmed ? out("note", "just a screw-up") : out("drop", `drops ${weaponName}`);
      if (d === 6) return out("note", unarmed ? "strikes something harmless" : `${weaponName} discharges or strikes something harmless`);
      if (d === 7) return unarmed ? out("note", "just a screw-up") : out("jam", `${weaponName} jams or lodges in something: unusable until the start of the user's next turn`);
      if (d === 8) return out("selfWound", "wounds themselves");
      return out("partyWound", "wounds a party member");
    case "athletics":
      if (d <= 4) return out("note", "makes an idiot of themselves");
      if (d <= 7) return out("selfHits", "1 Hit + Stun/Shock", { hits: "1", stunMod: 0 });
      return out("selfHits", "1D6 Hits + Stun/Shock at -1", { hits: "1d6", stunMod: -1 });
    case "tech":
      if (d <= 4) return out("note", "can't get it together");
      if (d <= 7) return out("note", "+5 Difficulty on the next attempt");
      return out("note", "the device is damaged beyond repair");
    case "social":
      if (d <= 4) return out("note", "they don't buy it");
      if (d <= 6) return out("note", "-4 to the next roll with them");
      return out("note", "they're violently opposed"
        + (secondDie !== null ? ` (1D10 ${secondDie}: ${secondDie <= 4 ? "they attempt physical harm" : "no violence"})` : ""));
    case "int":
      if (d <= 4) return out("note", "no idea");
      if (d <= 7) return out("note", "clueless; Fast Talk -2 to hide it");
      return out("note", "everyone sees how ignorant they are");
    default:
      return out("note", "a plain fumble");
  }
}

/** Whether a fumble table needs a follow-up 1D10 for this result (Social 7-10). */
export const needsSecondDie = (table, die) => table === "social" && Number(die) >= 7;

/**
 * The card line for a natural 1 (F6):
 *   "FUMBLE (confirm 7 > skill 3): Combat 5 — drops Quarterstaff"
 *   "Natural 1, saved by skill (confirm 2 ≤ 3)"
 * @param {{die:number, rank:number, fumble:boolean}} confirm - from confirmFumble
 * @param {ReturnType<typeof fumbleResult>|null} result - null when saved
 */
export function fumbleLine(confirm, result) {
  if (!confirm.fumble) return `Natural 1, saved by skill (confirm ${confirm.die} ≤ ${confirm.rank})`;
  const why = confirm.rank > 0 ? `confirm ${confirm.die} > skill ${confirm.rank}` : `confirm ${confirm.die}, no skill`;
  const table = result.die === null ? FUMBLE_TABLE_LABELS[result.table] : `${FUMBLE_TABLE_LABELS[result.table]} ${result.die}`;
  return `FUMBLE (${why}): ${table} — ${result.text}`;
}

/**
 * The party member a "wound a party member" fumble hits: the nearest
 * candidate (a FRIENDLY token: same side as the user, not the user) within
 * `maxDistance` and, for a ranged weapon, with line of fire. Null when none
 * qualifies (the card posts it for the GM).
 * @param {{id:string, distance:number, lineOfFire?:boolean}[]} candidates
 * @param {{maxDistance:number, ranged?:boolean}} o
 */
export function pickPartyVictim(candidates, { maxDistance, ranged = false }) {
  let best = null;
  for (const c of candidates ?? []) {
    if (!(Number.isFinite(c.distance) && c.distance <= maxDistance + 1e-6)) continue;
    if (ranged && !c.lineOfFire) continue;
    if (!best || c.distance < best.distance) best = c;
  }
  return best;
}

/**
 * The weapon update for a Combat fumble: "drop" takes it out of hand; "jam"
 * flags it with the running combat (null when no combat is running: the jam
 * isn't tracked). Null for every other effect.
 * @param {string} effect - fumbleResult().effect
 * @param {{combatId?:string|null}} [o]
 */
export function fumbleWeaponUpdate(effect, { combatId = null } = {}) {
  if (effect === "drop") return { "system.inHand": false };
  if (effect === "jam") return combatId ? { "flags.mekton-fusion.jammed": { combatId } } : null;
  return null;
}

/**
 * _applyLocationDamage options for a fumble's damage. Self-wound and party
 * wound are weapon hits: armor applies as normal (no armor bypass at human
 * scale), with the weapon's damage type and AP. Athletics Hits aren't an
 * attack: no armor, always a Stun/Shock roll, at the result's stunMod.
 * @param {ReturnType<typeof fumbleResult>} result
 * @param {{damageType?:string, armorPiercing?:boolean}} [selfDamage]
 */
export function fumbleDamageOptions(result, selfDamage = {}) {
  if (result.effect === "selfHits") return { ignoreSp: true, forceStun: true, stunMod: result.stunMod ?? 0, damageType: "wound" };
  return { ignoreSp: false, damageType: selfDamage?.damageType === "bruise" ? "bruise" : "wound", armorPiercing: !!selfDamage?.armorPiercing };
}

/**
 * A jammed weapon (Combat 7): flagged with the combat it jammed in, cleared at
 * the start of its user's next turn in that combat. It blocks only while that
 * combat still exists (a stale flag from an ended combat doesn't).
 * @param {{combatId:string}|null|undefined} jam - the weapon's flag
 * @param {Iterable<string>|{has:(id:string)=>boolean}} combatIds - existing combats
 */
export function jamBlocks(jam, combatIds) {
  if (!jam?.combatId) return false;
  const has = typeof combatIds?.has === "function" ? id => combatIds.has(id) : id => [...(combatIds ?? [])].includes(id);
  return has(jam.combatId);
}

/** Whether a turn starting for the weapon's user in `combatId` clears its jam. */
export function jamClearsOnTurn(jam, combatId) {
  return !!jam?.combatId && jam.combatId === combatId;
}
