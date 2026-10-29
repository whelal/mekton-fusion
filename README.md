# Mekton Fusion FoundryVTT System

A **custom Foundry VTT system** that merges mechanics from **Mekton Zeta** and **Cyberpunk 2020** into a unified ruleset.

> Fusion of Mekton concepts with Cyberpunk 2020 style stats & skills, full derived combat stats, and a Mekton Zeta mecha construction/combat system. Currently **v0.3.16** -- APIs / data schema may still change.

---
## 📖 Overview
Built on inspirations from:
- **Cyberpunk 2020 Foundry system** (stats & skills model)
- **Mekton Zeta** (mecha combat + future planned construction features)

The goal: Provide a **complete character sheet and rules support** for campaigns mixing **mecha and cyberpunk elements**.

Core areas:
- Character stats, derived combat values, and skill checks (CP2020 style)
- Mekton Zeta mecha construction, combat, and movement
- Psionics framework (stat/point tracking; advanced powers still planned)

---
## ✨ Current Feature Set
**Character**
- Uppercase stat block: `INT REF TECH COOL ATTR LUCK MA BODY EMP EDU PSI`
- Cyberpunk-style sidebar header (portrait, vitals grid) & compact stat boxes with inline roll buttons
- Bidirectional exploding d10 rolls (10 chains up, 1 chains down, capped extras, flags include raw dice)
- Initiative: `1d10 + REF + Initiative Mod`
- BOD-derived Stun Save, Lift, Throw, Dmg, EV, and per-location hit points (Head/Torso/Limbs)
- MA-derived movement: Run, Walk, Leap, Running Jump, Anime Leap, Swim, and encumbrance-adjusted MA
- Paperdoll body tab with hit-location rolls and a Creature section (Body Plan + Natural Armor + Natural Weapons) for non-mecha NPCs
- Personal armor covers 8 zones (head, torso, each arm, each thigh, each lower leg). Dropping mesh or plate opens a picker to choose the zones covered (dropping on a paperdoll zone pre-ticks that zone): a garment (Vest, Jacket, Overcoat, Pants, Shorts, Boots, Hat, or Custom); weight and cost scale with the zones covered. Helmets, suits, the Flight Jacket and Powered Armor have fixed coverage. At most two pieces can be worn on any zone. Each zone is protected by one piece at a time, never added together: the piece with the most SP left, which stays in use until it's worn to 0 there, then the next piece takes over. A hit wears only that piece on that zone, by 1 SP and only from a hit of 5+ damage (before armor). The Body tab shows each zone's active piece and its SP; click a location to repair or wear it
- Close combat: a Close Combat button (Combat tab) picks a brawling maneuver and a location it can reach; melee weapons get the same Location choice in their attack dialog. The default location is free; others take a called-shot penalty on top of the maneuver's WA. The chosen location is the hit location (a leg hit lands on the thigh or lower leg at random). Bite asks where the attacker's mouth is: level with the target (reaches like a punch) or on the ground (legs only)
- Quick attacks: the Quarterstaff and Nunchaku/Tonfa (any weapon with Quick ticked on its sheet) and the fist strikes (Punch, Claw, Elbow, Backhand, Chop, Jab) can make two attacks in one Action. Tick "Quick: 2 attacks" in the attack dialog and pick a location for each; each attack rolls, is defended, and does damage on its own, on one chat card
- Defense after a failed Evade: a melee-weapon attack can be parried with a weapon the defender has **in hand** (the hand button on each Combat-tab weapon row draws it for free, or stows it for an Action or drops it). The Parry rolls 1D10 + REF + Blade (a sword uses the better of Blade and Fencing) + the weapon's WA, or -2 for a gun or other improvised item; a tie parries. With nothing in hand, or against an unarmed strike, the defender blocks with an arm instead (1D10 + REF + the better of Hand to Hand and Martial Art): by 5 or more nothing gets through; by less, the hit lands on the blocking arm through its armor. Ranged attacks can't be parried or blocked. The GM can force Parry, Block or None in the attack dialog
- Firearms can be swung as a club (WA -2, Bruise, 1D3+ for a handgun, 1D6+ for a long gun), which counts as a melee attack. Any melee or club strike can be a Knockout (-3): 1 Hit that bypasses armor, plus an automatic Stun/Shock roll
- Bruise damage: unarmed strikes and blunt weapons deal Bruises (melee and thrown weapon attacks can switch Wound/Bruise per roll), which ignore soft armor (hard armor still stops them). Each location has one track holding Wounds and Bruises: a full head or torso knocks you out, but only Wounds kill or break limbs, and a full limb with Bruises is Sprained (-3 on rolls that use it). The Body tab lists each location's Armor, a Hits bar (Wounds red, Bruises amber and hatched) and its status (Sprained, Broken, Unconscious, Dead…); the owner or GM clicks a location to add or heal Wounds and Bruises, repair or wear its armor, or remove a piece
- Attack cards name the attacker and the target, and the damage line names whose location was hit. Attacking a token on your own side (both Friendly or both Hostile), or targeting yourself, asks for confirmation first; area blasts don't ask, but list any same-side tokens caught
- Skill seeding (auto on new actor + manual Add Skills button + world seeding macro), categorized display with favorites filter & sorting
- Hard skill markers `(H)`, i18n keys under `MF.*`
- Personal & mecha weapon tables on the Combat tab with roll buttons
- Fencing (H) as an alternative skill for bladed weapons, and Martial Art (H) for close-combat maneuvers (it's unarmed-only, not a weapon skill), each adding half its rank (rounded down) to damage

**Mecha**
- Per-location servo construction (Torso/Arm/Leg/Head/Wing/Tail/Pod), each with its own class/extremity/armor pickers deriving Kills/Space/Cost/Weight
- Armament: two-level Category -> Weapon picker (Beam/Projectile/Missile/Melee/Energy Melee) deriving WA/Range/Damage/Shots/BV/Cost/Space/Weight, with a roll button (`1d10 + MR + Mecha skill + WA`)
- Shields, two independent Sensor slots (Main + Backup), Cockpit, and 10 optional Subassemblies (Damage Control, Ejection Seat, Storage Module, Weapon Linkage, etc.), all deriving Cost/Space from picks
- Movement Systems (Thruster/GES) deriving Spaces/CP from target MA; Powerplant (Charge + Source) deriving Explosion Save and a cost multiplier
- Unified cost engine: Cost = Base (sum of every additive system) x (1 + sum of multiplier values)
- Derived MEKTON PROFILE Weight (Final Weight = total Kills / 2, +10% with the Fuel toggle) and MEKTON STATS (MV/MR mass-derived; Land MA/Flight MA manual per config, pre-filled from tonnage/thruster hints)
- Maneuver Pool derived from the Mecha Piloting (H) skill
- NPC/mook presets (Vesper-class Skirmisher, Bulwark-class Assault, Dire Wolf) loadable via a picker, stamping selection keys into a mech's arrays for the derive pipeline to fill in
- Servos are an identified list, not a fixed 6-slot array: add/remove a servo (arm/leg/head/wing/tail/pod, any side) beyond the default humanoid torso, with labels derived automatically ("R Arm 2") and every Loc picker (weapons/shields/sensors/movement/subassemblies) picking it up immediately
- Mecha hit location and damage: every damaging Armament roll gets an "Apply hit" button -- the GM sets hit count, the margin (5+ = Critical with the attacker's choice of Normal/Special/Cinematic chart, 10+ = Mega-Crit with no armor), and aimed/random location, and the system rolls the Hit Location Chart (1d10, resolved against the mech's actual servo list), applies staged penetration (armor ablates 1 SP per hit, Kills carry through) per hit, and posts one chat card with every roll and outcome
- Pods: a pod has no Kills of its own; its armor holds it together. Damage past its armor goes to a weapon mounted in it. The pod is destroyed when its armor is gone (its weapons drop: offline, not damaged) or when every weapon in it is destroyed
- Mecha burst crits: Mega-Crits and Crits are counted from the margin and land on the first hits, each hit rolling its own location; the attacker picks the chart for Critical hits once per burst
- Missile salvos: a missile rack fires any number of missiles at one target in one Action (1 ammo per missile). Hits = margin x ceil(missiles / 10); the hit location is rolled once and walks down the chart one row per missile, and crits counted from the margin land on the first missiles
- Play/Build toggle: a compact Play view tracks per-servo armor SP/Kills (staged penetration), weapon ammo with spare clips and reloading, burst fire (hits per the servo-aware Hit Location Chart), and a Parry Roll (1D10 + MR + Mecha Melee + DA vs the attack total; shields ablate 1 SP per parried hit and pass damage over their SP on to the hit's location, melee weapons spend Kills, EMWs check their Damage rating) during a session, without exposing the full construction worksheet; Depot Maintenance is the only full reset of damage, ammo, clips, and parry wear

**Engine**
- DataModel-backed schema (Foundry VTT v13+) with `prepareDerivedData()` recomputing all of the above on every render
- Migration logic for legacy `system.abilities` (WILL→COOL, MOVE→MA)
- Centralized stat defaults (`module/data/defaults.js`)

---
## 🗺️ Roadmap
Version-by-version detail lives in [CHANGELOG.md](CHANGELOG.md) -- development hasn't moved in the straight-line phase order this table used to imply, so it now only tracks what's still ahead.

| Area | Goal | Status |
|------|------|--------|
| Mecha | Transformation-form / stealth / other multiplier data for the cost engine | Planned (a manual "Other Mult." override covers it for now) |
| Mecha | Weapon Linkage enforcement (same type/servo/target, one roll, per-shot hit locations) | Deferred (CP-only for now) |
| Psionics | Advanced powers beyond point tracking | Planned |
| Localization | Additional languages beyond English | Planned |
| Testing | Automated test harness | Planned |

Already shipped: BOD/MA-derived combat stats, full Mekton Zeta mecha construction (servos/armor/extremities per location, weapons, shields, sensors, cockpit, subassemblies, movement systems, powerplant), a unified cost engine, and NPC/mook presets.

---
## 📦 Installation (Development)
1. Place (clone or copy) this folder into your Foundry `Data/systems` directory.
2. Restart Foundry.
3. Create / load a world and select "Mekton Fusion" as the system.
4. Use the provided macro `macros/seed-core-data.macro.js` or Add Skills button if skills are empty.

Optional (git):
```bash
cd /path/to/FoundryVTT/Data/systems
git clone https://github.com/whelal/mekton-fusion.git
```

---
## 🧬 Actor Data Schema (Simplified)
The schema has grown well past a simple stat block -- `module/data/actor-data-model.js` is the authoritative source; this is just a shape overview:
```js
system: {
  meta: { role, age, points },
  stats: { INT, REF, TECH, COOL, ATTR, LUCK, MA, BODY, EMP, EDU, PSI },
  substats: { /* derived: stun, lift, run, leap, swim, hp, initiative, ... */ },
  body: { locations: { head, torso, rArm, lArm, rLeg, lLeg }, notes },
  creature: { bodyPlan, armorSP, naturalWeapons },   // non-mecha NPCs
  mecha: { /* full construction: servos, weapons, shields, sensors,
             cockpit, subassemblies, movementSystems, powerplant, config */ },
  psi: { points, maxPoints },
  equipment: { gear, totalWeight }
}
```
Values with no dedicated field (Throw, Dmg, EV, Walk, Running Jump, Anime Leap, skill point multiplier, per-mech cost/weight/space breakdowns) are recomputed each render under `system.derived`.

Legacy `system.abilities` (lowercase) auto-migrates when opening actor sheets; WILL → COOL, MOVE → MA.

---
## 🔄 Migration & Seeding
- Opening actors triggers stat shape normalization `{ value }`.
- World seeding macro populates global Items (skills) & updates actors.
- New actors auto-seed default skills (character & npc types).
- Manual per-actor Add Skills button appears when no skills are present.

### Re-run seeding world-wide (console)
```js
(async ()=>{ const { seedWorldData } = await import(game.modules.get('mekton-fusion') ? '' : 'systems/mekton-fusion/module/seed.js'); await seedWorldData(); })();
```

---
## 🎲 Rolling System
- Base stat roll: 1d10 (exploding 10 up / 1 down) + STAT (+ Rank for skills)
- Chains capped (config constant) to avoid runaway explosion
- Roll flags: `roll.flags['mekton-fusion'] = { plusDice, minusDice, capped }`
- Chat flavor shows breakdown & explosion tags

---
## 🛠️ Development Layout
```
module/
  data/
    defaults.js, skills.js, stats.js, item-data-model.js
    actor-data-model.js (schema + prepareDerivedData)
    body-values.js (BOD/MA tables, non-mecha enemy/creature helper)
    mecha-construction.js, mecha-weapons.js, mecha-movement.js
    mecha-options.js, mecha-powerplant.js, mecha-cost.js
    mecha-presets.js (NPC/mook presets)
  seed.js (world + actor core item seeding)
  settings.js
  sheets/item-sheet.js
scripts/sheets/
  actor-sheet.js (sheet logic, rolls, preset loaders, UI state)
  mekton-fusion.js (init hooks, Handlebars picker helpers, sheet registration)
styles/ (CSS: mekton-fusion.css)
templates/actor/
  actor-sheet.hbs (main sheet)
  tabs/ (stats, combat, skills, body, mecha, psi, equipment, notes)
lang/en.json
system.json
```

---
## 🌐 Internationalization
Add another language by copying `lang/en.json` to e.g. `lang/fr.json` and adding the language entry in `system.json` (planned). Most UI keys already namespaced under `MF.*`.

---
## 🚧 Known Gaps
- Transformation-form and stealth/other multiplier systems aren't modeled yet (a manual "Other Mult." override covers them for now)
- Weapon Linkage is charged (CP) but not enforced -- no linked-fire roll resolution yet
- Limited validation on skill rank editing
- No automated full migration script (opportunistic only)
- Minimal test harness

---
## 🤝 Contributing
Issues & PRs welcome (once repository stabilizes). Priority contributions:
- Derived stat formula proposals
- Mecha/vehicle schema design
- Localization packs
- Additional item / power categories

---
## 📜 License & Disclaimer
MIT License (see `LICENSE` / `NOTICE`). Mekton and Cyberpunk trademarks belong to their respective owners. This is a **non-commercial fan project** for tabletop use only.

---
_Enjoy rolling & blasting mecha!_  
Report issues: https://github.com/whelal/mekton-fusion/issues

---
## Homebrew / Third-Party Content Notice
This project may reference or summarize rules and numeric values from third-party
published games. Where applicable this module follows the homebrew policies of
the original publishers (for example R. Talsorian Games). The project is free
to use and distribute and does not include copyrighted descriptive text from
published works. For full rules and descriptive text, please consult the
original books.

Required disclaimer from R. Talsorian Games (when referencing their material):
"[This module] is unofficial content provided under the Homebrew Content
Policy of R. Talsorian Games and is not approved or endorsed by RTG. This
content references materials that are the property of R. Talsorian Games and
its licensees."

See `HOMEBREW_NOTICE.md` for full details.
