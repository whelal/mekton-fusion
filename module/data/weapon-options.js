/**
 * mekton-fusion: Weapon Options (attachments/accessories)
 * ---------------------------------------------------------
 * Things that can be added to an existing weapon to improve accuracy,
 * stealth, ammunition loads, or readiness. Availability is TL-gated like
 * everything else; this module only encodes the mechanical values, not the
 * book's descriptive text.
 *
 * Combat-math fields (used by the attack resolver):
 *   combatWaBonus - added to WA when the Range dropdown is at Combat Range
 *     only (a negative value, e.g. Optical Scope, is a penalty)
 *   maxRangeMod   - this option's Maximum Range penalty, replacing the
 *     default -4 if installed (less negative = better). When multiple
 *     installed options each define one, the best (least negative) wins --
 *     they don't stack.
 *   shotsMultiplier - multiplies the weapon's shot count (Magazine Extensions)
 *
 * Cost/weight are either a flat addition (weightKg/cost) or a percentage of
 * the base weapon's own stat (weightPct/costPct) -- Magazine Extensions
 * prices as "+20% weight, +10% cost (or 2x reload)"; the 2x-reload wording
 * is an alternate GM pricing call and isn't auto-applied.
 */

export const WEAPON_OPTIONS = {
  lasersight: {
    label: "Lasersight",
    weightKg: 0.1, cost: 100, tl: 5,
    combatWaBonus: 1
  },
  magazineExtensions: {
    label: "Magazine Extensions",
    weightPct: 0.20, costPct: 0.10, tl: 5,
    shotsMultiplier: 2,
    concealabilityOverride: "N", // "almost impossible to conceal (Ref's decision)"
    note: "Alt. pricing per the book: 2x reload cost instead of +10% weapon cost."
  },
  opticalScope: {
    label: "Optical Scope",
    weightKg: 0.2, cost: 100, tl: 4,
    maxRangeMod: -2,
    combatWaBonus: -2 // narrowed field of vision
  },
  silencer: {
    label: "Silencer",
    weightKg: 0.5, cost: 100, tl: 5,
    note: "Requires an Average Awareness roll to hear the shot (no numeric combat effect)."
  },
  smartgun: {
    label: "Smartgun",
    weightKg: 0.3, cost: 500, tl: 6,
    combatWaBonus: 2,
    maxRangeMod: -3
  }
};

// Skills that mark a weapon as melee or thrown (see the skill mapping in weapon-catalog.js).
// (athletics = thrown weapons, which also carry a "T" range)
const MELEE_SKILLS = new Set(["blade", "whip", "hand-to-hand", "athletics"]);

/**
 * Weapon Options are ranged-weapon accessories (sights, silencers, magazines):
 * personal-scale ranged weapons only. Not melee (melee skill, or a bare
 * reach-1..2 range), not thrown ("T" range -- grenades, boomerangs), and not
 * Mecha-scale weapons (mecha-weapon items or anything flagged isMecha).
 * @param {object} system - weapon Item system data
 * @param {string} [itemType] - the Item's type ("weapon" | "mecha-weapon")
 */
export function weaponSupportsOptions(system, itemType = "weapon") {
  if (itemType === "mecha-weapon" || system?.isMecha) return false;
  if (MELEE_SKILLS.has(String(system?.skill ?? "").toLowerCase())) return false;
  const range = String(system?.range ?? "").trim().toUpperCase();
  if (range === "T") return false;
  if (/^\d+$/.test(range) && Number(range) <= 2) return false;
  return true;
}

