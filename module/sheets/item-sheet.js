import { WEAPON_OPTIONS, computeWeaponOptionsEffect, effectiveCombatWa, weaponSupportsOptions, summarizeWeaponOption } from "../data/weapon-options.js";
import { ARMOR_ZONES, ARMOR_KINDS, effectiveCoverage } from "../data/armor-coverage.js";
import { seedZoneSP } from "../data/armor.js";
import { coverageEditorHtml, bindCoverageEditor } from "./armor-coverage-ui.js";

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
    context.isMechaLoadout = this.object.type === "mecha-loadout";

    if (context.isMechaLoadout) {
      const preset = context.system.preset ?? {};
      context.loadoutSummary = {
        kind: context.system.kind === 'creature' ? 'Creature' : 'Mecha',
        servoCount: preset.servos?.length ?? 0,
        weaponCount: preset.weapons?.length ?? 0,
        shieldCount: preset.shields?.length ?? 0,
        movementCount: preset.movement?.length ?? 0,
        naturalWeaponCount: preset.naturalWeapons?.length ?? 0
      };
    }

    if (context.isArmor) {
      const kind = context.system.kind ?? "";
      const kindDef = ARMOR_KINDS[kind];
      context.armorKindOptions = [{ value: "", label: "—", selected: !kindDef },
        ...Object.entries(ARMOR_KINDS).map(([value, k]) => ({ value, label: k.label, selected: value === kind }))];
      context.armorPerZone = kindDef?.pricing === "perZone";
      // Mesh/plate: preset + per-zone picker. Fixed kinds: read-only zone list.
      if (kindDef?.choosable) {
        context.armorCoverageEditor = coverageEditorHtml(context.system, { disabled: !this.isEditable });
      } else {
        const zones = effectiveCoverage(context.system);
        context.armorCoverageText = zones.length ? zones.map(z => ARMOR_ZONES[z].label).join(", ") : "None";
      }
    }

    // Options are ranged-weapon accessories only (see weaponSupportsOptions).
    context.supportsOptions = context.isWeapon && weaponSupportsOptions(context.system, this.object.type);
    // A locked compendium (or a non-owner) renders every control disabled;
    // options are configured on a character's own copy of the weapon.
    context.optionsReadOnly = !this.isEditable;

    if (context.supportsOptions) {
      const installedKeys = context.system.options ?? [];
      context.weaponOptionsList = Object.entries(WEAPON_OPTIONS).map(([key, opt]) => ({
        key, label: opt.label, checked: installedKeys.includes(key), summary: summarizeWeaponOption(opt)
      }));

      const effect = computeWeaponOptionsEffect(installedKeys);
      const baseWa = Number(context.system.wa) || 0;
      const baseWeight = Number(context.system.weight) || 0;
      const baseCost = Number(context.system.cost) || 0;
      const baseTl = Number(context.system.tl) || 0;
      const baseShotsNum = Number(context.system.shots);

      context.effective = {
        hasOptions: effect.installed.length > 0,
        combatWa: effectiveCombatWa(context.system, effect.combatWaBonus).wa,
        combatWaCapped: effectiveCombatWa(context.system, effect.combatWaBonus).capped,
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

    // Armor coverage editor (no `name` either): persist coverage and reseed
    // the per-zone current SP (kept zones keep theirs, new zones get baseSP).
    if (this.object.type === "armor" && this.isEditable) {
      const sys = this.object.system;
      bindCoverageEditor(html.find('.mf-coverage-editor'), sys, async zones => {
        await this.object.update({
          'system.coverage': zones,
          'system.currentSP': seedZoneSP(zones, sys.baseSP, { oldCoverage: sys.coverage, oldSP: sys.currentSP })
        });
      });
    }
  }

  async _onFormChange(event) {
    // Auto-save on form changes
    return this._onSubmit(event);
  }

  async _updateObject(event, formData) {
    // Armor kind change: a fixed-coverage kind takes its own zones; reseed per-zone SP to match.
    if (this.object.type === "armor" && "system.kind" in formData && formData["system.kind"] !== this.object.system.kind) {
      const sys = this.object.system;
      const zones = effectiveCoverage({ ...sys, kind: formData["system.kind"] });
      formData["system.coverage"] = zones;
      formData["system.currentSP"] = seedZoneSP(zones, sys.baseSP, { oldCoverage: sys.coverage, oldSP: sys.currentSP });
    }
    // A GM's Damage Type choice marks the weapon so Update Characters never resets it (catalogWeaponUpdate).
    if (this.object.type === "weapon" && "system.damageType" in formData && formData["system.damageType"] !== this.object.system.damageType) {
      formData["flags.mekton-fusion.damageTypeSet"] = true;
    }
    if (this.object.type === "weapon" && "system.quick" in formData && formData["system.quick"] !== this.object.system.quick) {
      formData["flags.mekton-fusion.quickSet"] = true;
    }
    // Handle the form submission and update the item
    return this.object.update(formData);
  }
}
