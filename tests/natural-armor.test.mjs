import { test } from "node:test";
import assert from "node:assert/strict";
import { naturalArmorAt, hasNaturalArmor, strayLocationSPUpdate } from "../module/data/natural-armor.js";
import { ablatePersonalArmor, piercedSP } from "../module/data/armor.js";
import { armorSoakLabel } from "../module/data/attack-card.js";
import { ZONE_KEYS } from "../module/data/armor-coverage.js";

const LOCS = ["head", "torso", "rArm", "lArm", "rLeg", "lLeg"];
const locations = (sp, spMax = sp) => Object.fromEntries(LOCS.map(k => [k, { label: k, sp, spMax }]));
const apply = (system, update) => {
  const out = structuredClone(system);
  for (const [path, v] of Object.entries(update)) {
    const [, , , key, field] = path.split(".");   // system.body.locations.<key>.<field>
    out.body.locations[key][field] = v;
  }
  return out;
};
// _applyLocationDamage's no-piece branch, on the pure parts.
const unarmoredHit = (system, key, dmg) => {
  const nat = naturalArmorAt(system, key);
  const counted = piercedSP(nat.sp, false);
  const { spNow, belowThreshold } = ablatePersonalArmor(nat.sp, dmg);
  return { sp: nat.sp, counted, spNow, belowThreshold, armorName: "", softIgnored: false, through: Math.max(0, dmg - counted) };
};

test("a new character's schema defaults are SP 0 on every location", async () => {
  // Minimal foundry stub: each field keeps its options, so defineSchema() can be read in node.
  class Field { constructor(a, b) { this.a = a; this.b = b; } }
  globalThis.foundry ??= { abstract: { TypeDataModel: class {} }, data: { fields: new Proxy({}, { get: () => Field }) } };
  const { ActorDataModel } = await import("../module/data/actor-data-model.js");
  const locs = ActorDataModel.defineSchema().body.a.locations.a;
  assert.deepEqual(Object.keys(locs), LOCS);
  for (const k of LOCS) assert.deepEqual([locs[k].a.sp.a.initial, locs[k].a.spMax.a.initial], [0, 0], k);
});

test("leftover location SP is never armor without creature natural armor", () => {
  const system = { creature: { armorSP: 0 }, body: { locations: locations(10) } };
  assert.equal(hasNaturalArmor(system), false);
  for (const k of LOCS) assert.deepEqual(naturalArmorAt(system, k), { sp: 0, spMax: 0 });
});

test("unarmored punch to the torso: no armor, full damage through", () => {
  for (const system of [
    { creature: { armorSP: 0 }, body: { locations: locations(0) } },    // new character
    { creature: { armorSP: 0 }, body: { locations: locations(10) } }    // old default left behind
  ]) {
    const r = unarmoredHit(system, "torso", 4);
    assert.equal(r.through, 4);
    assert.equal(r.spNow, 0);
    assert.equal(armorSoakLabel(r, 5), "no armor");
  }
});

test("a creature with natural armor 6 still soaks 6 and ablates it", () => {
  const system = { creature: { armorSP: 6 }, body: { locations: locations(6) } };
  const r = unarmoredHit(system, "torso", 8);
  assert.deepEqual([r.sp, r.through, r.spNow], [6, 2, 5]);
  assert.equal(armorSoakLabel(r, 5), "SP 6 soaked (ablated to 5)");
  // Ablated natural armor reads the location's stored sp.
  system.body.locations.torso.sp = 5;
  assert.deepEqual(naturalArmorAt(system, "torso"), { sp: 5, spMax: 6 });
});

test("natural armor typed in by hand (location never stamped) reads armorSP", () => {
  const system = { creature: { armorSP: 6 }, body: { locations: locations(0) } };
  assert.deepEqual(naturalArmorAt(system, "head"), { sp: 6, spMax: 6 });
  assert.equal(unarmoredHit(system, "head", 4).through, 0);
});

test("worn armor on the card is unchanged; a piece worn to 0 still names the piece", () => {
  assert.equal(armorSoakLabel({ sp: 15, counted: 15, spNow: 14, armorName: "Heavy Mesh" }, 5), "SP 15 (Heavy Mesh) soaked (ablated to 14)");
  assert.equal(armorSoakLabel({ sp: 0, counted: 0, spNow: 0, armorName: "Light Mesh" }, 5), "SP 0 (Light Mesh) soaked");
  assert.equal(armorSoakLabel({ sp: 0, softIgnored: true }, 5), "soft armor ignored");
});

test("migration: unarmored locations go to 0, covered locations and creatures untouched", () => {
  const jacket = { id: "j", coverage: ["torso", "rArm", "lArm"] };
  const system = { creature: { armorSP: 0 }, body: { locations: locations(10) } };
  system.body.locations.torso = { label: "torso", sp: 12, spMax: 14 };
  const r = strayLocationSPUpdate(system, [jacket]);
  assert.deepEqual(r.locations, ["head", "rLeg", "lLeg"]);
  const after = apply(system, r.update);
  assert.deepEqual(after.body.locations.torso, { label: "torso", sp: 12, spMax: 14 });
  for (const k of ["head", "rLeg", "lLeg"]) assert.deepEqual([after.body.locations[k].sp, after.body.locations[k].spMax], [0, 0]);

  const wolf = { creature: { armorSP: 2 }, body: { locations: locations(2) } };
  assert.deepEqual(strayLocationSPUpdate(wolf, []), { update: {}, locations: [] });
});

test("migration: a leg counts as covered by either of its zones", () => {
  const boots = { id: "b", coverage: ["rLowerLeg", "lLowerLeg"] };
  assert.ok(ZONE_KEYS.includes("rLowerLeg"));
  const r = strayLocationSPUpdate({ creature: {}, body: { locations: locations(10) } }, [boots]);
  assert.deepEqual(r.locations, ["head", "torso", "rArm", "lArm"]);
});

test("migration run twice changes nothing the second time", () => {
  const system = { creature: { armorSP: 0 }, body: { locations: locations(10) } };
  const first = strayLocationSPUpdate(system, []);
  assert.equal(first.locations.length, 6);
  const second = strayLocationSPUpdate(apply(system, first.update), []);
  assert.deepEqual(second, { update: {}, locations: [] });
});
