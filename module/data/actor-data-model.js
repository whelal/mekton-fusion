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
                EDU: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) }),
                PSI: new fields.SchemaField({ value: new fields.NumberField({initial: 5, min: 0, integer: true}) })
            }),
            // Unified substats container (replaces runtime seeding in sheet logic)
            substats: new fields.SchemaField({
                stun: new fields.NumberField({initial: 0, min: 0, integer: true}),
                death: new fields.NumberField({initial: 0, min: 0, integer: true}),
                lift: new fields.NumberField({initial: 0, min: 0, integer: true}),
                carry: new fields.NumberField({initial: 0, min: 0, integer: true}),
                run: new fields.NumberField({initial: 0, min: 0, integer: true}),
                leap: new fields.NumberField({initial: 0, min: 0, integer: true}),
                swim: new fields.NumberField({initial: 0, min: 0, integer: true}),
                hp: new fields.NumberField({initial: 0, min: 0, integer: true}),
                hp_current: new fields.NumberField({initial: 0, min: 0, integer: true}),
                sta: new fields.NumberField({initial: 0, min: 0, integer: true}),
                sta_current: new fields.NumberField({initial: 0, min: 0, integer: true}),
                rec: new fields.NumberField({initial: 0, min: 0, integer: true}),
                rec_current: new fields.NumberField({initial: 0, min: 0, integer: true}),
                psi: new fields.NumberField({initial: 0, min: 0, integer: true}),
                psi_current: new fields.NumberField({initial: 0, min: 0, integer: true}),
                psihybrid: new fields.NumberField({initial: 0, min: 0, integer: true}),
                psihybrid_current: new fields.NumberField({initial: 0, min: 0, integer: true}),
                initiative: new fields.NumberField({initial: 0, integer: true}), // removed min: 0 to allow negative modifiers
                dodge: new fields.NumberField({initial: 0, min: 0, integer: true}),
                enc: new fields.NumberField({initial: 0, min: 0, integer: true}),
                punch: new fields.NumberField({initial: 0, min: 0, integer: true}),
                kick: new fields.NumberField({initial: 0, min: 0, integer: true}),
                humanity: new fields.NumberField({initial: 0, min: 0, integer: true})
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
            // Mecha data (Mekton Zeta/Plus roadstriker style)
            mecha: new fields.SchemaField({
                name: new fields.StringField({ initial: "" }),
                weight: new fields.NumberField({ initial: 0, min: 0 }),
                cost: new fields.NumberField({ initial: 0, min: 0 }),
                activeConfig: new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true }),
                config: new fields.SchemaField({
                    name: new fields.StringField({ initial: "" }),
                    mv: new fields.NumberField({ initial: 0, integer: true }),
                    mr: new fields.NumberField({ initial: 0, integer: true }),
                    landMA: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    flightMA: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    name2: new fields.StringField({ initial: "" }),
                    mv2: new fields.NumberField({ initial: 0, integer: true }),
                    mr2: new fields.NumberField({ initial: 0, integer: true }),
                    landMA2: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    flightMA2: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    name3: new fields.StringField({ initial: "" }),
                    mv3: new fields.NumberField({ initial: 0, integer: true }),
                    mr3: new fields.NumberField({ initial: 0, integer: true }),
                    landMA3: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    flightMA3: new fields.NumberField({ initial: 0, min: 0, integer: true })
                }),
                skills: new fields.SchemaField({
                    piloting: new fields.NumberField({ initial: 0, integer: true }),
                    fighting: new fields.NumberField({ initial: 0, integer: true }),
                    melee: new fields.NumberField({ initial: 0, integer: true }),
                    gunnery: new fields.NumberField({ initial: 0, integer: true }),
                    missiles: new fields.NumberField({ initial: 0, integer: true })
                }),
                maneuverPool: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                costMultiplier: new fields.SchemaField({
                    system: new fields.StringField({ initial: "" }),
                    powerplant: new fields.StringField({ initial: "" })
                }),
                servos: new fields.ArrayField(new fields.SchemaField({
                    sp: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    servo: new fields.StringField({ initial: "" }),
                    level: new fields.StringField({ initial: "" }),
                    space: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    armor: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    armorCost: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{},{},{},{},{},{}] }),
                movementSystems: new fields.ArrayField(new fields.SchemaField({
                    system: new fields.StringField({ initial: "" }),
                    loc: new fields.StringField({ initial: "" }),
                    spc: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    cp: new fields.NumberField({ initial: 0, min: 0 }),
                    h: new fields.NumberField({ initial: 0, min: 0, integer: true })
                }), { initial: [{},{}] }),
                sensors: new fields.SchemaField({
                    loc: new fields.StringField({ initial: "" }),
                    range: new fields.NumberField({ initial: 0, min: 0 }),
                    comm: new fields.NumberField({ initial: 0, min: 0 }),
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 })
                }),
                subassemblies: new fields.SchemaField({
                    cockpit: new fields.SchemaField({
                        type: new fields.StringField({ initial: "" }),
                        crew: new fields.NumberField({ initial: 1, min: 0, integer: true }),
                        options: new fields.StringField({ initial: "" }),
                        space: new fields.NumberField({ initial: 0, min: 0 }),
                        cp: new fields.NumberField({ initial: 0, min: 0 })
                    }),
                    items: new fields.ArrayField(new fields.SchemaField({
                        name: new fields.StringField({ initial: "" }),
                        loc: new fields.StringField({ initial: "" }),
                        space: new fields.NumberField({ initial: 0, min: 0 }),
                        cp: new fields.NumberField({ initial: 0, min: 0 }),
                        h: new fields.NumberField({ initial: 0, min: 0, integer: true })
                    }), { initial: [{}] })
                }),
                shields: new fields.ArrayField(new fields.SchemaField({
                    name: new fields.StringField({ initial: "" }),
                    da: new fields.NumberField({ initial: 0, integer: true }),
                    sp: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    loc: new fields.StringField({ initial: "" }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    cost: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{}] }),
                weapons: new fields.ArrayField(new fields.SchemaField({
                    name: new fields.StringField({ initial: "" }),
                    wa: new fields.NumberField({ initial: 0, integer: true }),
                    range: new fields.StringField({ initial: "" }),
                    damage: new fields.StringField({ initial: "" }),
                    shots: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    loc: new fields.StringField({ initial: "" }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    notes: new fields.StringField({ initial: "" })
                }), { initial: [{},{},{}] }),
                imageUrl: new fields.StringField({ initial: "" })
            }),
            /* Body model for paperdoll locations */
            body: new fields.SchemaField({
                locations: new fields.SchemaField({
                    head: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Head" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                        hp: new fields.NumberField({ initial: 6, min: 0, integer: true }),
                        hpMax: new fields.NumberField({ initial: 6, min: 0, integer: true }),
                            mektonHp: new fields.NumberField({ initial: 6, min: 0, integer: true }),
                            mektonHpMax: new fields.NumberField({ initial: 6, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    torso: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Torso" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                        hp: new fields.NumberField({ initial: 12, min: 0, integer: true }),
                        hpMax: new fields.NumberField({ initial: 12, min: 0, integer: true }),
                            mektonHp: new fields.NumberField({ initial: 12, min: 0, integer: true }),
                            mektonHpMax: new fields.NumberField({ initial: 12, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    rArm: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Right Arm" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                        hp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        hpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    lArm: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Left Arm" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                        hp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        hpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    rLeg: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Right Leg" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                        hp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        hpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    lLeg: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Left Leg" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                        hp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        hpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHp: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                            mektonHpMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    })
                }),
                notes: new fields.StringField({ initial: "" })
            }),
            equipment: new fields.SchemaField({
                gear: new fields.StringField({ initial: "" }),
                totalWeight: new fields.NumberField({ initial: 0, min: 0 })
            }),
            // Player notes field
            notes: new fields.StringField({ initial: "" })
        };
    }
}