/** One-line human summary of an option's mechanical effect, for pickers. */
export function summarizeWeaponOption(opt) {
  const bits = [];
  const sgn = n => (n >= 0 ? `+${n}` : `${n}`);
  if (typeof opt.combatWaBonus === "number") bits.push(`WA ${sgn(opt.combatWaBonus)} at Combat Range`);
  if (typeof opt.maxRangeMod === "number") bits.push(`Max Range ${sgn(opt.maxRangeMod)}`);
  if (typeof opt.shotsMultiplier === "number") bits.push(`Shots x${opt.shotsMultiplier}`);
  if (opt.concealabilityOverride) bits.push(`Conc ${opt.concealabilityOverride}`);
  if (typeof opt.weightKg === "number") bits.push(`+${opt.weightKg} kg`);
  if (typeof opt.weightPct === "number") bits.push(`+${Math.round(opt.weightPct * 100)}% weight`);
  if (typeof opt.cost === "number") bits.push(`+${opt.cost} cost`);
  if (typeof opt.costPct === "number") bits.push(`+${Math.round(opt.costPct * 100)}% cost`);
  if (opt.note) bits.push(opt.note);
  return bits.join("; ");
}

// Weapon Accuracy ceiling. Options can raise a weapon's WA up to this and no
// further: 2 for projectile/energy/melee weapons, 3 for missiles. (Every
// personal-scale catalog weapon is in the first group; the missile ceiling is
// here for completeness.) Only the bonus is capped -- a weapon already above
// the ceiling keeps its own WA, and penalties (Optical Scope) are never
// raised back up by it.
const WA_CAP_DEFAULT = 2;
const WA_CAP_MISSILE = 3;

export function weaponWaCap(system) {
  return String(system?.skill ?? "").toLowerCase() === "missile" ? WA_CAP_MISSILE : WA_CAP_DEFAULT;
}

/**
 * WA at Combat Range once installed options' WA bonus is applied, respecting
 * the WA ceiling. e.g. Automag WA 1 + Smartgun +2 = 3, capped to 2.
 * @returns {{wa:number, capped:boolean}}
 */
export function effectiveCombatWa(system, combatWaBonus) {
  const base = Number(system?.wa) || 0;
  const raw = base + (combatWaBonus || 0);
  if (!(combatWaBonus > 0)) return { wa: raw, capped: false };
  const cap = weaponWaCap(system);
  const wa = Math.max(base, Math.min(raw, cap));
  return { wa, capped: wa < raw };
}

/**
 * Combine a weapon's installed options into one effective-stats delta.
 * Pure function of the option keys -- doesn't touch the weapon Item; callers
 * apply the deltas to the weapon's own base values for display/rolls.
 * @param {string[]} optionKeys - WEAPON_OPTIONS keys installed on the weapon
 * @returns {{combatWaBonus:number, maxRangeMod:number|null, shotsMultiplier:number,
 *            addWeight:number, addCost:number, weightPct:number, costPct:number,
 *            maxTL:number, concealabilityOverride:string|null, installed:object[]}}
 */
export function computeWeaponOptionsEffect(optionKeys = []) {
  const installed = (optionKeys ?? []).map(k => WEAPON_OPTIONS[k]).filter(Boolean);

  let combatWaBonus = 0;
  let maxRangeMod = null; // null = no override; default -4 stands
  let shotsMultiplier = 1;
  let addWeight = 0, addCost = 0, weightPct = 0, costPct = 0;
  let maxTL = 0;
  let concealabilityOverride = null;

  for (const opt of installed) {
    if (typeof opt.combatWaBonus === "number") combatWaBonus += opt.combatWaBonus;
    if (typeof opt.maxRangeMod === "number") {
      // Best (least negative) installed override wins; they don't stack.
      maxRangeMod = maxRangeMod === null ? opt.maxRangeMod : Math.max(maxRangeMod, opt.maxRangeMod);
    }
    if (typeof opt.shotsMultiplier === "number") shotsMultiplier *= opt.shotsMultiplier;
    if (typeof opt.weightKg === "number") addWeight += opt.weightKg;
    if (typeof opt.cost === "number") addCost += opt.cost;
    if (typeof opt.weightPct === "number") weightPct += opt.weightPct;
    if (typeof opt.costPct === "number") costPct += opt.costPct;
    if (typeof opt.tl === "number") maxTL = Math.max(maxTL, opt.tl);
    if (opt.concealabilityOverride) concealabilityOverride = opt.concealabilityOverride;
  }

  return { combatWaBonus, maxRangeMod, shotsMultiplier, addWeight, addCost, weightPct, costPct, maxTL, concealabilityOverride, installed };
}
