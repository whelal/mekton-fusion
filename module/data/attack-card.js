import { escapeHtml } from "../util/escape.js";

/**
 * Attack chat-card wording and the friendly-fire check. Pure helpers; the
 * sheet (actor-sheet.js) reads tokens/targets and builds the cards.
 */

const MINUS = "−";
const signed = n => (n < 0 ? `${MINUS}${-n}` : `${n}`);

/**
 * The exploding d10 in words (see _rollBidirectionalExplodingD10):
 *   no chain  "7"
 *   upward    "10 (+7) = 17", "10 (+10, +3) = 23"
 *   natural 1 "1 (fumble −4) = −3,"   (MZ subtracts one die; no chain)
 * A chain ends in a comma so the modifiers read as a separate step when the
 * caller joins the parts with " + ".
 * @param {number[]} plusDice
 * @param {number[]} minusDice
 */
export function chainText(plusDice, minusDice = []) {
  const [first = 0, ...extra] = plusDice;
  if (minusDice.length) {
    const net = plusDice.reduce((a, b) => a + b, 0) - minusDice.reduce((a, b) => a + b, 0);
    return `${first} (fumble ${MINUS}${minusDice[0]}) = ${signed(net)},`;   // one subtracted die, no chain
  }
  if (!extra.length) return `${first}`;
  const net = plusDice.reduce((a, b) => a + b, 0);
  return `${first} (${extra.map(d => `+${d}`).join(", ")}) = ${net},`;
}

/**
 * Who is being attacked, for the card header: the one target's name, else
 * "(no target)" / "(N targets)". HTML-escaped.
 * @param {string[]} targetNames
 */
export function targetLabel(targetNames) {
  if (targetNames.length === 1) return `<strong>${escapeHtml(targetNames[0])}</strong>`;
  return targetNames.length ? `(${targetNames.length} targets)` : "(no target)";
}

/** "<Attacker> attacks <Target> — <what>" (attacker and what are already HTML). */
export function attackHeader(attackerHtml, targetNames, whatHtml) {
  return `<strong>${attackerHtml}</strong> attacks ${targetLabel(targetNames)} &mdash; ${whatHtml}`;
}

/** "<Target>'s Torso", or "Torso" with no single target. HTML-escaped, bold. */
export function targetLocation(targetName, locLabel) {
  return targetName
    ? `<strong>${escapeHtml(targetName)}'s ${escapeHtml(locLabel)}</strong>`
    : `<strong>${escapeHtml(locLabel)}</strong>`;
}

/** The damage line's ending: "to <Target>'s Torso". */
export function damageTo(targetName, locLabel) {
  return `to ${targetLocation(targetName, locLabel)}`;
}

/** Foundry's CONST.TOKEN_DISPOSITIONS (FRIENDLY 1, HOSTILE -1 in v13/v14); fallbacks keep this testable outside Foundry. */
const FRIENDLY = globalThis.CONST?.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
const HOSTILE = globalThis.CONST?.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;

/**
 * Friendly fire: attacker and target are on the same side -- both FRIENDLY or
 * both HOSTILE. Friendly vs Hostile (either way), Neutral, Secret and unknown
 * dispositions never match.
 */
export function isFriendlyFire(attackerDisposition, targetDisposition) {
  return attackerDisposition === targetDisposition
    && (attackerDisposition === FRIENDLY || attackerDisposition === HOSTILE);
}

/** "Friendly" / "Hostile" for the prompt, from a matching disposition. */
export function sideLabel(disposition) {
  return disposition === FRIENDLY ? "Friendly" : disposition === HOSTILE ? "Hostile" : "";
}

/**
 * The armor half of a damage line, from an _applyLocationDamage result:
 * "no armor" (no piece and no natural armor at the location, 0.3.39),
 * "soft armor ignored" (a Bruise past soft pieces), "SP 15 (Heavy Mesh) soaked
 * (ablated to 14)", or for AP "AP: SP 15 (Heavy Mesh) counts as 7".
 * HTML-escaped. `threshold`: the personal ablation threshold, for the
 * "no ablation (<5)" note.
 */
export function armorSoakLabel({ sp = 0, counted, ap = false, spNow, belowThreshold = false, armorName = "", softIgnored = false }, threshold) {
  if (softIgnored) return "soft armor ignored";
  if (!sp && !armorName) return "no armor";
  const ablated = spNow !== undefined && spNow !== sp ? ` (ablated to ${spNow})`
    : belowThreshold ? `, no ablation (&lt;${threshold})` : "";
  const piece = armorName ? ` (${escapeHtml(armorName)})` : "";
  return ap ? `AP: SP ${sp}${piece} counts as ${counted}${ablated}` : `SP ${sp}${piece} soaked${ablated}`;
}
