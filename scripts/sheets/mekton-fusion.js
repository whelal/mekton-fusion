import { MektonActorSheet } from "../../module/sheets/actor-sheet.js";

Hooks.once("init", async () => {
  console.log("mekton-fusion | Initializing");

  // --- Sheet registration (v13-safe with fallback) ---
  const DSC = foundry?.applications?.sheets?.DocumentSheetConfig;
  const ActorDocumentClass = CONFIG?.Actor?.documentClass;

  if (DSC && ActorDocumentClass) {
    // Preferred modern API
    DSC.unregisterSheet(ActorDocumentClass, "core");
    DSC.registerSheet(ActorDocumentClass, "mekton-fusion", MektonActorSheet, {
      types: ["character", "npc"],
      makeDefault: true
    });
  } else {
    // Fallback to legacy API (will log deprecation warnings, but works)
    // eslint-disable-next-line no-undef
    Actors.unregisterSheet("core", ActorSheet);
    // eslint-disable-next-line no-undef
    Actors.registerSheet("mekton-fusion", MektonActorSheet, {
      types: ["character", "npc"],
      makeDefault: true
    });
  }

  // --- Initiative formula (set early so Combat is happy) ---
  CONFIG.Combat.initiative = {
    formula: "1d10 + @system.stats.REF.value",
    decimals: 0
  };

  // --- Template helper & preload ---
  Handlebars.registerHelper("length-of", (obj) => Object.keys(obj ?? {}).length);

  await foundry.applications.handlebars.loadTemplates([
    "systems/mekton-fusion/templates/actor/character-sheet.hbs"
  ]);
});
