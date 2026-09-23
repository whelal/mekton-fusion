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
