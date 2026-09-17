## [0.1.14] - 2026-09-17
### Added
- New mecha construction/weapons/movement data modules (`mecha-construction.js`, `mecha-weapons.js`, `mecha-movement.js`), ported with export style matched to the rest of the codebase; values unchanged from source.
- Mecha tab SERVOS & ARMOR table is now derived: per-location (Torso/Arm/Leg/Head) servo class + extremity pickers compute Kills/Space/Cost/Weight, and a separate Armor class picker computes SP/Armor Cost/Weight, instead of manual entry.
- ARMAMENT table is now a two-level Category → Weapon picker deriving WA/Range/Damage/Shots/Kills/BV/Cost/Space/Weight from `mecha-weapons.js`; Loc and Notes stay manual. Added a per-row roll button: 1d10 + Mecha Reflex (MR) + the matching Mecha skill (Gunnery/Missiles/Melee, by weapon category) + WA.
- SHIELDS table similarly derives DA/SP/Cost/Weight from a shield picker.
- SENSORS and COCKPIT sections get Type pickers deriving Cost/Space/Kills/Crew from their tables.
- MEKTON PROFILE Weight is now derived from Final Weight (total Kills / 2 across servos, weapons, sensors, subassemblies, and movement systems), not summed from parts, so it can't disagree with the value MA/flight are computed from. Added a Fuel toggle (+10% weight, applied before MA/flight/propulsion).
- MEKTON STATS config rows: MV and MR are now derived (mass-based, shared across all three configs); Land MA and Flight MA stay manual per config so transforming mechs can hold different movement profiles per mode.
- Movement Systems rows get a Type (thruster/GES) + Target MA picker deriving Spaces/CP (equal); Loc stays manual, same as weapons.
- Maneuver Pool is now derived from the Mecha Piloting (H) skill total instead of manual entry.
- Space Used by Location and Servos & Armor sections moved to full-width at the bottom of the tab (were cramped in the two-column layout).
### Fixed
- Mecha Combat Skills' "+ MR=" term and the actual skill roll were reading a stale, mech-agnostic REF+Initiative-Mod calculation instead of the real derived Mecha Reflex; both (and the Combat tab's mecha skills panel) now read the correct per-mech MR.

## [0.1.13] - 2026-09-16
### Added
- New `module/data/body-values.js`: Mekton Z BOD body-type table (Stun, Lift, Throw, Dmg, EV, per-location hit points) and MA movement tables/formulas, ported from a standalone reference file with export style matched to the rest of the codebase.
- Actor system data model now computes derived stats each render via `prepareDerivedData()` (`ActorDataModel` now extends `TypeDataModel` so the hook actually fires): Stun Save, Lift, Throw, Dmg, EV, and per-location Max SDP from BODY; Run, Walk, Leap, Running Jump, Anime Leap, and Swim from MA; a skill-point multiplier from INT+EDU; and an equipment-weight-adjusted MA.
- Stats tab surfaces the new derived values (Throw, Dmg, EV, Walk, Running Jump, Anime Leap, Encumbered MA, Skill Point Multiplier) as read-only fields; Stun Save, Lift, Run, Leap, Swim, and the Body tab's Max SDP column are now read-only/computed instead of manual entry.
### Fixed
- MA (Run/Jump/Anime Leap above MA 10) was incorrectly keyed off the BODY stat instead of MA, so raising BODY silently changed movement. Now keyed correctly off MA.
- Anime Leap at MA 10 and below now follows the correct errata value (1x MA, not 2x).
- Swim (MA / 3) is now rounded to 2 decimal places instead of showing repeating decimals.

## [0.1.12] - 2026-09-16
### Changed
- Actor sheet header reworked into a left sidebar with portrait, name/role card, and a Hit Points/Humanity vitals grid.
- Sheet width increased from 740 to 940 to accommodate the new sidebar layout.
- Humanity moved out of the Stats tab EMP panel and into the sidebar vitals grid.
- Removed the JS header-height-lock workaround, no longer needed with the new stable layout.

## [0.1.11] - 2026-09-16
### Removed
- Witcher tab (Signs/spellcasting) removed entirely from the actor sheet.
- `spell` Item type, data model, and item sheet fields removed.
- Spell seeding (`WITCHER_SIGNS`), world-seed spell folder, and `purge-spell-rank` macro removed.
- HP/Stamina/Vigor resource bars removed (they only existed on the Witcher tab).
- Associated CSS, localization strings, and dead legacy sheet templates removed.

