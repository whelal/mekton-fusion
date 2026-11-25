import { WEAPON_CATALOG } from "./data/weapon-catalog.js";
import { recomputeActorArmorSp, seedUnfilledPiece, armorPieces, locationWearMoves, HARDNESS_BY_NAME } from "./data/armor.js";
import { effectiveCoverage } from "./data/armor-coverage.js";
import { syncActorCoreItems } from "./seed.js";
import { strayLocationSPUpdate } from "./data/natural-armor.js";
import { planSkillCleanup, keptSkillLines, planCustomRemarks } from "./data/skill-cleanup.js";
import { catalogIconUpdates } from "./data/catalog-icons.js";

/**
 * One-time refresh of existing characters and NPCs after the 0.3.x changes:
 *   - re-marks lost custom skills, once per world actor (flag
 *     mekton-fusion.customSkillsRemarked): a skill whose name was never seeded
 *     gets system.custom = true (planCustomRemarks), listed for the GM. Before
 *     the cleanup, so the cleanup leaves those skills alone.
 *   - skill list cleanup, once per world actor (flag mekton-fusion.skillListCleaned):
 *     removed skills are deleted only at rank 0 with no IP, otherwise kept and
 *     listed for the GM; renames keep rank and IP; psionic skills get their
 *     PSI fields (planSkillCleanup). Unlinked tokens get the same rules every
 *     run, written only on change. Seeded world skill Items (the CP2020 Skills
 *     folder) get the same deletes and renames, listed.
 *   - adds any CP2020 skills added since the actor was created (existing ranks untouched)
 *   - sets the skill on owned weapons whose name matches a catalog entry, and
 *     their damage type, Quick and Armor Piercing once (0.3.29, catalogWeaponUpdate)
 *   - moves owned catalog armor and weapons onto the new catalog icons, once
 *     per world actor (flag mekton-fusion.catalogIconsUpdated), only where the
 *     item's img is still the old catalog img (catalogIconUpdates)
 *   - moves any weapon on the Martial Art skill to Hand to Hand, listing them
 *     (Martial Art is unarmed-only, martialArtWeaponUpdate)
 *   - gives owned force screens hard hardness when unset (0.3.29)
 *   - writes armor Items in the 0.3.24 zone format (ArmorDataModel.migrateData
 *     converts them in memory on load; this persists them), seeds each piece's
 *     per-zone current SP, and reports anything the migration couldn't map
 *   - moves armor wear recorded on body locations onto the worn pieces' own
 *     per-zone SP (0.3.28, locationWearMoves)
 *   - sets body-location sp/spMax to 0 where no armor piece covers the
 *     location, on actors without creature natural armor (0.3.39: the old
 *     schema default of 10 had been counted as natural armor), listing them;
 *     once per world actor (flag mekton-fusion.locationSPCleared)
 *   - recomputes body-location armor SP from worn armor Items
 *   - runs the armor steps (0.3.28) and the weapon step (0.3.29) on unlinked
 *     tokens on every scene too
 * Creatures (natural armor SP from a preset, system.creature.armorSP > 0) are
 * skipped by the armor step so their natural SP isn't zeroed.
 * Safe to re-run; each step only changes what differs.
 */
export async function migrateAllActors() {
  const report = { actors: 0, skillsAdded: 0, weaponsFixed: 0, martialArtWeapons: [], armorMigrated: 0, armorProblems: [], armorRecomputed: 0, armorSeeded: 0, wearMoved: 0, tokens: 0, skippedCreatures: [], locationSPCleared: [], skillsDeleted: 0, skillsRenamed: 0, skillsKept: [], worldSkillChanges: [], customRemarked: [], iconsUpdated: 0 };
  const catalog = new Map(WEAPON_CATALOG.map(w => [w.name, w]));

  for (const actor of game.actors) {
    if (!["character", "npc"].includes(actor.type)) continue;
    report.actors++;

    await remarkCustomSkills(actor, report);
    await cleanupActorSkills(actor, report);
    const seeded = await syncActorCoreItems(actor);
    report.skillsAdded += seeded.created ?? 0;

    await migrateActorWeapons(actor, catalog, report);
    await updateCatalogIcons(actor, report);
    await migrateActorArmor(actor, report);
  }

  // Unlinked tokens carry their own copy of the actor (its weapons and armor),
  // which the world-actor loop above never touches: run the skill cleanup,
  // weapon and armor steps on each.
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      const actor = token.actorLink ? null : token.actor;
      if (!actor || !["character", "npc"].includes(actor.type)) continue;
      report.tokens++;
      const label = `${actor.name} (token, ${scene.name})`;
      await remarkCustomSkills(actor, report, { onlyChanged: true, label });
      await cleanupActorSkills(actor, report, { onlyChanged: true, label, baseActor: token.baseActor });
      await migrateActorWeapons(actor, catalog, report);
      await updateCatalogIcons(actor, report, { onlyChanged: true });
      await migrateActorArmor(actor, report, { onlyChanged: true, label });
    }
  }
  await migrateArmorItems(game.items, null, report);
  await cleanupWorldSkills(report);
  return report;
}

