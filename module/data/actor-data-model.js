export class ActorDataModel extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            stats: new fields.SchemaField({
                INT: new fields.NumberField({initial: 5, min: 0, integer: true}),
                REF: new fields.NumberField({initial: 5, min: 0, integer: true}),
                TECH: new fields.NumberField({initial: 5, min: 0, integer: true}),
                COOL: new fields.NumberField({initial: 5, min: 0, integer: true}),
                ATTR: new fields.NumberField({initial: 5, min: 0, integer: true}),
                LUCK: new fields.NumberField({initial: 5, min: 0, integer: true}),
                MA: new fields.NumberField({initial: 5, min: 0, integer: true}),
                BODY: new fields.NumberField({initial: 5, min: 0, integer: true}),
                EMP: new fields.NumberField({initial: 5, min: 0, integer: true}),
                EDU: new fields.NumberField({initial: 5, min: 0, integer: true})
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