import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyColumn, injuryType, recoveryRate, modifiedRate, recoverLocation, recoverActor } from "../module/data/natural-recovery.js";

const loc = (hitsMax, hits, bruises = 0, recoveryRemainder = 0) => ({ hitsMax, hits, bruises, recoveryRemainder });
const run = (key, l, opts) => recoverLocation(key, l, { hoursPerDay: 0, ...opts });

test("BODY columns: 2 | 3-4 | 5-7 | 8-9 | 10, clamped at both ends", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 14].map(bodyColumn), [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test("BODY 5-7 Wounds, natural, 3 days -> +3", () => {
  assert.equal(run("torso", loc(12, 4), { body: 6, days: 3 }).hits, 7);
});

test("BODY 8-9 Broken, natural, 2 days -> +1 (0.5 builds up)", () => {
  const one = run("rArm", loc(9, -1), { body: 8, days: 1 });
  assert.deepEqual([one.hits, one.remainder], [-1, 0.5]);
  const two = run("rArm", loc(9, -1), { body: 8, days: 2 });
  assert.deepEqual([two.hits, two.remainder], [0, 0]);
  assert.equal(run("rArm", loc(9, -1, 0, 0.5), { body: 8, days: 1 }).hits, 0);   // a stored remainder carries over
});

test("BODY 2 Wounds, natural -> loses 1/day, only with deterioration allowed", () => {
  const held = run("torso", loc(12, 8), { body: 2, days: 2 });
  assert.deepEqual([held.hits, held.deteriorates, held.held], [8, true, true]);
  const worse = run("torso", loc(12, 8), { body: 2, days: 2, allowDeterioration: true });
  assert.equal(worse.hits, 6);
});

test("deterioration flags each MZ threshold crossed", () => {
  const r = run("lLeg", loc(9, 1), { body: 2, days: 3, allowDeterioration: true });
  // 1 -> 0 (Wounds -1: Broken) -> -2 (Broken -2: Mangled) -> -4 (Mangled -2)
  assert.equal(r.hits, -4);
  assert.deepEqual(r.crossed, ["Broken", "Mangled"]);
  const head = run("head", loc(6, 0), { body: 2, days: 1, allowDeterioration: true });
  assert.deepEqual([head.hits, head.crossed], [-2, ["Dead"]]);
});

test("a limb at -1, BODY 5-7, natural -> 0/day (stays Broken)", () => {
  const r = run("rArm", loc(9, -1), { body: 6, days: 5 });
  assert.deepEqual([r.hits, r.types[4], r.deteriorates], [-1, "broken", false]);
});

test("medical, BODY 5-7, Broken -> 1/day", () => {
  assert.equal(recoveryRate("broken", 6, { medical: true }), 1);
  assert.equal(run("lArm", loc(9, -1), { body: 6, days: 1, medical: true }).hits, 0);
});

test("a limb crossing 0 -> 1 switches from Broken to Wounds the next day", () => {
  const r = run("rArm", loc(9, -1), { body: 6, days: 3, medical: true });
  assert.deepEqual(r.types, ["broken", "broken", "wounds"]);
  assert.equal(r.hits, 4);   // -1 -> 0 -> 1 (Broken, 1/day), then Wounds at 3/day
});

test("Bruises: 5, 3 hours rested x 1 day -> 2; 8 hours clears them", () => {
  assert.equal(run("torso", loc(12, 12, 5), { body: 6, days: 1, hoursPerDay: 3 }).bruises, 2);
  assert.equal(run("torso", loc(12, 12, 5), { body: 6, days: 1, hoursPerDay: 8 }).bruises, 0);
});

test("healing never exceeds hitsMax; the remainder resets once healed", () => {
  const r = run("torso", loc(12, 11, 0, 0.5), { body: 10, days: 5, medical: true });
  assert.deepEqual([r.hits, r.remainder], [12, 0]);
});

test("a location with no Wounds never changes, even at a negative rate", () => {
  const r = run("torso", loc(12, 12), { body: 2, days: 3, allowDeterioration: true });
  assert.deepEqual([r.hits, r.deteriorates, r.rates], [12, false, []]);
});

test("severed limbs and dead locations are skipped", () => {
  assert.equal(injuryType("rLeg", -5), "severed");
  assert.equal(injuryType("torso", -2), "dead");
  const r = run("rLeg", loc(9, -6), { body: 10, days: 3, medical: true });
  assert.deepEqual([r.hits, r.skipped], [-6, "severed"]);
});

test("drug hooks: x2 and +1 on positive rates only", () => {
  assert.equal(modifiedRate(1, { speedHeal: true }), 2);
  assert.equal(modifiedRate(0.5, { speedHeal: true, syntheFlesh: true }), 2);
  assert.equal(modifiedRate(-1, { speedHeal: true, syntheFlesh: true }), -1);
  assert.equal(modifiedRate(0, { syntheFlesh: true }), 0);
});

test("recoverActor writes only what changed; a held row carries ifAllowed", () => {
  const { update, rows } = recoverActor(
    { torso: loc(12, 8), head: loc(6, 6, 2) },
    { body: 2, days: 1, hoursPerDay: 2 }
  );
  assert.deepEqual(update, { "system.body.locations.head.bruises": 0 });
  const torso = rows.find(r => r.key === "torso");
  assert.deepEqual([torso.held, torso.ifAllowed.hits], [true, 7]);
});
