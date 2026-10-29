import { test } from "node:test";
import assert from "node:assert/strict";
import { fullRecoveryUpdate, repairArmorUpdates, restUpdate } from "../module/data/recovery.js";
import { woundsOf, woundState } from "../module/data/damage-track.js";
import { ZONE_KEYS } from "../module/data/armor-coverage.js";

const loc = (hitsMax, wounds, bruises = 0) => ({ hitsMax, hits: hitsMax - wounds, bruises });
const apply = (locations, update) => {
  const out = structuredClone(locations);
  for (const [path, v] of Object.entries(update)) {
    const [, , , key, field] = path.split(".");   // system.body.locations.<key>.<field>
    out[key][field] = v;
  }
  return out;
};

test("Full Recovery clears Wounds, Bruises and Sprained", () => {
  const locations = { torso: loc(12, 5, 3), rArm: loc(6, 2, 4), head: loc(6, 0) };
  assert.equal(woundState("rArm", locations.rArm), "sprained");
  const { update, changes } = fullRecoveryUpdate(locations);
  const after = apply(locations, update);
  for (const k of Object.keys(after)) {
    assert.deepEqual([woundsOf(after[k]), after[k].bruises ?? 0], [0, 0]);
    assert.equal(woundState(k, after[k]), "ok");
  }
  assert.deepEqual(changes.map(c => [c.key, c.wounds, c.bruises]), [["torso", 5, 3], ["rArm", 2, 4]]);   // head untouched
});

test("Full Recovery restores negative Hits (MZ negative Hits)", () => {
  const { update } = fullRecoveryUpdate({ lLeg: loc(6, 9) });
  assert.equal(update["system.body.locations.lLeg.hits"], 6);
});

test("Repair Armor restores baseSP on every covered zone and clears activeArmorId", () => {
  const plate = { id: "p", name: "Heavy Plate", baseSP: 25, coverage: ["torso"], currentSP: { torso: 11 } };
  const suit = { id: "s", name: "Industrial Suit", baseSP: 15, coverage: [...ZONE_KEYS],
    currentSP: Object.fromEntries(ZONE_KEYS.map(z => [z, z === "rArm" ? 13 : 15])) };
  const zones = Object.fromEntries(ZONE_KEYS.map(z => [z, { activeArmorId: z === "torso" ? "p" : "s" }]));
  const r = repairArmorUpdates([plate, suit], {}, zones);
  const byId = Object.fromEntries(r.itemUpdates.map(u => [u._id, u["system.currentSP"]]));
  assert.equal(byId.p.torso, 25);
  assert.ok(ZONE_KEYS.every(z => byId.s[z] === 15));
  assert.ok(ZONE_KEYS.every(z => r.actorUpdate[`system.body.armorZones.${z}.activeArmorId`] === ""));
  assert.deepEqual(r.pieces.map(p => [p.name, p.zones]), [
    ["Heavy Plate", [{ zone: "torso", from: 11, to: 25 }]],
    ["Industrial Suit", [{ zone: "rArm", from: 13, to: 15 }]]
  ]);
});

test("Repair Armor resets natural armor to max only where no piece covers the location", () => {
  const mesh = { id: "m", name: "Heavy Mesh", baseSP: 15, coverage: ["torso"], currentSP: { torso: 15 } };
  const locations = { torso: { sp: 3, spMax: 15 }, head: { sp: 2, spMax: 4 }, lArm: { sp: 4, spMax: 4 } };
  const r = repairArmorUpdates([mesh], locations, {});
  assert.deepEqual(r.natural, [{ key: "head", from: 2, to: 4 }]);
  assert.equal(r.actorUpdate["system.body.locations.head.sp"], 4);
  assert.ok(!("system.body.locations.torso.sp" in r.actorUpdate));
  assert.deepEqual(r.itemUpdates, []);   // the intact mesh isn't rewritten
});

test("Rest 3h on 5B / 2W -> 2B / 2W", () => {
  const locations = { torso: loc(12, 2, 5) };
  const after = apply(locations, restUpdate(locations, 3).update);
  assert.deepEqual([woundsOf(after.torso), after.torso.bruises], [2, 2]);
});

test("Rest never touches Wounds", () => {
  const { update, healed } = restUpdate({ torso: loc(12, 4), rArm: loc(6, 2, 1) }, 10);
  assert.ok(Object.keys(update).every(p => p.endsWith(".bruises")));
  assert.deepEqual(healed, [{ key: "rArm", from: 1, to: 0 }]);
});

test("Rest 5h on 2B -> 0B, never negative; partial hours drop", () => {
  assert.equal(restUpdate({ head: loc(6, 0, 2) }, 5).update["system.body.locations.head.bruises"], 0);
  const r = restUpdate({ head: loc(6, 0, 2) }, 1.9);
  assert.equal(r.hours, 1);
  assert.equal(r.update["system.body.locations.head.bruises"], 1);
  assert.deepEqual(restUpdate({ head: loc(6, 0, 2) }, 0.5).healed, []);
});
