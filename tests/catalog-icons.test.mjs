import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ARMOR_CATALOG } from "../module/data/armor-catalog.js";
import { WEAPON_CATALOG } from "../module/data/weapon-catalog.js";
import { OLD_CATALOG_IMGS, catalogIconUpdates } from "../module/data/catalog-icons.js";

const VERIFIED = new Set(
  fs.readFileSync(new URL("./fixtures/verified-icons-v13.txt", import.meta.url), "utf8")
    .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"))
);
const CATALOG = [...ARMOR_CATALOG, ...WEAPON_CATALOG];
const byName = name => CATALOG.find(e => e.name === name);

test("every catalog img is a verified Foundry v13 core path", () => {
  for (const e of CATALOG) assert.ok(VERIFIED.has(e.img), `${e.name}: ${e.img} is not in the verified list`);
});

test("Needle Pistol and Hideout Pistol don't share an icon", () => {
  assert.notEqual(byName("Needle Pistol").img, byName("Hideout Pistol").img);
});

test("every old img belongs to a catalog entry and differs from its new img", () => {
  for (const [name, old] of Object.entries(OLD_CATALOG_IMGS)) {
    const e = byName(name);
    assert.ok(e, `${name} is not in a catalog`);
    assert.notEqual(e.img, old, name);
  }
});

test("owned catalog item on its old img gets the new img", () => {
  const items = [{ id: "a", type: "weapon", name: "Combat Pistol", img: OLD_CATALOG_IMGS["Combat Pistol"] }];
  assert.deepEqual(catalogIconUpdates(items), [{ _id: "a", img: byName("Combat Pistol").img }]);
});

test("missing and existing old paths are both replaced (force screen svg)", () => {
  const items = [{ id: "s", type: "armor", name: "Personal Force Screen", img: "icons/svg/shield.svg" }];
  assert.deepEqual(catalogIconUpdates(items), [{ _id: "s", img: byName("Personal Force Screen").img }]);
});

test("a GM-chosen img is never touched", () => {
  const items = [{ id: "a", type: "weapon", name: "Combat Pistol", img: "worlds/mine/pistol.webp" }];
  assert.deepEqual(catalogIconUpdates(items), []);
});

test("an item already on the new img, a non-catalog item, or a type mismatch is left alone", () => {
  const items = [
    { id: "a", type: "weapon", name: "Combat Pistol", img: byName("Combat Pistol").img },
    { id: "b", type: "weapon", name: "Laser Lance", img: "icons/weapons/guns/pistol-automatic.webp" },
    { id: "c", type: "armor", name: "Combat Pistol", img: OLD_CATALOG_IMGS["Combat Pistol"] },
    { id: "d", type: "skill", name: "Bow", img: OLD_CATALOG_IMGS.Bow }
  ];
  assert.deepEqual(catalogIconUpdates(items), []);
});

test("an unchanged entry (Shield) is left alone", () => {
  const items = [{ id: "s", type: "armor", name: "Shield", img: byName("Shield").img }];
  assert.deepEqual(catalogIconUpdates(items), []);
});
