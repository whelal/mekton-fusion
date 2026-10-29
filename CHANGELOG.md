## [0.3.33] - 2026-10-28
### Added
- **Armor piercing**, melee (MZ core Personal Weapons Table [AP] + Armor Piercing Attacks; MZ+ ATM Armor-Piercing melee): an AP weapon's hit meets the zone's armor at half SP, rounded down (`armorPiercingDivisor`), for that hit only. This covers the active worn piece, the hard piece a Bruise meets (soft armor is still ignored), and natural armor, and it applies to a hit that still lands after a parry or Arm Block. Ablation is unchanged: 1 SP at most, only at 5+ damage before armor. The damage line reads "AP: SP 15 (Heavy Mesh) counts as 7, 9 through". Clubbing with a firearm and a Knockout strike never pierce.
- New weapon field `armorPiercing`, with an Armor Piercing checkbox on the item sheet. Catalog: true for every entry marked [AP] (Broadsword, Chainsaw, Combat Knife, Dagger, Monoknife, Monosword, Rapier, Shuriken, Spear, Sword) except the Battleaxe: MZ errata p.98 (Armor-Piercing Attacks) removes axes from AP, overriding its [AP] table marker. Update Characters sets it on owned copies once (flag `apSet`), so a GM's change survives re-running it. A Battleaxe already set true is cleared once under its own flag (`apErrataSet`), which the item sheet also sets, so a GM's later tick survives.
- `piercedSP` in `module/data/armor.js`, with tests.
### Fixed
- **Knockout strike** no longer bypasses armor (added in 0.3.32): its 1 Hit is a normal Bruise against armor (hard armor stops it, soft armor is ignored, the ablation threshold applies). The Stun/Shock roll still always happens, even when armor stopped the Hit.
### Changed
- ROADMAP.md: armor piercing ticked (0.3.33); Knockout, AP and Battleaxe-errata interpretations; Parking lot adds AP ammunition for firearms, with a separate ammo system.
- A burst spending 1 ammo whatever its BV is RAW (MZ+ ATM Ammunition: one burst is bought as one Shot), not a house ruling: `burstAmmoCost` is gone from `table-rulings.js`, the code comment cites ATM, and ROADMAP.md lists it under a new RAW notes section. No behavior change.
- ROADMAP.md: 0.4 adds the ammunition system (four steps); 0.6 adds mecha projectile ammo on the same clip model, plus missile warhead types; the Parking lot weapon Hits item now covers personal-weapon Kill ratings.

## [0.3.32] - 2026-10-28
### Added
- **In hand**: each Combat-tab weapon row has a hand button. Drawing is free and posts "<Actor> draws <weapon>" (honor system: draw on your own turn, not in reaction to an attack). Putting it away asks **Stow (1 Action)** or **Drop (free)** and logs which. More than 2 items in hand warns but isn't blocked. New weapon field `inHand` (false for existing weapons).
- **Defense after a failed Evade** (MZ core, Evade Rolls / Parry Rolls): one further defense per attack (so per attack for Quick), on the same card.
  - **Weapon Parry** (RAW), vs melee-weapon/EMW attacks only: the defender's best in-hand weapon (skill + DA) rolls 1D10 + REF + Blade + DA; swords (`fencingWeapons`, or a weapon on Fencing) use the better of Blade and Fencing. A melee weapon's DA is its WA; anything else (a gun, a thrown weapon) is an improvised parry at DA -2 (`improvisedParryDA`). A tie parries. No wear on the weapon. "Kara parries with Quarterstaff: 7 + REF 5 + Blade 3 + DA 2 = 17 — PARRIED".
  - **Arm Block** (house, adapted from Interlock Unlimited), vs melee-weapon and unarmed attacks: 1D10 + REF + the better of Hand to Hand and Martial Art. The arm with the most Hits left blocks (then the best armor); a broken arm can't, a sprained one blocks at -3. By 5+ (`armBlockCleanMargin`): no damage. By 0-4: the hit lands on the blocking arm, through its armor. Under 0: the hit lands where it was going.
  - Auto picks a weapon Parry when one is possible, else an Arm Block. The GM's attack dialogs have **After a failed Evade: Auto / Weapon Parry / Arm Block / None**. Ranged attacks and GM Difficulty attacks get no further defense.
- **Club with it**: firearms have an Attack choice, Shoot or Club (WA -2, Bruise, 1D3+ handgun / 1D6+ long gun; Auto Weapons by concealability), rolled on Blade, the catalog blunt weapons' skill. It picks a location like a melee weapon and can be parried.
- **Knockout strike** (MZ core, Knockout Damage): melee-weapon and club attacks can be declared a knockout at -3: 1 Hit as a Bruise that bypasses armor, and the target always rolls Stun/Shock.
- Table rulings (house): `fencingWeapons`, `improvisedParryDA`, `improvisedMeleeWA`, `improvisedClub`, `armBlockCleanMargin`.
- `module/data/defense.js` (parry weapon and skill, DA, blocking arm, defense choice, outcomes, club damage, knockout), with tests.
### Removed
- Martial Art as a weapon attack skill: gone from the Combat-tab weapon skill dropdown, along with its half-rank damage bonus on weapons. Close-combat maneuvers and the Arm Block keep it. Update Characters moves weapons on Martial Art to Hand to Hand and whispers the GM a list of the weapons moved.
### Changed
- ROADMAP.md: human-scale defense ticked (0.3.32); new table rulings and interpretations; Parking lot adds personal weapon Hits / attacking held weapons and shield parry.

## [0.3.31] - 2026-10-28
### Added
- Quick melee attacks, human scale (MZ+ ATM, Melee Weapons, Quick): two attacks in one Action. Weapons have a **Quick** checkbox on the item sheet; the catalog's Quarterstaff and Nunchaku/Tonfa are Quick. In Close Combat, Punch, Claw, Elbow, Backhand, Chop and Jab are Quick (table ruling `quickManeuvers`); kicks and Bite are not. The maneuver list marks them "Quick".
- The attack dialog for a Quick weapon or maneuver has a **Quick: 2 attacks** checkbox, off by default. Ticked, it adds a second Location picker; each attack takes its own called-shot penalty, rolls its own attack, gets its own Evade (or is checked against the Difficulty), and rolls and applies its own damage (armor, Wound/Bruise, ablation and Stun/Shock each resolved separately, in order). Both attacks go on one chat card, "Attack 1" and "Attack 2", under a header naming the attacker and target. A Quick Chop reports Stun for each attack that lands (still not automated).
- Update Characters macro: sets Quick on owned catalog weapons once (Quarterstaff, Nunchaku/Tonfa) and marks each weapon, as it does for Damage Type, so a GM's change on the item sheet survives re-running it.
- Table ruling (house), `quickManeuvers` in table-rulings.js.
- `isQuickManeuver`, `closeAttackPlan` and `runAttackPlan` in close-combat.js, with tests.
### Changed
- ROADMAP.md: patch numbers are no longer assigned in advance; unbuilt items are an ordered checklist and get their version when they ship. Remaining 0.4 order: GM recovery tools, medical drugs, armor piercing (with a starting note for MZ+ ATM Armor-Piercing melee). 0.6 adds the Quick melee/EMW construction option (cost to verify). New table ruling listed: Quick applies to characters.
- CLAUDE.md: never pre-assign version numbers to unbuilt work.

## [0.3.30] - 2026-10-27
### Changed
- Body tab redesign (display only; no rules or data changes). The location table has four columns: **Location | Armor | Hits | Status**, replacing ten (SP, Max SP, Armor, SDP, Max SDP, Bruises, Track, SP Bar, SDP Bar) and every input box.
  - Armor: the active piece and its SP, "Medium Mesh 12/12", with a thin bar. A leg shows Thigh and Lower on separate lines when their piece or SP differ. Natural armor reads "Natural 6/6"; no armor, "—".
  - Hits: one bar per location, Wounds solid red, Bruises amber with a hatch, the rest neutral, then "8/16", plus "4W 4B" when there are Bruises. Negative Hits fill the bar red and show the negative value ("-3/12").
  - Status: a badge only when it applies (Sprained, Broken, Shattered, Severed, Unconscious, Dead).
- Editing moved into a location editor: the owner or GM clicks a row to get Wounds and Bruises steppers (adding one wraps a full track as a hit would; healing removes one), armor SP steppers per zone for the active piece (or natural SP), with the max shown, and Remove armor. It replaces the Location / ±SP / ±SDP / ±B row under the table and the × button in the Armor column.
- "SDP" is now "Hits" on the Body tab. Data fields are unchanged.
- ROADMAP.md: Body tab redesign is 0.3.30; GM recovery tools move to 0.3.31, medical drugs to 0.3.32, armor piercing to 0.3.33.
### Added
- `trackSegments(hitsMax, wounds, bruises)` in damage-track.js: the Hits bar's segment percentages and remaining Hits, with tests.

