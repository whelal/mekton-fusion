import { getBodyValues, getMovementAllowance, getStandardMovement, getSkillPointMultiplier, encumberedMA } from "./body-values.js";
import { deriveServo, deriveArmor, SENSORS, COCKPIT, SERVO_ROW_LOCATIONS } from "./mecha-construction.js";
import { getWeapon, SHIELDS } from "./mecha-weapons.js";
import { OPTIONS, optionCost } from "./mecha-options.js";
import { finalWeight, propulsionLiftPoints, groundMA, maneuverValue, mechaReflex, maneuverPool } from "./mecha-movement.js";
import { getPowerplant, powerplantMultipliers } from "./mecha-powerplant.js";
import { finalCost, collectMultipliers } from "./mecha-cost.js";

// Body-location keys mapped onto the BOD hit-value groups body-values.js provides
// (head/torso get their own column; all limbs share the "limbs" column).
const BODY_LOCATION_GROUPS = { head: "head", torso: "torso", rArm: "limbs", lArm: "limbs", rLeg: "limbs", lLeg: "limbs" };

// mecha-weapons.js uses the string "inf" for unlimited shots/burst value; render as ∞.
function formatInfinite(v) {
    return v === "inf" ? "∞" : String(v);
}

export class ActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
    return {
            // Reserved for the future scale-conversion system (human / roadstriker /
            // mekton / corvette / starship). Costs nothing now -- just avoids a live
            // migration once scales are built.
            scale: new fields.StringField({ initial: "human" }),
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
                    other: new fields.NumberField({ initial: 0 }) // manual multiplier value (e.g. 0.2) for unmodeled multiplier systems (transformation forms, stealth, etc.); feeds the cost engine directly
                }),
                powerplant: new fields.SchemaField({
                    charge: new fields.StringField({ initial: "" }), // CHARGE_LEVELS key
                    source: new fields.StringField({ initial: "" }), // POWER_SOURCES key
                    hot: new fields.BooleanField({ initial: false }), // "if Hot" charge variant
                    explosionSave: new fields.NumberField({ initial: 0, min: 0, integer: true }), // derived: D10 roll-or-under to explode when hit
                    chargeCostMod: new fields.NumberField({ initial: 0 }), // derived: Charge's own cost modifier
                    sourceFactor: new fields.NumberField({ initial: 1 }), // derived: Source's cost factor (multiplies chargeCostMod)
                    costMult: new fields.NumberField({ initial: 0 }), // derived: chargeCostMod x sourceFactor; feeds the cost engine's multiplier sum
                    mpMod: new fields.NumberField({ initial: 0 }) // derived combat modifier (Maneuver Pool); reference only, not yet applied
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
                }), { initial: [{},{},{}] }),
                // Two independent sensor slots -- Main and Backup are separate purchases,
                // not mutually exclusive picks, so both rows use the same Type picker.
                sensors: new fields.ArrayField(new fields.SchemaField({
                    type: new fields.StringField({ initial: "" }), // SENSORS key ("main"/"backup"); derives cost/space/hits/weight
                    loc: new fields.StringField({ initial: "" }),
                    range: new fields.NumberField({ initial: 0, min: 0 }),
                    comm: new fields.NumberField({ initial: 0, min: 0 }),
                    hits: new fields.NumberField({ initial: 0, min: 0, integer: true }),
                    cost: new fields.NumberField({ initial: 0, min: 0 }),
                    space: new fields.NumberField({ initial: 0, min: 0 }),
                    weightTons: new fields.NumberField({ initial: 0, min: 0 })
                }), { initial: [{},{}] }),
                subassemblies: new fields.SchemaField({
                    cockpit: new fields.SchemaField({
                        type: new fields.StringField({ initial: "" }), // COCKPIT key ("main"/"passenger"); derives cost/space/crew
                        crew: new fields.NumberField({ initial: 1, min: 0, integer: true }),
                        options: new fields.StringField({ initial: "" }),
                        space: new fields.NumberField({ initial: 0, min: 0 }),
                        cp: new fields.NumberField({ initial: 0, min: 0 })
                    }),
                    items: new fields.ArrayField(new fields.SchemaField({
                        key: new fields.StringField({ initial: "" }), // OPTIONS picker key; derives name/cost/space
                        name: new fields.StringField({ initial: "" }),
                        variant: new fields.BooleanField({ required: false, initial: false }), // Anti-theft Code Lock's alarm variant (costMax vs costMin); unused by flat-cost options. required:false so the ArrayField's bare {} placeholder default (ArrayField#initial doesn't recursively clean nested schema defaults) doesn't fail validation with "may not be undefined"
                        loc: new fields.StringField({ initial: "" }),
                        space: new fields.NumberField({ initial: 0, min: 0 }),
                        cp: new fields.NumberField({ initial: 0, min: 0 }),
                        h: new fields.NumberField({ initial: 0, min: 0, integer: true })
                    }), { initial: [{},{},{},{}] })
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
                }), { initial: [{},{}] }),
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
                }), { initial: [{},{},{},{}] }),
                imageUrl: new fields.StringField({ initial: "" })
            }),
            /* Body model for paperdoll locations */
            body: new fields.SchemaField({
                locations: new fields.SchemaField({
                    head: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Head" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            hits: new fields.NumberField({ initial: 6, integer: true }), // current wounds; no min so it can go negative (BOD table's negative Hits tiers)
                            hitsMax: new fields.NumberField({ initial: 6, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    torso: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Torso" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            hits: new fields.NumberField({ initial: 12, integer: true }), // current wounds; no min so it can go negative (BOD table's negative Hits tiers)
                            hitsMax: new fields.NumberField({ initial: 12, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    rArm: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Right Arm" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            hits: new fields.NumberField({ initial: 9, integer: true }), // current wounds; no min so it can go negative (BOD table's negative Hits tiers)
                            hitsMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    lArm: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Left Arm" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            hits: new fields.NumberField({ initial: 9, integer: true }), // current wounds; no min so it can go negative (BOD table's negative Hits tiers)
                            hitsMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    rLeg: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Right Leg" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            hits: new fields.NumberField({ initial: 9, integer: true }), // current wounds; no min so it can go negative (BOD table's negative Hits tiers)
                            hitsMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    }),
                    lLeg: new fields.SchemaField({
                        label: new fields.StringField({ initial: "Left Leg" }),
                            sp: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            spMax: new fields.NumberField({ initial: 10, min: 0, integer: true }),
                            hits: new fields.NumberField({ initial: 9, integer: true }), // current wounds; no min so it can go negative (BOD table's negative Hits tiers)
                            hitsMax: new fields.NumberField({ initial: 9, min: 0, integer: true }),
                        ablates: new fields.BooleanField({ initial: true }),
                        itemId: new fields.StringField({ initial: "" })
                    })
                }),
                notes: new fields.StringField({ initial: "" })
            }),
            // Non-mecha enemy/creature stat block (character body-plan/enemy model,
            // not mecha construction). BOD stat drives hit points as usual; bodyPlan
            // is flavor/reference only (Mekton Z defines no non-humanoid hit tables).
            creature: new fields.SchemaField({
                bodyPlan: new fields.StringField({ initial: "" }), // BODY_PLANS key
                armorSP: new fields.NumberField({ initial: 0, min: 0, integer: true }), // natural armor; stamped onto body.locations.*.sp on preset load
                naturalWeapons: new fields.ArrayField(new fields.SchemaField({
                    name: new fields.StringField({ initial: "" }),
                    damage: new fields.StringField({ initial: "" }),
                    type: new fields.StringField({ initial: "" })
                }), { initial: [{},{},{},{}] })
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
        // Only the max is derived here -- this runs every render, so writing current
        // hits would erase damage the player has already tracked.
        for (const [loc, group] of Object.entries(BODY_LOCATION_GROUPS)) {
            const locData = this.body?.locations?.[loc];
            if (locData) locData.hitsMax = body.hits[group].hits;
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
            mecha: this._deriveMecha(this.mecha)
        };
    }

    /**
     * Derive servo/weapon/shield stat-block rows for the mech
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

        // Sensors: two independent slots, each with its own SENSORS key ("main"/"backup").
        // Main and Backup are separate purchases -- both rows can hold the same pick.
        for (const sensorRow of mechaData.sensors ?? []) {
            if (!sensorRow) continue;
            const s = sensorRow.type ? SENSORS[sensorRow.type] : null;
            sensorRow.cost = s?.cost ?? 0;
            sensorRow.hits = s?.kills ?? 0;
            sensorRow.space = s?.space ?? 0;
            sensorRow.weightTons = s?.weightTons ?? 0;
            totalCost += sensorRow.cost;
            structuralKills += Number(sensorRow.hits) || 0;
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

        // Optional subassembly picks (OPTIONS table: CP + Space). Anti-theft Code
        // Lock has a cost range -- the row's "variant" checkbox (alarm) selects
        // costMax over costMin. Kills (h) has no OPTIONS equivalent, so it stays a
        // manual override, same as before.
        for (const item of mechaData.subassemblies?.items ?? []) {
            if (!item) continue;
            const opt = item.key ? OPTIONS[item.key] : null;
            if (opt) {
                item.name = opt.label;
                item.cp = optionCost(item.key, !!item.variant) ?? 0;
                item.space = opt.space ?? 0;
            } else {
                item.cp = item.cp || 0;
                item.space = item.space || 0;
            }
            totalCost += Number(item.cp) || 0;
            if (spaceByLocation[item.loc]) spaceByLocation[item.loc].space += Number(item.space) || 0;
            structuralKills += Number(item.h) || 0;
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
        // Thrusters are the only propulsion type that grants true flight (GES rides
        // just above the surface, priced lower per MA in mecha-movement.js), so their
        // targetMA values sum into a Flight MA hint below.
        let flightMaHint = 0;
        for (const ms of mechaData.movementSystems ?? []) {
            if (!ms) continue;
            if (ms.type) {
                const lift = propulsionLiftPoints(adjustedWeight, Number(ms.targetMA) || 0, ms.type);
                ms.spc = lift;
                ms.cp = lift;
                if (ms.type === "thruster") flightMaHint += Number(ms.targetMA) || 0;
            }
            totalCost += Number(ms.cp) || 0;
            if (spaceByLocation[ms.loc]) spaceByLocation[ms.loc].space += Number(ms.spc) || 0;
        }

        // MEKTON STATS config rows: MV/MR are mech-wide and derived for all three.
        // Configuration name, Land MA, and Flight MA stay manual per config (a
        // transforming mecha can walk in one mode and fly in another). Both are
        // filled from a hint whenever at their unset default (0) -- a starting
        // suggestion the pilot can type over with any nonzero value, which then
        // sticks (0 always re-suggests the hint). Land MA uses the tonnage-only
        // Ground MA band; Flight MA uses the summed thruster targetMA above.
        const cfg = mechaData.config;
        if (cfg) {
            cfg.mv = mv ?? 0;
            cfg.mr = mr;
            cfg.mv2 = mv ?? 0;
            cfg.mr2 = mr;
            cfg.mv3 = mv ?? 0;
            cfg.mr3 = mr;
            if (!cfg.landMA) cfg.landMA = groundMaHexes ?? 0;
            if (!cfg.landMA2) cfg.landMA2 = groundMaHexes ?? 0;
            if (!cfg.landMA3) cfg.landMA3 = groundMaHexes ?? 0;
            if (!cfg.flightMA) cfg.flightMA = flightMaHint;
            if (!cfg.flightMA2) cfg.flightMA2 = flightMaHint;
            if (!cfg.flightMA3) cfg.flightMA3 = flightMaHint;
        }

        // Maneuver Pool keys off the Mecha Piloting (H) skill's total (stat + rank) --
        // same skill item the Combat Skills section already looks up by name.
        const pilotingItem = this.parent?.items?.find(i => i.type === "skill" && i.name === "Mecha Piloting (H)");
        const pilotingTotal = pilotingItem
            ? (Number(this.stats?.[pilotingItem.system?.stat]?.value) || 0) + (Number(pilotingItem.system?.rank) || 0)
            : 0;
        mechaData.maneuverPool = maneuverPool(pilotingTotal);

        // Powerplant (Charge x Source): both are now verified (ATM p.68) to combine
        // into ONE cost-multiplier contribution -- Charge cost modifier x Source
        // factor -- rather than two separate terms in the sum.
        const ppData = mechaData.powerplant;
        const pp = (ppData?.charge && ppData?.source) ? getPowerplant(ppData.charge, ppData.source, !!ppData.hot) : null;
        const ppMults = powerplantMultipliers(pp);
        if (ppData) {
            ppData.explosionSave = pp?.explosionSave ?? 0;
            ppData.chargeCostMod = ppMults.chargeMod;
            ppData.mpMod = pp?.combat?.mpMod ?? 0;
            ppData.costMult = ppMults.costMult;
            ppData.sourceFactor = ppMults.sourceFactor;
        }

        // Unified cost engine (mecha-cost.js): totalCost above is the Base Cost
        // (sum of every additive system -- servos/armor, weapons, shields, sensors,
        // cockpit, subassembly options, movement systems). Multiplier systems add
        // NO cost of their own; their values sum, then apply once: Base x (1 + sum).
        // Modeled multipliers so far: the combined powerplant Charge x Source term,
        // plus a manual "Other" override for systems not yet modeled (transformation
        // forms, stealth, etc.).
        const multipliers = collectMultipliers({
            powerplantMult: ppMults.costMult,
            otherMults: [Number(mechaData.costMultiplier?.other) || 0]
        });
        mechaData.cost = finalCost(totalCost, multipliers);
        mechaData.weight = Math.round(adjustedWeight * 100) / 100;

        return {
            baseCost: Math.round(totalCost * 100) / 100,
            totalCost: mechaData.cost,
            weight: mechaData.weight,
            spaceByLocation,
            structuralKills,
            finalWeight: finalWt,
            adjustedWeight,
            groundMA: groundMaHexes,
            flightMAHint: flightMaHint,
            maneuverValue: mv,
            mechaReflex: mr,
            powerplantCostMult: ppMults.costMult
        };
    }
}