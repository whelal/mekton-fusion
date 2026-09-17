import { getBodyValues, getMovementAllowance, getStandardMovement, getSkillPointMultiplier, encumberedMA } from "./body-values.js";
import { deriveServo, deriveArmor, SENSORS, COCKPIT } from "./mecha-construction.js";
import { getWeapon, SHIELDS } from "./mecha-weapons.js";
import { finalWeight, propulsionLiftPoints, groundMA, maneuverValue, mechaReflex, maneuverPool } from "./mecha-movement.js";

// Body-location keys mapped onto the BOD hit-value groups body-values.js provides
// (head/torso get their own column; all limbs share the "limbs" column).
const BODY_LOCATION_GROUPS = { head: "head", torso: "torso", rArm: "limbs", lArm: "limbs", rLeg: "limbs", lLeg: "limbs" };

// Mecha servo rows are a fixed 6-slot array (see the ArrayField's `initial` below);
// this is the location each slot represents and the deriveServo() "location" kind it maps to.
// Each location now has its own construction table (Torso/Arm/Leg/Head all differ),
// so this mapping matters -- it used to be masked by a shared table.
const SERVO_ROW_LOCATIONS = [
    { key: "head", label: "Head", kind: "head" },
    { key: "torso", label: "Torso", kind: "torso" },
    { key: "rArm", label: "R Arm", kind: "arm" },
    { key: "lArm", label: "L Arm", kind: "arm" },
    { key: "rLeg", label: "R Leg", kind: "leg" },
    { key: "lLeg", label: "L Leg", kind: "leg" }
];

// mecha-weapons.js uses the string "inf" for unlimited shots/burst value; render as ∞.
function formatInfinite(v) {
    return v === "inf" ? "∞" : String(v);
}

