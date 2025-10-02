# Changelog
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
