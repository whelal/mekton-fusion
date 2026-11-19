import { test } from "node:test";
import assert from "node:assert/strict";
import { CP2020_SKILLS, PSI_POWERS, groupPsiSkills } from "../module/data/skills.js";
import { planSkillCleanup, planSkillRenames, psiFieldUpdate, keptSkillLines, planCustomRemarks } from "../module/data/skill-cleanup.js";

const names = CP2020_SKILLS.map(s => s.name);
const psi = CP2020_SKILLS.filter(s => s.system.category === "PSI");
const nonPsi = CP2020_SKILLS.filter(s => s.system.category !== "PSI");
const seeded = name => CP2020_SKILLS.find(s => s.name === name);

test("seed list: removed non-PSI skills are gone, Demolitions and Expert: Tactics stay", () => {
  for (const gone of ["Resist Magic (2)", "Spellcasting (2)", "Education/General", "Endurance", "Courage",
    "Hacking (H)", "Cybertech", "Electronics", "Mechanics", "Tactics"]) {
    assert.ok(!names.includes(gone), gone);
  }
  assert.ok(!nonPsi.some(s => s.name === "Regeneration"), "EMP Regeneration");
  assert.ok(names.includes("Demolitions (H)"));
  assert.equal(seeded("Expert: Tactics").system.stat, "INT");
  assert.ok(!nonPsi.some(s => s.system.category === "BODY"), "no BODY category left");
  assert.equal(new Set(names).size, names.length, "no duplicate names");
});

test("seed list: PSI skills are the MZ+ ATM list plus Empathy", () => {
  assert.deepEqual(psi.map(s => s.name).sort(), [
    "Astral Projection", "Aura Viewing", "Clairvoyance", "Danger Sensing", "Emotion Scan", "Empathy",
    "Energy Manipulation", "Healing", "Illusion", "Levitation", "Mind Lock", "Possession", "Precognition",
    "Psi Blast", "Psi Block", "Psychometry", "Pyrokinesis", "Regeneration", "Retrocognition", "Stat Boost",
    "Suggestion", "Telekinesis", "Telepathy", "Teleportation"
  ]);
  for (const s of psi) assert.equal(s.system.stat, "PSI", s.name);   // 1D10 + PSI + rank
  for (const gone of ["Recognition", "Illusion Generation", "Postcognition", "Stat Boost (phys)", "Danger Sense"]) {
    assert.ok(!names.includes(gone), gone);
  }
});

test("PSI metadata: a sample from each group", () => {
  const meta = n => { const { group, resistStat, costPerLevel, lensMagnifiable } = seeded(n).system; return { group, resistStat, costPerLevel, lensMagnifiable }; };
  assert.deepEqual(meta("Teleportation"), { group: "body", resistStat: "BODY", costPerLevel: 5, lensMagnifiable: true });
  assert.deepEqual(meta("Stat Boost"), { group: "body", resistStat: "BODY", costPerLevel: 3, lensMagnifiable: false });
  assert.deepEqual(meta("Telekinesis"), { group: "force", resistStat: "LUCK", costPerLevel: 3, lensMagnifiable: true });
  assert.deepEqual(meta("Psychometry"), { group: "force", resistStat: "LUCK", costPerLevel: 1, lensMagnifiable: false });
  assert.deepEqual(meta("Precognition"), { group: "mind", resistStat: "INT", costPerLevel: 2, lensMagnifiable: false });
  assert.deepEqual(meta("Psi Block"), { group: "mind", resistStat: "INT", costPerLevel: 2, lensMagnifiable: true });
  assert.deepEqual(meta("Danger Sensing"), { group: "will", resistStat: "COOL", costPerLevel: 0, lensMagnifiable: false });
  assert.deepEqual(meta("Mind Lock"), { group: "will", resistStat: "COOL", costPerLevel: 2, lensMagnifiable: false });
  assert.deepEqual(meta("Empathy"), { group: "will", resistStat: "COOL", costPerLevel: null, lensMagnifiable: false });
  const count = g => PSI_POWERS.filter(p => p.group === g).length;
  assert.deepEqual([count("body"), count("force"), count("mind"), count("will")], [5, 5, 7, 7]);
});

