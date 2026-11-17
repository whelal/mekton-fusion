import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resetMookData, nextMookNames, normalizeMookPattern, clampMookCount,
  defaultMookFolderPath, splitFolderPath, placementOffsets, MOOK_COUNT_MAX
} from "../module/data/mooks.js";

const loc = (hitsMax, wounds = 0, bruises = 0, extra = {}) =>
  ({ hitsMax, hits: hitsMax - wounds, bruises, recoveryRemainder: 0, sp: 0, spMax: 0, ...extra });

/** A damaged template mook, as actor.toObject() would give it. */
function damagedSoldier() {
  return {
    name: "PDF Soldier",
    type: "npc",
    system: {
      stats: { REF: { value: 7 }, BODY: { value: 6 } },
      body: {
        locations: {
          head: loc(6, 2, 1, { recoveryRemainder: 0.5 }),
          torso: loc(12, 13, 0, { recoveryRemainder: 0.25 }),   // past 0: negative Hits
          rArm: loc(9, 0, 4),
          lArm: loc(9), rLeg: loc(9), lLeg: loc(9)
        },
        armorZones: { head: { activeArmorId: "helm" }, torso: { activeArmorId: "flak" }, rArm: { activeArmorId: "" } }
      }
    },
    items: [
      { _id: "rifle", name: "Assault Rifle", type: "weapon", system: { inHand: true, skill: "Automatic Weapon" },
        flags: { "mekton-fusion": { jammed: { combatId: "c1" }, damageTypeSet: true } } },
      { _id: "knife", name: "Combat Knife", type: "weapon", system: { inHand: false } },
      { _id: "skill1", name: "Automatic Weapon", type: "skill", system: { rank: 4, stat: "REF" } },
      { _id: "skill2", name: "Expert: Heavy Weapons", type: "skill", system: { rank: 2, stat: "REF" } },   // custom skill
      { _id: "flak", name: "Flak Mesh", type: "armor",
        system: { kind: "mesh", coverage: ["torso", "rArm", "lArm"], baseSP: 18, currentSP: { torso: 15, rArm: 18, lArm: 17 } } },
      { _id: "helm", name: "Light Helmet", type: "armor",
        system: { kind: "", coverage: ["head"], baseSP: 14, currentSP: { head: 9 } } }
    ],
    effects: [
      { _id: "e1", name: "Unconscious", statuses: ["unconscious"] },
      { _id: "e2", name: "Burning", statuses: ["burning"] },
      { _id: "e3", name: "Dead", statuses: ["dead"] },
      { _id: "e4", name: "Some lasting effect", statuses: [] }
    ],
    flags: { "mekton-fusion": { burning: { torso: 4 }, locationSPCleared: true } },
    prototypeToken: { name: "PDF Soldier", disposition: -1, actorLink: false }
  };
}

test("reset clears Wounds, Bruises and recovery remainders", () => {
  const out = resetMookData(damagedSoldier());
  for (const [key, l] of Object.entries(out.system.body.locations)) {
    assert.equal(l.hits, l.hitsMax, `${key} hits`);
    assert.equal(l.bruises, 0, `${key} bruises`);
    assert.equal(l.recoveryRemainder, 0, `${key} remainder`);
  }
});

test("reset restores armor wear on every covered zone and clears activeArmorId", () => {
  const out = resetMookData(damagedSoldier());
  const flak = out.items.find(i => i._id === "flak");
  const helm = out.items.find(i => i._id === "helm");
  assert.equal(flak.system.currentSP.torso, 18);
  assert.equal(flak.system.currentSP.rArm, 18);
  assert.equal(flak.system.currentSP.lArm, 18);
  assert.equal(flak.system.currentSP.head, 0);
  assert.equal(helm.system.currentSP.head, 14);
  for (const z of Object.values(out.system.body.armorZones)) assert.equal(z.activeArmorId, "");
});

test("reset clears statuses, burning and jams; keeps other effects and flags", () => {
  const out = resetMookData(damagedSoldier());
  assert.deepEqual(out.effects.map(e => e._id), ["e4"]);
  assert.equal(out.flags["mekton-fusion"].burning, undefined);
  assert.equal(out.flags["mekton-fusion"].locationSPCleared, true);
  const rifle = out.items.find(i => i._id === "rifle");
  assert.equal(rifle.flags["mekton-fusion"].jammed, undefined);
  assert.equal(rifle.flags["mekton-fusion"].damageTypeSet, true);
});

test("reset keeps stats, skills (custom included), items, In hand and the token", () => {
  const src = damagedSoldier();
  const out = resetMookData(src);
  assert.deepEqual(out.system.stats, src.system.stats);
  assert.deepEqual(out.items.map(i => i._id), src.items.map(i => i._id));
  assert.equal(out.items.find(i => i._id === "rifle").system.inHand, true);
  assert.equal(out.items.find(i => i._id === "knife").system.inHand, false);
  assert.equal(out.items.find(i => i._id === "skill1").system.rank, 4);
  assert.equal(out.items.find(i => i._id === "skill2").name, "Expert: Heavy Weapons");
  assert.deepEqual(out.prototypeToken, src.prototypeToken);
});

