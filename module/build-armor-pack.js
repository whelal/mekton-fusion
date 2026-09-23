import { ARMOR_CATALOG } from "./data/armor-catalog.js";

const PACK_KEY = "mekton-fusion.armor-personal";

/**
 * Populate the system-bundled "Personal Armor (MZ)" compendium
 * (packs/armor-personal, declared in system.json) with Item documents from
 * ARMOR_CATALOG. Mirrors build-weapons-pack.js -- see that file for the
 * fuller explanation of why this writes directly into the registered system
 * pack instead of going through the Node-based scripts/build-packs.mjs.
 */
export async function buildArmorPack() {
  const pack = game.packs.get(PACK_KEY);
  if (!pack) throw new Error(`Compendium ${PACK_KEY} not found -- is the system pack registered in system.json and did you restart/reload the world?`);

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  try {
    const existing = await pack.getDocuments();
    const byName = new Map(existing.map(i => [i.name, i]));

    let created = 0, updated = 0;
    for (const entry of ARMOR_CATALOG) {
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

    return { created, updated, total: ARMOR_CATALOG.length };
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}
