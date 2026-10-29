import { test } from "node:test";
import assert from "node:assert/strict";
import { bestParryWeapon, parryDA, parrySkill, pickBlockingArm, chooseDefense, parryOutcome, armBlockOutcome, clubDamage, isMeleeBuilt } from "../module/data/defense.js";
import { closeAttackPlan, runAttackPlan, CLOSE_MANEUVERS } from "../module/data/close-combat.js";
import { WEAPON_CATALOG } from "../module/data/weapon-catalog.js";
import { martialArtWeaponUpdate, migrateActorWeapons } from "../module/migrate-actors.js";

const held = (name, inHand = true) => {
  const w = WEAPON_CATALOG.find(x => x.name === name);
  return { name: w.name, system: { ...w.system, inHand } };
};
const ranks = { blade: 3, fencing: 0 };
const loc = (hitsMax, wounds, bruises = 0) => ({ hitsMax, hits: hitsMax - wounds, bruises });
const arms = (r, l) => ({ rArm: r, lArm: l });

test("Evade fails, weapon Parry succeeds; a tie parries", () => {
  const parry = bestParryWeapon([held("Quarterstaff")], ranks);
  assert.equal(chooseDefense("auto", { attackKind: "melee", parry, arm: { key: "rArm", penalty: 0 } }), "weapon");
  assert.equal(parryOutcome(16, 15), "parried");
  assert.equal(parryOutcome(15, 15), "parried");
  assert.equal(parryOutcome(14, 15), "failed");
});

test("a punch: no weapon Parry; an Arm Block is used instead", () => {
  const parry = bestParryWeapon([held("Sword")], ranks);
  assert.ok(parry);
  assert.equal(chooseDefense("auto", { attackKind: "unarmed", parry, arm: { key: "rArm", penalty: 0 } }), "arm");
  assert.equal(chooseDefense("weapon", { attackKind: "unarmed", parry, arm: { key: "rArm", penalty: 0 } }), null);
});

test("ranged attacks get no further defense; None means none", () => {
  const parry = bestParryWeapon([held("Sword")], ranks);
  const arm = { key: "rArm", penalty: 0 };
  assert.equal(chooseDefense("auto", { attackKind: "ranged", parry, arm }), null);
  assert.equal(chooseDefense("arm", { attackKind: "ranged", parry, arm }), null);
  assert.equal(chooseDefense("none", { attackKind: "melee", parry, arm }), null);
  assert.equal(chooseDefense("arm", { attackKind: "melee", parry, arm }), "arm");
});

test("a shotgun parries at DA -2 even with WA +2", () => {
  const shotgun = { name: "Pump Shotgun", system: { skill: "rifle", wa: 2, range: "50", inHand: true } };
  assert.equal(isMeleeBuilt(shotgun.system), false);
  assert.equal(parryDA(shotgun.system), -2);
  const p = bestParryWeapon([shotgun], ranks);
  assert.deepEqual([p.da, p.improvised, p.skill.label], [-2, true, "Blade"]);
  assert.equal(parryDA(WEAPON_CATALOG.find(w => w.name === "Quarterstaff").system), 2);   // built for melee: its WA
  assert.equal(parryDA(WEAPON_CATALOG.find(w => w.name === "Boomerang").system), -2);     // thrown: improvised
});

test("a sword uses max(Blade, Fencing); other weapons use Blade", () => {
  assert.deepEqual(parrySkill(held("Sword"), { blade: 2, fencing: 4 }), { label: "Fencing", rank: 4 });
  assert.deepEqual(parrySkill(held("Sword"), { blade: 5, fencing: 4 }), { label: "Blade", rank: 5 });
  assert.deepEqual(parrySkill(held("Quarterstaff"), { blade: 2, fencing: 4 }), { label: "Blade", rank: 2 });
  const fencingSkill = { name: "Homemade Foil", system: { skill: "fencing" } };
  assert.equal(parrySkill(fencingSkill, { blade: 1, fencing: 3 }).rank, 3);
});

test("the best in-hand weapon parries (skill + DA)", () => {
  const p = bestParryWeapon([held("Mace"), held("Quarterstaff"), held("Sword", false)], ranks);
  assert.equal(p.weapon.name, "Quarterstaff");                   // WA 2 beats the Mace's -1; the Sword isn't drawn
});