/**
 * Re-mark custom skills the pre-0.3.42 schema dropped the marker from
 * (planCustomRemarks). A world actor runs it once (flag
 * mekton-fusion.customSkillsRemarked, set even when nothing changed); an
 * unlinked token is checked every run and written only on change.
 */
async function remarkCustomSkills(actor, report, { onlyChanged = false, label = actor.name } = {}) {
  if (!onlyChanged && actor.flags?.["mekton-fusion"]?.customSkillsRemarked) return;
  const updates = planCustomRemarks(actor.items.filter(i => i.type === "skill"));
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    report.customRemarked.push(`${label}: re-marked ${updates.length} custom skill${updates.length === 1 ? "" : "s"}`);
  }
  if (!onlyChanged) await actor.setFlag("mekton-fusion", "customSkillsRemarked", true);
}

/**
 * The skill list cleanup for one actor (planSkillCleanup). A world actor runs
 * it once (flag mekton-fusion.skillListCleaned, set even when nothing
 * changed). An unlinked token is checked every run and written only on
 * change; a kept skill it inherits from its base actor isn't listed again.
 */
async function cleanupActorSkills(actor, report, { onlyChanged = false, label = actor.name, baseActor = null } = {}) {
  if (!onlyChanged && actor.flags?.["mekton-fusion"]?.skillListCleaned) return;
  const plan = planSkillCleanup(actor.items.filter(i => i.type === "skill"));
  if (plan.deletes.length) await actor.deleteEmbeddedDocuments("Item", plan.deletes);
  if (plan.updates.length) await actor.updateEmbeddedDocuments("Item", plan.updates);
  report.skillsDeleted += plan.deletes.length;
  report.skillsRenamed += plan.renamed.length;
  const inherited = name => !!baseActor?.items?.some(i => i.type === "skill" && i.name === name);
  report.skillsKept.push(...keptSkillLines(label, plan.kept.filter(k => !inherited(k.name))));
  if (!onlyChanged) await actor.setFlag("mekton-fusion", "skillListCleaned", true);
}

/**
 * Owned catalog armor and weapons still on an old catalog img get the new one
 * (catalogIconUpdates). A world actor runs it once (flag
 * mekton-fusion.catalogIconsUpdated, set even when nothing changed); an
 * unlinked token is checked every run and written only on change.
 */
async function updateCatalogIcons(actor, report, { onlyChanged = false } = {}) {
  if (!onlyChanged && actor.flags?.["mekton-fusion"]?.catalogIconsUpdated) return;
  const updates = catalogIconUpdates(actor.items);
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    report.iconsUpdated += updates.length;
  }
  if (!onlyChanged) await actor.setFlag("mekton-fusion", "catalogIconsUpdated", true);
}

/** The same cleanup on the world skill Items the seeding macro made (the CP2020 Skills folder), listed. */
async function cleanupWorldSkills(report) {
  const folder = game.folders.find(f => f.type === "Item" && f.name === "CP2020 Skills");
  if (!folder) return;
  const items = game.items.filter(i => i.type === "skill" && i.folder?.id === folder.id);
  const plan = planSkillCleanup(items);
  const deleted = plan.deletes.map(id => game.items.get(id)?.name).filter(Boolean);
  if (plan.deletes.length) await Item.deleteDocuments(plan.deletes);
  if (plan.updates.length) await Item.updateDocuments(plan.updates);
  for (const name of deleted) report.worldSkillChanges.push(`deleted ${name}`);
  for (const r of plan.renamed) report.worldSkillChanges.push(`renamed ${r.from} -> ${r.to}`);
  report.worldSkillChanges.push(...keptSkillLines("(world item)", plan.kept));
}

