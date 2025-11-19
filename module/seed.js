import { CP2020_SKILLS } from "./data/skills.js";
import { WITCHER_SIGNS } from "./data/spells.js";


const HARD_MECHA_GUNNERY = "Mecha Gunnery (H)";
// Legacy variants we want to collapse into canonical HARD_MECHA_GUNNERY
const LEGACY_MECHA_GUNNERY_NAMES = ["Mecha Gunnery", "Mecha Gunnery [H]"];
// Legacy skill renames introduced in 0.0.10
const LEGACY_SKILL_RENAMES = {
  "Resist Magic": "Resist Magic (2)",
  "Spellcasting": "Spellcasting (2)",
  "Military Intelligence": "Expert: Military Intelligence"
};
// Deprecated skill names to purge (non-PSI duplicates)
const DEPRECATED_SKILL_NAMES = ["Stat Boost"]; // keep only Stat Boost (phys) in PSI list

async function ensureFolder(name, type) {
  let folder = game.folders.find(f => f.name === name && f.type === type);
  if (!folder) folder = await Folder.create({ name, type });
  return folder;
}

function prepareSkillSystem(source = {}) {
  const sys = foundry.utils.deepClone(source);
  if (sys.stat) sys.stat = String(sys.stat).toUpperCase();
  if (sys.category) sys.category = String(sys.category);
  if (sys.rank === undefined || sys.rank === null) sys.rank = 0;
  if (sys.favorite == null) sys.favorite = false;
  if (sys.ip == null) sys.ip = 0;
  if (sys.hard == null) sys.hard = /\(H\)|\[H\]/i.test(source?.name || "") ? true : false;
  return sys;
}

function prepareSpellSystem(source = {}) {
  const sys = foundry.utils.deepClone(source);
  if (sys.school === undefined || sys.school === null) sys.school = "Sign";
  if (sys.cost === undefined || sys.cost === null) sys.cost = 0;
  if (sys.effect === undefined || sys.effect === null) sys.effect = "";
  if (sys.test) sys.test = String(sys.test).toUpperCase();
  else sys.test = "INT";
  if (sys.favorite === undefined || sys.favorite === null) sys.favorite = false;
  return sys;
}

function normaliseSeedData(entry, folderId) {
  const { data, system, ...rest } = entry;
  const type = rest.type ?? entry.type;
  const baseSystem = foundry.utils.deepClone(system ?? data ?? {});
  const sys = type === "skill"
    ? prepareSkillSystem(baseSystem)
    : type === "spell"
      ? prepareSpellSystem(baseSystem)
      : baseSystem;

  return {
    ...rest,
    folder: folderId,
    system: sys
  };
}

async function ensureActorHasSkills(actor) {
  if (!actor) return { created: 0, updated: 0 };
  const allowedTypes = new Set(["character", "npc"]);
  if (!allowedTypes.has(actor.type)) return { created: 0, updated: 0 };

  const defaultSkills = CP2020_SKILLS.map(skill => ({
    name: skill.name,
    type: "skill",
    system: prepareSkillSystem(skill.system ?? skill.data ?? {})
  }));

  const existingSkills = actor.items.filter(it => it.type === "skill");
  // Perform legacy rename pass BEFORE building name map so new names don't conflict
  for (const it of existingSkills) {
    const newName = LEGACY_SKILL_RENAMES[it.name];
    if (newName && newName !== it.name) {
      // Only rename if target name does not already exist to avoid duplicates
      const already = existingSkills.some(other => other !== it && other.name === newName);
      if (!already) {
        try { await it.update({ name: newName }); } catch (e) { console.warn('mekton-fusion | Failed legacy skill rename', it.name, '->', newName, e); }
      }
    }
  }
  // Purge deprecated non-PSI duplicates
  const toRemove = existingSkills.filter(it => DEPRECATED_SKILL_NAMES.includes(it.name) && String(it.system?.category).toUpperCase() !== 'PSI');
  if (toRemove.length) {
    try { await actor.deleteEmbeddedDocuments('Item', toRemove.map(i=>i.id)); }
    catch (e) { console.warn('mekton-fusion | Failed deleting deprecated skills', e); }
  }
  const existingByName = new Map(existingSkills.map(it => [it.name, it]));
  const hardSkill = existingByName.get(HARD_MECHA_GUNNERY);
  const legacyNames = LEGACY_MECHA_GUNNERY_NAMES;
  const toDelete = [];
  let canonicalSkill = hardSkill ?? null;

  for (const legacyName of legacyNames) {
    const legacySkill = existingByName.get(legacyName);
    if (!legacySkill) continue;
    if (canonicalSkill) {
      toDelete.push(legacySkill.id);
      existingByName.delete(legacyName);
      continue;
    }

    await legacySkill.update({ name: HARD_MECHA_GUNNERY });
    existingByName.delete(legacyName);
    existingByName.set(HARD_MECHA_GUNNERY, legacySkill);
    canonicalSkill = legacySkill;
  }

  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);
  const toCreate = [];
  const toUpdate = [];

  for (const skill of defaultSkills) {
    const current = existingByName.get(skill.name);
    if (!current) {
      toCreate.push(skill);
      continue;
    }

    const currentSystem = current.system ?? {};
    const patch = {};
  if (!currentSystem.stat) patch["system.stat"] = skill.system.stat;
  if (skill.system.category && !currentSystem.category) patch["system.category"] = skill.system.category;
  if (currentSystem.hard == null && skill.system.hard) patch["system.hard"] = true;
    if (currentSystem.rank === undefined || currentSystem.rank === null) patch["system.rank"] = skill.system.rank;
    if (currentSystem.favorite === undefined || currentSystem.favorite === null) patch["system.favorite"] = skill.system.favorite;
    if (currentSystem.ip === undefined || currentSystem.ip === null) patch["system.ip"] = skill.system.ip;
    if (Object.keys(patch).length) toUpdate.push({ _id: current.id, ...patch });
  }

  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  if (toUpdate.length) await actor.updateEmbeddedDocuments("Item", toUpdate);

  return { created: toCreate.length, updated: toUpdate.length };
}

