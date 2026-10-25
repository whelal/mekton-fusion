import { test } from "node:test";
import assert from "node:assert/strict";
import { armorTotals, presetForZones, effectiveCoverage, COVERAGE_PRESETS, ZONE_KEYS, zoneForHitRoll, zonesOfLocation } from "../module/data/armor-coverage.js";
import { seedZoneSP, migrateArmorSource, ablatePersonalArmor, pickActivePiece, resolveZoneHit, locationWearMoves, seedUnfilledPiece, armorLayerViolations } from "../module/data/armor.js";
import { ARMOR_CATALOG } from "../module/data/armor-catalog.js";

const heavyMesh = ARMOR_CATALOG.find(a => a.name === "Heavy Mesh").system;

test("mesh weight/cost is charged per covered location (thigh/lower leg = 1/2)", () => {
  assert.deepEqual(armorTotals({ ...heavyMesh, coverage: COVERAGE_PRESETS.jacket.zones }), { units: 3, weight: 1.2, cost: 168 });
  assert.deepEqual(armorTotals({ ...heavyMesh, coverage: COVERAGE_PRESETS.boots.zones }), { units: 1, weight: 0.4, cost: 56 });
  assert.equal(armorTotals({ ...heavyMesh, coverage: COVERAGE_PRESETS.overcoat.zones }).units, 4);
  assert.equal(armorTotals({ ...heavyMesh, coverage: COVERAGE_PRESETS.pants.zones }).units, 2);
  assert.equal(armorTotals({ ...heavyMesh, coverage: COVERAGE_PRESETS.shorts.zones }).units, 1);
});

test("fixed kinds use the table weight/cost and their own coverage", () => {
  const suit = ARMOR_CATALOG.find(a => a.name === "Industrial Suit").system;
  assert.deepEqual(armorTotals(suit), { units: null, weight: 3.4, cost: 502 });
  assert.deepEqual(effectiveCoverage({ kind: "helmet", coverage: ["torso"] }), ["head"]);
  assert.deepEqual(effectiveCoverage(suit), ZONE_KEYS);
});

test("presetForZones", () => {
  assert.equal(presetForZones(["lArm", "torso", "rArm"]), "jacket");
  assert.equal(presetForZones(["rArm"]), "custom");
  assert.equal(presetForZones([]), "custom");
});

test("seedZoneSP keeps ablation on zones already covered", () => {
  const sp = seedZoneSP(["torso", "rArm"], 15, { oldCoverage: ["torso"], oldSP: { torso: 9 } });
  assert.equal(sp.torso, 9);
  assert.equal(sp.rArm, 15);
  assert.equal(sp.head, 0);
});

test("migrateArmorSource maps legacy coverage and fills kind/tier/hardness", () => {
  const vest = migrateArmorSource({ name: "Heavy Mesh", category: "Ballistic Mesh", sp: 15, coverage: "vest" });
  assert.equal(vest.baseSP, 15);
  assert.deepEqual(vest.coverage, ["torso"]);
  assert.equal(vest.kind, "mesh");
  assert.equal(vest.tier, "heavy");
  assert.equal(vest.hardness, "soft");
  assert.equal(vest.migrationNote, undefined);

  assert.deepEqual(migrateArmorSource({ name: "Light Plate", category: "Multi-Polymer Plate", sp: 20, coverage: "pants" }).coverage,
    ["rThigh", "rLowerLeg", "lThigh", "lLowerLeg"]);
  const mil = migrateArmorSource({ name: "Military Suit", category: "Space Suit", sp: 25, coverage: "all" });
  assert.deepEqual(mil.coverage, ZONE_KEYS);
  assert.equal(mil.hardness, "hard");
  assert.equal(mil.migrationNote, undefined);
});

test("migrateArmorSource reports what it can't map instead of guessing", () => {
  const odd = migrateArmorSource({ name: "Chainmail", category: "Medieval", sp: 8, coverage: "gauntlets" });
  assert.equal(odd.kind, undefined);
  assert.deepEqual(odd.coverage, []);
  assert.match(odd.migrationNote, /kind unknown/);
  assert.match(odd.migrationNote, /coverage "gauntlets" unknown/);
});

test("migrateArmorSource leaves current-format data alone", () => {
  const cur = { name: "Heavy Mesh", kind: "mesh", baseSP: 15, coverage: ["torso"], hardness: "soft" };
  assert.deepEqual(migrateArmorSource({ ...cur }), cur);
});

test("personal armor ablates 1 SP only on hits of 5+", () => {
  assert.deepEqual(ablatePersonalArmor(25, 3), { spNow: 25, ablated: false, belowThreshold: true });
  assert.equal(ablatePersonalArmor(25, 5).spNow, 24);
  assert.equal(ablatePersonalArmor(10, 17).spNow, 9); // never more than 1 per hit
  assert.equal(ablatePersonalArmor(0, 9).spNow, 0);
});

test("each burst hit is checked separately", () => {
  let sp = 20;
  for (const dmg of [3, 6, 4, 9]) sp = ablatePersonalArmor(sp, dmg).spNow;
  assert.equal(sp, 18);
});

const mesh = (id, sp, coverage = ["torso"]) => ({ id, coverage, currentSP: Object.fromEntries(coverage.map(z => [z, sp])) });