test("PSI tab groups: Body, Force, Mind, Will, then Other; empty groups left out", () => {
  const rows = [
    { name: "Telepathy", system: { group: "mind" } },
    { name: "My Power", system: { group: "" } },
    { name: "Healing", system: { group: "body" } },
    { name: "Astral Projection", system: { group: "mind" } }
  ];
  const groups = groupPsiSkills(rows);
  assert.deepEqual(groups.map(g => g.key), ["body", "mind", "other"]);
  assert.deepEqual(groups[1].skills.map(s => s.name), ["Telepathy", "Astral Projection"]);   // order kept
  assert.equal(groups[1].resistStat, "INT");
});

// Item stand-ins as the planner sees them
const skill = (id, name, category, rank = 0, ip = 0, extra = {}) => ({ id, name, system: { category, rank, ip, ...extra } });

/** Apply a plan to stand-in items, as the Foundry side would. */
function apply(items, plan) {
  const out = items.filter(i => !plan.deletes.includes(i.id)).map(i => structuredClone(i));
  for (const u of plan.updates) {
    const item = out.find(i => i.id === u._id);
    for (const [k, v] of Object.entries(u)) {
      if (k === "_id") continue;
      if (k === "name") item.name = v;
      else item.system[k.replace(/^system\./, "")] = v;
    }
  }
  return out;
}

test("cleanup: removed skills go at rank 0 with no IP, ranked ones are kept and reported", () => {
  const items = [
    skill("a", "Hacking (H)", "INT"),
    skill("b", "Postcognition", "PSI", 2),
    skill("c", "Courage", "COOL", 0, 3),
    skill("d", "Regeneration", "EMP"),
    skill("e", "Regeneration", "PSI", 1),
    skill("f", "Demolitions (H)", "TECH"),
    skill("g", "Electronics", "TECH", 0, 0, { custom: true })
  ];
  const plan = planSkillCleanup(items);
  assert.deepEqual(plan.deletes.sort(), ["a", "d"]);
  assert.deepEqual(plan.kept, [{ name: "Postcognition", rank: 2, ip: 0 }, { name: "Courage", rank: 0, ip: 3 }]);
  assert.deepEqual(keptSkillLines("Kai", plan.kept), ["Kai: kept Postcognition rank 2", "Kai: kept Courage rank 0 (3 IP)"]);
  // PSI Regeneration stays and gets its fields; Demolitions and a custom "Electronics" are untouched
  assert.deepEqual(plan.updates, [{ _id: "e", "system.group": "body", "system.resistStat": "BODY", "system.costPerLevel": 2, "system.lensMagnifiable": false }]);
});

test("cleanup: renames keep rank and IP; Recognition becomes Precognition only if there's none yet", () => {
  const items = [
    skill("t", "Tactics", "INT", 4, 7),
    skill("s", "Stat Boost (phys)", "PSI", 3, 2),
    skill("d", "Danger Sense", "PSI", 1),
    skill("r", "Recognition", "PSI", 2, 5)
  ];
  const after = apply(items, planSkillCleanup(items));
  const by = n => after.find(i => i.name === n);
  assert.deepEqual([by("Expert: Tactics").system.rank, by("Expert: Tactics").system.ip], [4, 7]);
  assert.deepEqual([by("Stat Boost").system.rank, by("Stat Boost").system.ip, by("Stat Boost").system.group], [3, 2, "body"]);
  assert.equal(by("Danger Sensing").system.costPerLevel, 0);
  assert.deepEqual([by("Precognition").system.rank, by("Precognition").system.ip, by("Precognition").system.group], [2, 5, "mind"]);

  // Already has Precognition: Recognition is a removed duplicate instead
  const both = [skill("p", "Precognition", "PSI", 1, 0, { group: "mind" }), skill("r", "Recognition", "PSI"), skill("r2", "Recognition", "PSI", 2)];
  const plan = planSkillCleanup(both);
  assert.deepEqual(plan.deletes, ["r"]);
  assert.deepEqual(plan.kept, [{ name: "Recognition", rank: 2, ip: 0 }]);
  assert.deepEqual(plan.updates, []);
});