## [0.3.29] - 2026-10-27
### Added
- Bruise damage ("Fists From Hell" Bruise Damage addendum, core rule only). Weapons have a **Damage Type** (Wound or Bruise) on the item sheet; a new edit button on each Combat-tab weapon row opens it (hover shows the current type). Melee and thrown weapon attacks (not blasts) have a Damage Type choice in the attack dialog, starting on the weapon's own type, to switch Wound/Bruise for that roll; guns, energy weapons and blasts always use the weapon's type. Bruise: the unarmed strikes and kicks in Close Combat (Punch, Elbow, Backhand, Jab, Kick, Wheel, Crescent, Thrust, Spin) and the blunt catalog weapons (Mace, Nunchaku/Tonfa, Quarterstaff, Boomerang). Claw, Bite, the Whip, edged and pointed weapons, ranged weapons and blasts stay Wound.
- One damage track per location holds both Wounds and Bruises (capacity = max Hits). Past capacity, each further point turns a Bruise into a Wound; only with no Bruises left do Wounds go into negative Hits. Example: torso capacity 10 with 5 Wounds takes 7 Bruises: 7 Wounds / 3 Bruises, track full.
- Head or torso with a full track (any mix): unconscious. Death and broken/shattered/severed limbs count Wounds only, so Bruises never kill. Stun/Shock checks trigger on Bruise hits the same as Wounds.
- **Sprained** (interpretation): a limb whose track is full and holds a Bruise. Skill rolls, weapon attacks and close combat list the roller's sprained limbs as checkboxes; tick the ones the roll uses for -3 each (table ruling `sprainedLimbPenalty`).
- Bruise hits vs armor: soft pieces are ignored (no protection, no ablation); the best hard piece soaks and ablates at the 5-damage threshold without changing the zone's active piece. Natural armor stops Bruises normally. The Personal and Advanced Force Screens are hard; a piece with no hardness set (the parked Shield) counts as soft. Cards read "Bruise: soft armor ignored, 7 through" or "Bruise: SP 25 (Heavy Plate) soaked, no ablation (<5)".
- Body tab: a Bruises column and a Track column per location (X = Wound, / = Bruise, · = free) with the state (Sprained, Unconscious, …). The SDP bar shows Hits after Bruises. A **B** button in the adjust row heals Bruises (+N heals N); Bruises heal 1 per full hour of rest, applied by hand for now.
- Update Characters macro: sets the damage type on owned catalog weapons once (Bruise for the Mace, Nunchaku/Tonfa, Quarterstaff and Boomerang) and marks each weapon so re-running never undoes a GM's change; changing Damage Type on the item sheet marks it too. Weapons on unlinked tokens get this too, as their armor already did. Owned force screens with no hardness become hard. Existing damage stays as Wounds.
### Changed
- Friendly-fire guard: the prompt now appears when the attacker and the target are on the same side, both Friendly or both Hostile (it used to be Friendly only), and whenever a token targets itself ("Keith is targeting themselves"). Friendly attacking Hostile, Hostile attacking Friendly, and Neutral or Secret tokens go through without a prompt. Area blasts still never prompt; their "Friendly fire:" list now names same-side tokens caught, the thrower included.
- No Stun/Shock check is rolled for a target already unconscious (head or torso track full), as for the dead.
- ROADMAP.md: 0.3.30 GM recovery tools (Full Recovery, Repair Armor, Rest), 0.3.31 medical drugs; armor piercing moves to 0.3.32. Parking lot: the Shield needs an explicit hardness when implemented; grenades and thrown blasts (scatter on a miss, targeting a grid square/hex, blast radius).

## [0.3.28] - 2026-10-23
### Changed
- Personal armor protects per zone, one piece at a time (no layering). Each zone has an **active piece**: the covering piece with the most SP left on that zone (ties: list order). It stays active until its SP there reaches 0, even after it wears below a backup piece; then the next piece takes over. Example: Heavy Mesh (15) over Light Mesh (10) on the torso, hit six times for 6: the torso is still on Heavy Mesh at 9; once Heavy Mesh is worn to 0, Light Mesh's 10 takes over.
- A hit wears only the active piece, only on the zone hit (thigh and lower leg are separate), by 1 SP at the 5-damage threshold. The damage card names the piece: "SP 9 (Heavy Mesh) soaked".
- Random hit locations now name the leg zone ("Right Lower Leg") and resolve armor there; the hit roll picks it (7/8, 9/10).
- ROADMAP.md: armor piercing ([AP] weapons and AP ammo) added to 0.4 as 0.3.30.
- Body tab: for worn armor, SP, Max SP and Armor show each zone's active piece and its own SP (both zones for a leg). The SP adjust button repairs or wears those pieces. Locations no piece covers (natural armor, creatures) keep their editable location SP, which hits still use.
### Added
- Actor field `system.body.armorZones.<zone>.activeArmorId` (empty until a zone is first hit).
- Update Characters macro: moves armor wear recorded on body locations (0.3.24–0.3.27) onto the piece that was providing it, so existing characters keep their damaged armor. It also gives per-zone SP to any piece that never had it (every zone at 0), and now runs its armor steps on unlinked tokens on every scene, not just world actors. Run it once after updating; re-running is safe.
- Table ruling (house), `maxArmorLayers: 2` in table-rulings.js: at most 2 armor pieces may cover any one zone. Adding a piece, or changing a piece's coverage or kind, that would make a third layer is refused with a message naming the zones. Characters already wearing more keep their armor.
### Removed
- `HIT_LOCATION_CHART` (replaced by `zoneForHitRoll` in armor-coverage.js).

## [0.3.27] - 2026-10-23
### Added
- Friendly-fire guard (human scale and mecha): attacking a targeted token when both it and the attacker's token are Friendly asks "<Target> is friendly. Attack anyway?" first, with Cancel as the default. Cancel stops the attack with no roll and no ammo spent. The GM gets the prompt too. Covers weapon attacks, close combat, mecha Armament rolls, bursts and missile salvos.
- Area blasts never prompt; everyone in the radius is hit, and the card lists any friendlies caught as "Friendly fire: <names>".
### Changed
- Attack cards name both sides: "<Attacker> attacks <Target> — <weapon or maneuver>", or "(no target)" / "(N targets)". Damage lines end "to <Target>'s Torso". Applies to weapon attacks (including bursts), close combat, and mecha Armament rolls, bursts and salvos. "Apply to targeted token" now reads "Applied N damage from <Attacker> to <Target>'s <location>".
- Exploding dice read in words: "10 (+7) = 17," and "1 (fumble chain −4) = −3," followed by the modifiers. Applies to attacks, Evade, stat and skill rolls. Totals are unchanged.
- ROADMAP.md: attack card clarity is 0.3.27; armor protection moves to 0.3.28 and bruise damage to 0.3.29. Parking lot: mook actors default to a Hostile token disposition.
### Fixed
- release.json's `compatibility.verified` now matches system.json (14).

## [0.3.26] - 2026-10-23
### Added
- **Bite** close combat maneuver (MZ core Hand-to-Hand Attack Table): WA 0 (MZ core errata p.99), 1D3 + BODY damage. A **Mouth Position** choice appears in the Close Combat dialog for Bite. Level with target reaches torso, head or arms like a Punch (torso free, head -4, arm -2: the table's called-shot ruling overrides core's no-penalty Bite); On the ground reaches the legs only (free, either leg).
- Table ruling (house), `biteReach` in table-rulings.js: the locations each mouth position can reach.
- Table ruling (interpretation), `personalArmorAblationThreshold: 5` in table-rulings.js (MZ ATM Scaling, human-scale ablation rate).
### Changed
- Personal armor ablates 1 SP only when a hit's damage (before armor) is 5 or more, never more than 1 SP per hit. It used to lose 1 SP on any hit of 1+, so a 3-damage punch wore down SP 25 plate. Applies to all personal armor, soft and hard; each burst hit is checked separately; burning still never ablates. Mecha armor is unchanged (any 1K+ hit ablates).
- Damage cards say when a hit was under the threshold, e.g. "SP 25 soaked, no ablation (<5), 0 through."
- ROADMAP.md: Bite and the ablation threshold are 0.3.26; armor protection moves to 0.3.27 and bruise damage to 0.3.28. The human-scale ablation ruling is now an interpretation, not RAW. The 0.3.27 and 0.3.28 items now include their ablation specs. Parking lot: head-mounted melee weapons for humanoid mecha.

