import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTrackDamage, woundState, sprainedLimbs, shownHits, woundsOf, trackSegments } from "../module/data/damage-track.js";
import { resolveBruiseZoneHit, resolveZoneHit, HARDNESS_BY_NAME } from "../module/data/armor.js";
import { CLOSE_MANEUVERS } from "../module/data/close-combat.js";
import { WEAPON_CATALOG } from "../module/data/weapon-catalog.js";
import { ARMOR_CATALOG } from "../module/data/armor-catalog.js";
import { catalogWeaponUpdate, migrateActorWeapons } from "../module/migrate-actors.js";

const loc = (hitsMax, wounds, bruises = 0) => ({ hitsMax, hits: hitsMax - wounds, bruises });
const wb = l => [woundsOf(l), l.bruises];

test("wraparound: capacity 10, 5 Wounds, then 7 Bruises -> 7W / 3B, track full", () => {
  const after = { hitsMax: 10, ...applyTrackDamage(loc(10, 5), 7, "bruise") };
  assert.deepEqual(wb(after), [7, 3]);
  assert.equal(shownHits(after), 0);
});

test("a Wound hit onto a full track converts Bruises; then Wounds go negative", () => {
  const full = loc(10, 4, 6);
  assert.deepEqual(wb({ hitsMax: 10, ...applyTrackDamage(full, 2, "wound") }), [6, 4]);
  const r = { hitsMax: 10, ...applyTrackDamage(full, 8, "wound") };   // 6 conversions, 2 past capacity
  assert.deepEqual(wb(r), [12, 0]);
  assert.equal(r.hits, -2);
});

test("damage fits as its own type while there's room", () => {
  assert.deepEqual(wb({ hitsMax: 12, ...applyTrackDamage(loc(12, 0), 4, "bruise") }), [0, 4]);
  assert.deepEqual(wb({ hitsMax: 12, ...applyTrackDamage(loc(12, 0, 4), 3, "wound") }), [3, 4]);
});

test("a full Bruise track is unconscious, not dead; death counts Wounds only", () => {
  assert.equal(woundState("torso", loc(10, 0, 10)), "unconscious");
  assert.equal(woundState("head", loc(6, 3, 3)), "unconscious");
  assert.equal(woundState("torso", loc(10, 12)), "dead");
  assert.equal(woundState("torso", loc(10, 2, 3)), "ok");
});

test("Sprained: a full limb with at least one Bruise; Wound results take priority", () => {
  assert.equal(woundState("rArm", loc(9, 5, 4)), "sprained");
  assert.equal(woundState("rArm", loc(9, 9)), "broken");          // full of Wounds, no Bruises
  assert.equal(woundState("lLeg", loc(9, 11, 0)), "shattered");
  assert.equal(woundState("lLeg", loc(9, 3, 2)), "ok");
  const locs = { rArm: loc(9, 5, 4), lArm: loc(9, 0), rLeg: loc(9, 0, 9), torso: loc(12, 0, 12) };
  assert.deepEqual(sprainedLimbs(locs), ["rArm", "rLeg"]);         // torso isn't a limb
});

const piece = (id, hardness, sp, coverage = ["torso"]) => ({ id, name: id, hardness, coverage, currentSP: Object.fromEntries(coverage.map(z => [z, sp])) });

test("a punch vs mesh is ignored with no ablation", () => {
  const r = resolveBruiseZoneHit([piece("mesh", "soft", 15)], "torso", 7);
  assert.deepEqual([r.piece, r.sp, r.through, r.softIgnored], [null, 0, 7, true]);
});

test("a punch vs plate is soaked; 5+ ablates, under 5 doesn't", () => {
  const plate = piece("plate", "hard", 25);
  const big = resolveBruiseZoneHit([plate], "torso", 6);
  assert.deepEqual([big.piece.id, big.sp, big.spNow, big.through], ["plate", 25, 24, 0]);
  assert.equal(resolveBruiseZoneHit([plate], "torso", 4).belowThreshold, true);
});

test("a bruise hit uses the best HARD piece and ignores the wound activeArmorId", () => {
  const pieces = [piece("suit", "soft", 15), piece("plate", "hard", 10), piece("helmet", "hard", 20, ["head"])];
  // the wound track would pick the suit (stored and highest); the bruise hit uses the plate
  assert.equal(resolveZoneHit(pieces, "torso", "suit", 6).activeId, "suit");
  const r = resolveBruiseZoneHit(pieces, "torso", 6);
  assert.equal(r.piece.id, "plate");
  assert.equal(r.softIgnored, true);
  assert.equal("activeId" in r, false);                            // nothing to write back
  assert.equal(resolveBruiseZoneHit([piece("other", "", 30)], "torso", 6).piece, null); // no hardness = soft
});