test("cleanup: a non-PSI Tactics/Stat Boost isn't matched by a PSI rename, and vice versa", () => {
  assert.deepEqual(planSkillRenames([skill("x", "Stat Boost (phys)", "BODY"), skill("y", "Tactics", "PSI")]), []);
});

test("cleanup: a skill marked custom is never deleted or renamed", () => {
  const items = [
    skill("e", "Electronics", "TECH", 0, 0, { custom: true }),
    skill("p", "Postcognition", "PSI", 0, 0, { custom: true }),
    skill("t", "Tactics", "INT", 2, 0, { custom: true }),
    skill("r", "Recognition", "PSI", 0, 0, { custom: true })
  ];
  const plan = planSkillCleanup(items);
  assert.deepEqual(plan.deletes, []);
  assert.deepEqual(plan.kept, []);
  assert.deepEqual(plan.renamed, []);
  assert.ok(!plan.updates.some(u => "name" in u));
  assert.deepEqual(planSkillRenames(items), []);
});

test("lost custom markers: a never-seeded name is re-marked; seeded, removed and old names aren't", () => {
  const items = [
    skill("h", "Expert: Heavy Weapons", "INT", 3),
    skill("b", "Blade", "REF:Combat", 2),
    skill("x", "Hacking (H)", "INT"),              // removed
    skill("s", "Stat Boost (phys)", "PSI"),        // pre-rename
    skill("g", "Mecha Gunnery", "REF:Mecha"),      // legacy spelling
    skill("m", "Military Intelligence", "INT"),    // 0.0.10 legacy name
    skill("d", "Danger Sensing", "PSI"),           // PSI list
    skill("k", "My Power", "PSI", 0, 0, { custom: true })   // already marked
  ];
  const updates = planCustomRemarks(items);
  assert.deepEqual(updates, [{ _id: "h", "system.custom": true }]);
  const after = apply(items, { deletes: [], updates });
  assert.equal(after.find(i => i.id === "h").system.custom, true);
  assert.deepEqual(planCustomRemarks(after), []);   // second run changes nothing
  // and the cleanup then leaves it alone
  assert.deepEqual(planSkillCleanup(after.filter(i => i.id === "h")).updates, []);
});

test("cleanup: a second run changes nothing", () => {
  const items = [
    skill("a", "Hacking (H)", "INT"), skill("b", "Postcognition", "PSI", 2), skill("t", "Tactics", "INT", 4),
    skill("s", "Stat Boost (phys)", "PSI"), skill("h", "Healing", "PSI", 1), skill("m", "My Power", "PSI")
  ];
  const once = apply(items, planSkillCleanup(items));
  const again = planSkillCleanup(once);
  assert.deepEqual(again.deletes, []);
  assert.deepEqual(again.updates, []);
  assert.deepEqual(again.renamed, []);
  assert.deepEqual(again.kept, [{ name: "Postcognition", rank: 2, ip: 0 }]);   // still kept, still not deleted
});

test("PSI fields are written only while the group is empty", () => {
  assert.equal(psiFieldUpdate("Healing", { category: "PSI", group: "mind" }), null);
  assert.equal(psiFieldUpdate("Healing", { category: "EMP" }), null);
  assert.equal(psiFieldUpdate("My Power", { category: "PSI" }), null);
  assert.equal(psiFieldUpdate("Telepathy", { category: "PSI" })["system.costPerLevel"], 1);
});
