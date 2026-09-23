import { MECHA_LOADOUT_CATALOG } from "./data/mecha-loadout-catalog.js";

const PACK_KEY = "mekton-fusion.mecha-loadouts";

/**
 * Populate the system-bundled "Mecha Loadouts" compendium
 * (packs/mecha-loadouts, declared in system.json) with Item documents from
 * MECHA_LOADOUT_CATALOG. Mirrors build-weapons-pack.js/build-armor-pack.js
 * -- see build-weapons-pack.js for the fuller explanation of why this
 * writes directly into the registered system pack instead of going through
 * the Node-based scripts/build-packs.mjs.
 */
export async function buildMechaLoadoutPack() {
  const pack = game.packs.get(PACK_KEY);
  if (!pack) throw new Error(`Compendium ${PACK_KEY} not found -- is the system pack registered in system.json and did you restart/reload the world?`);

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  try {
    const existing = await pack.getDocuments();
    const byName = new Map(existing.map(i => [i.name, i]));

    let created = 0, updated = 0;
    for (const entry of MECHA_LOADOUT_CATALOG) {
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

    return { created, updated, total: MECHA_LOADOUT_CATALOG.length };
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}