test("reset doesn't change its input", () => {
  const src = damagedSoldier();
  const before = structuredClone(src);
  resetMookData(src);
  assert.deepEqual(src, before);
});

test("reset puts natural armor back to max only where no piece covers", () => {
  const src = damagedSoldier();
  src.system.body.locations.rLeg = loc(9, 0, 0, { sp: 1, spMax: 4 });
  src.system.body.locations.torso.sp = 2;
  src.system.body.locations.torso.spMax = 4;
  const out = resetMookData(src);
  assert.equal(out.system.body.locations.rLeg.sp, 4);
  assert.equal(out.system.body.locations.torso.sp, 2);   // Flak Mesh covers it: left alone
});

test("reset tolerates a bare actor", () => {
  assert.deepEqual(resetMookData({ name: "X" }), { name: "X" });
});

test("names start at 1 with no existing mooks", () => {
  assert.deepEqual(nextMookNames("PDF Soldier N", [], 3), ["PDF Soldier 1", "PDF Soldier 2", "PDF Soldier 3"]);
});

test("numbering continues past the highest existing number", () => {
  const existing = ["PDF Soldier 1", "PDF Soldier 2", "PDF Soldier 3", "PDF Soldier 4", "PDF Soldier 5"];
  assert.deepEqual(nextMookNames("PDF Soldier N", existing, 3), ["PDF Soldier 6", "PDF Soldier 7", "PDF Soldier 8"]);
  assert.deepEqual(nextMookNames("PDF Soldier N", ["PDF Soldier 3"], 1), ["PDF Soldier 4"]);
  assert.deepEqual(nextMookNames("PDF Soldier N", ["PDF Soldier 2", "PDF Soldier 9"], 1), ["PDF Soldier 10"]);   // gaps aren't refilled
});

test("numbering ignores names with another pattern", () => {
  const existing = ["PDF Soldier", "PDF Soldier 3b", "PDF Sergeant 7", "pdf soldier 9", "Old PDF Soldier 12"];
  assert.deepEqual(nextMookNames("PDF Soldier N", existing, 1), ["PDF Soldier 1"]);
});

test("a pattern without N gets a trailing number; N can sit anywhere", () => {
  assert.equal(normalizeMookPattern("Ganger"), "Ganger N");
  assert.equal(normalizeMookPattern("NCO"), "NCO N");   // N inside a word isn't the placeholder
  assert.deepEqual(nextMookNames("Ganger", ["Ganger 2"], 1), ["Ganger 3"]);
  assert.deepEqual(nextMookNames("Thug #N (Red)", ["Thug #4 (Red)"], 2), ["Thug #5 (Red)", "Thug #6 (Red)"]);
  assert.deepEqual(nextMookNames("Unit N N", [], 1), ["Unit N 1"]);   // the last N is the number
});

test("count 1 and 20 both work", () => {
  assert.equal(nextMookNames("PDF Soldier N", [], 1).length, 1);
  const twenty = nextMookNames("PDF Soldier N", ["PDF Soldier 5"], MOOK_COUNT_MAX);
  assert.equal(twenty.length, 20);
  assert.equal(twenty[0], "PDF Soldier 6");
  assert.equal(twenty[19], "PDF Soldier 25");
  assert.equal(new Set(twenty).size, 20);
});

test("count is clamped to 1..20", () => {
  assert.equal(clampMookCount(0), 1);
  assert.equal(clampMookCount(""), 1);
  assert.equal(clampMookCount(7.9), 7);
  assert.equal(clampMookCount(50), 20);
});

test("default folder path is Mooks/<template name>", () => {
  assert.equal(defaultMookFolderPath("PDF Soldier"), "Mooks/PDF Soldier");
  assert.equal(defaultMookFolderPath("  Ganger  "), "Mooks/Ganger");
  assert.equal(defaultMookFolderPath("Guard A/B"), "Mooks/Guard A-B");
  assert.equal(defaultMookFolderPath(""), "Mooks");
  assert.equal(defaultMookFolderPath(), "Mooks");
  assert.deepEqual(splitFolderPath(defaultMookFolderPath("Guard A/B")), ["Mooks", "Guard A-B"]);
  assert.deepEqual(splitFolderPath(" Mooks / Warehouse raid/ "), ["Mooks", "Warehouse raid"]);
  assert.deepEqual(splitFolderPath(""), []);
});

test("placement fills a compact block around the centre", () => {
  const one = placementOffsets(1);
  assert.deepEqual(one, [{ di: 0, dj: 0 }]);
  const nine = placementOffsets(9);
  for (const c of nine) assert.ok(Math.abs(c.di) <= 1 && Math.abs(c.dj) <= 1);
  assert.equal(new Set(nine.map(c => `${c.di},${c.dj}`)).size, 9);
});

test("placement skips occupied cells, and falls back to a plain grid when full", () => {
  const offs = placementOffsets(3, (di, dj) => !(di === 0 && dj === 0));
  assert.ok(!offs.some(c => c.di === 0 && c.dj === 0));
  assert.equal(offs.length, 3);
  const crowded = placementOffsets(4, () => false, 2);
  assert.equal(crowded.length, 4);
  assert.deepEqual(crowded[0], { di: 0, dj: 0 });
});
