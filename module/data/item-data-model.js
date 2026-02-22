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
      range: new fields.StringField({ initial: "" }),
      damage: new fields.StringField({ initial: "" }),
      shots: new fields.NumberField({ initial: 0, integer: true }),
      bv: new fields.StringField({ initial: "" }),
      skill: new fields.StringField({ initial: "" })
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

// Schema for spell items
export class SpellDataModel extends ItemDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    return foundry.utils.mergeObject(parentSchema, {
      school: new fields.StringField({ initial: "Sign" }),
      cost: new fields.NumberField({ initial: 0, integer: true }),
      effect: new fields.StringField({ initial: "" }),
      test: new fields.StringField({ initial: "INT" }),
      favorite: new fields.BooleanField({ initial: false })
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
