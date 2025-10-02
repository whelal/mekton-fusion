export class ActorDataModel extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            meta: new fields.SchemaField({
                role: new fields.StringField({initial: ""}),
                age: new fields.NumberField({initial: 25, min: 0, integer: true}),
                points: new fields.NumberField({initial: 0, min: 0, integer: true})
            }),
            stats: new fields.SchemaField({
                INT: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                REF: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                TECH: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                COOL: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                ATTR: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                LUCK: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                MA: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                BODY: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                EMP: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                EDU: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) })
            }),
            hp: new fields.SchemaField({
                current: new fields.NumberField({initial: 10, min: 0, integer: true}),
                max: new fields.NumberField({initial: 10, min: 0, integer: true})
            }),
            magic: new fields.SchemaField({
                vigor: new fields.NumberField({initial: 5, min: 0, integer: true}),
                maxVigor: new fields.NumberField({initial: 5, min: 0, integer: true})
            }),
            psi: new fields.SchemaField({
                points: new fields.NumberField({initial: 0, min: 0, integer: true}),
                maxPoints: new fields.NumberField({initial: 0, min: 0, integer: true})
            }),
            equipment: new fields.SchemaField({
                entries: new fields.ArrayField(new fields.ObjectField())
            })
        };
    }
}