/**
 * The weapon step for one actor (world or unlinked token): each owned weapon
 * whose name matches a catalog entry gets catalogWeaponUpdate's changes.
 * @param {{items:Iterable<object>, updateEmbeddedDocuments:Function}} actor
 * @param {Map<string, object>} catalog - WEAPON_CATALOG by name
 * @param {{weaponsFixed:number}} report
 */
export async function migrateActorWeapons(actor, catalog, report) {
  const weaponUpdates = [];
  for (const item of actor.items) {
    if (item.type !== "weapon") continue;
    // Martial Art is unarmed-only: any weapon on it moves to Hand to Hand, catalog or not.
    const update = { ...martialArtWeaponUpdate(item), ...(catalog.has(item.name) ? catalogWeaponUpdate(item, catalog.get(item.name)) : null) };
    if (update["system.skill"] === "hand-to-hand" && item.system?.skill === "martial-art") {
      (report.martialArtWeapons ??= []).push(`${actor.name}: ${item.name}`);
    }
    if (Object.keys(update).length) weaponUpdates.push({ _id: item.id, ...update });
  }
  if (weaponUpdates.length) {
    await actor.updateEmbeddedDocuments("Item", weaponUpdates);
    report.weaponsFixed += weaponUpdates.length;
  }
}

/**
 * Martial Art stopped being a weapon attack skill: a weapon on "martial-art"
 * moves to "hand-to-hand" (null = nothing to do). A catalog weapon's own skill,
 * set by catalogWeaponUpdate, wins over this.
 * @param {{system:object}} item
 */
export function martialArtWeaponUpdate(item) {
  return item.system?.skill === "martial-art" ? { "system.skill": "hand-to-hand" } : null;
}

/**
 * Update for an owned weapon matching a catalog entry (null = nothing to do):
 * its skill, always, and its damageType ONCE. damageType (0.3.29) is set from
 * the catalog only while the item lacks the mekton-fusion.damageTypeSet flag,
 * then the flag is set, so a GM's later change (the item sheet sets the flag
 * too) survives re-running the macro. quick (0.3.31) works the same way, with
 * the mekton-fusion.quickSet flag, and armorPiercing (0.3.33) with apSet.
 * AP errata (MZ errata p.98, axes are not AP): an entry marked [AP] but with
 * armorPiercing false has AP cleared ONCE, under its own apErrataSet flag, so a
 * copy the 0.3.33 step already set true is still fixed; the item sheet sets
 * apErrataSet too, so a GM's later choice survives.
 * @param {{system:object, flags?:object}} item
 * @param {{system:object}} entry - the WEAPON_CATALOG entry
 */
export function catalogWeaponUpdate(item, entry) {
  const update = {};
  const want = entry.system?.skill;
  if (want && item.system?.skill !== want) update["system.skill"] = want;
  if (!item.flags?.["mekton-fusion"]?.damageTypeSet) {
    const type = entry.system?.damageType ?? "wound";
    if (item.system?.damageType !== type) update["system.damageType"] = type;
    update["flags.mekton-fusion.damageTypeSet"] = true;
  }
  if (!item.flags?.["mekton-fusion"]?.quickSet) {
    const quick = !!entry.system?.quick;
    if (!!item.system?.quick !== quick) update["system.quick"] = quick;
    update["flags.mekton-fusion.quickSet"] = true;
  }
  if (!item.flags?.["mekton-fusion"]?.apSet) {
    const ap = !!entry.system?.armorPiercing;
    if (!!item.system?.armorPiercing !== ap) update["system.armorPiercing"] = ap;
    update["flags.mekton-fusion.apSet"] = true;
  }
  const errata = !!entry.system?.damageNote?.includes("[AP]") && !entry.system?.armorPiercing;
  if (errata && !item.flags?.["mekton-fusion"]?.apErrataSet) {
    if (item.system?.armorPiercing) update["system.armorPiercing"] = false;
    update["flags.mekton-fusion.apErrataSet"] = true;
  }
  return Object.keys(update).length ? update : null;
}

