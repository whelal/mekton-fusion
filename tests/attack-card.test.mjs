import { test } from "node:test";
import assert from "node:assert/strict";
import { chainText, attackHeader, targetLabel, damageTo, isFriendlyFire, sideLabel } from "../module/data/attack-card.js";

test("chainText: plain die, upward chain, fumble chain", () => {
  assert.equal(chainText([7]), "7");
  assert.equal(chainText([10, 7]), "10 (+7) = 17,");
  assert.equal(chainText([10, 10, 3]), "10 (+10, +3) = 23,");
  assert.equal(chainText([1], [4]), "1 (fumble chain −4) = −3,");
  assert.equal(chainText([1], [1]), "1 (fumble chain −1) = 0,");
});

test("chainText reads as the spec's Evade example", () => {
  const line = [chainText([1], [4]), "REF 5", "Dodge 0"].join(" + ") + " = 2";
  assert.equal(line, "1 (fumble chain −4) = −3, + REF 5 + Dodge 0 = 2");
});

test("attack header names attacker and target", () => {
  assert.equal(attackHeader("Dire Wolf", ["Rook"], "Bite"), "<strong>Dire Wolf</strong> attacks <strong>Rook</strong> &mdash; Bite");
  assert.equal(targetLabel([]), "(no target)");
  assert.equal(targetLabel(["A", "B", "C"]), "(3 targets)");
  assert.equal(targetLabel(["<x>"]), "<strong>&lt;x&gt;</strong>");
});

test("damage line names who took it", () => {
  assert.equal(damageTo("Rook", "Torso"), "to <strong>Rook's Torso</strong>");
  assert.equal(damageTo(null, "Torso"), "to <strong>Torso</strong>");
});

test("friendly fire: same side only (both Friendly or both Hostile)", () => {
  assert.equal(isFriendlyFire(1, 1), true);    // PC attacks PC
  assert.equal(isFriendlyFire(-1, -1), true);  // hostile NPC attacks hostile NPC
  assert.equal(isFriendlyFire(1, -1), false);  // PC attacks hostile
  assert.equal(isFriendlyFire(-1, 1), false);  // hostile NPC attacks a PC
  assert.equal(isFriendlyFire(0, 0), false);   // neutral vs neutral
  assert.equal(isFriendlyFire(-2, -2), false); // secret vs secret
  assert.equal(isFriendlyFire(undefined, undefined), false);
  assert.equal(sideLabel(-1), "Hostile");
});
