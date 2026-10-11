// Mecha hit location chart (Mekton Zeta core, 1d10), resolved against the mech's
// actual servo list rather than a fixed 6 slots. A tie among several equally
// valid servos (e.g. two pods) is broken uniformly; LIMB_PICK is a single switch
// point if a table ever wants a different side-limb tie rule.
export const LIMB_PICK = "uniform"; // "uniform" | "armOrLegFirst"

function pickUniform(list, rand) {
  return list.length ? list[rand(list.length)] : null;
}

/**
 * Resolve a Hit Location Chart roll against this mech's servo list.
 * `rand(k)` must return an integer in [0, k) -- the caller supplies a picker
 * (dice-backed or not) so this function stays pure/synchronous and testable.
 * @param {number} n - the 1d10 roll (1-10)
 * @param {object[]} servos - servo rows ({ id, kind, side }); falsy entries skipped
 * @param {(k:number)=>number} rand
 * @returns {{ servoId: string|null, special: boolean, reroll: boolean }}
 */
export function locationFromRoll(n, servos, rand) {
  const list = (servos ?? []).filter(Boolean);
  const byKind = (...kinds) => list.filter(s => kinds.includes(s.kind));
  const bySide = (side, ...kinds) => list.filter(s => kinds.includes(s.kind) && s.side === side);
  const torso = () => byKind("torso")[0] ?? null;
  const hit = servoId => ({ servoId, special: false, reroll: false });
  const miss = { servoId: null, special: false, reroll: false };

  if (n === 1) {
    const head = byKind("head")[0];
    return head ? hit(head.id) : (torso() ? hit(torso().id) : miss);
  }
  if (n === 2 || n === 3) {
    const t = torso();
    return t ? hit(t.id) : miss;
  }
  if (n === 4) {
    const picked = pickUniform(byKind("pod"), rand) ?? torso();
    return picked ? hit(picked.id) : miss;
  }
  if (n === 5 || n === 6) {
    const picked = pickUniform(bySide("r", "arm", "leg"), rand) ?? torso();
    return picked ? hit(picked.id) : miss;
  }
  if (n === 7 || n === 8) {
    const picked = pickUniform(bySide("l", "arm", "leg"), rand) ?? torso();
    return picked ? hit(picked.id) : miss;
  }
  if (n === 9) {
    const picked = pickUniform(byKind("wing", "tail"), rand);
    return picked ? hit(picked.id) : { servoId: null, special: false, reroll: true };
  }
  // n === 10: Special chart -- resolve by hand, nothing applied automatically.
  return { servoId: null, special: true, reroll: false };
}

/**
 * Mekton Zeta staged penetration: ONE hit's Kills against ONE servo.
 * - Damage minus the servo's CURRENT SP (0 on a Mega-Crit -- it bypasses armor
 *   entirely) penetrates to Kills.
 * - A non-Mega-Crit hit of >=1K ablates 1 SP, even if fully stopped. A
 *   Mega-Crit never ablates (the shot never touched the armor).
 * - `maxKills === 0` (a pod, or any unconfigured servo) has no real Kills
 *   pool: the first penetrating hit still registers (taken.kills -> 1) so the
 *   caller's destroyed check can fire; a second hit is a no-op (wasDestroyed).
 * - Excess damage past 0 Kills is lost, not carried to another servo.
 * - A hit on an already-destroyed servo does nothing; the caller should report
 *   that rather than re-resolve it (see `wasDestroyed`).
 * @param {{maxKills:number, maxSP:number, taken:{kills:number, sp:number}}} servo
 * @param {number} kills - this hit's damage
 * @param {{megaCrit?:boolean}} [opts]
 */
export function applyHit({ maxKills, maxSP, taken }, kills, { megaCrit = false } = {}) {
  const dmg = Math.max(0, Math.floor(Number(kills) || 0));
  const takenKills = Number(taken?.kills) || 0;
  const takenSp = Number(taken?.sp) || 0;
  const maxK = Number(maxKills) || 0;
  const spCurrent = Math.max(0, (Number(maxSP) || 0) - takenSp);
  const killsCurrent = Math.max(0, maxK - takenKills);
  const wasDestroyed = (maxK > 0 && killsCurrent === 0) || (maxK === 0 && takenKills > 0);

  if (wasDestroyed) {
    return { taken: { kills: takenKills, sp: takenSp }, through: 0, ablated: false, destroyed: true, wasDestroyed: true };
  }

  const effSP = megaCrit ? 0 : spCurrent;
  const through = Math.max(0, dmg - effSP);
  const ablated = !megaCrit && spCurrent > 0 && dmg >= 1;
  const newSp = takenSp + (ablated ? 1 : 0);
  const newKills = maxK > 0 ? takenKills + Math.min(through, killsCurrent) : takenKills + (through > 0 ? 1 : 0);
  const nowDestroyed = (maxK > 0 && maxK - newKills <= 0) || (maxK === 0 && newKills > 0);

  return { taken: { kills: newKills, sp: newSp }, through, ablated, destroyed: nowDestroyed, wasDestroyed: false };
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

/** Parry Roll vs attack. ASSUMPTION: same tie rule as Evade (parry total >= attack total succeeds). */
export function parrySucceeds(parryTotal, attackTotal) {
  return Number(parryTotal) >= Number(attackTotal);
}
