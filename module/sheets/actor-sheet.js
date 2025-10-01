export class MektonActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "actor"],
      template: "systems/mekton-fusion/templates/actor/character-sheet.hbs",
      width: 720,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  getData(options) {
    const base = super.getData(options);
    // Ensure we always have the containers the template expects
    base.system = base.actor.system ?? {};
    base.system.stats = base.system.stats ?? {};
    base.system.skills = base.system.skills ?? {};
    base.system.spells = base.system.spells ?? {};
    return base;
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Add listeners later for editing stats/skills/spells
  }
}
