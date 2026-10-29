import { test } from "node:test";
import assert from "node:assert/strict";
import { piercedSP, ablatePersonalArmor, resolveZoneHit, resolveBruiseZoneHit } from "../module/data/armor.js";
import { WEAPON_CATALOG } from "../module/data/weapon-catalog.js";
import { catalogWeaponUpdate } from "../module/migrate-actors.js";

const mesh = (sp, hardness = "soft") => ({ id: "m", name: "Heavy Mesh", baseSP: sp, hardness, coverage: ["torso"], currentSP: { torso: sp } });

test("AP: SP 15 vs 16 counts as 7, 9 through", () => {
  const r = resolveZoneHit([mesh(15)], "torso", "", 16, { ap: true });
  assert.deepEqual([r.sp, r.counted, r.through], [15, 7, 9]);
});

test("AP: SP 1 counts as 0; halving rounds down", () => {
  assert.equal(piercedSP(1, true), 0);
  assert.equal(piercedSP(14, true), 7);
  assert.equal(resolveZoneHit([mesh(1)], "torso", "", 3, { ap: true }).through, 3);
});

test("AP ablation is unchanged: 1 SP only at >= 5 damage before armor", () => {
  assert.equal(resolveZoneHit([mesh(15)], "torso", "", 4, { ap: true }).spNow, 15);
  assert.equal(resolveZoneHit([mesh(15)], "torso", "", 5, { ap: true }).spNow, 14);
  assert.equal(resolveZoneHit([mesh(15)], "torso", "", 30, { ap: true }).spNow, 14);
});

test("a non-AP weapon is unchanged", () => {
  const r = resolveZoneHit([mesh(15)], "torso", "", 16);
  assert.deepEqual([r.counted, r.through], [15, 1]);
  assert.equal(piercedSP(15), 15);
});

test("AP halving never reaches stored SP: Heavy Plate 25, two AP hits of 9", () => {
  const plate = { ...mesh(25, "hard"), id: "p", name: "Heavy Plate" };
  const first = resolveZoneHit([plate], "torso", "", 9, { ap: true });
  assert.deepEqual([first.sp, first.counted, first.spNow], [25, 12, 24]);   // "SP 25 counts as 12", stored 24
  plate.currentSP.torso = first.spNow;                                      // what _applyLocationDamage writes back
  const second = resolveZoneHit([plate], "torso", "p", 9, { ap: true });
  assert.deepEqual([second.sp, second.counted, second.spNow], [24, 12, 23]);
});

test("AP halving never reaches stored SP: Bruise hard-piece path", () => {
  const plate = { ...mesh(25, "hard"), id: "p", name: "Heavy Plate" };
  const first = resolveBruiseZoneHit([plate], "torso", 9, { ap: true });
  assert.deepEqual([first.sp, first.counted, first.spNow], [25, 12, 24]);
  plate.currentSP.torso = first.spNow;
  const second = resolveBruiseZoneHit([plate], "torso", 9, { ap: true });
  assert.deepEqual([second.sp, second.counted, second.spNow], [24, 12, 23]);
});

test("AP halving never reaches stored SP: natural armor path", () => {
  // _applyLocationDamage's no-piece branch: counted = piercedSP, stored = ablatePersonalArmor(sp).spNow
  let sp = 25;
  assert.equal(piercedSP(sp, true), 12);
  sp = ablatePersonalArmor(sp, 9).spNow;
  assert.equal(sp, 24);
  assert.equal(piercedSP(sp, true), 12);
  assert.equal(ablatePersonalArmor(sp, 9).spNow, 23);
});

test("AP Bruise halves only the hard armor it meets", () => {
  const plate = { ...mesh(18, "hard"), id: "p", name: "Heavy Plate" };
  const r = resolveBruiseZoneHit([mesh(15), plate], "torso", 12, { ap: true });
  assert.deepEqual([r.piece.id, r.counted, r.through], ["p", 9, 3]);
  assert.equal(resolveBruiseZoneHit([mesh(15)], "torso", 12, { ap: true }).through, 12);   // soft: ignored anyway
});

test("catalog AP weapons are the [AP] entries minus the Battleaxe (MZ errata p.98)", () => {
  const ap = WEAPON_CATALOG.filter(w => w.system.armorPiercing).map(w => w.name).sort();
  assert.deepEqual(ap, ["Broadsword", "Chainsaw", "Combat Knife", "Dagger", "Monoknife", "Monosword", "Rapier", "Shuriken", "Spear", "Sword"]);
  assert.ok(WEAPON_CATALOG.every(w => !/AP/.test(w.system.damage)));   // no [AP] left in a damage string
});

test("migration sets AP once; a GM's change survives re-running", () => {
  const sword = WEAPON_CATALOG.find(w => w.name === "Sword");
  const owned = { system: { skill: "blade", damageType: "wound", armorPiercing: false }, flags: { "mekton-fusion": { damageTypeSet: true, quickSet: true } } };
  assert.deepEqual(catalogWeaponUpdate(owned, sword), { "system.armorPiercing": true, "flags.mekton-fusion.apSet": true });
  const unticked = { ...owned, flags: { "mekton-fusion": { damageTypeSet: true, quickSet: true, apSet: true } } };
  assert.equal(catalogWeaponUpdate(unticked, sword), null);
});

test("Battleaxe is not AP: its hit meets full SP", () => {
  const axe = WEAPON_CATALOG.find(w => w.name === "Battleaxe");
  const r = resolveZoneHit([mesh(15)], "torso", "", 16, { ap: axe.system.armorPiercing });
  assert.deepEqual([r.counted, r.through], [15, 1]);
});

test("AP errata clears a Battleaxe the 0.3.33 step set true, once; a GM's later edit survives", () => {
  const axe = WEAPON_CATALOG.find(w => w.name === "Battleaxe");
  const flags = { damageTypeSet: true, quickSet: true, apSet: true };
  const migrated = { system: { skill: "blade", damageType: "wound", armorPiercing: true }, flags: { "mekton-fusion": flags } };
  assert.deepEqual(catalogWeaponUpdate(migrated, axe), { "system.armorPiercing": false, "flags.mekton-fusion.apErrataSet": true });
  const gmTicked = { ...migrated, flags: { "mekton-fusion": { ...flags, apErrataSet: true } } };
  assert.equal(catalogWeaponUpdate(gmTicked, axe), null);
  const fresh = { system: { skill: "blade", damageType: "wound", armorPiercing: false }, flags: { "mekton-fusion": { damageTypeSet: true, quickSet: true } } };
  assert.deepEqual(catalogWeaponUpdate(fresh, axe), { "flags.mekton-fusion.apSet": true, "flags.mekton-fusion.apErrataSet": true });
});
