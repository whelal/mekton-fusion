import { MektonActorSheet } from "../../module/sheets/actor-sheet.js";

async function preloadHandlebarsTemplates() {
  const templatePaths = [
    "systems/mekton-fusion/templates/actor/character-sheet.hbs"
  ];
  return loadTemplates(templatePaths);
}

Hooks.once("init", () => {
  console.log("mekton-fusion | Initializing Mekton Fusion system");

  // Register Actor sheet
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("mekton-fusion", MektonActorSheet, {
    types: ["character", "npc"],
    makeDefault: true
  });

  // Preload templates
  preloadHandlebarsTemplates();
});
