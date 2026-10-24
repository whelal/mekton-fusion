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
- Human-scale: no armor bypass for characters. Burst fire plays RAW. Armor ablation uses the 5-Hit threshold (see Interpretations). The GM Difficulty option stays, for sneak attacks with no evade or dodge.
- Hard armor: helmets, plate, Military Suit, Powered Armor. Everything else is soft.
- Close combat: default location (torso, or legs for sweeps) is free; other locations cost head -4, arm/leg -2 on top of maneuver WA; single-location maneuvers take no extra penalty. Playtest values. Bite included (overrides core's no-penalty Bite).

### Interpretations
Where the book is silent or ambiguous and the table decided. These are not settings toggles.
- Parried through-damage goes to the originally rolled location.
- Salvo crit chart (Random/Special/Cinematic) is chosen once per salvo. Random must remain an option.
- Ties go to the defender in all combat, including vs GM Difficulty.
- Pod destroyed at 0 armor or when all its weapons are destroyed; contents are dropped (offline), not destroyed. No-armor pod: destroyed by its first hit.
- Several weapons in a pod: a random weapon takes the hit; damage past its Kills is lost.
- Non-weapon pod contents (sensors, subassemblies): the GM adjudicates. Not codified.
- Mesh/plate weight and cost are per Single location; a thigh or lower leg is half a location (Jacket = 3, Overcoat = 4, Pants = 2, Shorts = 1, Boots = 1).
- Chop and Crescent have no free location (they can't reach the torso).
- Melee leg hits split thigh / lower leg 50/50, on the side the attacker chose.
- Eyes/sensors (Jab) damage the head.
- Personal armor ablates 1 SP only on hits of 5+ Hits (MZ ATM human-scale ablation rate, applied to the Personal Armor Table). Mecha unchanged.

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

### 0.4 — Human-scale polish ◀ CURRENT
**Done when:** a human-scale fight runs without paper.
- [x] Armor ablation (staged penetration); 5-Hit threshold at human scale (0.3.26)
- [x] Burst fire, RAW
- [x] No armor bypass (ruling)
- [x] GM Difficulty option retained
- [x] Human-scale armor coverage: 8 zones, garment presets, drop-on-zone, per-zone weight/cost (0.3.24)
- [x] Human-scale close combat: called locations, maneuver picker, maneuver damage (0.3.25)
- [x] Bite maneuver with mouth position (0.3.26)
- [x] Human-scale armor ablation threshold: 1 SP only on hits of 5+ (0.3.26)
- [ ] Human-scale armor protection: best single piece per zone, sticky ablation (0.3.27)
  - The active piece loses 1 SP on that zone only, and only for a hit of >= `personalArmorAblationThreshold` (before armor); never more than 1 per hit. Use `ablatePersonalArmor()`.
  - Check: Heavy Mesh (15) + Light Mesh (10) on the torso, hits of 6 damage. After 6 hits the torso is at 9 (still Heavy Mesh); after 15 hits Light Mesh's 10 takes over.
- [ ] Bruise damage, Fists From Hell core rule (0.3.28)
  - Soft pieces are ignored by Bruise attacks (no protection, no ablation).
  - Hard pieces protect normally and ablate only at >= `personalArmorAblationThreshold`.
  - A bruise hit uses the highest-currentSP hard piece covering the zone and doesn't change the wound `activeArmorId`.

### 0.5 — Mecha sheet usability
**Done when:** I can stat a book NPC mech in under ~10 minutes.
- [x] Create `module/rules/table-rulings.js` and route existing rulings through it
- [ ] Redesign the mecha data model: separate inputs from derived values
- [ ] Split the sheet into a Construction view and a Play view
- [ ] Make derived values read-only and remove redundant input fields
- [ ] Use presets as the starting point (create a mech from a preset, then edit)
- [ ] Support non-humanoid servo layouts (generalized kind + side)
- [ ] Migrate existing mech actors

### 0.6 — Mecha combat loop
**Done when:** one full mecha skirmish has been played in Foundry.
- [~] Interlock attack roll (1d10 + MR + skill + WA vs. defense) — rolls exist; defense is still typed in by hand (no opposed-roll handshake)
- [x] Hit location, including the reroll-9 ruling and aimed-shot choice
- [x] Servo damage, with excess lost
- [x] Ammo and clips per ruling; reload as an Action
- [ ] Maneuver Pool use in combat
- [ ] Damage Coefficient (Alpha/Beta/Gamma): armor and shields ablate only on hits >= DC
- [ ] Beam and Reactive shields (no staged penetration; overload/reset)
- [ ] Streamline the shield parry flow (table finds it clunky)
- [ ] Non-weapon systems (sensors, subassemblies, movement) go out of action with a destroyed servo, except flight systems and maneuver verniers (RAW)

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
- Shields at human scale
- Force screens (3D6 SP, 10 attacks/round)
- Powered Armor extras (+4 BODY, +4H damage, -3 non-ablative)
- Custom hard Flight Jacket (built as plate)
- Remaining Hand-to-Hand Attack Table maneuvers in the Close Combat dialog: Slam, Throw, Trip/Sweep, Grab, Pin, Bearhug, Dismember; and Chop's Stun effect
- Mecha-scale brawling (the table's Mecha column, + by servo size)
- (0.6 Mecha combat loop) Head-mounted melee weapons for humanoid mecha, WA +0 (MZ core errata p.99; also simulates jaws).
