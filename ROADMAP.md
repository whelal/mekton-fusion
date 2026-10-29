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
- Personal armor: at most 2 pieces per zone (`maxArmorLayers`). Layers never add; one active piece protects a zone.
- Close combat: default location (torso, or legs for sweeps) is free; other locations cost head -4, arm/leg -2 on top of maneuver WA; single-location maneuvers take no extra penalty. Playtest values. Bite included (overrides core's no-penalty Bite).
- Quick applies to characters: fist strikes (Punch, Claw, Elbow, Backhand, Chop, Jab), Quarterstaff, Nunchaku/Tonfa.
- Parry skill: Blade; swords use the higher of Blade and Fencing (`fencingWeapons`: Broadsword, Sword, Rapier, Monosword, Energy Sword, or any weapon on the Fencing skill).
- Improvised parry DA -2; a weapon's shooting WA never applies to parrying.
- Improvised clubbing with firearms: WA -2, Bruise, 1D3+ handgun / 1D6+ long gun (playtest), Blade skill. Auto Weapons club as handguns at Pocket/Jacket concealability, else as long guns.
- No parry wear on personal weapons.
- Martial Art is unarmed-only (not a weapon attack skill).
- Arm Block (house, adapted from Interlock Unlimited): vs melee and unarmed attacks; uses the higher of HtH and Martial Art; margin 0-4 = damage to the blocking arm, 5+ = no damage (playtest).

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
- Sprained ("Fists From Hell" Bruise Damage addendum): a limb whose track is full and holds at least one Bruise; -3 per sprained limb on rolls that use it (`sprainedLimbPenalty`). Roll dialogs list sprained limbs and the player ticks the ones the roll uses.
- Weapon parries only work against melee-weapon/EMW attacks (RAW); the Arm Block covers unarmed attacks.
- One defense after a failed Evade: a weapon Parry or an Arm Block, not both. A GM Difficulty attack (unaware target) gets neither.
- In hand: draw only on your own turn (honor system).
- Blocking arm: the arm with the most Hits left, then the best armor; a broken arm can't block.
- Knockout strike (MZ core, Knockout Damage): its 1 Hit is a Bruise that bypasses armor; the Stun/Shock roll always happens.
- Personal armor ablates 1 SP only on hits of 5+ Hits (MZ ATM human-scale ablation rate, applied to the Personal Armor Table). Mecha unchanged.

## Versioning

- **Minor** (0.x.0) = a milestone is complete.
- **Patch** (0.x.y) = work toward the next milestone; e.g. 0.3.y patches build toward 0.4.0.
- Only one milestone is open at a time.
- Patch numbers are assigned when a patch ships, never in advance. Unbuilt items are an ordered checklist under their milestone; when one ships, tick it and add its version, e.g. "[x] Quick melee attacks (0.3.31)".

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
- [x] Attack card clarity + friendly-fire guard: cards name attacker and target, exploding chains in words, confirm before attacking a friendly token (0.3.27)
- [x] Human-scale armor protection: best single piece per zone, sticky ablation (0.3.28)
  - The active piece loses 1 SP on that zone only, and only for a hit of >= `personalArmorAblationThreshold` (before armor); never more than 1 per hit. Use `ablatePersonalArmor()`.
  - Check: Heavy Mesh (15) + Light Mesh (10) on the torso, hits of 6 damage. After 6 hits the torso is at 9 (still Heavy Mesh); after 15 hits Light Mesh's 10 takes over.
- [x] Bruise damage, Fists From Hell core rule (0.3.29)
  - Soft pieces are ignored by Bruise attacks (no protection, no ablation).
  - Hard pieces protect normally and ablate only at >= `personalArmorAblationThreshold`.
  - A bruise hit uses the highest-currentSP hard piece covering the zone and doesn't change the wound `activeArmorId`.
- [x] Body tab redesign, UI only: Location | Armor | Hits | Status, one Hits bar per location, a location editor on row click; "SDP" renamed "Hits" (0.3.30)
- [x] Quick melee attacks, human scale: two attacks in one Action for Quick weapons and fist strikes (0.3.31)
- [x] Human-scale defense: In hand, weapon Parry, Arm Block, improvised use, Martial Art unarmed-only (0.3.32)
- [ ] GM recovery tools: Full Recovery, Repair Armor, Rest
- [ ] Medical drugs
- [ ] Armor piercing (MZ core): [AP] melee weapons (already flagged in the weapon catalog's `damageNote`) and AP ammo, applied in `resolveZoneHit` (spec pending)
  - MZ+ ATM Armor-Piercing melee: armor at 1/2 SP; staged penetration and DC work as normal. Use this as the starting point.

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
- [ ] Quick melee/EMW construction option and two attacks per Action in the Play view. Cost x2.0 per the Net Mekton Handbook summary; VERIFY against ATM's melee/EMW cost table before using it.

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
  - Pinned releases: each `vX.Y.Z` tag gets a GitHub Release with a built `mekton-fusion.zip` (and its `system.json`) attached; that release's manifest `download` points at its own zip, and `manifest` points at `releases/latest/download/system.json`, so Foundry installs and updates by version instead of tracking the `main` branch. Needs `gh auth login` (or a GitHub Actions workflow that builds the zip on tag push).
- Shields at human scale
- Force screens (3D6 SP, 10 attacks/round); they're already hard vs Bruise (0.3.29)
- Shield needs an explicit hardness when implemented.
- Powered Armor extras (+4 BODY, +4H damage, -3 non-ablative)
- Custom hard Flight Jacket (built as plate)
- Remaining Hand-to-Hand Attack Table maneuvers in the Close Combat dialog: Slam, Throw, Trip/Sweep, Grab, Pin, Bearhug, Dismember; and Chop's Stun effect
- Mecha-scale brawling (the table's Mecha column, + by servo size)
- Mook/NPC creation: new mook actors get a Hostile prototype token disposition (the friendly-fire guard reads token dispositions; Foundry's Token Config works but is clunky at the table).
- (0.6 Mecha combat loop) Head-mounted melee weapons for humanoid mecha, WA +0 (MZ core errata p.99; also simulates jaws).
- Paperdoll icon shows the active armor piece (currently the highest base SP).
- Creature natural armor as worn plate or mesh pieces (currently a flat location SP from the preset).
- Quadruped and hexapod creatures (non-humanoid body locations and hit charts).
- New characters show "Natural 10/10" on every location until armor is first dragged on; then every other location drops to 0 (the schema's initial `spMax` of 10 lingers until the armor recompute runs). New characters should start at 0 natural SP.
- Personal weapon Hits and attacking held weapons. Human-scale weapons are built at Mekton scale in Kills; 1K = 2.5 Hits (round down), and damage dice come from the K->D6 table (e.g. 7K = 3D6-1), but catalog weapons don't line up exactly (no 3D6-1 entries). Needs a design pass.
- Shield parry (needs a DA; the MZ Personal Armor Table lists only SP 15).
- Grenades and thrown blasts: a miss scatters, the target can be a grid square/hex instead of a token, and the blast radius hits every token in it (currently needs exactly one targeted token as the point of impact).