## [0.3.25] - 2026-10-23
### Added
- Close combat (MZ core, brawling and melee): a **Close Combat** button on the Combat tab opens a dialog to pick the maneuver (Punch, Claw, Elbow, Backhand, Chop, Crescent, Kick, Wheel, Thrust, Spin, Jab), the skill (Hand to Hand or Martial Art), and a location the maneuver can reach. The dialog shows the total modifier (WA + location penalty) before rolling, and the chosen location is the hit location (no location roll).
- Melee weapons (Blade, Fencing, Whip, Hand to Hand, Martial Art skills) get a Location choice in their attack dialog: torso free, head -4, arm -2, leg -2.
- Table ruling (playtest values), `closeCombatCalledPenalty` in table-rulings.js: the default location (torso, or legs for sweeps) is free; other locations cost head -4, arm/leg -2 on top of the maneuver's WA. Single-location maneuvers (Kick, Wheel, Thrust, Spin, Jab) take only their own WA.
- Interpretations: Chop and Crescent have no free location (head -6, arm -4 total). A leg hit lands on the thigh or lower leg 50/50, on the chosen side. Eyes/sensors (Jab) damage the head.
- Maneuver damage per MZ core's Hand-to-Hand Attack Table (men scale), with the BODY damage modifier: Punch/Claw/Elbow/Backhand 1D2, Jab 1D3, Kick 1D3, Wheel 1D6, Crescent 1D6+1, Thrust 1D6+2, Spin 1D6+3. A Martial Art attack adds half its rank, as Martial Art weapons already do. It's applied to the targeted token like a weapon hit. Chop does no damage; the card reports Stun (not automated).
### Changed
- No Stun/Shock check is rolled when damage is applied to a dead target (head or torso at DEAD).
- Stat, skill, weapon, close combat and mecha armament roll cards now show the final total (die + modifiers) as the big number, not the bare die roll.
- ROADMAP.md: close combat is 0.3.25; armor protection moves to 0.3.26 and bruise damage to 0.3.27.

## [0.3.24.1] - 2026-10-23
### Changed
- Dropping mesh or plate always opens the coverage picker so the player picks the zones covered. Dropping on a paperdoll zone now just pre-ticks that zone instead of skipping the picker.
- ROADMAP.md: Human-scale polish is now 0.4 (CURRENT) and holds the human-scale armor items. Mecha sheet usability moves to 0.5 and the Mecha combat loop to 0.6.

## [0.3.24] - 2026-10-19
### Added
- Personal armor zones (MZ core, Personal Armor / Sample Armor Coverage). Armor now covers 8 zones keyed by the hit number: head (1), torso (2-4), right arm (5), left arm (6), right thigh (7), right lower leg (8), left thigh (9), left lower leg (10). Damage still goes to the 6 body locations.
- Armor items have a **Kind** (mesh, plate, helmet, suit, flight jacket, powered armor, other), a **Tier**, an explicit **Hardness** (soft or hard, never derived from SP), a **Base SP**, and a current SP per covered zone. The per-zone SP is stored but not used by damage yet (0.3.25).
- Coverage picker for mesh and plate: a garment preset (Hat, Vest, Jacket, Overcoat, Pants, Shorts, Boots) or Custom, with a checkbox per zone. It's on the item sheet, and it opens when you drop mesh or plate anywhere on the character sheet except a paperdoll zone. Closing the picker cancels the drop.
- Dropping mesh or plate on a paperdoll zone covers just that zone. Each leg on the paperdoll is now split into thigh and lower leg.
- Weight and cost for mesh and plate are per Single location, charged per covered zone (a thigh or lower leg is half). Heavy Mesh as a Jacket is 1.2 kg, 168; as Boots, 0.4 kg, 56. Helmets, suits, the Flight Jacket and Powered Armor keep their table weight and cost.
### Changed
- Helmets (head), the Flight Jacket (torso and arms), suits and Powered Armor (all 8 zones) have fixed coverage and skip the picker.
- Overcoat now covers the thighs only, Shorts the thighs only, and Boots the lower legs only, as the coverage table says (they used to cover the whole leg).
- Shield and both force screens are kind "other" with no hardness set; they're parked (ROADMAP.md).
- Interim until 0.3.25: a body location's SP is still the best Base SP covering any of its zones, and ablation still lives on the location.
- ROADMAP.md: the three human-scale armor patches are 0.4 items; the hard-armor ruling, the per-zone charge Interpretation, and four Parking-lot items are added. The drop-zone Parking-lot item is removed (done).
- Old armor converts automatically when loaded: SP becomes Base SP, the old Coverage value becomes zones (Vest = torso, Jacket = torso and arms, Pants = all four leg zones, All = all 8; Hat, Overcoat, Shorts and Boots map to their presets), and kind, tier and hardness are filled in from the category and name.
- Run the **Update Characters** macro to save the converted armor and seed each piece's per-zone SP. A piece that was providing a location's SP keeps that location's ablated SP on its zones there; other zones start at Base SP. Any armor it couldn't map is whispered to you in chat, left blank, and not guessed.
- Run the **Build Armor Pack** macro to rewrite the compendium in the new format.

## [0.3.23] - 2026-10-15
### Fixed
- Pods (MZ ATM, Pod Servo; corrects 0.3.22): a pod is held together by its armor. It's destroyed when EITHER its armor is gone OR every weapon inside it is destroyed.
  - **Armor gone:** an armored pod at 0 SP. Each hit of 1K or more ablates 1 SP, even when nothing gets through.
  - **No armor:** the pod is destroyed by its first hit of 1K or more.
  - **Armor loss drops the contents:** the weapons inside go offline, but their own damage is untouched.
  - **Empty pod:** destroyed when its armor is gone (0.3.22 never destroyed it).
  - **Damage past the armor** still goes to a random weapon inside; anything past that weapon's Kills is lost.
  - **Display:** the Play view shows "Destroyed (contents dropped)" for a pod lost to armor, and the hit card says which way the pod fell.
- Mecha autofire crits (MZ ATM: autofire uses the missile salvo method). A burst at margin 10+ used to make every hit a Mega-Crit. Now the counts come from the raw margin (`salvoCritCounts`) and land on the first hits: Mega-Crits, then Crits, then normal hits. Each burst hit still rolls its own location; only salvos walk.
  - **Examples:** BV 5 at margin 12 = 3 Mega-Crit + 2 Critical. BV 5 at margin 6 = 2 Critical + 3 normal.
  - **Chart:** the burst dialog asks for the chart for Critical hits once per burst: Random (Hit Location Chart), Special or Cinematic. A Critical on Special/Cinematic shows its own d10 as the result on that chart, with no Apply button.
  - **Per-hit buttons:** they no longer carry the margin. Each Mega-Crit hit is flagged on its own button instead. Burst cards posted before this version lose their Mega-Crit flag when applied.
- The Apply-hit dialog had the same all-Mega-Crit problem when you typed in several hits with a margin. It now counts crits the same way and shows the counts, and the Mega-Crit box only applies to a single hit. Its chart choices read Random / Special / Cinematic.
### Changed
- ROADMAP.md: three pod Interpretations added; the autofire-crit item is removed from the 0.5 checklist (done); "Streamline the shield parry flow" is added to 0.5.

## [0.3.22] - 2026-10-15
### Fixed
- Pods (MZ ATM, Pod Servo): a pod has no Kills of its own and was being destroyed by its first penetrating hit. Damage past a pod's armor now goes to a weapon mounted in it, chosen at random when there are several (`applyPodHit`); excess past that weapon's Kills is lost. A pod is destroyed once every weapon in it is, and a destroyed weapon goes offline. Only weapons track damage, so sensors and subassembly items in a pod aren't counted. An empty pod still ablates its armor, but penetrating damage goes nowhere and the pod is never destroyed. Pod hits resolve the same way from every Apply button: the salvo dialog, burst per-hit buttons, the Play view's Apply Hit, and parry through-damage.
- Ties go to the defender in all combat (MZ core, Evade Rolls). A human-scale attack that exactly meets a GM Difficulty now misses, and a human-scale burst on a tie lands 0 hits (it used to land 1).
### Changed
- Shield parry plays RAW only. Each parried hit is resolved against the shield's current SP, and any hit of 1K or more costs 1 SP even when fully stopped (MZ core, Staged Penetration; MZ ATM, Shields). The `SHIELD_PASS_THROUGH` switch and its "parry stops everything" mode are removed.
- Damage that gets past a shield now goes to the hit's originally rolled location, not the shield's mounting servo (an Interpretation, now listed in ROADMAP.md). The parry dialog asks for that location: Random rolls it the normal way (walking the chart if you tick "Missile salvo"), or pick the aimed or already-rolled servo. The shield wear, the servo damage and the parry roll go into one update and one chat card. The "no mount, apply by hand" path is removed.
- An aimed hit no longer rolls a d10 it doesn't use. The single-hit Apply buttons now share the salvo flow, so their chat card shows "Hit 1: aimed → …".
- Every weapon's `killsUsed` is kept in the Play-view form, not just melee/EMW weapons', so damage taken in a pod survives a form submit. Any weapon that has lost Kills shows "Kills X/Y".
- The comment calling "weapons in a destroyed servo go offline" an assumption now cites RAW (MZ ATM).
- ROADMAP.md: new Interpretations list, and four new 0.5 items (Damage Coefficient, Beam/Reactive shields, autofire crit allocation, non-weapon systems going out of action with their servo).

