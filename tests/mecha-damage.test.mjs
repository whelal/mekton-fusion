import { test } from "node:test";
import assert from "node:assert/strict";
import { critTier, salvoHitCount, salvoRows, salvoCritCounts, resolveShieldParry, locationFromRoll, applyHit, applyPodHit }
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

test("salvoRows walks down the chart and wraps 10 -> 1", () => {
  assert.deepEqual(salvoRows(3, 4), [3, 4, 5, 6]);
  assert.deepEqual(salvoRows(10, 2), [10, 1]);
  assert.deepEqual(salvoRows(3, 12), [3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4]);
});

test("salvoRows skips rows (walked 9 with no wing/tail)", () => {
  assert.deepEqual(salvoRows(8, 3, [9]), [8, 10, 1]);
  assert.deepEqual(salvoRows(9, 2, [9]), [10, 1]); // a skipped start row moves on too
});

test("salvoCritCounts uses the raw margin, capped at hits", () => {
  // Book check: 12 missiles, margin 11 -> 12 hits; 2 mega, 5 crit, 5 normal.
  assert.equal(salvoHitCount(21, 10, 12), 12);
  assert.deepEqual(salvoCritCounts(11, 12), { mega: 2, crit: 5, normal: 5 });
  assert.deepEqual(salvoCritCounts(3, 9), { mega: 0, crit: 0, normal: 9 });
  assert.deepEqual(salvoCritCounts(7, 2), { mega: 0, crit: 2, normal: 0 });
  assert.deepEqual(salvoCritCounts(11, 3), { mega: 2, crit: 1, normal: 0 });
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

test("shield parry: a fully stopped hit still costs 1 SP", () => {
  const r = resolveShieldParry({ spMax: 6, spUsed: 0 }, 4, 2);
  assert.deepEqual(r.through, [0, 0]);
  assert.equal(r.spUsed, 2);
});

test("applyPodHit: penetrating Kills go to a system in the pod", () => {
  const pod = { maxSP: 2, taken: { kills: 0, sp: 0 } };
  const r = applyPodHit(pod, 5, [{ maxKills: 4, takenKills: 0 }]);
  assert.equal(r.through, 3);
  assert.equal(r.taken.sp, 1);
  assert.equal(r.systemIndex, 0);
  assert.equal(r.systemTaken, 3);
  assert.equal(r.destroyed, false);                 // first penetrating hit no longer destroys the pod
  const r2 = applyPodHit({ maxSP: 2, taken: r.taken }, 5, [{ maxKills: 4, takenKills: 3 }]);
  assert.equal(r2.systemDestroyed, true);
  assert.equal(r2.destroyed, true);                 // every system in it destroyed -> pod destroyed
  const r3 = applyPodHit({ maxSP: 2, taken: r2.taken }, 5, [{ maxKills: 4, takenKills: 4 }]);
  assert.equal(r3.wasDestroyed, true);
});

test("applyPodHit: empty pod ablates but is never destroyed", () => {
  const r = applyPodHit({ maxSP: 1, taken: { kills: 0, sp: 0 } }, 9, []);
  assert.equal(r.through, 8);
  assert.equal(r.systemIndex, null);
  assert.equal(r.destroyed, false);
});
