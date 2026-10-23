import { test } from "node:test";
import assert from "node:assert/strict";
import { armorTotals, presetForZones, effectiveCoverage, COVERAGE_PRESETS, ZONE_KEYS } from "../module/data/armor-coverage.js";
import { seedZoneSP, migrateArmorSource } from "../module/data/armor.js";
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
