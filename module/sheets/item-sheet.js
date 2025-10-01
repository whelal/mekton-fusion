export class MektonFusionItemSheet extends foundry.applications.item.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "item"],
      template: "systems/mekton-fusion/templates/item-sheet.html",
      width: 520,
      height: 420
    });
  }
}
