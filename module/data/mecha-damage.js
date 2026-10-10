/**
 * Mekton Zeta staged penetration: ONE attack against ONE mecha servo location.
 * - Damage minus CURRENT SP penetrates to the servo's Kills.
 * - Any single attack of >= 1 Kill ablates armor by 1 SP, even if fully stopped.
 * Operates on damage-taken counters (system.mecha.damage.<loc>), never on derived maxima.
 */
export function resolveMechaHit({ damage, spMax, spDamage, killsMax, killsDamage }) {
  const dmg = Math.max(0, Math.floor(Number(damage) || 0));
  const spBefore = Math.max(0, spMax - spDamage);
  const penetrating = Math.max(0, dmg - spBefore);
  const ablated = (dmg >= 1 && spBefore > 0) ? 1 : 0;
  const killsBefore = Math.max(0, killsMax - killsDamage);
  const applied = Math.min(penetrating, killsBefore);
  return {
    spBefore, spAfter: spBefore - ablated, ablated,
    penetrating, killsBefore, killsAfter: killsBefore - applied,
    excess: penetrating - applied,            // Kills beyond what the servo had left (not carried over; rule TBD)
    spDamage: spDamage + ablated,
    killsDamage: killsDamage + applied,
    destroyed: killsMax > 0 && killsBefore - applied === 0
  };
}

/** Burst fire: one hit per point Attack beats Defense, capped at BV. Tie/miss = 0. */
export function burstHitCount(attackTotal, defenseTotal, bv) {
  const margin = Math.floor(Number(attackTotal) - Number(defenseTotal));
  if (!(margin >= 1)) return 0;
  const cap = parseInt(bv, 10);                  // "∞"/blank -> NaN -> uncapped
  return Number.isFinite(cap) ? Math.min(margin, cap) : margin;
}

/**
 * Parry with a melee weapon: its Kills rating acts like a shield's SP.
 * Every successful parry costs 1 Kill, regardless of the attack's damage.
 * At 0 Kills the weapon is destroyed and can no longer parry.
 */
export function resolveMeleeParry({ killsMax, killsUsed }) {
  const killsBefore = Math.max(0, Number(killsMax) - Number(killsUsed));
  if (killsBefore <= 0) return { ok: false, killsBefore: 0, killsAfter: 0, killsUsed: Number(killsUsed) };
  const killsAfter = killsBefore - 1;
  return { ok: true, killsBefore, killsAfter, killsUsed: Number(killsUsed) + 1, destroyed: killsAfter === 0 };
}

/**
 * Parry with an Energy Melee Weapon: its Damage rating acts like a shield's
 * SP, but a successful parry does NOT deplete it. If the attack's damage
 * exceeds the EMW's own Damage rating, the EMW doesn't stop the attack at
 * all -- the attack breezes through for full damage.
 */
export function resolveEmwParry({ emwDamage, attackDamage }) {
  return { ok: Number(attackDamage) <= Number(emwDamage), emwDamage: Number(emwDamage), attackDamage: Number(attackDamage) };
}
