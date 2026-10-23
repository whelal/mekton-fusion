import { WEAPON_CATALOG } from "./data/weapon-catalog.js";
import { recomputeActorArmorSp, seedZoneSP } from "./data/armor.js";
import { ARMOR_ZONES, effectiveCoverage } from "./data/armor-coverage.js";
import { syncActorCoreItems } from "./seed.js";

/**
 * One-time refresh of existing characters and NPCs after the 0.3.x changes:
 *   - adds any CP2020 skills added since the actor was created (existing ranks untouched)
 *   - sets the skill on owned weapons whose name matches a catalog entry
 *   - writes armor Items in the 0.3.24 zone format (ArmorDataModel.migrateData
 *     converts them in memory on load; this persists them), seeds each piece's
 *     per-zone current SP, and reports anything the migration couldn't map
 *   - recomputes body-location armor SP from worn armor Items
 * Creatures (natural armor SP from a preset, system.creature.armorSP > 0) are
 * skipped by the armor step so their natural SP isn't zeroed.
 * Safe to re-run; each step only changes what differs.
 */
export async function migrateAllActors() {
  const report = { actors: 0, skillsAdded: 0, weaponsFixed: 0, armorMigrated: 0, armorProblems: [], armorRecomputed: 0, skippedCreatures: [] };
  const catalogSkill = new Map(WEAPON_CATALOG.map(w => [w.name, w.system?.skill ?? ""]));

  for (const actor of game.actors) {
    if (!["character", "npc"].includes(actor.type)) continue;
    report.actors++;

    const seeded = await syncActorCoreItems(actor);
    report.skillsAdded += seeded.created ?? 0;

    const weaponUpdates = [];
    for (const item of actor.items) {
      if (item.type !== "weapon" || !catalogSkill.has(item.name)) continue;
      const want = catalogSkill.get(item.name);
      if (!want || item.system?.skill === want) continue;
      weaponUpdates.push({ _id: item.id, "system.skill": want });
    }
    if (weaponUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", weaponUpdates);
      report.weaponsFixed += weaponUpdates.length;
    }

    await migrateArmorItems(actor.items, actor, report);

    if ((Number(actor.system?.creature?.armorSP) || 0) > 0) {
      report.skippedCreatures.push(actor.name);
      continue;
    }
    await recomputeActorArmorSp(actor);
    report.armorRecomputed++;
  }
  await migrateArmorItems(game.items, null, report);
  return report;
}

/**
 * Persist armor Items in the zone format. Per-zone current SP is seeded once
 * (only while every covered zone is still 0): the piece that was providing a
 * body location's SP keeps that location's ablated SP on each of its zones
 * there; every other zone starts at baseSP. Unmappable pieces (migrationNote)
 * are reported, and the note is cleared once reported.
 */
async function migrateArmorItems(items, actor, report) {
  const updates = [];
  for (const item of items) {
    if (item.type !== "armor") continue;
    const sys = item.toObject().system;
    const owner = actor ? `${actor.name}: ` : "(world item) ";
    if (sys.migrationNote) report.armorProblems.push(`${owner}${item.name} -- ${sys.migrationNote}`);

    const zones = effectiveCoverage(sys);
    const base = Number(sys.baseSP) || 0;
    if (base > 0 && zones.length && zones.every(z => !(Number(sys.currentSP?.[z]) > 0))) {
      sys.currentSP = seedZoneSP(zones, base);
      const locs = actor?.system?.body?.locations ?? {};
      for (const z of zones) {
        const loc = locs[ARMOR_ZONES[z].location];
        if (loc?.itemId === item.id) sys.currentSP[z] = Math.min(base, Math.max(0, Number(loc.sp) || 0));
      }
    }
    sys.coverage = zones;
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
