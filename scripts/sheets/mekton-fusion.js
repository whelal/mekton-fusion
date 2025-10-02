// module/script/sheets/mekton-fusion.js
import { MektonActorSheet } from "./actor-sheet.js";
import { ActorDataModel } from "../../module/data/actor-data-model.js";
import { syncActorCoreItems } from "../../module/seed.js";

Hooks.once("init", () => {
  console.log("mekton-fusion | init");

  // Register DataModel for all actor types we use
  CONFIG.Actor.dataModels ||= {};
  for (const t of ["character", "npc", "vehicle"]) {
    CONFIG.Actor.dataModels[t] = ActorDataModel;
  }

  // Use namespaced DocumentSheetConfig (no deprecation warning)
  const DSC = foundry.applications.apps.DocumentSheetConfig;

  // Unregister the core Actor sheet (V1) by specifying the class explicitly
  DSC.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);

  // Register our sheet
  DSC.registerSheet(Actor, "mekton-fusion", MektonActorSheet, {
    types: ["character", "npc", "vehicle"], // must match system.json actor types
    makeDefault: true,
    label: "Mekton Actor Sheet"
  });

  // Initiative (or put this in system.json, but keep only one source of truth)
  CONFIG.Combat.initiative = {
    formula: "1d10 + @system.stats.REF.value", // updated path (uppercase stats)
    decimals: 0
  };
});

// Auto-seed skills and spells when actors are created
Hooks.on("createActor", async (actor) => {
  if (["character", "npc"].includes(actor.type)) {
    console.log("mekton-fusion | Auto-seeding new actor:", actor.name);
    try {
      const result = await syncActorCoreItems(actor);
      if (result.created > 0) {
        ui.notifications.info(`Added ${result.created} default skills/spells to ${actor.name}`);
      }
    } catch (err) {
      console.error("mekton-fusion | Auto-seeding failed for", actor.name, err);
    }
  }
});

Hooks.once("ready", () => {
  console.log("mekton-fusion | ready");
  // Migration: ensure stats follow { value } shape for new DataModel
  for (const actor of game.actors.contents ?? []) {
    const stats = actor.system?.stats;
    if (!stats) continue;
    let changed = false;
    for (const [k, v] of Object.entries(stats)) {
      if (v !== null && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value')) continue;
      // v is likely a number or malformed object; wrap
      const numeric = (typeof v === 'number') ? v : Number(v?.value ?? v) || 0;
      stats[k] = { value: numeric };
      changed = true;
    }
    if (changed) {
      actor.update({ 'system.stats': stats }).catch(err => console.warn('mekton-fusion | stat migration failed for actor', actor.id, err));
    }
  }
});
