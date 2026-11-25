// Mekton Fusion: Update Characters macro
// GM-only. Brings every character and NPC in the world up to the current
// system: cleans up the skill list once per actor (removed skills go only at
// rank 0 with no IP; renames keep rank and IP; psionic skills get group and
// cost), adds newly added CP2020 skills, fixes the skill on owned catalog
// weapons and sets their damage type (0.3.29) and Quick (0.3.31) once, converts armor to the
// 8-zone coverage format (0.3.24), moves armor wear from body locations onto
// each worn piece (0.3.28), clears the leftover location SP of 10 from
// unarmored locations on non-creatures (0.3.39, once per actor), and
// recomputes body-location armor SP from worn armor -- for world actors and for unlinked tokens on every scene (their
// skill cleanup, weapon and armor steps; new skills are added to world actors only). Ranks and
// your own edits are kept. Creatures with natural armor are skipped for the
// armor step. Back up the world first (Setup > Backup) since this writes to
// every actor.
(async () => {
  if (!game.user.isGM) { ui.notifications.warn("Only a GM can update characters."); return; }
  const confirmed = await Dialog.confirm({
    title: "Update all characters?",
    content: `<p>This updates every character and NPC in the world: cleans up the skill list (unused removed skills deleted, ranked ones kept and listed), adds new skills, fixes weapon skills, damage types and Quick, moves weapons off Martial Art, converts armor to zone coverage, moves armor wear onto each worn piece, and recomputes armor SP.</p>
      <p><strong>Note:</strong> on characters and NPCs without creature natural armor, body locations with no worn armor drop to 0 SP (the old schema default of 10 had been counting as natural armor). You'll get a whispered list of the actors changed. Creatures keep their natural armor. Back up the world first.</p>`
  });
  if (!confirmed) return;

  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/migrate-actors.js");
  try {
    ui.notifications.info("Updating characters…");
    const { migrateAllActors } = await import(`${modulePath}?v=${game.system.version}`);
    const r = await migrateAllActors();
    const skipped = r.skippedCreatures.length ? ` Skipped creatures (natural armor): ${r.skippedCreatures.join(", ")}.` : "";
    ui.notifications.info(`Updated ${r.actors} actors: ${r.skillsAdded} skills added, ${r.weaponsFixed} weapons fixed, ${r.iconsUpdated} item icons updated, ${r.armorMigrated} armor pieces converted (${r.armorSeeded} given per-zone SP), wear moved onto pieces at ${r.wearMoved} locations, ${r.tokens} unlinked tokens checked, armor recomputed on ${r.armorRecomputed}.${skipped}`);
    if (r.martialArtWeapons.length) {
      const list = r.martialArtWeapons.map(p => `<li>${foundry.utils.escapeHTML(p)}</li>`).join("");
      ChatMessage.create({ whisper: [game.user.id], content: `<p><strong>Weapons moved from Martial Art to Hand to Hand</strong> (Martial Art is unarmed-only):</p><ul>${list}</ul>` });
    }
    if (r.locationSPCleared.length) {
      const list = r.locationSPCleared.map(p => `<li>${foundry.utils.escapeHTML(p)}</li>`).join("");
      ChatMessage.create({ whisper: [game.user.id], content: `<p><strong>Leftover location SP set to 0</strong> (no armor piece there, no creature natural armor):</p><ul>${list}</ul>` });
    }
    if (r.customRemarked.length) {
      const list = r.customRemarked.map(p => `<li>${foundry.utils.escapeHTML(p)}</li>`).join("");
      ChatMessage.create({ whisper: [game.user.id], content: `<p><strong>Custom skills re-marked</strong> (their custom marker had been lost on save):</p><ul>${list}</ul>` });
    }
    if (r.skillsDeleted || r.skillsRenamed) {
      ui.notifications.info(`Skill list cleanup: ${r.skillsDeleted} unused skills removed, ${r.skillsRenamed} renamed.`);
    }
    if (r.skillsKept.length) {
      const list = r.skillsKept.map(p => `<li>${foundry.utils.escapeHTML(p)}</li>`).join("");
      ChatMessage.create({ whisper: [game.user.id], content: `<p><strong>Removed skills kept</strong> (they have ranks or IP; delete them by hand if unwanted):</p><ul>${list}</ul>` });
    }
    if (r.worldSkillChanges.length) {
      const list = r.worldSkillChanges.map(p => `<li>${foundry.utils.escapeHTML(p)}</li>`).join("");
      ChatMessage.create({ whisper: [game.user.id], content: `<p><strong>World skill items (CP2020 Skills folder)</strong>:</p><ul>${list}</ul>` });
    }
    if (r.armorProblems.length) {
      const list = r.armorProblems.map(p => `<li>${foundry.utils.escapeHTML(p)}</li>`).join("");
      ChatMessage.create({ whisper: [game.user.id], content: `<p><strong>Armor the migration couldn't map</strong> (fix on the item sheet):</p><ul>${list}</ul>` });
    }
    console.log("mekton-fusion | Character update report", r);
  } catch (err) {
    console.error("Mekton Fusion | Character update error", err);
    ui.notifications.error(`Character update failed: ${err.message ?? err}`);
  }
})();
