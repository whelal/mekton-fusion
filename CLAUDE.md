# CLAUDE.md — mekton-fusion

Guidance for Claude Code (VS Code) working in this repo. Planning, rules
interpretation, and design discussion also happen in the linked claude.ai
project; the actual editing/committing/pushing happens here.

## Scope discipline
- Read ROADMAP.md before starting any task.
- Work only on the milestone marked CURRENT. If a request falls outside it,
  add it to the Parking lot in ROADMAP.md and say so, rather than implementing it.
- Never hardcode a table ruling inline; add or use a named entry in
  module/rules/table-rulings.js.
- Every change meets the Definition of done in ROADMAP.md.
- Never add rulebook PDFs, scans, or verbatim rule text to the repo, including in code
  comments. Cite book + section/page only.

## What this is

A custom **Foundry VTT system** (not a module — `system.json` at root) implementing
**Mekton Zeta**, ~9.4k lines (JS ~4.9k, HBS ~1.8k, CSS ~2.6k). Repo:
github.com/whelal/mekton-fusion.

A full mecha construction section exists. Its original pain point was data entry —
too many manual fields. The ongoing direction (0.1.13 → 0.2.x) is converting manual
fields into **derived pickers**: you choose a servo/weapon/shield/powerplant and the
derive pipeline computes Kills/Space/Cost/Weight/SP. **Improving the mecha data model
and sheet UX is the top priority.**

## Priorities & rules

- Implement **Mekton Zeta / Mekton Zeta Plus** faithfully — Interlock resolution and
  the mecha construction system. The rulebooks (Core Book + ATM) live in the claude.ai
  project, not in the repo; cite them when a value's provenance matters.
- If a book value can't be verified against a worked example, compute it but mark it
  clearly and keep it out of totals until confirmed (see the powerplant
  "Source (unverified)" cost multiplier — computed, shown read-only, excluded from Cost).

## Conventions

- Match existing code style. Prefer **small, reviewable diffs over rewrites.**
- **Flag security implications of any network calls** — there's a pending audit of these.
- When behavior depends on the **Foundry core version, ask which version** is targeted
  before assuming. Say "I don't know" for API/version specifics rather than guessing.
- Every user-facing change: bump `version` in **both `system.json` and `release.json`**
  (keep them in sync) and add a **CHANGELOG.md** entry (Added/Changed/Fixed/Removed).
- Removing a feature: drop its template, its `system.<key>` DataModel schema block, its
  derive call, tab nav entry + body slot, and any `data-*` branch points — then grep for
  the name to confirm it's gone. No migration script; stale actor data is dropped by the
  DataModel on next save. Precedent: the Witcher tab removal in CHANGELOG 0.1.11.

## Architecture

- `system.json` / `release.json` — manifests (version lives in both).
- `template.json` — actor/item type skeleton.
- `module/data/actor-data-model.js` — `ActorDataModel extends TypeDataModel`;
  `prepareDerivedData()` computes character stats and calls `_deriveMecha()` (one shared
  function for the mech). Mecha construction tables are the `module/data/mecha-*.js`
  files (construction, weapons, movement, options, powerplant, presets, cost).
- `scripts/sheets/actor-sheet.js` — sheet logic, rolls, preset loading, UI state.
- `scripts/sheets/mekton-fusion.js` — init hooks, sheet registration, initiative,
  auto-seed, change-listener wiring for pickers.
- `templates/actor/tabs/*.hbs` — one file per tab, pre-rendered in `getData()`
  (`scripts/sheets/actor-sheet.js:258`) and injected into `actor-sheet.hbs` via
  `_tab<Name>Html`. The sheet is **ApplicationV1** (`class MektonActorSheet extends
  foundry.appv1.sheets.ActorSheet`), so it uses `getData()` / `activateListeners()` —
  there is no `_prepareContext`/`_onRender` (those are ApplicationV2).
- `styles/` — `mekton-fusion.css` plus `partials/_*.css`.
- `lang/en.json` — i18n under `MF.*`.

## Checks before committing

- `node` (v24) is on PATH. Before every commit:
  - `node --check <file>` on each edited `.js`/`.mjs` file.
  - `npm test` (runs `node --test tests/*.test.mjs`) must pass. Add or update a test in
    `tests/` when changing pure rules logic in `module/`.
  - Still review import/export symmetry by hand — `--check` is syntax only.
- `.hbs`: eyeball `{{#...}}`/`{{/...}}` block balance. A real Handlebars parse needs the
  Foundry helpers (`localize`, etc.), so a full render isn't the bar — structural balance is.
- Grep for a removed identifier to confirm no orphaned references remain.

## Rolling / mechanics notes

- Base roll: 1d10, bidirectional exploding (10 chains up, 1 chains down, capped),
  + STAT (+ Rank for skills). Flags under `roll.flags['mekton-fusion']`.
- Mecha skill rolls use derived **Mecha Reflex (MR)** (`system.mecha.config.mr`), not raw REF.
- Armament rows roll 1d10 + MR + Mecha skill (by weapon category) + WA.