## [0.3.21] - 2026-10-15
### Changed
- Table rulings now live in `module/rules/table-rulings.js` (`TABLE_RULINGS`), and the code reads them from there instead of hardcoding them: `burstAmmoCost` (1 per mecha burst, whatever the BV), `otherWithoutWingTail` (a single attack's 9 with no wing/tail rerolls; "torso" restores the pre-0.3.15 behavior), `salvoWalkEmptyOther` (added in 0.3.20), `sideLimbPick` (moved from `LIMB_PICK` in `mecha-damage.js`, which is removed), and `excessKills` ("lost"). No gameplay change: every entry holds its current value.
- Parry ties going to the defender are RAW (MZ core Interlock), not an assumption, so the code comments now say so. No entry, since the file holds house deviations only.

## [0.3.20] - 2026-10-15
### Fixed
- Missile salvo hit determination now follows RAW (MZ ATM, Missiles / Missile Hit Determination). 0.3.18 got three things wrong:
  - **Walk direction.** The attacker no longer chooses a direction. The salvo rolls one location, then walks down the chart one row per missile (3, 4, 5 … 10), wrapping 10 → 1. The Walk select is gone from the Apply-hit dialog.
  - **Crits.** These are now counted from the raw margin, not applied as one tier to every missile: Mega-Crits = margin − 9, Crits = (margin − 4) − Mega-Crits (`salvoCritCounts`). They land on the first missiles in the walk: Mega-Crits first (that row's location, no armor), then Crits, then normal hits. Example: 12 missiles at margin 11 = 12 hits, 2 Mega-Crit, 5 Critical, 5 normal. The dialog shows the counts in place of the all-or-nothing Mega-Crit checkbox, and the fire card's header shows them too.
  - **Crit chart.** On a Critical, the attacker's choice of the Special or Cinematic chart now uses the walk's row number as the result on that chart. Each such missile is posted for manual resolution, and nothing is applied for it.
### Changed
- A walked 9 (Other) on a mech with no wing or tail is skipped (the walk moves on to 10), instead of rerolling that missile. This is a house ruling, now in the new `module/rules/table-rulings.js` (`TABLE_RULINGS.salvoWalkEmptyOther`, "skip" or "reroll"). A single attack's reroll-9 is unchanged.
- The salvo fire dialog notes that a salvo has one target: a volley split across several targets is fired as separate salvos.
- README: the mecha combat section now covers the margin-based crits, missile salvos, and shield pass-through on a parry.

## [0.3.19] - 2026-10-14
### Added
- The Mecha Loadouts compendium (`packs/mecha-loadouts`) now ships populated with the Vesper-class Skirmisher, Bulwark-class Assault and Dire Wolf loadouts. It was declared in `system.json` but never built, so Foundry kept recreating it as an empty, untracked database.
### Fixed
- Body tab hit-location table: the SP and SDP number inputs clipped 2-digit values (e.g. "15" showed as "1"). Inputs now have a 3-digit minimum width with tighter padding, cells use less side padding, and the SP/SDP bar columns shrink to 48px (was 80px) to make room. The ±SP / ±SDP adjust boxes are wider (60px) so their placeholders fit.

## [0.3.18] - 2026-10-14
### Added
- Missile salvos (core): a missile rack with more than 1 shot gets a **Salvo** button in the Play view instead of Burst. Fire any number of missiles (1 to shots left) in one Action; hits = margin × ⌈missiles fired / 10⌉, clamped to missiles fired, not BV-capped (`salvoHitCount`). The card's "Apply hit" dialog adds a **Walk** pick for random location: roll one start d10, then step one chart row per extra missile toward the Head (3→2→1→10) or toward the limbs (3→4→5), wrapping 1↔10 (`salvoRows`).
- Critical hits from margin (core p.102, `critTier`): the "Apply hit" dialog has an optional Margin (attack − defense) field, prefilled from burst and salvo cards. A margin of 10+ auto-checks Mega-Crit (still editable by hand; it applies to aimed shots too). A margin of 5–9 unlocks a Normal / Special / Cinematic chart pick: Special or Cinematic posts each hit for resolution on that chart and applies nothing, like a rolled 10. Burst and salvo cards show "Critical" / "MEGA-CRIT" in the header. A burst's per-hit Apply buttons carry the margin, so a 10+ burst applies each hit as a Mega-Crit.
- `tests/mecha-damage.test.mjs` (`node --test tests/`): crit tiers, salvo hit counts and walks, shield pass-through, book hit-chart rows, staged penetration.
### Changed
- Burst fire now uses the servo-aware Hit Location Chart (`locationFromRoll`) against the targeted mech's real servo list, the same chart as the salvo flow. With no single mech targeted, it falls back to the default humanoid layout. A 9 with no wing/tail rerolls, a 10 shows "Special hit — resolve on the Special chart" with no Apply button, and labels are the servos' derived names ("R Arm 2"). The 1d2 house table (`module/data/mecha-hit-table.js`) and its auto-rolled Special/Cinematic text are removed. **Odds change:** the old table sent a 9 to Torso.
- Shield parry (MZ+ ATM, Shields; `resolveShieldParry`): Standard/Active shields use staged penetration. Damage over the shield's current SP passes through to its mounting servo, through that servo's own armor. A parried burst or salvo ablates the shield once per hit; the parry dialog gained a Hits field for that. The shield's SP and the servo damage are written in one update and reported on one card. A shield with no mount posts the through-damage to apply manually. The 0.3.13 "not yet book-confirmed" flag on shield wear is dropped (core p.92). `SHIELD_PASS_THROUGH` in `mecha-damage.js` is the single switch back to the core-only reading (a parry stops the whole attack, -1 SP).
- Play view weapon Loc column, and the Armament roll's chat "Loc", show the mount's servo label instead of its raw id (`locLabel`, derived for weapons and shields).
### Fixed
- Deleting a servo now also drops its `system.mecha.damage` entry, and moves the cockpit back to the torso if it was mounted on that servo.
### Decision points (one-line changes if ruled otherwise)
- Salvo ammo: a salvo spends one shot per missile fired. The "1 ammo per burst" ruling is treated as autofire-only. See the DECISION comment in `_onMechaBurst`.
- Per-missile reroll: a walked salvo row of 9 with no wing/tail rerolls a fresh d10 for that missile only. The book's walk doesn't cover it. See the DECISION comment in `_applyMechaSalvo`.

## [0.3.17] - 2026-10-14
### Added
- Human-scale opposed Evade (core p.92): the personal-weapon attack dialog has a Defense selector. "Target Evades" (default with exactly one targeted token) auto-rolls the target's 1D10 (exploding) + REF + Dodge & Escape, with -1 from the flank / -2 from the rear via a new Arc picker; Evade >= attack is a miss. "GM Difficulty" keeps the existing preset/Situational Modifier block unchanged -- the table ruling for unaware targets and sneak attacks, where no defense roll is allowed (a blank Difficulty still means no defense roll at all). Area weapons only offer GM Difficulty (indirect fire, core p.97). The Evade is rolled on the attacker's client; Parry is not resolved yet.
- Human-scale burst fire (core p.95-96): a weapon with a numeric BV > 1 gets a Fire Mode picker (Single / Burst). A burst lands one hit per point of margin over the Evade or Difficulty, capped at BV (a Difficulty tie still lands 1); each hit rolls its own damage and hit location and soaks through that location's armor separately. With no defense roll and no Difficulty, a burst lands 1 hit. No ammo tracking for personal weapons (unchanged).
### Fixed
- Character armor never ablated on its own. `_applyLocationDamage` now applies staged penetration (core p.103): any hit of 1+ damage drops that location's current SP by 1, even when the armor stops it all. Burning damage (`ignoreSp`) doesn't ablate -- it's already past the armor, not a new hit. The damage chat line shows "SP 6 soaked (ablated to 5)".
### Notes
- No Crits or Mega-Crits at human scale (table ruling: armor always applies to characters). The margin only drives burst hits.

## [0.3.16] - 2026-10-12
### Added
- Fencing (H) and Martial Art (H) as alternative weapon skills: the Combat tab's personal-weapon skill dropdown gained "Fencing (H)" (alternative to Blade, for bladed weapons) and "Martial Art (H)" (alternative to Hand to Hand). Choosing either adds half that skill's rank, rounded down, as a flat bonus to the weapon's damage (rank 1 -> +0, rank 2 -> +1, rank 3 -> +1, rank 4 -> +2) -- shown as a "+ Skill +N" breakdown term alongside the existing BODY damage mod, on both the standalone damage-roll button and the full attack-roll flow. Mecha-scale personal weapons (the isMecha-flagged row) don't get these options -- mecha combat uses its own Mecha Melee (H) skill, unrelated to this bonus.
### Fixed
- `weaponSupportsOptions` (ranged-only Weapon Options eligibility) didn't recognize "fencing"/"martial-art" as melee skills, so a reach weapon like a Quarterstaff or Spear (range > 2, so not caught by the range check) would wrongly qualify for ranged accessories (Smartgun, Silencer, etc.) once switched to one of the new skills.

## [0.3.15] - 2026-10-11
### Added
- Mecha hit location and staged penetration (Mekton Zeta core): every damaging Armament roll now posts an "Apply hit" button. The GM sets hit count (burst hits = margin capped at BV), a Mega-Crit checkbox, and an aimed servo or "Random", then the system rolls the Hit Location Chart (1d10 per hit) against the mech's actual servo list -- 1 Head, 2-3 Torso, 4 Pod (uniform among several; none -> Torso), 5-6 right-side limb (uniform among arm/leg servos on that side; none -> Torso), 7-8 same for left, 9 wing/tail (none -> reroll), 10 Special chart (posted, not automated) -- and applies one `applyHit()` per hit: damage minus current SP (0 on a Mega-Crit, which never ablates) penetrates to Kills; any non-Mega-Crit hit of >=1K ablates 1 SP even when fully stopped; excess past 0 Kills is lost. One chat card lists every hit's d10 roll, SP/Kills result, and DESTROYED when it happens; destroying the servo holding the cockpit (new `subassemblies.cockpit.loc`, Build-view picker, default torso) posts an Emergency Ejection warning. GM-only, since this system has no socket to relay a player's apply request safely.
- Pods (and any 0-Kills component): the first penetrating hit destroys them outright, reflected in both `_deriveMecha`'s `destroyed` flag and the Play view (shows "Intact"/"Destroyed" instead of a meaningless "0/0").
### Changed
- `system.mecha.damage` is now an `ObjectField` keyed by servo id instead of a fixed 6-key `SchemaField`, so a servo added past the default 6 (see 0.3.14) can take and keep damage -- closing the known gap flagged in 0.3.14. Still stores damage *taken* (never current values), so this was a straight widening with no value conversion; existing actors' stored `{head, torso, rArm, lArm, rLeg, lLeg}` data already matches the new shape 1:1; no migration.
- The Play view's per-servo manual "Apply Hit" button and the existing burst-fire per-hit chat buttons now share the same `applyHit()` staged-penetration math as the new salvo flow (previously their own near-duplicate function); the manual Apply Hit dialog also gained a Mega-Crit checkbox.
### Reconciliation notes (plan predates recent 0.3.12-0.3.14 work)
- The plan's `.mf-apply-mecha-hit` button class was already bound to the 0.3.12 burst-fire per-hit buttons (different data attributes, no dialog). The new single-roll "Apply hit" button and its hits/Mega-Crit/location dialog use a distinct class, `.mf-apply-mecha-salvo`, to avoid double-binding; burst fire's own per-hit buttons and hit-location table (`mecha-hit-table.js`, the house-ruled 1d2-limb chart) are untouched and still coexist with the new book-accurate, servo-aware `locationFromRoll()` used by the salvo flow -- unifying the two hit-location systems is left for a later pass.
- No knockback feature (`.mf-knockback` or otherwise) exists anywhere in this codebase for the plan to refactor, so the "run knockback once per attack" step was not implemented -- inventing one from scratch wasn't part of what was asked.

## [0.3.14] - 2026-10-10
### Changed
- Mecha servos are now an identified list (`id` + `kind` + `side`) instead of a fixed 6-slot array mapped by index. The default humanoid's 6 rows keep fixed ids equal to the old location keys (`head`/`torso`/`rArm`/`lArm`/`rLeg`/`lLeg`), so every existing weapon/shield/sensor/movement-system/subassembly `loc` value and every actor's stored data stays valid with no migration. A servo's display label (e.g. "R Arm 2") is now always derived from side + kind + an ordinal when duplicated, never typed by hand. The Mecha tab gained a "+ Servo" button (add an arm/leg/head/wing/tail/pod, any side) and a per-row delete button (not on the fixed torso); deleting a servo clears any `loc` pointing at it instead of leaving it dangling. NPC/mook presets (Vesper, Bulwark) build their servo list the same way and still resolve to the same default ids.
- **Known gap:** `system.mecha.damage` (added in 0.3.12 for Play-view staged penetration) is still a fixed 6-key schema. A servo added beyond the default 6 derives correctly and can be assigned weapons/shields, but its Play-view damage edits (SP/Kills steppers, Apply Hit) won't persist until a later phase widens that schema to be dynamic. The default 6 servos are unaffected.
- Shield parry-arc labels ("Front + R/L flank") now key off the mounting servo's actual `side`/`kind` instead of a literal `rArm`/`lArm` id check, so they keep working for a shield mounted on an added second arm.

## [0.3.13] - 2026-10-10
### Fixed
- Parry was resolving as an automatic stop. It's now a Parry Roll (core p.92-93): 1D10 + Mecha Reflex + Mecha Melee + DA, vs the attack total (ties succeed, same assumption as Evade) -- a failed roll means the target takes the hit. Shields use their own DA; melee weapons and EMWs use their WA as DA. Shields now lose 1 SP per successful parry, the same "no matter the damage" rule as a melee weapon's Kills, and are destroyed at 0 SP -- this reading of the shield rule (p.92) is NOT yet book-confirmed by the maintainer, flagged in code and here. Non-melee weapons parrying a melee attack at DA -2, and knockback from a parried attack (one level less, p.100), are both out of scope and not implemented.
- A burst spent its ammo even when the defense-total dialog was cancelled (nothing was actually fired). Ammo now only spends after the dialog resolves. An empty weapon (single shot or burst) now refuses to roll at all, with a message pointing at Reload when it has spares.
### Added
- Spare clips per weapon (Build view only, `system.mecha.weapons[].clips`): a counted number of full reloads bought at construction. Reload (`.mp-reload`, 1 Action, announced in chat, not tracked by the sheet) swaps in a full spare clip, or else the largest partially-used clip on hand -- the clip just pulled is kept as a partial, never discarded, and persists even on a destroyed mech until Depot or salvage. The Reload button disables once reloading wouldn't add any shots.
### Changed
- "Repair & Reload" is renamed **Depot Maintenance** and is explicitly framed as the only full reset (not a field action): it now also restocks every weapon's spare clips and clears partials, and restores shield parry SP, alongside the existing servo-damage and ammo reset.

## [0.3.12] - 2026-10-10
### Added
- Mecha tab Play/Build toggle (`.mecha-mode-toggle`): the Play view is a compact combat tracker -- per-servo SP/Kills remaining with +/- steppers and a direct "Apply Hit" button, and per-weapon ammo remaining with a single-shot or burst roll button -- instead of the full ~230-cell construction worksheet. A Repair & Reload button clears all servo damage and refills every weapon's ammo. Both views render in the same form (Build hidden via CSS, not `disabled`) so the fixed-length servos/weapons arrays never lose data when only one view is visible.
- Staged penetration (`module/data/mecha-damage.js`): damage beyond a servo's *current* SP penetrates to Kills, and any attack of >=1 Kill ablates 1 SP even when fully stopped. Current SP/Kills are derived from damage-taken counters (`system.mecha.damage.<loc>`), never stored directly, so re-picking a servo's class or armor can't desync them. A destroyed servo (Kills = 0) shows struck-through and takes any weapons mounted there offline.
- Ammo tracking: each attack (single shot or a burst) spends 1 ammo from a weapon's numeric `shots` (`"12"`, `"10 bursts"`); `"∞"`/blank weapons are untracked. Rolling with no ammo left is refused.
- Burst fire: hits = attack total minus defense total (defense entered manually for now -- no opposed-roll handshake yet), capped at the weapon's BV; a tie or miss is 0 hits. Each hit rolls separately on a paraphrased Mecha Random Hit Chart (`module/data/mecha-hit-table.js`) and gets its own "Apply" button in chat, mirroring the existing targeted-token damage flow. Side-limb is a confirmed 1d2 arm/leg roll; Pod/Other -> Torso is still a house assumption pending a book check. Special/Cinematic results (roll of 10) are shown in chat, not automated.
- `module/util/escape.js`: shared `escapeHtml()` (previously private to `mekton-fusion.js`) for user-controlled strings (actor/mech names) interpolated into new chat cards.
- Parry, Mecha tab Play view (`resolveMeleeParry`/`resolveEmwParry` in `module/data/mecha-damage.js`): shields parry any attack; melee weapons and EMWs may only parry melee/EMW attacks (not exclusive -- either can parry the other). A melee weapon's Kills act like a shield's SP -- every successful parry costs 1 Kill regardless of the attack's damage, and it's destroyed at 0. An EMW's Damage rating acts like a shield's SP but doesn't deplete on a successful parry; if the incoming attack's damage exceeds the EMW's own Damage rating, the EMW doesn't stop it at all. Shields show a parry-arc reminder (front + the flank matching their mounting arm) as a label only -- this system doesn't track token facing, so the arc isn't enforced.
### Fixed
- Land MA / Flight MA on the Mecha tab's MEKTON STATS rows: the tonnage/thruster hint was written directly into the stored field whenever it read 0, so `submitOnChange` would silently persist that hint as if the pilot had typed it on the next unrelated edit, and the mech would stop tracking the hint as its weight changed. The hint now only affects a separate derived `*Eff` value used for display/calculation; the stored field is only ever set by typing into it, and reads blank (showing the hint as a placeholder) until then. Mechs already affected keep their stored value; clearing the field restores hint behavior.

## [0.3.11] - 2026-10-05
### Added
- Update Characters macro (`macros/update-characters.macro.js`, GM only, logic in `module/migrate-actors.js`): brings every character and NPC in the world up to date. It adds CP2020 skills added since the actor was created (existing ranks untouched), sets the skill on owned weapons whose name matches a catalog entry (e.g. thrown weapons -> Athletics), and recomputes body-location armor SP from worn armor. Creatures with natural armor SP are skipped for the armor step. Safe to re-run.
### Changed
- Body locations with no worn armor now read 0 SP after the update (previously the schema default of 10 showed on every location).

## [0.3.10] - 2026-10-03
### Added
- I.P. and Eurobucks ledgers in the sidebar header: `system.meta.points` (I.P.) and a new `system.meta.eurobucks` (cash, starts at 0) are now `{value, transactions[]}` instead of a bare number. A receipt-icon button next to each opens a log dialog -- add a signed delta with a note, edit or delete any past entry, and the running total always recalculates from a fixed baseline rather than trusting stored totals. Existing actors' flat `meta.points` values upgrade automatically (via `migrateData`) into a ledger with no history, starting from the old number. Ported from the maintainer's other system, long-drift (github.com/whelal/long-drift), adapted to this project's `TypeDataModel`/`foundry.utils.escapeHTML` conventions.
- 7 new CP2020 skills: Endurance (BODY -- new category, first BODY-stat skill in the list), Oratory (COOL), EW/Electronic Warfare and Hacking (H) (INT), Fencing (H) and Martial Art (H) (REF:Combat), Demolitions (H) (TECH). Forgery and Tactics were already in the list (non-Hard) and were left as-is rather than duplicated. ECM/ECCM (book text frames them as EW specialties) and description text were intentionally left out per the maintainer.
### Changed
- Combat tab's Human and Mecha combat skill rows are more compact: smaller label and total text, tighter row padding, and a narrower roll button.
### Fixed
- Sidebar header AGE/POINTS/EUROBUCKS row overflowed the sidebar (boxes sat in a single flex row, so the right edge clipped and spacing was uneven). The row is now a two-column grid with EUROBUCKS full width underneath.

## [0.3.7] - 2026-09-29
### Changed
- Body-location armor SP is now DERIVED from the actor's armor Items instead of stamped at equip time (`module/data/armor.js`). A location's `spMax` is the highest `sp` among owned armor whose coverage includes it -- highest wins, no stacking (MZ default; proportional layering is a later change to one comparison in `deriveArmorByLocation`). Current `sp` ablates down from `spMax` and can't exceed it. `createItem`/`deleteItem`/`updateItem` hooks (only on the client that made the change; `updateItem` only for `sp`/`coverage` edits) recompute every location; intact armor (sp == old max) tracks the new ceiling, already-ablated armor keeps its damage clamped under it. Owning an armor Item = wearing it (no equipped flag in v1). Removed `_equipArmorToBody`. Per-location `itemId` is now just the paperdoll icon, set to the highest-SP contributor.
- Body tab: Max SP is read-only (derived); current SP input, the SP +/- button, and ablate all clamp to [0, Max SP]. New Armor column shows what's providing each location with a remove button, which deletes the chosen armor Item (a piece covering several locations is removed from all of them). The sheet previously had no way to remove worn armor at all.
- Weapon Options can now be edited on a character: a sliders button on each personal-weapon row of the Combat tab opens a checklist (with each option's effect) and saves straight to the owned weapon. Previously options could only be set on the standalone Item sheet, and a weapon already on a character had no way to view or change them.
- Weapon Options are limited to personal-scale ranged weapons (`weaponSupportsOptions`): melee (blade/whip/hand-to-hand skill, or a reach-1..2 range), thrown ("T" range) and mecha-scale weapons don't get the options UI, and the attack resolver ignores any options left on a weapon that no longer qualifies.
- Grenade blast radius is automated. Weapons gained `blastRadius` (metres, 0 = single target) and `blastEffect` (`damage` / `perLocation` / `sleep`), editable on the weapon Item sheet. When a blast weapon hits (or its damage button is pressed) with exactly one token targeted as the point of impact, every token within the radius (measured centre to centre in scene units -- scenes are expected to use metres; the card warns otherwise -- thrower included) is affected: Frag rolls one damage roll for the whole blast and each target rolls its own hit location and soaks it through that location's SP; Incendiary rolls 1D6 separately on EVERY location of every target, each soaking through that location's SP, and sets the target burning (see below); Sleep has each target roll a Stun/Shock save at -3 (1d10 <= Stun - 3 stays awake) and applies the core "sleep" status on a failure. A miss produces no blast. Damage applies to other actors' tokens, so non-GM players without permission get a "GM must apply this one" line for those targets. The catalog's `/6m` damage suffix (not valid dice notation) is replaced by plain rolls: Frag `5D6`, Incendiary `1D6`, Sleep no damage. Re-run the weapons pack macro to update the compendium entries.
- Incendiary burning: each burning location takes HALF the damage it took the round before (rounded down, straight to Hits since it's already past armor) at the start of every new combat round, and stops once that would be under 1; the actor carries the core "burning" status while any location is alight. State lives in the actor flag `mekton-fusion.burning` (location -> last damage) and is advanced by `MektonActorSheet.tickBurning` from an `updateCombat` hook on the active GM's client (all burning tokens on the combat's scene, whether or not they're combatants). Setting fire again keeps the higher value per location. There's no put-out action yet -- clear the flag/status by hand.
- 2-Barrel Shotgun damage is now plain `2D10` (was `2D10x2`; in Foundry's dice notation `x2` means "explode on 2", so it silently rolled the wrong thing) with its two-rounds-at-the-same-target-per-action rule moved into the weapon's note; roll damage twice. Re-run the weapons pack macro to update the compendium entry.
- Thrown weapons (Boomerang, Shuriken, Frag/Incendiary/Sleep Grenade) now use the Athletics skill in the weapons catalog (previously `blade` or blank), the Combat tab's skill dropdowns gained Athletics, and the attack resolver maps it to the Athletics skill. Re-run `macros/build-weapons-pack.macro.js` to update the compendium entries.
- Weapon Options can't push a weapon's WA past the ceiling: 2 for projectile/energy/melee weapons, 3 for missiles (`effectiveCombatWa`, `weaponWaCap`). E.g. an Automag (WA 1) with a Smartgun (+2 at Combat Range) resolves at WA 2, not 3. Only the bonus is capped -- a weapon already at/above the ceiling keeps its own WA and penalties (Optical Scope) still apply. The attack card notes "capped", and the Item sheet's Effective panel shows the capped value. Every personal-scale catalog weapon falls under the 2 ceiling; the missile ceiling keys off a "missile" skill that no personal weapon uses yet.
- Roll/attack dialogs (Stat, Skill, weapon Attack) got a compact style (`mekton-fusion-dialog`): smaller text and checkboxes, a two-column Cover/LOS list, and the Difficulty block stacked vertically instead of squeezed into one row.
- Stats tab BODY panel: Lift is labelled kg and Throw m.
- Stats tab MA block now shows units: Run, Walk and Swim are hexes and each gets a second read-only box with the distance in meters (1 hex = 3 m; new `hexToM` helper); Leap, Running Jump and Anime Leap are labelled m. Run/Walk/Swim are now listed together, ahead of the meter-based ones.
- Stats tab: the REF panel title is now an `<h4>` like BODY and MA, so all three headings share one font size (it was an unstyled `<h5>` rendering at Foundry's default).
- Stability substat on the Stats tab (derived, read-only): COOL x 2.5 rounded down -- the Difficulty Number for Interrogation, Intimidation, Leadership and Seduction rolls made against the character (not Persuasion). COOL 2 -> 5, 6 -> 15, 8 -> 20, 10 -> 25. Exposed as `system.derived.stability`.
### Removed
- Death Save and Carry (Cyberpunk 2020 substats, not Mekton Zeta) removed from the Stats tab's BODY panel and dropped from the `substats` schema (`death`, `carry`); nothing else read them. Stored values on existing actors are dropped by the DataModel on next save.
### Fixed
- The Combat tab's standalone damage-roll button failed with "Invalid damage formula" on any damage ending in "+" (e.g. Battleaxe `2D10+`): it fed the raw string to Foundry's `Roll`, which rejects the trailing "+" (the BODY TYPE damage-mod marker). Both it and the attack resolver now share `_rollDamageFormula`, which strips the "+" and adds the BODY damage mod (flat or dice), and the chat card shows the breakdown.
- Weapon Options checkboxes looked dead on compendium weapons: a locked compendium sheet renders every control disabled. The Options section now says so and points at the character-side button.
- Removing/deleting armor left its SP stuck on the body location; overlapping armor overwrote each other (last-equipped won regardless of SP); and the equip stamp and manual SP adjust fought over `sp`. All three follow from the derived model above.
- Creature presets still set `spMax`/`sp` directly (natural armor). Creatures are assumed not to wear armor Items; if one does, the next armor change recomputes over its natural SP.

## [0.3.6] - 2026-09-23
### Added
- Mecha Loadouts compendium (`packs/mecha-loadouts`): the existing NPC/mook presets (Vesper-class Skirmisher, Bulwark-class Assault, Dire Wolf -- `MECHA_PRESETS`/`CREATURE_PRESETS`) are now also available as draggable Items. Dragging one onto a character sheet stamps its build directly onto that actor's Mecha (or Creature) section -- the exact same effect as the Mecha/Body tabs' "Load Preset" pickers, just sourced from a compendium Item instead of a dropdown, with the same overwrite-confirmation prompt first. A dropped loadout is never added as an inventory Item; it applies and discards. New `mecha-loadout` Item type (`MechaLoadoutDataModel`) wraps a preset's data as-is, so both stay in sync if a preset's construction changes. Built via `macros/build-mecha-loadout-pack.macro.js` / `module/build-mecha-loadout-pack.js`, same in-world pattern as the weapons/armor packs.
### Fixed
- Weapon Items had an `isMecha` flag and a per-weapon `note` field used throughout the codebase (`_onCreateWeapon`, the drag-drop `isMecha:overMecha` override, `weapon-catalog.js`, the Combat tab's human/mecha table split, the per-row note input) -- but neither was ever actually declared in `WeaponDataModel`'s schema. Foundry's `DataModel` silently strips any key not in its schema, so both fields always persisted as blank/false regardless of what was set: every weapon Item always rendered in the Combat tab's human table (the mecha-vs-human drop targeting from 0.3.2 never actually worked), and per-weapon notes never saved. Declared both fields.
- `mecha-weapons.js`'s `autocannon` entry had Cost and Space transposed (6/5 instead of the book's 5/6) -- verified against a book worked example (`rocketLauncher` and `heavyAutocannon` both matched as-is). Affects every mech using Autocannon.
- `mecha-presets.js`'s `padTo()` helper (pads a preset's servos/weapons/shields/movement arrays up to the sheet's default slot count) also silently truncated any preset with MORE rows than that default via `.slice(0, len)` -- would have dropped any armament rows beyond the first 4. The sheet's `{{#each}}` weapon/shield/movement tables render however many rows exist (no hard schema max), so this was a pure, unnecessary data-loss bug for any preset richer than the current defaults; now only pads up, never truncates.
- `ARM_EXTREMITIES.claw` had `manipulation: true` -- the book's ARM EXT. table lists Manipulation as "Yes" only for Hand; Claw/Talon/Pincer are all "No". Not yet read anywhere else in the codebase, so no behavior actually changed, but it's now correct ahead of anything relying on it.

## [0.3.3] - 2026-09-22
### Added
- Situational Modifiers (Interlock): a collapsible checklist of 19 book modifiers (Complex repair +2, Very complex repair +4, Wounded +2, Under attack or stress +3, etc.) added to the shared Difficulty Preset block used by the Stat roll, Skill roll, and weapon attack dialogs. Checking any of them adds its value on top of the chosen Difficulty Preset (or a custom base number) -- the actual Difficulty passed to the roll is always base + checked modifiers, recomputed live as the GM fills out the dialog (`_bindDifficultyPresetListeners`, wired via `Dialog.prompt`'s `render` option so it's live while the dialog is open, not just after it resolves).
- Personal armor compendium ("Personal Armor (MZ)", `packs/armor-personal`): 17 items transcribed from the Mekton Zeta Personal Armor Table (Ballistic Mesh, Full Utility Helmet, Multi-Polymer Plate, Space Suit, Other Armor), each with a real, verified icon from Foundry's own bundled art. Personal Force Screen's SP ("3D6" in the book, not a flat value) is captured as-is in a new `spNote` field rather than fabricating a number -- `sp` starts at 0 for the GM to roll once and fill in. Source data lives in `module/data/armor-catalog.js` with the same in-world macro pattern as the weapons pack (`macros/build-armor-pack.macro.js` / `module/build-armor-pack.js`).
- Armor coverage (`module/data/armor-coverage.js`, `ARMOR_COVERAGE`): the Sample Armor Coverage table's garment shapes (Hat/Vest/Jacket/Overcoat/Pants/Shorts/Boots), each fixed to the hit-zone(s) it actually protects, plus `all` (every zone including head -- Space Suit, Powered Armor, both Force Screens) and `handheld` (Shield -- not tied to a zone). "Single"-location armor (Ballistic Mesh, Multi-Polymer Plate) is bought as an SP tier but worn as any garment shape -- the same "Medium Mesh" could be a shirt on one character and pants on another -- so coverage lives on the Item (`system.coverage`), editable on the armor Item sheet, not fixed by the catalog entry. Full Utility Helmets are the one exception: always `hat` (head-only), matching the book.
- Armor Item schema fleshed out: `category`, `sp`, `spNote`, `coverage`, `weight`, `cost`, `tl` -- replacing the two placeholder fields (`armorValue`, `bodyLocation`) that nothing in the codebase actually read.
- The standalone armor Item sheet now has an actual form (Category/SP/SP Note/Coverage/Weight/Cost/TL/Notes). Previously armor items, like weapons before 0.3.2, showed no fields at all.
- Dropping an armor Item onto the actor sheet now equips it: its `coverage` fixes which hit-zone(s) it stamps SP onto (a Jacket always covers Torso+Arms, a Hat always covers Head, etc, per the book), so it doesn't matter where on the sheet it's actually dropped -- same as a weapon drop.
### Fixed
- The armor drop handler had always read `item.system.sp`, a field the Armor schema never actually defined (it only had `armorValue`/`bodyLocation`) -- so any armor ever dragged onto the body paperdoll silently equipped at 0 SP. Fixed as part of fleshing out the real schema above.
- Armor drops did nothing at all: the equip logic lived in its own jQuery-bound `drop` listener calling `TextEditor.getDragEventData(event)`, but jQuery's Event wrapper doesn't copy over `.dataTransfer` (only `event.originalEvent.dataTransfer` has it), so that call always silently returned `{}` and the handler bailed out with no error. Rewired armor equipping into the existing `_onDropItem`/`_onDropItemCreate` override (the same pipeline that already reliably creates dropped weapon Items, using Foundry's native DragEvent dispatch) instead of a second, independently-bound listener.

## [0.3.2] - 2026-09-22
### Added
- Personal weapons compendium ("Personal Weapons (MZ)", `packs/weapons-personal`): 46 human-scale weapons transcribed from the Mekton Zeta Personal Weapons Table (Melee, Archery, Handguns, SMGs, Rifles, Shotguns, Heavy Weapons), each with a real, verified icon from Foundry's own bundled art. The 4 Mekton-scale K-damage anti-mek entries (Anti-Mecha Mine, Anti-Mek Beamgun, Anti-Mek Missile, Armor-Buster Rifle) are deliberately excluded -- they can't resolve against `body.locations` hits until the scale-conversion system exists. Source data lives in `module/data/weapon-catalog.js` (plain, reviewable) with two ways to (re)build the pack from it: `macros/build-weapons-pack.macro.js` (in-world, no tooling needed -- writes straight into the registered system pack) and `scripts/build-packs.mjs` (Node + `@foundryvtt/foundryvtt-cli`, for CI/release builds).
- Archery skill (REF), seeded onto new actors alongside the other personal-combat skills; added to both Combat tab weapon-skill dropdowns and the attack resolver's skill map.
- Weapon Item schema gained `conc`, `weight`, `cost`, `ammoCost` (price per reload/clip), `tl`, and `damageNote` (mirrors the mecha-weapon field), plus a reserved `scale` field (on both the actor root and weapons) for the future scale-conversion system -- unused for now, just avoids a live migration later.
- Drag-and-drop: dropping a weapon Item onto the actor sheet now works (`_onDropItem`/`_onDropItemCreate` overrides) and forces `isMecha:false` so a dropped catalog weapon lands in the human Combat tab table unless dropped directly over the mecha combat section.
- The standalone weapon Item sheet (opened from a compendium or the sidebar) now has an actual form -- WA/Range/Damage/Damage Note/Shots/BV/Skill/Concealability/Weight/Cost/Ammo Cost/TL/Notes/Mecha checkbox. Previously it only showed the name field for any non-skill item type.
### Changed
- `shots` is now a string field (was numeric), matching `range`/`damage`/`bv` -- required to hold values like "na", "10 turns", or "40D6" (energy charge) without coercion. The Combat tab's shots input changed from `type="number"` to `type="text"` to match (a number input physically rejects non-numeric text).
- Pre-production cleanup: with no actor data to preserve, removed the `mektonHp`-era migration function, the dead "seed a default body model" and "ensure substats exists" guards, and the legacy `system.abilities` -> `system.stats` migration -- all three were only ever reachable for a data shape the DataModel schema now makes structurally impossible.
### Fixed
- Weapon Item sheets (compendium or otherwise) showed no data in any field -- `getData()` never set `context.system`, the same quirk already worked around in the actor sheet. Every `{{system.*}}` binding in the weapon form was resolving to undefined regardless of the item's actual data.
- Dragging anything onto the actor sheet did nothing: a custom `_onDrop(ev)` method (used for reordering PSI skill rows) was shadowing Foundry's own base `ActorSheet._onDrop`, which is what Foundry's core DragDrop system calls on every drop, anywhere on the sheet, to dispatch to `_onDropItem`. Renamed to `_onPsiSkillDrop` so the base method dispatches correctly again; this bug predated the compendium work and had likely broken all item drag-drop from the start.
- Weapon icons: two earlier attempts used unverified asset paths (broken images) or a single generic fallback (all weapons showing the same icon). Every one of the 46 catalog entries now points at a path confirmed to exist by listing the actual Foundry install's `public/icons/weapons/` tree.

## [0.3.0] - 2026-09-22
### Added
- Human-scale attack resolver (Mekton Zeta core Interlock rules, not CP2020/IU): the Combat tab's weapon roll now opens a dialog (range Combat/Max, aim 0-4, the 8 MZ cover/LOS toggles, a free "Other" modifier, optional GM Difficulty) and resolves `1d10(exploding) + skill + WA + mods` in one roll. On a hit (or no Difficulty given), the same chat card continues into damage: rolls the weapon's damage formula (a trailing `+` adds the attacker's BODY TYPE damage mod, flat or dice, regardless of weapon type or range), rolls hit location (1d10 vs the Human Random Hit Chart), subtracts the target's location SP, and applies the remainder to that location's `hits` -- flat to every location including the head (no head-doubling, no 12-point cap; both are BTM-coupled CP2020/IU rules Mekton Zeta doesn't have). Damage only ever applies to `game.user.targets`, never the attacker; with 0 or 2+ tokens targeted it posts the rolled numbers plus an "Apply to targeted token" button instead of guessing. A Stun/Shock save (1d10 <= `substats.stun`) fires automatically when a single hit's post-armor damage exceeds half the location's hits before the hit. The standalone per-weapon damage-roll and hit-location-roll buttons remain as manual overrides; opposed melee/Evade/Parry to-hit stays deferred to a later pass.
### Changed
- Body/Mekton hit points renamed from `mektonHp`/`mektonHpMax` to `hits`/`hitsMax` (and the unused top-level `system.hp` plus per-location `hp`/`hpMax` dropped entirely) to match Mekton Zeta's actual wound model: per-location Hits going negative, no BTM, no wound ladder, no single HP pool. `hits` can now go below 0 (the negative-Hits death/severed tiers); `hitsMax` stays BOD-derived. Existing actors migrate automatically (`mektonHp` -> `hits`, old fields unset); brand-new actors now start every location at full `hits` (`hitsMax`) via a `preCreateActor` hook, instead of a flat schema default that ignored BOD.
- Consolidated three overlapping hit-location-roll code paths (only one was ever actually reachable -- later class methods silently override earlier ones with the same name) into one static `_rollHitLocationKey()` helper plus a single `_onRollHitLocation` handler, which now also flashes the rolled zone on the Body tab paperdoll.
- Body tab's heal/damage quick-actions (+/- buttons, the SDP adjust field) now target `hits`/`hitsMax`: healing clamps at `hitsMax`, damage has no floor (can go negative).
### Fixed
- Powerplant cost is now verified (ATM p.68): Charge's cost modifier and Source's cost factor combine into ONE multiplier -- Charge x Source -- rather than being two separate terms, and Source is no longer excluded from total Cost. Worked example: Hot Overcharged Combustion = 0.15 x 0.67 = 0.1. **This changes every mech's derived Cost** wherever a Powerplant is set. `mecha-cost.js`'s `collectMultipliers()` now takes a single `powerplantMult` instead of separate `chargeMod`/`sourceContribution` params. Mecha tab's Powerplant section relabels "Source (unverified)" to "Source" (now a cost factor, not a raw table value) and adds a "Powerplant Mult." field showing the combined value that's actually included in Cost.
- Initiative Mod (MV): fixed a race between Foundry's own `submitOnChange` full-form-submit and the duplicate-input sync script (the field is shown on both the Stats and Mecha tabs) that could silently revert an edit back to its previous value. The two inputs no longer carry a form `name` (they use `data-name` instead) and persist solely through the existing debounced handler, removing the race entirely.
- `system.mecha.subassemblies.items[].variant` (the Anti-theft Code Lock alarm checkbox) failed actor validation ("may not be undefined") on any actor whose subassembly items array fell back to its schema default -- `BooleanField` doesn't tolerate a missing value the way `StringField`/`NumberField` do. Fixed by marking it `required: false`.

## [0.2.2] - 2026-09-21
### Removed
- Snaggletooth tab removed entirely -- it was an exact duplicate of the Mecha tab's construction/combat schema and no longer served a purpose. Dropped its template, its `system.snaggletooth` DataModel schema block, its `_deriveMecha()` call, the tab nav entry + body slot, and all `data-mech="snaggletooth"` branch points in roll/preset-loader logic (those now go straight to `system.mecha`). No migration script; any existing actor's `system.snaggletooth` data is dropped by the DataModel on next save (same precedent as the Witcher tab removal, CHANGELOG 0.1.11).

## [0.2.1] - 2026-09-20
### Added
- Flight MA now pre-fills (all three configs) from the sum of the mech's thruster `targetMA` values whenever it's at its unset default (0) -- mirrors the existing Land MA hint. GES-type propulsion is excluded since it's priced as ground-hugging movement, not true flight. Still a plain manual/editable field afterward.
### Changed
- README overhauled to match actual project state: version banner, Current Feature Set, and Actor Data Schema now describe the real Mecha/Snaggletooth/Creature/Powerplant/Cost-engine system instead of the original v0.0.x stats-only scaffold. Roadmap table replaced with a "what's still ahead" list pointing at CHANGELOG.md, since development didn't follow the old linear phase table. Known Gaps and the Development Layout file tree updated to match the current `module/data/mecha-*.js` split.

## [0.2.0] - 2026-09-18
### Added
- NPC/mook presets (`mecha-presets.js`): Vesper-class Skirmisher and Bulwark-class Assault mecha, plus a Dire Wolf creature. A "Load Preset" picker on the Mecha and Snaggletooth tabs stamps a preset's selection keys (servos/armament/shields/movement/powerplant) into that mech's arrays; the existing derive pipeline fills all computed cells. Overwrites the current loadout, so it's confirmed first.
- Body tab gained a CREATURE section (non-mecha NPCs): a Load Preset picker, Body Plan reference field, Natural Armor SP, and a 4-row Natural Weapons table, following the character body-plan/enemy model rather than mecha construction.
- SUBASSEMBLIES row is now a real picker (`mecha-options.js`'s 10 optional extras -- Damage Control, Ejection Seat, Storage Module, Weapon Linkage, etc.) deriving Cost and Space instead of manual entry; an Alarm checkbox selects Anti-theft Code Lock's costMax variant. Space now counts toward the Space Used by Location rollup (previously subassembly items only contributed Cost/Kills).
- POWERPLANT section (Mecha/Snaggletooth tabs) replaces the old placeholder "Cost Multipliers" text fields: Charge and Source pickers derive Explosion Save and a cost multiplier contribution; a Hot toggle switches to the "if Hot" table column.
- Unified cost engine (`mecha-cost.js`): mech Cost is now Base Cost (sum of every additive system -- servos/armor, weapons, shields, sensors, cockpit, subassembly options, movement systems) x (1 + sum of multiplier values), rounded to the nearest 0.1, instead of a flat sum. Powerplant Charge's cost modifier feeds the multiplier sum directly; Source's contribution is unverified against a worked book example, so it's computed and shown read-only ("Source (unverified)") but deliberately excluded from the total until confirmed. A manual "Other Mult." field covers systems not modeled yet (transformation forms, stealth, etc.).
### Changed
- Weapons array bumped from 3 to 4 slots and Shields from 1 to 2 (both mechs), so the verified presets fit; the Shields table is now a repeating row like Armament instead of a single hardcoded row. Movement Systems bumped from 2 to 3 slots for the same reason. Subassembly items bumped from 1 to 4 slots.
- Armament table: Roll column narrowed (was forced ~100px wide by a stale min-width rule) and Weapon column widened; Category now shows short abbreviations (Beam/Proj/Msl/Melee/E.Melee) instead of full labels to free up space for Weapon.
- Land MA now pre-fills from the tonnage-based Ground MA hint whenever it's at its unset default (0), across all three configs; still a plain manual/editable field afterward, and 0 always re-suggests the hint rather than locking in as "no movement."
### Fixed
- Roll column on the Armament table was min-width 100px, squeezing Category/Weapon into a few characters.

## [0.1.15] - 2026-09-18
### Changed
- Movement Systems section moved from beside Sensors (left column) to under Shields (right column); dropped its Kills (K) column.
- Sensors is now two independent slots (Main and Backup are separate purchases, not an either/or pick) instead of one, each with its own Type/Loc/Range/Comm and derived Kills/Cost/Space/Weight, both counted toward the mech's totals. Laid out as two value columns (Sensor 1 / Sensor 2) against the same attribute rows, not two stacked row-tables.
- Armament roll button reworked into a single `_onRollWeapon` entry point that dispatches to the Combat tab's Item-based weapon roll or the Mecha tab's Armament-row roll (1d10 + MR + Mecha skill by weapon category + WA), instead of two separate, differently-named handlers. The Mecha roll's chat message now also shows Damage/Shots/Loc pulled from the weapon row.
- Mecha Combat Skills panel and its skill roll now read the real derived MR (`system.mecha.config.mr` / `system.snaggletooth.config.mr`, per mech) instead of a stale REF + Initiative-Mod calculation that always showed 0.
### Fixed
- Initiative Mod (MV) box on the Mecha tab confirmed intentionally manual (wound-penalty entry) and left untouched after a prior pass mistakenly wired it to derived MR.

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
