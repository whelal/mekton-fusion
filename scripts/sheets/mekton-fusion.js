// module/script/sheets/mekton-fusion.js
import { MektonActorSheet } from "./actor-sheet.js";

Hooks.once("init", () => {
  console.log("mekton-fusion | init");

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
    formula: "1d10 + @system.abilities.ref.value",
    decimals: 0
  };
});

Hooks.once("ready", () => {
  console.log("mekton-fusion | ready");
});
