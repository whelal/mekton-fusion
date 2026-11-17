import { test } from "node:test";
import assert from "node:assert/strict";
import { isMeleeWeapon, isThrownWeapon, supportsWeaponOptions } from "../module/data/weapon-type.js";
import { WEAPON_CATALOG } from "../module/data/weapon-catalog.js";

const w = (skill, range, extra = {}) => ({ type: "weapon", system: { skill, range, ...extra } });
const catalog = name => ({ type: "weapon", ...WEAPON_CATALOG.find(x => x.name === name) });

test("blade, fencing, whip and hand-to-hand weapons are melee", () => {
  for (const skill of ["blade", "fencing", "whip", "hand-to-hand"]) {
    assert.equal(isMeleeWeapon(w(skill, "2")), true, skill);
    assert.equal(isThrownWeapon(w(skill, "2")), false, skill);
  }
});

test("a T-range blade (thrown knife) is thrown, not melee", () => {
  const knife = w("blade", "T");
  assert.equal(isThrownWeapon(knife), true);
  assert.equal(isMeleeWeapon(knife), false);
  assert.equal(supportsWeaponOptions(knife), false);
});

test("an athletics weapon is thrown, whatever its range", () => {
  for (const range of ["T", "10", "5-20"]) {
    const thrown = w("athletics", range);
    assert.equal(isThrownWeapon(thrown), true, range);
    assert.equal(isMeleeWeapon(thrown), false, range);
    assert.equal(supportsWeaponOptions(thrown), false, range);
  }
});

test("only personal-scale ranged, non-thrown weapons get Weapon Options", () => {
  assert.equal(supportsWeaponOptions(w("rifle", "28-400")), true);
  assert.equal(supportsWeaponOptions(w("handgun", "15-100")), true);
  assert.equal(supportsWeaponOptions(w("blade", "2")), false);
  assert.equal(supportsWeaponOptions(w("athletics", "T")), false);
  assert.equal(supportsWeaponOptions({ type: "mecha-weapon", system: { skill: "rifle", range: "28-400" } }), false);
  assert.equal(supportsWeaponOptions(w("rifle", "28-400", { isMecha: true })), false);
});

test("martial-art is not a weapon skill: such a weapon is not melee", () => {
  assert.equal(isMeleeWeapon(w("martial-art", "1")), false);
});

test("a reach-3 quarterstaff is melee and gets no Weapon Options", () => {
  const staff = w("blade", "3");
  assert.equal(isMeleeWeapon(staff), true);
  assert.equal(supportsWeaponOptions(staff), false);
  const book = catalog("Quarterstaff");                       // reach 4 in the catalog
  assert.equal(isMeleeWeapon(book), true);
  assert.equal(supportsWeaponOptions(book), false);
});

test("catalog: athletics weapons are thrown, blade/whip weapons melee, the rest take options", () => {
  for (const entry of WEAPON_CATALOG) {
    const item = { type: "weapon", ...entry };
    const skill = entry.system.skill;
    if (skill === "athletics") assert.equal(isThrownWeapon(item), true, entry.name);
    else if (skill === "blade" || skill === "whip") assert.equal(isMeleeWeapon(item), true, entry.name);
    else assert.equal(supportsWeaponOptions(item), true, entry.name);
  }
});
