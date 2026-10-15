import { test } from "node:test";
import assert from "node:assert/strict";
import { critTier, salvoHitCount, salvoRows, resolveShieldParry, locationFromRoll, applyHit }
  from "../module/data/mecha-damage.js";

test("critTier", () => {
  assert.equal(critTier(4), "none");
  assert.equal(critTier(5), "crit");
  assert.equal(critTier(9), "crit");
  assert.equal(critTier(10), "mega");
});

test("salvoHitCount matches the book examples", () => {
  assert.equal(salvoHitCount(20, 17, 10), 3);   // salvo 10, beat by 3 -> 3
  assert.equal(salvoHitCount(20, 17, 50), 15);  // salvo 50, beat by 3 -> 15
  assert.equal(salvoHitCount(17, 17, 10), 0);   // tie
  assert.equal(salvoHitCount(30, 10, 4), 4);    // clamped to missiles fired
});

test("salvoRows walks and wraps", () => {
  assert.deepEqual(salvoRows(3, 4, "dec"), [3, 2, 1, 10]);
  assert.deepEqual(salvoRows(3, 4, "inc"), [3, 4, 5, 6]);
  assert.deepEqual(salvoRows(10, 2, "inc"), [10, 1]);
});

test("shield parry: pass-through and per-hit ablation", () => {
  const r = resolveShieldParry({ spMax: 3, spUsed: 0 }, 8, 1);
  assert.deepEqual(r.through, [5]);
  assert.equal(r.spUsed, 1);
  const burst = resolveShieldParry({ spMax: 2, spUsed: 0 }, 4, 3);
  assert.deepEqual(burst.through, [2, 3, 4]); // SP 2 -> 1 -> 0, last hit unshielded
  assert.equal(burst.destroyed, true);
});

test("locationFromRoll book rows", () => {
  const humanoid = [
    { id: "head", kind: "head", side: "c" }, { id: "torso", kind: "torso", side: "c" },
    { id: "rArm", kind: "arm", side: "r" }, { id: "lArm", kind: "arm", side: "l" },
    { id: "rLeg", kind: "leg", side: "r" }, { id: "lLeg", kind: "leg", side: "l" },
  ];
  const first = () => 0;
  assert.equal(locationFromRoll(4, humanoid, first).servoId, "torso"); // no pod -> torso
  assert.equal(locationFromRoll(9, humanoid, first).reroll, true);     // no wing/tail -> reroll
  assert.equal(locationFromRoll(10, humanoid, first).special, true);
});

test("applyHit staged penetration (core example: 3 SP, 5K -> 2 through, SP -1)", () => {
  const r = applyHit({ maxKills: 10, maxSP: 3, taken: { kills: 0, sp: 0 } }, 5);
  assert.equal(r.through, 2);
  assert.equal(r.taken.sp, 1);
});
