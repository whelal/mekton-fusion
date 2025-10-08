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
    context.isCustom = this.object.system?.custom;
    
    // Debug logging
    console.log("mekton-fusion | Item sheet getData:", {
      name: this.object.name,
      type: this.object.type,
      system: this.object.system,
      isSkill: context.isSkill,
      isCustom: this.object.system?.custom
    });
    
    // Add stat selections for dropdown - always create for skills
    if (context.isSkill) {
      const stats = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"];
      const currentStat = this.object.system?.stat || "REF";
      context.statOptions = stats.map(stat => ({
        value: stat,
        label: stat,
        selected: stat === currentStat
      }));
      
      // Create HTML for stat select element
      context.statSelectHTML = stats.map(stat => 
        `<option value="${stat}"${stat === currentStat ? ' selected' : ''}>${stat}</option>`
      ).join('');
      
      console.log("mekton-fusion | Created stat options:", context.statOptions);
      console.log("mekton-fusion | Current stat:", currentStat);
    }
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Set the correct value for the stat dropdown
    if (this.object.type === "skill" && this.object.system?.custom) {
      const statSelect = html.find('select[name="system.stat"]');
      if (statSelect.length && this.object.system.stat) {
        statSelect.val(this.object.system.stat);
        console.log("mekton-fusion | Set stat dropdown to:", this.object.system.stat);
      }
    }
    
    // Only handle changes for name and stat (custom skills only)
    html.find('input[name="name"]').change(this._onFormChange.bind(this));
    if (this.object.type === "skill" && this.object.system?.custom) {
      html.find('select[name="system.stat"]').change(this._onFormChange.bind(this));
    }
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
