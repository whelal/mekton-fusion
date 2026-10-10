import { WEAPON_CATALOG } from "./data/weapon-catalog.js";
import { recomputeActorArmorSp } from "./data/armor.js";
import { syncActorCoreItems } from "./seed.js";

/**
 * One-time refresh of existing characters and NPCs after the 0.3.x changes:
 *   - adds any CP2020 skills added since the actor was created (existing ranks untouched)
 *   - sets the skill on owned weapons whose name matches a catalog entry
 *   - recomputes body-location armor SP from worn armor Items
 * Creatures (natural armor SP from a preset, system.creature.armorSP > 0) are
 * skipped by the armor step so their natural SP isn't zeroed.
 * Safe to re-run; each step only changes what differs.
 */
export async function migrateAllActors() {
  const report = { actors: 0, skillsAdded: 0, weaponsFixed: 0, armorRecomputed: 0, skippedCreatures: [] };
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

    if ((Number(actor.system?.creature?.armorSP) || 0) > 0) {
      report.skippedCreatures.push(actor.name);
      continue;
    }
    await recomputeActorArmorSp(actor);
    report.armorRecomputed++;
  }
  return report;
}