async function ensureActorHasSpells(actor) {
  if (!actor) return { created: 0, updated: 0 };
  const allowedTypes = new Set(["character", "npc"]);
  if (!allowedTypes.has(actor.type)) return { created: 0, updated: 0 };

  const defaultSpells = WITCHER_SIGNS.map(spell => ({
    name: spell.name,
    type: "spell",
    system: prepareSpellSystem(spell.system ?? spell.data ?? {})
  }));

  const existingByName = new Map(
    actor.items.filter(it => it.type === "spell").map(it => [it.name, it])
  );
  const toCreate = [];
  const toUpdate = [];

  for (const spell of defaultSpells) {
    const current = existingByName.get(spell.name);
    if (!current) {
      toCreate.push(spell);
      continue;
    }

    const needsUpdate = !foundry.utils.objectsEqual(current.system ?? {}, spell.system);
    if (needsUpdate) toUpdate.push({ _id: current.id, system: spell.system });
  }

  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  if (toUpdate.length) await actor.updateEmbeddedDocuments("Item", toUpdate);

  return { created: toCreate.length, updated: toUpdate.length };
}

async function ensureActorHasCoreItems(actor) {
  const skillResult = await ensureActorHasSkills(actor);
  const spellResult = await ensureActorHasSpells(actor);
  return {
    created: skillResult.created + spellResult.created,
    updated: skillResult.updated + spellResult.updated
  };
}

export async function syncActorCoreItems(actor) {
  return ensureActorHasCoreItems(actor);
}

export async function seedWorldData() {
  try {
    const skillFolder = await ensureFolder("CP2020 Skills", "Item");
    const spellFolder = await ensureFolder("Witcher Signs", "Item");

    const existing = new Map(game.items.map(item => [item.name, item]));
    // World-level legacy renames (Items in compendium/world item directory)
    for (const [oldName, newName] of Object.entries(LEGACY_SKILL_RENAMES)) {
      const current = existing.get(oldName);
      if (current && !existing.has(newName)) {
        try {
          await current.update({ name: newName });
          existing.delete(oldName);
          existing.set(newName, current);
        } catch (e) { console.warn('mekton-fusion | Failed world skill legacy rename', oldName, '->', newName, e); }
      }
    }
    const legacyNames = LEGACY_MECHA_GUNNERY_NAMES;
    const hardSkill = existing.get(HARD_MECHA_GUNNERY);
    let canonicalSkill = hardSkill ?? null;

    for (const legacyName of legacyNames) {
      const legacySkill = existing.get(legacyName);
      if (!legacySkill) continue;
      if (canonicalSkill) {
        await legacySkill.delete();
        existing.delete(legacyName);
        continue;
      }

      await legacySkill.update({ name: HARD_MECHA_GUNNERY });
      existing.delete(legacyName);
      existing.set(HARD_MECHA_GUNNERY, legacySkill);
      canonicalSkill = legacySkill;
    }
    const toCreate = [];
    const updates = [];
    const processEntry = (entry, folderId) => {
      const desired = normaliseSeedData(entry, folderId);
      const current = existing.get(entry.name);

      if (!current) {
        toCreate.push(desired);
        return;
      }

      const needsUpdate = !foundry.utils.objectsEqual(current.system, desired.system);
      if (needsUpdate) updates.push(current.update({ system: desired.system }));
    };

    for (const s of CP2020_SKILLS) processEntry(s, skillFolder.id);
    for (const sp of WITCHER_SIGNS) processEntry(sp, spellFolder.id);

    if (toCreate.length) {
      await Item.createDocuments(toCreate);
      ui.notifications.info(`Seeded ${toCreate.length} Items (skills/spells).`);
    }

    if (updates.length) {
      await Promise.all(updates);
      ui.notifications.info(`Updated ${updates.length} existing Items.`);
    }

    let createdCount = 0;
    let updatedCount = 0;
    for (const actor of game.actors.contents ?? []) {
      const { created, updated } = await ensureActorHasCoreItems(actor);
      createdCount += created;
      updatedCount += updated;
    }

    if (createdCount || updatedCount) {
      ui.notifications.info(`Synced actor items: ${createdCount} added, ${updatedCount} refreshed.`);
    }

    if (!toCreate.length && !updates.length && !createdCount && !updatedCount) {
      ui.notifications.info("No new Items to seed.");
    }
  } catch (err) {
    console.error("mekton-fusion | Seeding failed", err);
    ui.notifications.error("Mekton Fusion seeding failed. See console.");
  }
}

