import { WEAPON_CATALOG } from "./data/weapon-catalog.js";

const PACK_KEY = "mekton-fusion.weapons-personal";

/**
 * Populate the system-bundled "Personal Weapons (MZ)" compendium
 * (packs/weapons-personal, declared in system.json) with Item documents from
 * WEAPON_CATALOG. This is the in-Foundry alternative to the Node-based
 * scripts/build-packs.mjs generator -- no CLI/build step needed, just run the
 * paired macro as a GM. Existing entries are replaced (by name) so re-running
 * after editing the catalog is safe.
 *
 * Foundry auto-creates an empty LevelDB store the first time it loads a
 * system that declares a pack path which doesn't exist on disk yet -- that's
 * why the compendium already shows up (empty) before this has ever run.
 * System packs default to locked; this unlocks it for the write and leaves
 * it unlocked afterward (lock it again from the compendium sidebar if you
 * want it read-only for players).
 */
export async function buildWeaponsPack() {
  const pack = game.packs.get(PACK_KEY);
  if (!pack) throw new Error(`Compendium ${PACK_KEY} not found -- is the system pack registered in system.json and did you restart/reload the world?`);

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  try {
    const existing = await pack.getDocuments();
    const byName = new Map(existing.map(i => [i.name, i]));

    let created = 0, updated = 0;
    for (const entry of WEAPON_CATALOG) {
      const data = foundry.utils.deepClone(entry);
      const existingItem = byName.get(data.name);
      if (existingItem) {
        await existingItem.update(data);
        updated++;
      } else {
        await Item.create(data, { pack: pack.collection });
        created++;
      }
    }

    return { created, updated, total: WEAPON_CATALOG.length };
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}
