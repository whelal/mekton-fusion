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
 *   fumble    "1 (fumble chain −4) = −3,"
 * A chain ends in a comma so the modifiers read as a separate step when the
 * caller joins the parts with " + ".
 * @param {number[]} plusDice
 * @param {number[]} minusDice
 */
export function chainText(plusDice, minusDice = []) {
  const [first = 0, ...extra] = plusDice;
  if (minusDice.length) {
    const net = plusDice.reduce((a, b) => a + b, 0) - minusDice.reduce((a, b) => a + b, 0);
    return `${first} (fumble chain ${MINUS}${minusDice.join(`, ${MINUS}`)}) = ${signed(net)},`;
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

/** Foundry's CONST.TOKEN_DISPOSITIONS.FRIENDLY (1 in v13/v14); a fallback keeps this testable outside Foundry. */
const FRIENDLY = globalThis.CONST?.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;

/** Friendly fire: attacker and target tokens are both FRIENDLY. Unknown dispositions never match. */
export function isFriendlyFire(attackerDisposition, targetDisposition) {
  return attackerDisposition === FRIENDLY && targetDisposition === FRIENDLY;
}
