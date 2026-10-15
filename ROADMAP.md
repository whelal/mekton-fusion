# Mekton Fusion — Roadmap

## 1.0 goal

> I can run a full session of my campaign with no paper sheets: characters,
> human-scale combat, and GM-statted NPC mecha in combat.

1.0 is for my table, not public release. Anything that doesn't serve that
sentence goes in the Parking lot.

## Rules policy

- **Table rulings are the default.** RAW toggles come after 1.0.
- **Every ruling lives in `module/rules/table-rulings.js`.** Code never hardcodes
  a ruling inline; it calls the named ruling. That keeps the later move to
  `game.settings` checkboxes a one-file change.
- **Core is Interlock (Mekton Zeta / Zeta Plus).** CP2020-only mechanics (BTM,
  cyberware/Humanity, netrunning, CP2020 roles) are out of scope before 1.0.

### Current table rulings
- No knockback.
- Mecha ammo: a burst spends 1 ammo regardless of BV. Missile salvos spend 1 ammo per missile fired. Spare clips are tracked per weapon, reloading takes an Action, and full rearm happens at a depot. Infinite-shot beams use no ammo.
- Mecha damage: excess damage past a servo's 0 Kills is lost. A hit-location roll of 9 (Other) rerolls if the mecha has no wing or tail. In a missile salvo walk, a 9 with no wing or tail is skipped (the walk moves on to 10), not rerolled.
- Players choose the hit location only on aimed shots. On a Crit, the attacker chooses the chart (RAW). Salvo walks are not chosen.
- Human-scale: no armor bypass for characters. Armor ablation and burst fire play RAW. The GM Difficulty option stays, for sneak attacks with no evade or dodge.

## Versioning

- **Minor** (0.x.0) = a milestone is complete.
- **Patch** (0.x.y) = work toward the next milestone; e.g. 0.3.y patches build toward 0.4.0.
- Only one milestone is open at a time.

## Definition of done (every change)

- [ ] Works on Foundry v13
- [ ] Schema change ⇒ migration included
- [ ] CHANGELOG entry
- [ ] README updated if the change is user-visible

## Milestones

### 0.4 — Mecha sheet usability ◀ CURRENT
**Done when:** I can stat a book NPC mech in under ~10 minutes.
- [~] Create `module/rules/table-rulings.js` and route existing rulings through it — mecha rulings routed; SHIELD_PASS_THROUGH and the human-scale rulings still to classify
- [ ] Redesign the mecha data model: separate inputs from derived values
- [ ] Split the sheet into a Construction view and a Play view
- [ ] Make derived values read-only and remove redundant input fields
- [ ] Use presets as the starting point (create a mech from a preset, then edit)
- [ ] Support non-humanoid servo layouts (generalized kind + side)
- [ ] Migrate existing mech actors

### 0.5 — Mecha combat loop
**Done when:** one full mecha skirmish has been played in Foundry.
- [~] Interlock attack roll (1d10 + MR + skill + WA vs. defense) — rolls exist; defense is still typed in by hand (no opposed-roll handshake)
- [x] Hit location, including the reroll-9 ruling and aimed-shot choice
- [x] Servo damage, with excess lost
- [x] Ammo and clips per ruling; reload as an Action
- [ ] Maneuver Pool use in combat

### 0.6 — Human-scale polish
**Done when:** a human-scale fight runs without paper.
- [x] Armor ablation (staged penetration), RAW
- [x] Burst fire, RAW
- [x] No armor bypass (ruling)
- [x] GM Difficulty option retained

### 0.7 — Hardening
**Done when:** schema changes can't silently break worlds.
- [ ] Real migration script (versioned, not opportunistic)
- [ ] `node:test` coverage of the pure derive modules (`mecha-cost.js`, `mecha-construction.js`, etc.)
- [ ] README matches reality; repo description fixed

### 1.0 — Play a real session
- [ ] Run a session, then fix what broke

## Parking lot (post-1.0 or never)

- RAW toggles in settings for each table ruling
- Player mech creation and modification
- Knockback (under consideration)
- Weapon Linkage enforcement
- Transformation, stealth, and other cost multipliers (manual override exists)
- Verify the Powerplant Source cost against a worked book example
- Advanced psionic powers
- CP2020-only mechanics (BTM, cyberware/Humanity, netrunning)
- Localization
- Public release (manifest, compendium packs, docs)
