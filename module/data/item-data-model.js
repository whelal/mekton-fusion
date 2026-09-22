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
      scale: new fields.StringField({ initial: "human" }) // reserved for the future scale system; unused for now
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
      armorValue: new fields.NumberField({ initial: 0, integer: true }),
      bodyLocation: new fields.StringField({ initial: "" })
    });
  }
}
