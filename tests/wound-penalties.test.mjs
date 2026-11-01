import { test } from "node:test";
import assert from "node:assert/strict";
import { locationWoundEffect, woundPenalties, needsTurnStunRoll, turnStunCauses, locationStates, appliedWoundPenalty, halvedIf, REALISTIC_DAMAGE } from "../module/data/wound-penalties.js";
import { TABLE_RULINGS } from "../module/rules/table-rulings.js";
import { woundState } from "../module/data/damage-track.js";

const loc = (hitsMax, hits, bruises = 0) => ({ hitsMax, hits, bruises });
const healthy = () => ({ head: loc(4, 4), torso: loc(10, 10), rArm: loc(5, 5), lArm: loc(5, 5), rLeg: loc(6, 6), lLeg: loc(6, 6) });
const pen = (key, l) => locationWoundEffect(key, l).penalty;
const turn = (locs, isUnconscious = false) => needsTurnStunRoll({ ...locationStates(locs), isUnconscious });

test("head or torso at exactly 1 Hit: -1", () => {
  assert.equal(pen("head", loc(4, 1)), -1);
  assert.equal(pen("torso", loc(10, 1)), -1);
  assert.equal(pen("torso", loc(10, 2)), 0);
  assert.equal(pen("head", loc(4, 0)), 0);     // head at 0: unconscious (core), no Realistic Damage penalty
});

test("torso at 0 or -1 Wound Hits: -2, stacks, Stun/Shock each turn; -2 is dead", () => {
  assert.deepEqual([0, -1, -2].map(h => pen("torso", loc(10, h))), [-2, -2, 0]);
  assert.equal(woundPenalties({ ...healthy(), torso: loc(10, 0), rArm: loc(5, 0) }).total, -3);
  assert.deepEqual(turnStunCauses(locationStates({ ...healthy(), torso: loc(10, -1) })), ["torso"]);
  assert.deepEqual(turnStunCauses(locationStates({ ...healthy(), torso: loc(10, 0), lArm: loc(5, -5) })), ["torso", "lArm"]);
  assert.equal(turn({ ...healthy(), torso: loc(10, -2) }), false);
});

test("torso full with Bruises -> stun-check state, per-turn roll fires, no -2 penalty", () => {
  const locs = { ...healthy(), torso: loc(10, 10, 10) };
  assert.equal(woundState("torso", locs.torso), "stun-check");
  assert.equal(turn(locs), true);
  assert.equal(woundPenalties(locs).total, 0);
});

test("head full (Wounds or Bruises) is unconscious: no per-turn roll", () => {
  assert.equal(turn({ ...healthy(), head: loc(4, 4, 4), lArm: loc(5, -5) }), false);
  assert.equal(turn({ ...healthy(), head: loc(4, 0), torso: loc(10, 0) }), false);
});

test("needsTurnStunRoll: the per-turn decision from states and the Unconscious status", () => {
  const ok = { headState: "ok", torsoState: "ok", limbStates: { rArm: "ok", lArm: "ok", rLeg: "ok", lLeg: "ok" } };
  assert.equal(needsTurnStunRoll({ ...ok, torsoState: "stun-check", isUnconscious: true }), false);   // unconscious
  assert.equal(needsTurnStunRoll({ ...ok, limbStates: { lArm: "severed" }, isUnconscious: true }), false);
  assert.equal(needsTurnStunRoll({ ...ok, torsoState: "stun-check", isUnconscious: false }), true);   // torso at 0, awake
  assert.equal(needsTurnStunRoll({ ...ok, limbStates: { ...ok.limbStates, lArm: "severed" } }), true); // blown-off limb, awake
  assert.equal(needsTurnStunRoll({ ...ok, limbStates: { rArm: "shattered", lLeg: "broken" } }), false); // nothing qualifying
  assert.equal(needsTurnStunRoll(ok), false);
  assert.equal(needsTurnStunRoll({ ...ok, headState: "dead", torsoState: "stun-check" }), false);
});

test("limb thresholds: 0 -> -1, -1 to -4 -> -3, -5 or below -> -5", () => {
  assert.deepEqual([0, -1, -4, -5, -8].map(h => pen("rArm", loc(5, h))), [-1, -3, -3, -5, -5]);
  assert.deepEqual([pen("lLeg", loc(6, 2)), pen("lLeg", loc(6, 6))], [0, 0]);
});

test("limb at 1 Hit: arm halves Lift, leg halves MA, no action penalty", () => {
  assert.deepEqual(locationWoundEffect("lArm", loc(5, 1)), { penalty: 0, maHalved: false, liftHalved: true, blownOff: false, reason: "1 Hit left: Lift halved" });
  const leg = locationWoundEffect("rLeg", loc(6, 1));
  assert.deepEqual([leg.penalty, leg.maHalved, leg.liftHalved], [0, true, false]);
});

test("a location whose max is 1 isn't 'at 1 Hit remaining' until it's wounded", () => {
  assert.equal(pen("head", loc(1, 1)), 0);
});

test("penalties stack across locations: torso at 1 + broken arm = -2", () => {
  const locs = { ...healthy(), torso: loc(10, 1), rArm: loc(5, 0) };
  assert.equal(woundPenalties(locs).total, -2);
  const worse = { ...locs, lLeg: loc(6, -5) };
  assert.equal(woundPenalties(worse).total, -7);
});

test("Bruises never trigger penalties (Wounds only)", () => {
  const locs = { ...healthy(), torso: loc(10, 10, 9), rArm: loc(5, 5, 5), rLeg: loc(6, 6, 5) };
  const w = woundPenalties(locs);
  assert.deepEqual([w.total, w.maHalved, w.liftHalved], [0, false, false]);
});

test("a blown-off limb triggers the per-turn Stun/Shock roll", () => {
  assert.equal(turn({ ...healthy(), lArm: loc(5, -5) }), true);
  assert.equal(turn({ ...healthy(), lArm: loc(5, -4) }), false);
  assert.equal(turn({ ...healthy(), lArm: loc(5, -6), torso: loc(10, -2) }), false);   // already dead
  assert.deepEqual(woundPenalties({ ...healthy(), lArm: loc(5, -6) }).blownOff, ["lArm"]);
});

test("MA and Lift halve once, however many limbs call for it", () => {
  const w = woundPenalties({ ...healthy(), rLeg: loc(6, 1), lLeg: loc(6, 1), rArm: loc(5, 1), lArm: loc(5, 1) });
  assert.deepEqual([w.maHalved, w.liftHalved, w.total], [true, true, 0]);
  assert.equal(halvedIf(15, w.maHalved), 7.5);
  assert.equal(halvedIf(15, false), 15);
});

test("the roll dialog's untick removes the penalty", () => {
  assert.equal(appliedWoundPenalty(-4), -4);
  assert.equal(appliedWoundPenalty(-4, { ticked: true }), -4);
  assert.equal(appliedWoundPenalty(-4, { ticked: false }), 0);
});

test("ruling off: no penalties", () => {
  const was = TABLE_RULINGS.realisticDamagePenalties;
  TABLE_RULINGS.realisticDamagePenalties = false;
  try {
    assert.equal(woundPenalties({ ...healthy(), rArm: loc(5, -6) }).total, 0);
  } finally { TABLE_RULINGS.realisticDamagePenalties = was; }
  assert.equal(REALISTIC_DAMAGE.limbBlownOff, -5);
});
