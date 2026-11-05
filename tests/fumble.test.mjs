import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNaturalOne, confirmFumble, fumbleTableFor, fumbleResult, needsSecondDie, fumbleLine,
  pickPartyVictim, jamBlocks, jamClearsOnTurn, fumbleWeaponUpdate, fumbleDamageOptions
} from "../module/data/fumble.js";
import { helplessAttack } from "../module/data/helpless.js";
import { TABLE_RULINGS } from "../module/rules/table-rulings.js";
import { resolveZoneHit } from "../module/data/armor.js";

test("only a natural 1 starts a fumble check", () => {
  assert.equal(isNaturalOne([1]), true);
  assert.equal(isNaturalOne([10, 1]), false);   // an upward chain ending on 1 is not a natural 1
  assert.equal(confirmFumble({ plusDice: [5], minusDice: [], rank: 3 }), null);
});

test("confirm: the subtracted die vs skill rank (<= rank saved, > rank fumble); no third die", () => {
  assert.deepEqual(confirmFumble({ plusDice: [1], minusDice: [3], rank: 3 }), { die: 3, rank: 3, fumble: false });
  assert.deepEqual(confirmFumble({ plusDice: [1], minusDice: [2], rank: 3 }), { die: 2, rank: 3, fumble: false });
  assert.deepEqual(confirmFumble({ plusDice: [1], minusDice: [7], rank: 3 }), { die: 7, rank: 3, fumble: true });
});

test("rank 0 or no skill: every natural 1 fumbles", () => {
  for (let d = 1; d <= 10; d++) {
    assert.equal(confirmFumble({ plusDice: [1], minusDice: [d], rank: 0 }).fumble, true);
    assert.equal(confirmFumble({ plusDice: [1], minusDice: [d] }).fumble, true);
  }
});

test("table mapping by roll kind, skill and stat", () => {
  assert.equal(fumbleTableFor({ kind: "attack" }), "combat");
  assert.equal(fumbleTableFor({ kind: "defense" }), "combat");   // Evade, Parry, Arm Block
  assert.equal(fumbleTableFor({ kind: "skill", stat: "REF", skillName: "Handgun", category: "REF:Combat" }), "combat");
  assert.equal(fumbleTableFor({ kind: "skill", stat: "REF", skillName: "Mecha Gunnery (H)", category: "REF:Mecha" }), "combat");
  assert.equal(fumbleTableFor({ kind: "skill", stat: "REF", skillName: "Dodge & Escape", category: "REF:Combat" }), "athletics");
  assert.equal(fumbleTableFor({ kind: "skill", stat: "REF", skillName: "Swimming", category: "REF:Utility" }), "athletics");
  assert.equal(fumbleTableFor({ kind: "skill", stat: "BODY", skillName: "Endurance", category: "BODY" }), "athletics");
  assert.equal(fumbleTableFor({ kind: "skill", stat: "TECH", skillName: "Jury Rig", category: "TECH" }), "tech");
  for (const stat of ["EMP", "ATTR", "COOL"]) assert.equal(fumbleTableFor({ kind: "skill", stat, skillName: "x", category: stat }), "social");
  for (const stat of ["INT", "EDU"]) assert.equal(fumbleTableFor({ kind: "stat", stat }), "int");
  assert.equal(fumbleTableFor({ kind: "stat", stat: "LUCK" }), "plain");
  assert.equal(fumbleTableFor({ kind: "stat", stat: "ma" }), "plain");
});

test("Combat table results; unarmed drop and jam become a screw-up", () => {
  const eff = (d, o) => fumbleResult("combat", d, o).effect;
  for (const d of [1, 2, 3, 4]) assert.equal(eff(d), "note");
  assert.equal(eff(5, { weaponName: "Quarterstaff" }), "drop");
  assert.equal(fumbleResult("combat", 5, { weaponName: "Quarterstaff" }).text, "drops Quarterstaff");
  assert.equal(eff(6), "note");
  assert.equal(eff(7), "jam");
  assert.equal(eff(8), "selfWound");
  assert.equal(eff(9), "partyWound");
  assert.equal(eff(10), "partyWound");
  assert.equal(eff(5, { unarmed: true }), "note");
  assert.equal(eff(7, { unarmed: true }), "note");
  assert.equal(eff(8, { unarmed: true }), "selfWound");   // self-damage uses the maneuver's
});

test("Athletics: 1 Hit + Stun/Shock, or 1D6 Hits + Stun/Shock at -1", () => {
  assert.equal(fumbleResult("athletics", 3).effect, "note");
  assert.deepEqual([fumbleResult("athletics", 6).hits, fumbleResult("athletics", 6).stunMod], ["1", 0]);
  assert.deepEqual([fumbleResult("athletics", 9).hits, fumbleResult("athletics", 9).stunMod], ["1d6", -1]);
});

