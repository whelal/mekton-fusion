export class MektonFusionItemSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "item"],
      template: "systems/mekton-fusion/templates/item-sheet.html",
      width: 520,
      height: 420,
      closeOnSubmit: false,
      submitOnChange: true
    });
  }

  getData(options = {}) {
    const context = super.getData(options);
    
    // Add helper data to context
    context.isSkill = this.object.type === "skill";
    context.isSpell = this.object.type === "spell";
    
    // Add stat selections for dropdown
    if (context.isSkill && this.object.system?.custom) {
      const stats = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"];
      context.statOptions = stats.map(stat => ({
        value: stat,
        label: stat,
        selected: this.object.system.stat === stat
      }));
    }
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Handle form changes
    html.find('input, select, textarea').change(this._onFormChange.bind(this));
  }

  async _onFormChange(event) {
    // Auto-save on form changes
    return this._onSubmit(event);
  }

  async _updateObject(event, formData) {
    // Handle the form submission and update the item
    return this.object.update(formData);
  }
}
