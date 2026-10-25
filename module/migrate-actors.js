import { WEAPON_CATALOG } from "./data/weapon-catalog.js";
import { recomputeActorArmorSp, seedUnfilledPiece, armorPieces, locationWearMoves } from "./data/armor.js";
import { effectiveCoverage } from "./data/armor-coverage.js";
import { syncActorCoreItems } from "./seed.js";

/**
 * One-time refresh of existing characters and NPCs after the 0.3.x changes:
 *   - adds any CP2020 skills added since the actor was created (existing ranks untouched)
 *   - sets the skill on owned weapons whose name matches a catalog entry
 *   - writes armor Items in the 0.3.24 zone format (ArmorDataModel.migrateData
 *     converts them in memory on load; this persists them), seeds each piece's
 *     per-zone current SP, and reports anything the migration couldn't map
 *   - moves armor wear recorded on body locations onto the worn pieces' own
 *     per-zone SP (0.3.28, locationWearMoves)
 *   - recomputes body-location armor SP from worn armor Items
 *   - runs the armor steps on unlinked tokens on every scene too (0.3.28)
 * Creatures (natural armor SP from a preset, system.creature.armorSP > 0) are
 * skipped by the armor step so their natural SP isn't zeroed.
 * Safe to re-run; each step only changes what differs.
 */
export async function migrateAllActors() {
  const report = { actors: 0, skillsAdded: 0, weaponsFixed: 0, armorMigrated: 0, armorProblems: [], armorRecomputed: 0, armorSeeded: 0, wearMoved: 0, tokens: 0, skippedCreatures: [] };
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

    await migrateActorArmor(actor, report);
  }

  // Unlinked tokens carry their own copy of the actor (and its armor), which
  // the world-actor loop above never touches: run the armor steps on each.
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      const actor = token.actorLink ? null : token.actor;
      if (!actor || !["character", "npc"].includes(actor.type)) continue;
      report.tokens++;
      await migrateActorArmor(actor, report, { onlyChanged: true });
    }
  }
  await migrateArmorItems(game.items, null, report);
  return report;
}

/**
 * The armor steps for one actor (world or unlinked token): armor Items in the
 * zone format with per-zone SP, location wear moved onto the pieces (0.3.28),
 * then location SP recomputed. Creatures (natural armor) skip the last two.
 */
async function migrateActorArmor(actor, report, { onlyChanged = false } = {}) {
  await migrateArmorItems(actor.items, actor, report, { onlyChanged });

  if ((Number(actor.system?.creature?.armorSP) || 0) > 0) {
    report.skippedCreatures.push(actor.name);
    return;
  }
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
    if (onlyChanged && !seeded && !note) continue;
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
