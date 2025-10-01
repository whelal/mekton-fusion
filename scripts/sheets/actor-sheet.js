// module/script/sheets/actor-sheet.js
export class MektonActorSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "actor"],
      template: "systems/mekton-fusion/templates/actor/actor-sheet.hbs",
      width: 740,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }],
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: true,
      scrollY: [".tab.stats", ".tab.skills", ".tab.spells"]
    });
  }

  async getData(options = {}) {
    const ctx = await super.getData(options);
    ctx.actor    = this.actor;
    ctx.system   = this.actor.system ?? {};
    ctx.items    = this.actor.items ?? [];
    ctx.editable = this.isEditable;

    // optional seeding
    ctx.system.skills ??= {};
    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.on("click", ".item-control.item-edit", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet?.render(true);
    });
  }
}
