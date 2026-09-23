export class ItemDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // Shared fields for all item types
      description: new fields.StringField({ initial: "" }),
      sort: new fields.NumberField({ initial: 0, integer: true })
    };
  }
}

// Schema for weapon and mecha-weapon items
export class WeaponDataModel extends ItemDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    return foundry.utils.mergeObject(parentSchema, {
      name: new fields.StringField({ initial: "" }),
      wa: new fields.NumberField({ initial: 0, integer: true }),
      range: new fields.StringField({ initial: "" }), // free text: "T", "28-400", a single number, etc. -- never coerced
      damage: new fields.StringField({ initial: "" }), // free text: "2D6+", "1-4D6", "40D6", etc. -- never coerced
      shots: new fields.StringField({ initial: "" }), // free text: "na", "10 turns", "(2)", a bare number -- never coerced
      bv: new fields.StringField({ initial: "" }),
      skill: new fields.StringField({ initial: "" }),
      conc: new fields.StringField({ initial: "" }), // concealability: P/J/L/N
      weight: new fields.NumberField({ initial: 0, min: 0 }), // kg
      cost: new fields.NumberField({ initial: 0, min: 0 }), // eb/credits
      ammoCost: new fields.NumberField({ initial: 0, min: 0 }), // cost per reload (generally per clip)
      tl: new fields.NumberField({ initial: 0, min: 0, integer: true }), // tech level
      damageNote: new fields.StringField({ initial: "" }), // [AP], *, etc. -- mirrors mecha-weapon damageNote
      scale: new fields.StringField({ initial: "human" }), // reserved for the future scale system; unused for now
      options: new fields.ArrayField(new fields.StringField(), { initial: [] }), // WEAPON_OPTIONS keys installed on this weapon
      // Which Combat tab table this weapon renders in (combat.hbs branches on
      // this) and its per-weapon freeform note (also combat.hbs). Both were
      // read/written throughout the codebase (_onCreateWeapon,
      // _onDropItemCreate's isMecha:overMecha merge, weapon-catalog.js) but
      // were never actually declared here -- Foundry's DataModel silently
      // drops any key not in the schema, so every weapon's isMecha/note
      // always persisted as undefined regardless of what was set before
      // creation. Declaring them now is what actually makes those existing
      // call sites take effect.
      isMecha: new fields.BooleanField({ initial: false }),
      note: new fields.StringField({ initial: "" })
    });
  }
}

// Schema for skill items
export class SkillDataModel extends ItemDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    return foundry.utils.mergeObject(parentSchema, {
      stat: new fields.StringField({ initial: "INT" }),
      category: new fields.StringField({ initial: "" }),
      rank: new fields.NumberField({ initial: 0, integer: true }),
      favorite: new fields.BooleanField({ initial: false }),
      ip: new fields.NumberField({ initial: 0, integer: true }),
      hard: new fields.BooleanField({ initial: false })
    });
  }
}

// Schema for armor items
export class ArmorDataModel extends ItemDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    return foundry.utils.mergeObject(parentSchema, {
      name: new fields.StringField({ initial: "" }),
      category: new fields.StringField({ initial: "" }), // e.g. "Ballistic Mesh", "Space Suit", "Other Armor"
      sp: new fields.NumberField({ initial: 0, min: 0, integer: true }), // Stopping Power
      spNote: new fields.StringField({ initial: "" }), // e.g. "3D6" (Personal Force Screen) -- roll once, enter the result into sp above
      // Garment shape (hat/vest/jacket/overcoat/pants/shorts/boots), plus
      // "all"/"handheld" -- see module/data/armor-coverage.js (ARMOR_COVERAGE)
      // for what hit-zone(s) each value actually covers.
      coverage: new fields.StringField({ initial: "vest" }),
      weight: new fields.NumberField({ initial: 0, min: 0 }), // kg
      cost: new fields.NumberField({ initial: 0, min: 0 }),
      tl: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });
  }
}

// Schema for mecha-loadout items: a whole mecha (or creature) build,
// draggable from a compendium onto a character sheet to stamp it directly
// onto that actor's system.mecha (or system.creature), same effect as the
// Mecha/Body tabs' "Load Preset" pickers -- just sourced from a compendium
// Item instead of the hardcoded MECHA_PRESETS/CREATURE_PRESETS list. Never
// embedded as an inventory Item on the target actor (see
// _onDropItemCreate/_applyMechaLoadout in actor-sheet.js).
export class MechaLoadoutDataModel extends ItemDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    return foundry.utils.mergeObject(parentSchema, {
      name: new fields.StringField({ initial: "" }),
      kind: new fields.StringField({ initial: "mecha" }), // "mecha" | "creature" -- picks which preset builder/target fields to use
      // The full MECHA_PRESETS/CREATURE_PRESETS entry shape (servos/weapons/
      // shields/movement/powerplant, or bod/naturalWeapons/armorSP for a
      // creature) -- opaque here, consumed by buildMechaPresetUpdate()/
      // buildCreaturePresetUpdate() exactly as a hardcoded preset would be.
      preset: new fields.ObjectField({ initial: {} })
    });
  }
}