export class ActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
    return {
            meta: new fields.SchemaField({
                role: new fields.StringField({initial: ""}),
                age: new fields.NumberField({initial: 25, min: 0, integer: true}),
                points: new fields.NumberField({initial: 0, min: 0, integer: true})
            }),
            // Player profile / appearance & personal hooks
            profile: new fields.SchemaField({
                hairColor: new fields.StringField({ initial: "" }),
                hairStyle: new fields.StringField({ initial: "" }),
                eyeColor: new fields.StringField({ initial: "" }),
                height: new fields.StringField({ initial: "" }),
                weight: new fields.StringField({ initial: "" }),
                sex: new fields.StringField({ initial: "" }),
                personalityTraits: new fields.StringField({ initial: "" }),
                valueMost: new fields.StringField({ initial: "" }),
                valuedPossession: new fields.StringField({ initial: "" }),
                personValueMost: new fields.StringField({ initial: "" })
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
                bodyTypeMod: new fields.NumberField({initial: 0, integer: true}),
                lift: new fields.NumberField({initial: 0, min: 0, integer: true}),
                carry: new fields.NumberField({initial: 0, min: 0, integer: true}),
                run: new fields.NumberField({initial: 0, min: 0, integer: false}),
                leap: new fields.NumberField({initial: 0, min: 0, integer: false}),
                swim: new fields.NumberField({initial: 0, min: 0, integer: false}),
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
                weight: new fields.NumberField({ initial: 0, min: 0 }), // derived: finalWeight (x1.1 if fuel)
                fuel: new fields.BooleanField({ initial: false }), // book's 10% fuel rule; applied before MA/flight calc
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
                    sp: new fields.NumberField({ initial: 0, min: 0, integer: true }), // derived from armor (ARMOR table)
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    servo: new fields.StringField({ initial: "" }),
                    level: new fields.StringField({ initial: "" }), // servo class key (e.g. "striker"); derives hits/space/cost/weight
                    extremityKey: new fields.StringField({ initial: "" }), // arm/leg rows only
                    extremitySpace: new fields.NumberField({ initial: 0, min: 0 }), // tracked separately from servo space per the book
                    space: new fields.StringField({ initial: "" }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 }),
                    armor: new fields.StringField({ initial: "" }), // ARMOR class key (reused field); derives sp/armorCost/armorWeightTons
                    armorCost: new fields.NumberField({ initial: 0, min: 0 }),
                    armorWeightTons: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{},{},{},{},{},{}] }),
                movementSystems: new fields.ArrayField(new fields.SchemaField({
                    system: new fields.StringField({ initial: "" }), // free-text label (e.g. "Left Leg Thruster"), stays manual
                    type: new fields.StringField({ initial: "" }), // "thruster"/"ges"; with targetMA, derives spc/cp (equal)
                    targetMA: new fields.NumberField({ initial: 0, min: 0 }), // desired MA this propulsion system delivers; manual
                    loc: new fields.StringField({ initial: "" }),
                    spc: new fields.NumberField({ initial: 0, min: 0 }),
                    cp: new fields.NumberField({ initial: 0, min: 0 }),
                    h: new fields.NumberField({ initial: 0, min: 0, integer: true })
                }), { initial: [{},{}] }),
                sensors: new fields.SchemaField({
                    type: new fields.StringField({ initial: "" }), // SENSORS key ("main"/"backup"); derives cost/space/hits/weight
                    loc: new fields.StringField({ initial: "" }),
                    range: new fields.NumberField({ initial: 0, min: 0 }),
                    comm: new fields.NumberField({ initial: 0, min: 0 }),
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 })
                }),
                subassemblies: new fields.SchemaField({
                    cockpit: new fields.SchemaField({
                        type: new fields.StringField({ initial: "" }), // COCKPIT key ("main"/"passenger"); derives cost/space/crew
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
                    key: new fields.StringField({ initial: "" }), // SHIELDS picker key; derives name/da/sp/cost/weight
                    name: new fields.StringField({ initial: "" }),
                    da: new fields.NumberField({ initial: 0, integer: true }),
                    sp: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    loc: new fields.StringField({ initial: "" }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{}] }),
                weapons: new fields.ArrayField(new fields.SchemaField({
                    category: new fields.StringField({ initial: "" }), // WEAPON_CATEGORIES key (beam/projectile/missile/melee/energyMelee)
                    weaponKey: new fields.StringField({ initial: "" }), // key within that category; category+weaponKey derive everything but loc/notes
                    name: new fields.StringField({ initial: "" }),
                    wa: new fields.NumberField({ initial: 0, integer: true }),
                    range: new fields.StringField({ initial: "" }),
                    damage: new fields.StringField({ initial: "" }), // damageK, plain number as text (0 is valid, e.g. Epoxy Gun)
                    damageNote: new fields.StringField({ initial: "" }), // special-rule marker (AP, grapples, etc.) -- read-only, separate from notes
                    shots: new fields.StringField({ initial: "" }), // number, "10 bursts", or "∞"
                    bv: new fields.StringField({ initial: "" }), // burst value; blank when the weapon has none
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    loc: new fields.StringField({ initial: "" }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 }),
                    notes: new fields.StringField({ initial: "" })
                }), { initial: [{},{},{}] }),
                imageUrl: new fields.StringField({ initial: "" })
            }),
            // Snaggletooth - separate duplicate of mecha data
            snaggletooth: new fields.SchemaField({
                name: new fields.StringField({ initial: "" }),
                weight: new fields.NumberField({ initial: 0, min: 0 }), // derived: finalWeight (x1.1 if fuel)
                fuel: new fields.BooleanField({ initial: false }), // book's 10% fuel rule; applied before MA/flight calc
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
                    sp: new fields.NumberField({ initial: 0, min: 0, integer: true }), // derived from armor (ARMOR table)
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    servo: new fields.StringField({ initial: "" }),
                    level: new fields.StringField({ initial: "" }), // servo class key (e.g. "striker"); derives hits/space/cost/weight
                    extremityKey: new fields.StringField({ initial: "" }), // arm/leg rows only
                    extremitySpace: new fields.NumberField({ initial: 0, min: 0 }), // tracked separately from servo space per the book
                    space: new fields.StringField({ initial: "" }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 }),
                    armor: new fields.StringField({ initial: "" }), // ARMOR class key (reused field); derives sp/armorCost/armorWeightTons
                    armorCost: new fields.NumberField({ initial: 0, min: 0 }),
                    armorWeightTons: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{},{},{},{},{},{}] }),
                movementSystems: new fields.ArrayField(new fields.SchemaField({
                    system: new fields.StringField({ initial: "" }), // free-text label (e.g. "Left Leg Thruster"), stays manual
                    type: new fields.StringField({ initial: "" }), // "thruster"/"ges"; with targetMA, derives spc/cp (equal)
                    targetMA: new fields.NumberField({ initial: 0, min: 0 }), // desired MA this propulsion system delivers; manual
                    loc: new fields.StringField({ initial: "" }),
                    spc: new fields.NumberField({ initial: 0, min: 0 }),
                    cp: new fields.NumberField({ initial: 0, min: 0 }),
                    h: new fields.NumberField({ initial: 0, min: 0, integer: true })
                }), { initial: [{},{}] }),
                sensors: new fields.SchemaField({
                    type: new fields.StringField({ initial: "" }), // SENSORS key ("main"/"backup"); derives cost/space/hits/weight
                    loc: new fields.StringField({ initial: "" }),
                    range: new fields.NumberField({ initial: 0, min: 0 }),
                    comm: new fields.NumberField({ initial: 0, min: 0 }),
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 })
                }),
                subassemblies: new fields.SchemaField({
                    cockpit: new fields.SchemaField({
                        type: new fields.StringField({ initial: "" }), // COCKPIT key ("main"/"passenger"); derives cost/space/crew
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
                    key: new fields.StringField({ initial: "" }), // SHIELDS picker key; derives name/da/sp/cost/weight
                    name: new fields.StringField({ initial: "" }),
                    da: new fields.NumberField({ initial: 0, integer: true }),
                    sp: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    loc: new fields.StringField({ initial: "" }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{}] }),
                weapons: new fields.ArrayField(new fields.SchemaField({
                    category: new fields.StringField({ initial: "" }), // WEAPON_CATEGORIES key (beam/projectile/missile/melee/energyMelee)
                    weaponKey: new fields.StringField({ initial: "" }), // key within that category; category+weaponKey derive everything but loc/notes
                    name: new fields.StringField({ initial: "" }),
                    wa: new fields.NumberField({ initial: 0, integer: true }),
                    range: new fields.StringField({ initial: "" }),
                    damage: new fields.StringField({ initial: "" }), // damageK, plain number as text (0 is valid, e.g. Epoxy Gun)
                    damageNote: new fields.StringField({ initial: "" }), // special-rule marker (AP, grapples, etc.) -- read-only, separate from notes
                    shots: new fields.StringField({ initial: "" }), // number, "10 bursts", or "∞"
                    bv: new fields.StringField({ initial: "" }), // burst value; blank when the weapon has none
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    loc: new fields.StringField({ initial: "" }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 }),
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

    /**
     * BOD/INT/EDU-derived read-only stats (Mekton Z body-type tables).
     * Overwrites the substats/body fields the table governs so they can never
     * drift from BODY; everything else the table provides lives under
     * `system.derived` since it has no dedicated schema field.
     */
    prepareDerivedData() {
        const bod = this.stats?.BODY?.value ?? 5;
        const ma = this.stats?.MA?.value ?? 5;
        const intVal = this.stats?.INT?.value ?? 5;
        const edu = this.stats?.EDU?.value ?? 5;

        const body = getBodyValues(bod);
        // MA is keyed entirely off the MA stat -- BOD has no effect on movement.
        // Above MA 10, the fixed ">10" table applies (Run/Jump/Anime Leap). At or
        // below MA 10, it's the standard formula: Run = MA x3, Jump = MA/4
        // (Mekton Zeta core movement rules).
        const highMaMovement = getMovementAllowance(ma);
        const standardMovement = getStandardMovement(ma);
        const run = highMaMovement?.run ?? standardMovement.run;
        const jump = highMaMovement?.jump ?? standardMovement.jump;

        // Stun Save and Lift are plain NumberFields on substats -> overwrite directly.
        this.substats.stun = body.stun;
        this.substats.lift = body.lift;
        this.substats.run = run;
        this.substats.leap = jump;
        this.substats.swim = Math.round((ma / 3) * 100) / 100;

        // Per-location hit points (labeled SDP on the Body tab) follow the same BOD table.
        for (const [loc, group] of Object.entries(BODY_LOCATION_GROUPS)) {
            const locData = this.body?.locations?.[loc];
            if (locData) locData.mektonHpMax = body.hits[group].hits;
        }

        // Values with no dedicated schema field (Throw, Dmg, EV, Walk, Running Jump,
        // Anime Leap, skill points, encumbrance-adjusted MA) are exposed read-only via
        // `system.derived`.
        this.derived = {
            throwM: body.throwM,
            dmg: body.dmg,
            ev: body.ev,
            hits: body.hits,
            movementAllowance: {
                run,
                jump,
                walk: run / 3,
                runningJump: run / 4,
                animeLeap: highMaMovement?.animeLeap ?? standardMovement.animeLeap,
                source: highMaMovement ? "ma-table" : "ma-formula"
            },
            skillPointMultiplier: getSkillPointMultiplier(intVal, edu),
            encumberedMA: encumberedMA(this.equipment?.totalWeight ?? 0, bod, run),
            mecha: this._deriveMecha(this.mecha),
            snaggletooth: this._deriveMecha(this.snaggletooth)
        };
    }

    /**
     * Derive servo/weapon/shield stat-block rows for one mech (mecha or snaggletooth)
     * from their picker fields, overwrite the mech's own Weight/Cost totals, and
     * return a per-location Space-used breakdown (no dedicated schema field for that).
     * Mutates `mechaData` in place (same pattern as the BODY/MA overwrites above).
     */
    _deriveMecha(mechaData) {
        const spaceByLocation = {};
        for (const loc of SERVO_ROW_LOCATIONS) spaceByLocation[loc.key] = { label: loc.label, space: 0 };
        if (!mechaData) return { totalCost: 0, weight: 0, spaceByLocation };

        let totalCost = 0;
        // Final Weight = total Kills across the whole mecha / 2 -- every component with a
        // Kills stat counts (servos, weapons, sensors, subassembly items, movement systems).
        // Shields have no Kills stat in this data, so they never contribute.
        let structuralKills = 0;

        // Servos: 6 fixed rows, mapped onto SERVO_ROW_LOCATIONS by index. Each location
        // (torso/arm/leg/head) has its own construction table -- deriveServo needs the
        // row's real location, not a shared one, or the numbers are wrong.
        const servos = mechaData.servos ?? [];
        servos.forEach((row, i) => {
            const locDef = SERVO_ROW_LOCATIONS[i];
            if (!row || !locDef) return;
            const classKey = row.level; // reused field: stores the servo class key, not free text
            const derived = classKey ? deriveServo(classKey, locDef.kind, row.extremityKey) : null;
            row.servo = locDef.label;
            row.hits = derived?.kills ?? 0;
            row.space = derived?.space ?? 0;
            row.cost = derived?.cost ?? 0;
            row.weightTons = derived?.weightTons ?? 0;
            // Extremity space is tracked separately from the servo's own space (per the
            // book) -- it counts toward the location's space total but never folds into
            // the servo row's own Space cell.
            row.extremitySpace = derived?.extremitySpace ?? 0;

            // Armor is bought per servo, separately from the servo class itself.
            const armor = row.armor ? deriveArmor(row.armor) : null; // reused field: ARMOR class key
            row.sp = armor?.sp ?? 0;
            row.armorCost = armor?.cost ?? 0;
            row.armorWeightTons = armor?.weightTons ?? 0;

            totalCost += row.cost + row.armorCost;
            spaceByLocation[locDef.key].space += (Number(row.space) || 0) + (Number(row.extremitySpace) || 0);
            structuralKills += Number(row.hits) || 0;
        });

        // Weapons: two-level pick (category, then weapon within it) into getWeapon().
        const weapons = mechaData.weapons ?? [];
        weapons.forEach(row => {
            if (!row) return;
            const w = (row.category && row.weaponKey) ? getWeapon(row.category, row.weaponKey) : null;
            if (w) {
                row.name = w.label;
                row.wa = w.wa;
                row.range = String(w.range);
                row.damage = String(w.damageK); // plain number; 0 is valid (e.g. Epoxy Gun)
                row.damageNote = w.damageNote ?? "";
                row.shots = formatInfinite(w.shots);
                row.bv = (w.bv === null || w.bv === undefined) ? "" : formatInfinite(w.bv); // missiles have no bv -> blank
                row.hits = w.kills;
                row.cost = w.cost;
                row.space = w.spaces;
                row.weightTons = w.weightTons;
            } else {
                row.weightTons = row.weightTons || 0;
            }
            totalCost += Number(row.cost) || 0;
            if (spaceByLocation[row.loc]) spaceByLocation[row.loc].space += Number(row.space) || 0;
            structuralKills += Number(row.hits) || 0;
        });

        // Shields: flat SHIELDS lookup by key.
        const shields = mechaData.shields ?? [];
        shields.forEach(row => {
            if (!row) return;
            const s = row.key ? SHIELDS[row.key] : null;
            if (s) {
                row.name = s.label;
                row.da = s.da;
                row.sp = s.sp;
                row.cost = s.cost;
                row.weightTons = s.weightTons;
            } else {
                row.weightTons = row.weightTons || 0;
            }
            totalCost += Number(row.cost) || 0;
            if (spaceByLocation[row.loc]) spaceByLocation[row.loc].space += Number(row.space) || 0;
        });

        // Sensors: SENSORS key ("main"/"backup") derives cost/space/hits/weight.
        const sensors = mechaData.sensors;
        if (sensors) {
            const s = sensors.type ? SENSORS[sensors.type] : null;
            sensors.cost = s?.cost ?? 0;
            sensors.hits = s?.kills ?? 0;
            sensors.space = s?.space ?? 0;
            sensors.weightTons = s?.weightTons ?? 0;
            totalCost += sensors.cost;
            structuralKills += Number(sensors.hits) || 0;
        }

        // Cockpit: COCKPIT key ("main"/"passenger") derives cost/space/crew. Only one
        // cockpit row exists, so this is a single pick, not a stacking list.
        const cockpit = mechaData.subassemblies?.cockpit;
        if (cockpit) {
            const c = cockpit.type ? COCKPIT[cockpit.type] : null;
            cockpit.cp = c?.cost ?? 0;
            cockpit.space = c?.space ?? 0;
            cockpit.crew = c ? (c.crew ?? c.crewMod ?? 0) : cockpit.crew;
            totalCost += cockpit.cp;
        }

        // Subassembly items aren't derived yet (formula-based, out of scope for now), but
        // their manually-entered Cost and Kills still count toward the mech's totals.
        for (const item of mechaData.subassemblies?.items ?? []) {
            totalCost += Number(item?.cp) || 0;
            structuralKills += Number(item?.h) || 0;
        }
        // Movement systems' own Kills (h) is likewise manual; sum it before deriving
        // Spaces/CP below, since that derivation needs finalWeight, which needs this sum.
        for (const ms of mechaData.movementSystems ?? []) structuralKills += Number(ms?.h) || 0;

        // Final Weight = total Kills / 2 -- this IS the mech's Weight (MEKTON PROFILE),
        // not a separate figure summed from parts; keeping those in sync was the point.
        // Fuel (+10%) applies before MA/flight/propulsion, per the book.
        const finalWt = finalWeight(structuralKills);
        const adjustedWeight = mechaData.fuel ? finalWt * 1.1 : finalWt;

        // Maneuver Value and Mecha Reflex are mech-wide (mass-derived), so all three
        // config rows share them. Ground MA is only computed here as a tonnage-only
        // reference hint -- Land MA/Flight MA are manual per config (a transforming
        // mecha can walk in one mode and fly in another; full per-config movement-system
        // loadouts are a later scope).
        const groundMaHexes = groundMA(adjustedWeight);
        const mv = maneuverValue(adjustedWeight);
        const pilotRef = this.stats?.REF?.value ?? 0;
        const mr = mechaReflex(pilotRef, mv ?? 0);

        // Movement systems: thruster/GES rows derive Spaces/CP (equal) from the
        // fuel-adjusted weight + targetMA. Loc stays manual, same as weapons.
        for (const ms of mechaData.movementSystems ?? []) {
            if (!ms) continue;
            if (ms.type) {
                const lift = propulsionLiftPoints(adjustedWeight, Number(ms.targetMA) || 0, ms.type);
                ms.spc = lift;
                ms.cp = lift;
            }
            totalCost += Number(ms.cp) || 0;
            if (spaceByLocation[ms.loc]) spaceByLocation[ms.loc].space += Number(ms.spc) || 0;
        }

        // MEKTON STATS config rows: MV/MR are mech-wide and derived for all three.
        // Configuration name, Land MA, and Flight MA stay manual per config.
        const cfg = mechaData.config;
        if (cfg) {
            cfg.mv = mv ?? 0;
            cfg.mr = mr;
            cfg.mv2 = mv ?? 0;
            cfg.mr2 = mr;
            cfg.mv3 = mv ?? 0;
            cfg.mr3 = mr;
        }

        // Maneuver Pool keys off the Mecha Piloting (H) skill's total (stat + rank) --
        // same skill item the Combat Skills section already looks up by name.
        const pilotingItem = this.parent?.items?.find(i => i.type === "skill" && i.name === "Mecha Piloting (H)");
        const pilotingTotal = pilotingItem
            ? (Number(this.stats?.[pilotingItem.system?.stat]?.value) || 0) + (Number(pilotingItem.system?.rank) || 0)
            : 0;
        mechaData.maneuverPool = maneuverPool(pilotingTotal);

        mechaData.cost = Math.round(totalCost * 100) / 100;
        mechaData.weight = Math.round(adjustedWeight * 100) / 100;

        return {
            totalCost: mechaData.cost,
            weight: mechaData.weight,
            spaceByLocation,
            structuralKills,
            finalWeight: finalWt,
            adjustedWeight,
            groundMA: groundMaHexes,
            maneuverValue: mv,
            mechaReflex: mr
        };
    }
}