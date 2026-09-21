# Mekton Fusion FoundryVTT System

A **custom Foundry VTT system** that merges mechanics from **Mekton Zeta** and **Cyberpunk 2020** into a unified ruleset.

> Fusion of Mekton concepts with Cyberpunk 2020 style stats & skills, full derived combat stats, and a two-mech Mekton Zeta construction/combat system. Currently **v0.2.1** -- APIs / data schema may still change.

---
## 📖 Overview
Built on inspirations from:
- **Cyberpunk 2020 Foundry system** (stats & skills model)
- **Mekton Zeta** (mecha combat + future planned construction features)

The goal: Provide a **complete character sheet and rules support** for campaigns mixing **mecha and cyberpunk elements**.

Core areas:
- Character stats, derived combat values, and skill checks (CP2020 style)
- Mekton Zeta mecha construction, combat, and movement -- two independent mechs per actor
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
- Skill seeding (auto on new actor + manual Add Skills button + world seeding macro), categorized display with favorites filter & sorting
- Hard skill markers `(H)`, i18n keys under `MF.*`
- Personal & mecha weapon tables on the Combat tab with roll buttons

**Mecha** (two independent mechs per actor: Mecha + Snaggletooth)
- Per-location servo construction (Torso/Arm/Leg/Head/Wing/Tail/Pod), each with its own class/extremity/armor pickers deriving Kills/Space/Cost/Weight
- Armament: two-level Category -> Weapon picker (Beam/Projectile/Missile/Melee/Energy Melee) deriving WA/Range/Damage/Shots/BV/Cost/Space/Weight, with a roll button (`1d10 + MR + Mecha skill + WA`)
- Shields, two independent Sensor slots (Main + Backup), Cockpit, and 10 optional Subassemblies (Damage Control, Ejection Seat, Storage Module, Weapon Linkage, etc.), all deriving Cost/Space from picks
- Movement Systems (Thruster/GES) deriving Spaces/CP from target MA; Powerplant (Charge + Source) deriving Explosion Save and a cost multiplier
- Unified cost engine: Cost = Base (sum of every additive system) x (1 + sum of multiplier values)
- Derived MEKTON PROFILE Weight (Final Weight = total Kills / 2, +10% with the Fuel toggle) and MEKTON STATS (MV/MR mass-derived; Land MA/Flight MA manual per config, pre-filled from tonnage/thruster hints)
- Maneuver Pool derived from the Mecha Piloting (H) skill
- NPC/mook presets (Vesper-class Skirmisher, Bulwark-class Assault, Dire Wolf) loadable via a picker, stamping selection keys into a mech's arrays for the derive pipeline to fill in

**Engine**
- DataModel-backed schema (Foundry VTT v13+) with `prepareDerivedData()` recomputing all of the above on every render
- Migration logic for legacy `system.abilities` (WILL→COOL, MOVE→MA)
- Centralized stat defaults (`module/data/defaults.js`)

---
## 🗺️ Roadmap
Version-by-version detail lives in [CHANGELOG.md](CHANGELOG.md) -- development hasn't moved in the straight-line phase order this table used to imply, so it now only tracks what's still ahead.

| Area | Goal | Status |
|------|------|--------|
| Mecha | Verify Powerplant Source cost contribution against a worked book example, then fold it into the cost engine | Open (currently computed but excluded from total Cost) |
| Mecha | Transformation-form / stealth / other multiplier data for the cost engine | Planned (a manual "Other Mult." override covers it for now) |
| Mecha | Weapon Linkage enforcement (same type/servo/target, one roll, per-shot hit locations) | Deferred (CP-only for now) |
| Psionics | Advanced powers beyond point tracking | Planned |
| Localization | Additional languages beyond English | Planned |
| Testing | Automated test harness | Planned |

Already shipped: BOD/MA-derived combat stats, full Mekton Zeta mecha construction (servos/armor/extremities per location, weapons, shields, sensors, cockpit, subassemblies, movement systems, powerplant), a unified cost engine, NPC/mook presets, and a two-mech (Mecha + Snaggletooth) actor layout.

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
  snaggletooth: { /* identical shape -- a second, independent mech */ },
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
  tabs/ (stats, combat, skills, body, mecha, snaggletooth, psi, equipment, notes)
lang/en.json
system.json
```

---
## 🌐 Internationalization
Add another language by copying `lang/en.json` to e.g. `lang/fr.json` and adding the language entry in `system.json` (planned). Most UI keys already namespaced under `MF.*`.

---
## 🚧 Known Gaps
- Powerplant Source cost contribution is unverified against a worked book example; computed but held out of total Cost until confirmed
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