test("Tech, Social, INT and plain results are notes; Social 7-10 rolls a follow-up", () => {
  for (const t of ["tech", "social", "int", "plain"]) for (let d = 1; d <= 10; d++) assert.equal(fumbleResult(t, d).effect, "note");
  assert.equal(needsSecondDie("social", 7), true);
  assert.equal(needsSecondDie("social", 6), false);
  assert.match(fumbleResult("social", 8, { secondDie: 3 }).text, /physical harm/);
  assert.match(fumbleResult("social", 8, { secondDie: 6 }).text, /no violence/);
  assert.equal(fumbleResult("plain", null).die, null);
});

test("card lines", () => {
  const r = fumbleResult("combat", 5, { weaponName: "Quarterstaff" });
  assert.equal(fumbleLine({ die: 7, rank: 3, fumble: true }, r), "FUMBLE (confirm 7 > skill 3): Combat 5 — drops Quarterstaff");
  assert.equal(fumbleLine({ die: 2, rank: 3, fumble: false }, null), "Natural 1, saved by skill (confirm 2 ≤ 3)");
  assert.equal(fumbleLine({ die: 4, rank: 0, fumble: true }, fumbleResult("plain", null)), "FUMBLE (confirm 4, no skill): Plain fumble — a plain fumble");
});

test("drop clears In hand; jam flags the running combat, untracked outside combat", () => {
  assert.deepEqual(fumbleWeaponUpdate("drop"), { "system.inHand": false });
  assert.deepEqual(fumbleWeaponUpdate("jam", { combatId: "c1" }), { "flags.mekton-fusion.jammed": { combatId: "c1" } });
  assert.equal(fumbleWeaponUpdate("jam"), null);
  assert.equal(fumbleWeaponUpdate("selfWound", { combatId: "c1" }), null);
});

test("jam blocks while its combat exists, and clears at the user's next turn in it", () => {
  const jam = { combatId: "c1" };
  assert.equal(jamBlocks(jam, new Set(["c1"])), true);
  assert.equal(jamBlocks(jam, new Map([["c2", {}]])), false);   // combat gone: stale flag doesn't block
  assert.equal(jamBlocks(null, new Set(["c1"])), false);
  assert.equal(jamClearsOnTurn(jam, "c1"), true);
  assert.equal(jamClearsOnTurn(jam, "c2"), false);
  assert.equal(jamClearsOnTurn(undefined, "c1"), false);
});

test("self-wound goes through armor (armor applies); Athletics Hits skip it", () => {
  const self = fumbleDamageOptions(fumbleResult("combat", 8), { damageType: "wound", armorPiercing: false });
  assert.equal(self.ignoreSp, false);
  // The same hit resolved against worn armor: Heavy Mesh 15 on the torso stops 10 damage.
  const pieces = [{ id: "a", name: "Heavy Mesh", kind: "soft", baseSP: 15, coverage: ["torso"], currentSP: { torso: 15 } }];
  const hit = resolveZoneHit(pieces, "torso", "", 10, { ap: self.armorPiercing });
  assert.equal(Math.max(0, 10 - hit.counted), 0);
  const ath = fumbleDamageOptions(fumbleResult("athletics", 9));
  assert.deepEqual(ath, { ignoreSp: true, forceStun: true, stunMod: -1, damageType: "wound" });
  assert.equal(fumbleDamageOptions(fumbleResult("combat", 9), { damageType: "bruise", armorPiercing: true }).armorPiercing, true);
});

test("party wound: nearest friendly in reach (melee) or in range with line of fire, else none (GM)", () => {
  const c = [{ id: "far", distance: 8, lineOfFire: true }, { id: "near", distance: 2, lineOfFire: false }, { id: "mid", distance: 4, lineOfFire: true }];
  assert.equal(pickPartyVictim(c, { maxDistance: 2 }).id, "near");                  // melee: reach only
  assert.equal(pickPartyVictim(c, { maxDistance: 10, ranged: true }).id, "mid");    // ranged: needs line of fire
  assert.equal(pickPartyVictim(c, { maxDistance: 1 }), null);
  assert.equal(pickPartyVictim([], { maxDistance: 10 }), null);
});

test("helpless melee: a natural 1 saved by skill still hits; a confirmed fumble misses", () => {
  assert.equal(helplessAttack({ attackKind: "melee", natural: 1, fumbled: false }).hit, true);
  assert.equal(helplessAttack({ attackKind: "melee", natural: 1, fumbled: true }).hit, false);
  assert.equal(helplessAttack({ attackKind: "unarmed", natural: 1 }).hit, false);   // no check: a 1 misses
  assert.equal(helplessAttack({ attackKind: "melee", natural: 6, fumbled: null }).hit, true);
});

test("fumbles toggle off: MZ core only, no check", () => {
  TABLE_RULINGS.fumbles = false;
  try { assert.equal(confirmFumble({ plusDice: [1], minusDice: [9], rank: 0 }), null); }
  finally { TABLE_RULINGS.fumbles = true; }
});
