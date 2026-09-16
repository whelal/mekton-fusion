# Mekton Fusion FoundryVTT System

A **custom Foundry VTT system** that merges mechanics from **Mekton Zeta** and **Cyberpunk 2020** into a unified ruleset.

> Fusion of Mekton concepts with Cyberpunk 2020 style stats & skills plus a Psionics scaffold. This system is **early stage (v0.0.x)** and APIs / data schema may still change.

---
## 📖 Overview
Built on inspirations from:
- **Cyberpunk 2020 Foundry system** (stats & skills model)
- **Mekton Zeta** (mecha combat + future planned construction features)

The goal: Provide a **complete character sheet and rules support** for campaigns mixing **mecha and cyberpunk elements**.

Core areas:
- Character stats & skill checks (CP2020 style)
- Psionics framework
- Planned: Mecha design, vehicle frames, loadouts

---
## ✨ Current Feature Set
- Uppercase stat block: `INT REF TECH COOL ATTR LUCK MA BODY EMP EDU`
- Cyberpunk-style header & compact stat boxes with inline roll buttons
- Bidirectional exploding d10 rolls (10 chains up, 1 chains down, capped extras, flags include raw dice)
- Initiative: `1d10 + REF`
- Skill seeding (auto on new actor + manual Add Skills button + world seeding macro)
- Categorized skill display with favorites filter & sorting (name/stat/rank/total)
- Hard skill markers `(H)` with localization support
- DataModel-backed stats schema (Foundry VTT v13+)
- Migration logic for legacy `system.abilities` (WILL→COOL, MOVE→MA)
- Centralized stat defaults (`module/data/defaults.js`)
- Basic i18n keys (`lang/en.json`)
- Manual & auto skill seeding; canonicalization of Mecha Gunnery variants
- Actor meta fields: Role, Age, Points (header inputs)

---
## 🗺️ Roadmap
| Phase | Goal | Status |
|-------|------|--------|
| 0.0.x | Core stats + skills seeding | In progress |
| 0.1.0 | Derived values (HP calc, encumbrance stub) | Planned |
| 0.2.0 | Vehicle & Mecha item types / sheets | Planned |
| 0.3.0 | Psionics / advanced powers | Planned |
| 0.4.0 | Expanded localization / community translation | Planned |

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
```js
system: {
  meta: { role: string, age: number, points: number },
  stats: {
    INT:{value}, REF:{value}, TECH:{value}, COOL:{value}, ATTR:{value},
    LUCK:{value}, MA:{value}, BODY:{value}, EMP:{value}, EDU:{value}
  },
  skills: { /* legacy inline map (deprecated) */ },
  // Skills preferred as embedded Item documents
}
```
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
  data/ (defaults, skills, actor-data-model)
  seed.js (world + actor core item seeding)
  settings.js (future system settings)
  sheets/item-sheet.js
scripts/sheets/
  actor-sheet.js (sheet logic, rolls, UI state)
  mekton-fusion.js (init hooks, sheet registration, initiative, auto-seed)
styles/ (CSS: mekton-fusion.css)
templates/actor/
  actor-sheet.hbs (main sheet)
lang/en.json
system.json
```

---
## 🌐 Internationalization
Add another language by copying `lang/en.json` to e.g. `lang/fr.json` and adding the language entry in `system.json` (planned). Most UI keys already namespaced under `MF.*`.

---
## 🚧 Known Gaps
- No derived HP / encumbrance formulas yet
- No mecha sheet implementation (planned)
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