/**
 * The armor steps for one actor (world or unlinked token): armor Items in the
 * zone format with per-zone SP, location wear moved onto the pieces (0.3.28),
 * then location SP recomputed. Creatures (natural armor) skip the last two.
 */
async function migrateActorArmor(actor, report, { onlyChanged = false, label = actor.name } = {}) {
  await migrateArmorItems(actor.items, actor, report, { onlyChanged });

  if ((Number(actor.system?.creature?.armorSP) || 0) > 0) {
    report.skippedCreatures.push(label);
    return;
  }
  await clearStrayLocationSP(actor, report, { onlyChanged, label });
  // 0.3.28: wear recorded on body locations moves onto the pieces' own per-zone SP.
  const wear = locationWearMoves(actor.system?.body?.locations, armorPieces(actor));
  if (wear.moved) {
    await actor.updateEmbeddedDocuments("Item", wear.itemUpdates);
    await actor.update(wear.actorUpdate);
    report.wearMoved += wear.moved;
  }
  await recomputeActorArmorSp(actor);
  report.armorRecomputed++;
}

/**
 * 0.3.39: sp/spMax 0 on every location no piece covers, for an actor without
 * creature natural armor (strayLocationSPUpdate). A world actor runs this once
 * (flag mekton-fusion.locationSPCleared, set even when nothing changed). An
 * unlinked token is checked every run but written only when it changes, so it
 * doesn't get a private copy of the flag.
 */
async function clearStrayLocationSP(actor, report, { onlyChanged = false, label = actor.name } = {}) {
  if (!onlyChanged && actor.flags?.["mekton-fusion"]?.locationSPCleared) return;
  const { update, locations } = strayLocationSPUpdate(actor.system, armorPieces(actor));
  if (locations.length) {
    const names = locations.map(k => actor.system.body.locations[k]?.label || k).join(", ");
    report.locationSPCleared.push(`${label}: ${names}`);
  }
  if (!onlyChanged) update["flags.mekton-fusion.locationSPCleared"] = true;
  if (Object.keys(update).length) await actor.update(update);
}

/**
 * Persist armor Items in the zone format, and seed per-zone current SP for any
 * piece that never had it (seedUnfilledPiece). Unmappable pieces
 * (migrationNote) are reported, and the note is cleared once reported.
 * onlyChanged (unlinked tokens): write only pieces that are seeded or carry a
 * note, so a token doesn't get a private copy of every armor piece it inherits.
 */
async function migrateArmorItems(items, actor, report, { onlyChanged = false } = {}) {
  const updates = [];
  for (const item of items) {
    if (item.type !== "armor") continue;
    const sys = item.toObject().system;
    const owner = actor ? `${actor.name}: ` : "(world item) ";
    const note = sys.migrationNote;
    if (note) report.armorProblems.push(`${owner}${item.name} -- ${note}`);

    const seeded = seedUnfilledPiece(sys, item.id, actor?.system?.body?.locations);
    if (seeded) {
      sys.currentSP = seeded;
      report.armorSeeded++;
    }
    // 0.3.29: the force screens are hard. Only fills an empty hardness, so a GM's choice stays.
    const hardened = !sys.hardness && !!HARDNESS_BY_NAME[item.name];
    if (hardened) sys.hardness = HARDNESS_BY_NAME[item.name];
    if (onlyChanged && !seeded && !note && !hardened) continue;
    sys.coverage = effectiveCoverage(sys);
    sys.migrationNote = "";
    updates.push({ _id: item.id, system: sys });
  }
  if (!updates.length) return;
  // diff:false -- the in-memory source is already migrated, so a diff would
  // be empty and the legacy data on disk would never be rewritten.
  if (actor) await actor.updateEmbeddedDocuments("Item", updates, { diff: false });
  else await Item.updateDocuments(updates, { diff: false });
  report.armorMigrated += updates.length;
}