test("a weapon not in hand can't parry", () => {
  const parry = bestParryWeapon([held("Sword", false)], ranks);
  assert.equal(parry, null);
  assert.equal(chooseDefense("weapon", { attackKind: "melee", parry, arm: null }), null);
  assert.equal(chooseDefense("auto", { attackKind: "melee", parry, arm: { key: "lArm", penalty: 0 } }), "arm");
});

test("Arm Block margins: -1 fails; 0 and 4 hit the blocking arm; 5 is clean", () => {
  assert.deepEqual(armBlockOutcome(14, 15), { result: "failed", margin: -1 });
  assert.deepEqual(armBlockOutcome(15, 15), { result: "arm", margin: 0 });
  assert.deepEqual(armBlockOutcome(19, 15), { result: "arm", margin: 4 });
  assert.deepEqual(armBlockOutcome(20, 15), { result: "clean", margin: 5 });
});

test("blocking arm: most Hits, then armor; a broken arm is skipped; a sprained arm gets -3", () => {
  assert.deepEqual(pickBlockingArm(arms(loc(9, 3), loc(9, 1))), { key: "lArm", penalty: 0 });
  assert.deepEqual(pickBlockingArm(arms(loc(9, 0), loc(9, 0)), { lArm: 10 }), { key: "lArm", penalty: 0 });
  assert.deepEqual(pickBlockingArm(arms(loc(9, 0), loc(9, 0))), { key: "rArm", penalty: 0 });
  assert.deepEqual(pickBlockingArm(arms(loc(9, 9), loc(9, 6))), { key: "lArm", penalty: 0 });      // right arm broken
  assert.deepEqual(pickBlockingArm(arms(loc(9, 9), loc(9, 5, 4))), { key: "lArm", penalty: -3 });  // left sprained
  assert.equal(pickBlockingArm(arms(loc(9, 9), loc(9, 11))), null);                                 // no arm can block
});

test("Quick: two independent defenses, one parried and one not", async () => {
  const plan = closeAttackPlan(true, ["torso", "head"], CLOSE_MANEUVERS.punch.targets);
  const parryRolls = [18, 9];
  const out = await runAttackPlan(plan, async (a, n) => parryOutcome(parryRolls[n - 1], 15 + a.locPenalty));
  assert.deepEqual(out, ["parried", "failed"]);
});

test("club damage: handguns and small Auto Weapons 1D3+, long guns 1D6+; not a firearm, null", () => {
  assert.equal(clubDamage({ skill: "handgun" }), "1D3+");
  assert.equal(clubDamage({ skill: "rifle" }), "1D6+");
  assert.equal(clubDamage({ skill: "automatic-weapon", conc: "J" }), "1D3+");
  assert.equal(clubDamage({ skill: "automatic-weapon", conc: "N" }), "1D6+");
  assert.equal(clubDamage({ skill: "blade" }), null);
  assert.equal(clubDamage({ skill: "archery" }), null);
});

test("migration moves Martial Art weapons to Hand to Hand and lists them", async () => {
  assert.deepEqual(martialArtWeaponUpdate({ system: { skill: "martial-art" } }), { "system.skill": "hand-to-hand" });
  assert.equal(martialArtWeaponUpdate({ system: { skill: "blade" } }), null);
  const sent = [];
  const actor = {
    name: "Keith",
    items: [
      { id: "w1", type: "weapon", name: "Brass Knuckles", system: { skill: "martial-art" }, flags: {} },
      { id: "w2", type: "weapon", name: "Pipe", system: { skill: "blade" }, flags: {} }
    ],
    updateEmbeddedDocuments: async (type, updates) => sent.push(...updates)
  };
  const report = { weaponsFixed: 0, martialArtWeapons: [] };
  await migrateActorWeapons(actor, new Map(), report);
  assert.deepEqual(sent, [{ _id: "w1", "system.skill": "hand-to-hand" }]);
  assert.deepEqual(report.martialArtWeapons, ["Keith: Brass Knuckles"]);
});
