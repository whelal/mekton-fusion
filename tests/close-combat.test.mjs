import { test } from "node:test";
import assert from "node:assert/strict";
import { CLOSE_MANEUVERS, MELEE_STRIKE_TARGETS, maneuverTargets, closeTargetsFor, closeCalledPenalty, defaultCloseTarget, closeHitZone, isQuickManeuver, closeAttackPlan, runAttackPlan } from "../module/data/close-combat.js";

const total = (m, target) => m.wa + closeCalledPenalty(m.targets, target, m.defaultGroup);

test("Punch: torso free, head -4, arm -2; no legs", () => {
  const p = CLOSE_MANEUVERS.punch;
  assert.equal(defaultCloseTarget(p.targets), "torso");
  assert.equal(total(p, "torso"), 0);
  assert.equal(total(p, "head"), -4);
  assert.equal(total(p, "rArm"), -2);
  assert.ok(!closeTargetsFor(p.targets).includes("rLeg"));
});

test("Chop and Crescent have no free location", () => {
  for (const m of [CLOSE_MANEUVERS.chop, CLOSE_MANEUVERS.crescent]) {
    assert.equal(total(m, "head"), -6);
    assert.equal(total(m, "lArm"), -4);
    assert.ok(!closeTargetsFor(m.targets).includes("torso"));
  }
});

test("single-location maneuvers take only their WA", () => {
  assert.deepEqual(closeTargetsFor(CLOSE_MANEUVERS.spin.targets), ["head"]);
  assert.equal(total(CLOSE_MANEUVERS.spin, "head"), -4);
  assert.equal(total(CLOSE_MANEUVERS.kick, "rLeg"), 0);
  assert.equal(total(CLOSE_MANEUVERS.wheel, "torso"), -1);
  assert.equal(total(CLOSE_MANEUVERS.thrust, "torso"), -3);
  assert.equal(total(CLOSE_MANEUVERS.jab, "eyes"), -5);
});

test("melee weapon strike: any location, torso free", () => {
  assert.equal(defaultCloseTarget(MELEE_STRIKE_TARGETS), "torso");
  assert.equal(closeCalledPenalty(MELEE_STRIKE_TARGETS, "head"), -4);
  assert.equal(closeCalledPenalty(MELEE_STRIKE_TARGETS, "lArm"), -2);
  assert.equal(closeCalledPenalty(MELEE_STRIKE_TARGETS, "rLeg"), -2);
});

test("a multi-location sweep can make legs free", () => {
  const groups = ["torso", "leg"];
  assert.equal(defaultCloseTarget(groups, "leg"), "rLeg");
  assert.equal(closeCalledPenalty(groups, "lLeg", "leg"), 0);
  assert.equal(closeCalledPenalty(groups, "torso", "leg"), 0); // torso costs 0 anyway
});

test("leg hits split thigh / lower leg on the chosen side", () => {
  assert.equal(closeHitZone("rLeg", () => 0.1), "rThigh");
  assert.equal(closeHitZone("rLeg", () => 0.9), "rLowerLeg");
  assert.equal(closeHitZone("lLeg", () => 0.1), "lThigh");
  assert.equal(closeHitZone("lLeg", () => 0.9), "lLowerLeg");
  assert.equal(closeHitZone("eyes"), "head");
  assert.equal(closeHitZone("torso"), "torso");
});

test("Bite: level reaches like a Punch; from the ground, legs only and free", () => {
  const b = CLOSE_MANEUVERS.bite;
  const level = maneuverTargets(b, "level");
  assert.deepEqual(closeTargetsFor(level), closeTargetsFor(CLOSE_MANEUVERS.punch.targets));
  assert.equal(defaultCloseTarget(level), "torso");
  assert.equal(b.wa + closeCalledPenalty(level, "head"), -4);
  const ground = maneuverTargets(b, "ground");
  assert.deepEqual(closeTargetsFor(ground), ["rLeg", "lLeg"]);
  assert.equal(b.wa + closeCalledPenalty(ground, "lLeg"), 0);
  assert.equal(b.damage, "1D3+");
});

test("maneuvers without positions ignore the position", () => {
  assert.equal(maneuverTargets(CLOSE_MANEUVERS.kick, "level"), CLOSE_MANEUVERS.kick.targets);
});

test("every maneuver has damage or a named effect", () => {
  for (const [k, m] of Object.entries(CLOSE_MANEUVERS)) assert.ok(m.damage || m.effect, k);
  assert.equal(CLOSE_MANEUVERS.chop.effect, "Stun");
  assert.equal(CLOSE_MANEUVERS.spin.damage, "1D6+3+");
});

test("Quick maneuvers: fist strikes only; kicks and Bite are not", () => {
  const quick = Object.keys(CLOSE_MANEUVERS).filter(isQuickManeuver);
  assert.deepEqual(quick.sort(), ["backhand", "chop", "claw", "elbow", "jab", "punch"]);
});

test("Quick off is one attack; Quick on is two, each with its own location penalty", () => {
  const p = CLOSE_MANEUVERS.punch;
  assert.deepEqual(closeAttackPlan(false, ["torso", "head"], p.targets), [{ target: "torso", locPenalty: 0 }]);
  assert.deepEqual(closeAttackPlan(true, ["torso", "head"], p.targets),
    [{ target: "torso", locPenalty: 0 }, { target: "head", locPenalty: -4 }]);
  assert.deepEqual(closeAttackPlan(true, ["rArm"], MELEE_STRIKE_TARGETS).map(a => a.target), ["rArm", "rArm"]);
});

test("Quick attacks resolve independently: one hits, one misses", async () => {
  const plan = closeAttackPlan(true, ["torso", "head"], CLOSE_MANEUVERS.punch.targets);
  const rolls = [12, 12], evades = [10, 10];                       // same roll and Evade for both
  const seen = [];
  const results = await runAttackPlan(plan, async (a, n) => {
    seen.push(n);
    const total = rolls[n - 1] + a.locPenalty;
    return { target: a.target, total, hit: total > evades[n - 1] };  // ties go to the defender
  });
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(results, [{ target: "torso", total: 12, hit: true }, { target: "head", total: 8, hit: false }]);
  // a miss first doesn't stop the second attack
  const after = await runAttackPlan([...plan].reverse(), async a => 12 + a.locPenalty > 10);
  assert.deepEqual(after, [false, true]);
});
