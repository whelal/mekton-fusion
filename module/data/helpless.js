/**
 * Helpless targets (table ruling, TABLE_RULINGS.helplessStatuses /
 * helplessRangedDifficulty): a target with a helpless status (Unconscious,
 * Asleep, Defeated) or a head or torso that is unconscious or dead (woundState) gets no
 * defense at all: no Evade, Parry or Arm Block. Pure; the sheet reads the
 * token's own actor (linked or unlinked) and passes its statuses and body
 * locations in.
 *
 * Melee and close combat: the attacker still rolls 1D10, only to check for a
 * natural 1; anything else hits automatically, at the chosen location, with
 * no called-shot penalty. A natural 1 misses (the fumble check comes later).
 * Ranged: GM Difficulty, defaulting to TABLE_RULINGS.helplessRangedDifficulty;
 * range, cover, WA and called-shot modifiers apply as normal.
 */
import { TABLE_RULINGS } from "../rules/table-rulings.js";
import { woundState } from "./damage-track.js";

/**
 * Whether a target is helpless.
 * @param {{statuses?: Iterable<string>, locations?: Record<string, object>}} s
 */
export function isHelpless({ statuses = [], locations = {} } = {}) {
  const set = statuses instanceof Set ? statuses : new Set(statuses);
  if (TABLE_RULINGS.helplessStatuses.some(id => set.has(id))) return true;
  return ["head", "torso"].some(k => locations?.[k] && HELPLESS_WOUND_STATES.has(woundState(k, locations[k])));
}

/** Head or torso wound states (woundState) that make a target helpless. */
const HELPLESS_WOUND_STATES = new Set(["unconscious", "dead"]);

/** Attack kinds that hit a helpless target automatically ("melee" | "unarmed"). */
export const isHelplessAutoHitKind = attackKind => attackKind === "melee" || attackKind === "unarmed";

/**
 * How an attack on a helpless target resolves.
 *  - melee / unarmed: { defense: "none", hit: natural !== 1, locPenalty: false }
 *  - ranged: { defense: "difficulty", difficulty, locPenalty: true }, the
 *    Difficulty the GM set, else TABLE_RULINGS.helplessRangedDifficulty.
 * @param {{attackKind:string, natural?:number, difficulty?:number|null}} a
 */
export function helplessAttack({ attackKind, natural, difficulty = null }) {
  if (isHelplessAutoHitKind(attackKind)) return { defense: "none", hit: natural !== 1, locPenalty: false };
  return { defense: "difficulty", difficulty: difficulty ?? TABLE_RULINGS.helplessRangedDifficulty, locPenalty: true };
}