test("spec G check: Heavy Mesh 15 + Light Mesh 10 on the torso, hits of 6", () => {
  const pieces = [mesh("heavy", 15), mesh("light", 10)];
  let active = "";
  const hit = () => {
    const r = resolveZoneHit(pieces, "torso", active, 6);
    active = r.activeId;
    r.piece.currentSP.torso = r.spNow;
    return r;
  };
  for (let i = 0; i < 6; i++) hit();
  assert.equal(active, "heavy");                  // sticky: 9 is below Light's 10
  assert.equal(pieces[0].currentSP.torso, 9);
  for (let i = 6; i < 15; i++) hit();
  assert.equal(pieces[0].currentSP.torso, 0);
  const r = hit();                                // 16th hit: Light takes over
  assert.equal(r.activeId, "light");
  assert.equal(r.sp, 10);
  assert.equal(r.through, 0);
});

test("pickActivePiece: highest current SP, ties by list order, layers never add", () => {
  const pieces = [mesh("a", 12), mesh("b", 12), mesh("c", 8)];
  assert.equal(pickActivePiece(pieces, "torso", ""), "a");
  assert.equal(pickActivePiece(pieces, "torso", "c"), "c");      // stored piece with SP stays
  assert.equal(pickActivePiece(pieces, "torso", "gone"), "a");   // removed piece: re-pick
  assert.equal(pickActivePiece(pieces, "head", ""), "");         // nothing covers the head
  const r = resolveZoneHit(pieces, "torso", "", 20);
  assert.equal(r.through, 8);                                    // 20 - 12, not 20 - 32
});

test("resolveZoneHit: only the hit zone, below-threshold hits don't ablate", () => {
  const pants = mesh("pants", 10, ["rThigh", "rLowerLeg", "lThigh", "lLowerLeg"]);
  const r = resolveZoneHit([pants], "rLowerLeg", "", 4);
  assert.deepEqual([r.sp, r.spNow, r.belowThreshold, r.through], [10, 10, true, 0]);
  const shorts = mesh("shorts", 10, ["rThigh", "lThigh"]);
  assert.equal(resolveZoneHit([shorts], "rLowerLeg", "", 6).piece, null);
});

test("hit-roll zones", () => {
  assert.deepEqual([1, 3, 5, 7, 8, 9, 10].map(zoneForHitRoll), ["head", "torso", "rArm", "rThigh", "rLowerLeg", "lThigh", "lLowerLeg"]);
  assert.deepEqual(zonesOfLocation("lLeg"), ["lThigh", "lLowerLeg"]);
});

test("migration moves location wear onto the providing piece, once", () => {
  const vest = mesh("vest", 15);
  const locations = { torso: { sp: 9, spMax: 15, itemId: "vest" }, head: { sp: 0, spMax: 0, itemId: "" } };
  const m = locationWearMoves(locations, [vest]);
  assert.equal(m.moved, 1);
  assert.deepEqual(m.itemUpdates, [{ _id: "vest", "system.currentSP.torso": 9 }]);
  assert.equal(m.actorUpdate["system.body.armorZones.torso.activeArmorId"], "vest");
  assert.equal(m.actorUpdate["system.body.locations.torso.sp"], 15);
  // after it's applied the location reads intact: a re-run moves nothing
  assert.equal(locationWearMoves({ torso: { sp: 15, spMax: 15, itemId: "vest" } }, [vest]).moved, 0);
});

test("migration on a leg only touches the zones the piece covers", () => {
  const shorts = mesh("shorts", 10, ["rThigh", "lThigh"]);
  const m = locationWearMoves({ rLeg: { sp: 7, spMax: 10, itemId: "shorts" } }, [shorts]);
  assert.deepEqual(m.itemUpdates, [{ _id: "shorts", "system.currentSP.rThigh": 7 }]);
});

test("seedUnfilledPiece: a piece with no per-zone SP gets base SP; the provider keeps its location wear", () => {
  const plate = { kind: "plate", baseSP: 20, coverage: ["torso", "rArm"], currentSP: {} };
  const sp = seedUnfilledPiece(plate, "p1", { torso: { sp: 17, itemId: "p1" }, rArm: { sp: 20, itemId: "other" } });
  assert.equal(sp.torso, 17);
  assert.equal(sp.rArm, 20);
  assert.equal(sp.head, 0);
});

test("seedUnfilledPiece leaves a piece with SP on any zone alone (safe to re-run)", () => {
  const worn = { kind: "plate", baseSP: 20, coverage: ["torso", "rArm"], currentSP: { torso: 0, rArm: 3 } };
  assert.equal(seedUnfilledPiece(worn, "p1"), null);
  assert.equal(seedUnfilledPiece({ kind: "plate", baseSP: 0, coverage: ["torso"] }, "p2"), null);
});

test("two-layer limit: a third piece on a zone is refused, re-covering a piece isn't counted twice", () => {
  const worn = [mesh("vest", 15), mesh("jacket", 10, ["torso", "rArm", "lArm"])];
  assert.deepEqual(armorLayerViolations(worn, ["torso"]), ["torso"]);
  assert.deepEqual(armorLayerViolations(worn, ["rArm", "head"]), []);           // arms have 1 layer
  assert.deepEqual(armorLayerViolations(worn, ["torso", "rArm"], "jacket"), []); // jacket re-covering itself
  assert.deepEqual(armorLayerViolations([mesh("helmet", 20, ["head"])], ["head"]), []);
});
