/**
 * mekton-fusion: Mecha Loadout Catalog
 * ---------------------------------------
 * Source data for the "Mecha Loadouts" compendium pack -- wraps each entry
 * from MECHA_PRESETS/CREATURE_PRESETS (module/data/mecha-presets.js) as a
 * mecha-loadout Item so it can be dragged from a compendium straight onto a
 * character sheet, same effect as the Mecha/Body tabs' "Load Preset"
 * pickers (see _applyMechaLoadout in actor-sheet.js) -- just sourced from a
 * compendium Item instead of a dropdown. The preset data itself isn't
 * duplicated here; these are thin wrappers around the same MECHA_PRESETS/
 * CREATURE_PRESETS entries the picker already uses, so both stay in sync
 * automatically if a preset's construction changes.
 *
 * Icons: verified against the actual Foundry install's
 * public/icons/creatures/magical/ tree (same methodology as weapon-catalog.js
 * and armor-catalog.js). No stock "mecha" art exists in Foundry's bundled
 * set, so these use the closest available reads -- a blue robotic construct
 * for the fast/light Vesper, a heavier stomping-iron construct for the
 * slow/armored Bulwark.
 */

import { MECHA_PRESETS, CREATURE_PRESETS } from "./mecha-presets.js";

/** Build one catalog entry from a MECHA_PRESETS/CREATURE_PRESETS entry. */
function loadout(preset, img) {
  return {
    name: preset.label,
    type: "mecha-loadout",
    img,
    system: { name: preset.label, kind: preset.kind, preset, description: preset.notes ?? "" }
  };
}

export const MECHA_LOADOUT_CATALOG = [
  loadout(MECHA_PRESETS.vesper, "icons/creatures/magical/construct-golem-robot-blue.webp"),
  loadout(MECHA_PRESETS.bulwark, "icons/creatures/magical/construct-iron-stomping-yellow.webp"),
  loadout(CREATURE_PRESETS.direWolf, "icons/creatures/mammals/wolf-shadow-black.webp")
];
