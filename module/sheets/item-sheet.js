import { WEAPON_OPTIONS, computeWeaponOptionsEffect } from "../data/weapon-options.js";
import { ARMOR_COVERAGE } from "../data/armor-coverage.js";

export class MektonFusionItemSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "item"],
      template: "systems/mekton-fusion/templates/item-sheet.html",
      width: 520,
      height: 620,
      closeOnSubmit: false,
      submitOnChange: true
    });
  }

  getData(options = {}) {
    const context = super.getData(options);

    // super.getData() doesn't flatten system data to context.system the way
    // the template expects (same quirk actor-sheet.js works around) -- set
    // it explicitly, or every {{system.*}} binding in item-sheet.html
    // resolves to undefined regardless of the item's actual data.
    context.system = this.object.system ?? {};

    // Add helper data to context
    context.isSkill = this.object.type === "skill";
    context.isCustom = this.object.system?.custom;
    context.isWeapon = this.object.type === "weapon" || this.object.type === "mecha-weapon";
    context.isArmor = this.object.type === "armor";

    if (context.isArmor) {
      const currentCoverage = context.system.coverage || "vest";
      context.armorCoverageOptions = Object.entries(ARMOR_COVERAGE).map(([value, opt]) => ({
        value, label: opt.label, selected: value === currentCoverage
      }));
    }

    if (context.isWeapon) {
      const installedKeys = context.system.options ?? [];
      context.weaponOptionsList = Object.entries(WEAPON_OPTIONS).map(([key, opt]) => ({
        key, label: opt.label, checked: installedKeys.includes(key)
      }));

      const effect = computeWeaponOptionsEffect(installedKeys);
      const baseWa = Number(context.system.wa) || 0;
      const baseWeight = Number(context.system.weight) || 0;
      const baseCost = Number(context.system.cost) || 0;
      const baseTl = Number(context.system.tl) || 0;
      const baseShotsNum = Number(context.system.shots);

      context.effective = {
        hasOptions: effect.installed.length > 0,
        combatWa: baseWa + effect.combatWaBonus,
        maxRangeMod: effect.maxRangeMod ?? -4,
        maxRangeIsDefault: effect.maxRangeMod === null,
        shots: Number.isFinite(baseShotsNum) ? String(baseShotsNum * effect.shotsMultiplier) : context.system.shots,
        weight: Math.round((baseWeight * (1 + effect.weightPct) + effect.addWeight) * 100) / 100,
        cost: Math.round((baseCost * (1 + effect.costPct) + effect.addCost) * 100) / 100,
        tl: Math.max(baseTl, effect.maxTL),
        conc: effect.concealabilityOverride ?? context.system.conc
      };
    }

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

    // Weapon Options checkboxes carry no `name` (kept out of the normal
    // submitOnChange form collection, same reasoning as Initiative Mod on the
    // actor sheet) -- collect all checked keys directly and persist explicitly.
    html.find('.mf-weapon-option').on('change', async () => {
      const keys = html.find('.mf-weapon-option:checked').map((_, el) => el.dataset.optionKey).get();
      await this.object.update({ 'system.options': keys });
    });
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