test("damage types: unarmed strikes are Bruise; Claw and Bite are Wound; blunt catalog weapons", () => {
  const bruise = Object.entries(CLOSE_MANEUVERS).filter(([, m]) => m.damageType === "bruise").map(([k]) => k);
  assert.deepEqual(bruise.sort(), ["backhand", "crescent", "elbow", "jab", "kick", "punch", "spin", "thrust", "wheel"]);
  assert.equal(CLOSE_MANEUVERS.claw.damageType, "wound");
  assert.equal(CLOSE_MANEUVERS.bite.damageType, "wound");
  assert.equal(CLOSE_MANEUVERS.chop.damage, null);
  const blunt = WEAPON_CATALOG.filter(w => w.system.damageType === "bruise").map(w => w.name);
  assert.deepEqual(blunt.sort(), ["Boomerang", "Mace", "Nunchaku/Tonfa", "Quarterstaff"]);
  assert.equal(WEAPON_CATALOG.find(w => w.name === "Whip").system.damageType, "wound");
});

const mace = WEAPON_CATALOG.find(w => w.name === "Mace");

test("migration sets a catalog weapon's damage type once, then flags it", () => {
  const owned = { system: { skill: "blade", damageType: "wound" }, flags: {} };
  assert.deepEqual(catalogWeaponUpdate(owned, mace),
    { "system.damageType": "bruise", "flags.mekton-fusion.damageTypeSet": true, "flags.mekton-fusion.quickSet": true });
});

test("re-running the migration leaves an overridden Mace as Wound", () => {
  // the GM set it back to Wound on the item sheet, which also sets the flag
  const overridden = { system: { skill: "blade", damageType: "wound" }, flags: { "mekton-fusion": { damageTypeSet: true, quickSet: true } } };
  assert.equal(catalogWeaponUpdate(overridden, mace), null);
});

const staff = WEAPON_CATALOG.find(w => w.name === "Quarterstaff");

test("Quick catalog weapons: Quarterstaff and Nunchaku/Tonfa", () => {
  assert.deepEqual(WEAPON_CATALOG.filter(w => w.system.quick).map(w => w.name).sort(), ["Nunchaku/Tonfa", "Quarterstaff"]);
});

test("migration sets Quick once; a GM's change survives re-running", () => {
  const owned = { system: { skill: "blade", damageType: "bruise", quick: false }, flags: { "mekton-fusion": { damageTypeSet: true } } };
  assert.deepEqual(catalogWeaponUpdate(owned, staff), { "system.quick": true, "flags.mekton-fusion.quickSet": true });
  const unticked = { system: { skill: "blade", damageType: "bruise", quick: false }, flags: { "mekton-fusion": { damageTypeSet: true, quickSet: true } } };
  assert.equal(catalogWeaponUpdate(unticked, staff), null);
});

test("weapon step updates an unlinked token's own weapons", async () => {
  const sent = [];
  const tokenActor = {
    items: [
      { id: "w1", type: "weapon", name: "Mace", system: { skill: "blade", damageType: "wound" }, flags: {} },
      { id: "w2", type: "weapon", name: "Homemade Club", system: { damageType: "wound" }, flags: {} },
      { id: "a1", type: "armor", name: "Mace", system: {}, flags: {} }
    ],
    updateEmbeddedDocuments: async (type, updates) => sent.push([type, updates])
  };
  const report = { weaponsFixed: 0 };
  await migrateActorWeapons(tokenActor, new Map(WEAPON_CATALOG.map(w => [w.name, w])), report);
  assert.deepEqual(sent, [["Item", [{ _id: "w1", "system.damageType": "bruise", "flags.mekton-fusion.damageTypeSet": true, "flags.mekton-fusion.quickSet": true }]]]);
  assert.equal(report.weaponsFixed, 1);
});

test("force screens are hard; the Shield stays unset", () => {
  const screens = ARMOR_CATALOG.filter(a => /Force Screen/.test(a.name)).map(a => a.system.hardness);
  assert.deepEqual(screens, ["hard", "hard"]);
  assert.equal(ARMOR_CATALOG.find(a => a.name === "Shield").system.hardness, "");
  assert.equal(HARDNESS_BY_NAME["Personal Force Screen"], "hard");
  assert.equal(HARDNESS_BY_NAME.Shield, undefined);
});

test("trackSegments: Wounds, Bruises and free as shares of hitsMax", () => {
  assert.deepEqual(trackSegments(16, 4, 4), { wound: 25, bruise: 25, free: 50, remaining: 8 });
  assert.deepEqual(trackSegments(10, 0, 0), { wound: 0, bruise: 0, free: 100, remaining: 10 });
  const full = trackSegments(13, 8, 5);
  assert.deepEqual([full.wound, full.bruise, full.free].map(Math.round), [62, 38, 0]);
  assert.equal(full.remaining, 0);
});

test("trackSegments: negative Hits fill the bar with Wounds and show the negative value", () => {
  assert.deepEqual(trackSegments(12, 15, 0), { wound: 100, bruise: 0, free: 0, remaining: -3 });
});

test("trackSegments: no capacity (or junk input) is an empty bar, never NaN", () => {
  assert.deepEqual(trackSegments(0, 0, 0), { wound: 0, bruise: 0, free: 100, remaining: 0 });
  assert.deepEqual(trackSegments(undefined, -2, null), { wound: 0, bruise: 0, free: 100, remaining: 0 });
});
