// Mekton Fusion: Update Characters macro
// GM-only. Brings every character and NPC in the world up to the current
// system: adds newly added CP2020 skills, fixes the skill on owned catalog
// weapons, converts armor to the 8-zone coverage format (0.3.24), and
// recomputes body-location armor SP from worn armor. Ranks and
// your own edits are kept. Creatures with natural armor are skipped for the
// armor step. Back up the world first (Setup > Backup) since this writes to
// every actor.
(async () => {
  if (!game.user.isGM) { ui.notifications.warn("Only a GM can update characters."); return; }
  const confirmed = await Dialog.confirm({
    title: "Update all characters?",
    content: `<p>This updates every character and NPC in the world: adds new skills, fixes weapon skills, converts armor to zone coverage, and recomputes armor SP.</p>
      <p><strong>Note:</strong> body locations with no worn armor drop to 0 SP (previously they showed the schema default of 10). Creatures keep their natural armor. Back up the world first.</p>`
  });
  if (!confirmed) return;

  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/migrate-actors.js");
  try {
    ui.notifications.info("Updating characters…");
    const { migrateAllActors } = await import(`${modulePath}?v=${game.system.version}`);
    const r = await migrateAllActors();
    const skipped = r.skippedCreatures.length ? ` Skipped creatures (natural armor): ${r.skippedCreatures.join(", ")}.` : "";
    ui.notifications.info(`Updated ${r.actors} actors: ${r.skillsAdded} skills added, ${r.weaponsFixed} weapon skills fixed, ${r.armorMigrated} armor pieces converted, armor recomputed on ${r.armorRecomputed}.${skipped}`);
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