## [0.1.8] - 2026-02-22
### Changed
- Combat tab: Range column widened to 10% to accommodate values like `300-1800`.
- Combat tab: Damage column widened to 16% to accommodate formulas like `2d6+1d10+5`.

## [0.1.7] - 2026-02-22
### Added
- Combat tab: Mecha combat section now has a MECHA WEAPONS table matching the human combat weapons layout.
- Weapons separated by `isMecha` flag — human and mecha weapons are fully independent.
- Note field added after Skill column in both human and mecha weapons tables.

## [0.1.0] - 2025-11-19
## [0.1.4] - 2026-01-05
### Fixed
- Initiative (MV) now persists: duplicate MV inputs across tabs stay in sync and submit the edited value instead of reverting.

## [0.1.3] - 2025-11-30
### Fixed
- Header height anchored to initial Stats render to prevent layout jumps across tabs.

### Changed
- Profile header layout: grouped Hair Color, Hair Style, Eye Color into a single row; constrained profile box width for cleaner header.

### Added
- Actor `system.profile` fields exposed in header (hair color/style, eye color, personality traits, valued most, valued possession, person valued most).

### Added
- Decimal support for movement substats (`run`, `leap`, `swim`) allowing fractional values.

### Changed
- Skill renames: `Military Intelligence` -> `Expert: Military Intelligence`; `Spellcasting` -> `Spellcasting (2)`; `Resist Magic` -> `Resist Magic (2)`.
- Expanded input width for large numeric substats (`--mf-input-w-lg` 56px→70px).

### Removed
- Duplicate non-PSI `Stat Boost` skill (legacy item purged).

### Migration
- Automatic rename of legacy skill items to new names during seed/migration pass.
- Purge of deprecated skill items at load (non-PSI Stat Boost).

### Fixed
- Movement decimal values now persist (previously coerced to integers by schema).
- Initiative remains integer-only (schema confirms enforcement).

### Internal
- DataModel schema updated: `run`, `leap`, `swim` now `integer:false`.
- Version bumped to `0.1.0` marking minor feature milestone.

## 0.0.8 - 2025-10-20
### Fixed
- Tab bar height causing large blank space above Equipment/Notes; force compact single-line tabs and horizontal overflow.

### Changed
- Consolidated tab CSS rules in styles/partials/_tabs.css and styles/mekton-fusion.css to avoid theme interference.

## 0.0.5 - 2025-10-15
### Changed
- Body tab: grouped SP/SDP input-button pairs on a single row for faster use.
- Allow SDP to exceed MaxSDP (no clamping) to support over-repair/buffer scenarios.
- Default SP and MaxSP set to 10 across all body locations.
- Compact CSS tweaks for inline actions and spacing.
- Horizontal layout refinements for paperdoll + table.

## 0.0.4 - 2025-10-10
### Added
- Formal DataModel schema for `system.substats` (stun, death, lift, carry, run, leap, swim, hp, hp_current, sta, sta_current, rec, rec_current, psi, psi_current, psihybrid, psihybrid_current, initiative, dodge, enc, punch, kick, humanity).
- Removed runtime seeding logic from actor sheet; defaults now handled by schema.
- Atomic seeding flag update replaced by schema approach (legacy actors without `system.substats` get an empty object created once).

## Changelog
All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and uses Semantic Versioning while still in 0.0.x (breaking changes may still occur).

## [0.0.3] - 2025-10-01
### Added
- README with overview, schema, seeding, roadmap, and development notes.
- CHANGELOG file and manifest links (`readme`, `changelog`).
- Centralized stat defaults module (`module/data/defaults.js`).
- DataModel registration for Actor types.
- Localization keys for Role, Level, Roll tooltip, Edit.

### Changed
- Bumped version to 0.0.3.
- Actor sheet template now fully uses localization tokens.
- Initiative and all references moved to uppercase `system.stats.*` structure.
- Skill rank fallback set to 0 instead of 5.
- Seeding wrapped with error handling.

### Removed
- Deprecated `character-sheet.hbs` (legacy template).
- Legacy lowercase `system.abilities` usage (now auto-migrated on sheet load only).

### Migration
- Opening an Actor with old `system.abilities` automatically migrates to `system.stats`; WILL -> COOL and MOVE -> MA.

## [0.0.2] - 2025-09-30
### Added
- Initial public prototype (stats, seeding, basic actor sheet, lowercase abilities schema).

## [0.0.1] - 2025-09-29
### Added
- Internal scaffolding commit (unreleased) with initial manifest and placeholder data.

---
Future: 0.0.4 planned for derived stat calculations & mecha groundwork.
