// Mekton Fusion: Generate Mooks macro
// GM-only. Opens the same dialog as the "Generate Mooks" button in the Actors
// sidebar: copies a template NPC from the mook template folder (default
// "Mook Templates"; a system setting) into fresh, separate world actors in a
// folder (default Mooks/<template name>), optionally placing their tokens on the
// current scene.
(async () => {
  if (!game.user.isGM) { ui.notifications.warn("Only a GM can generate mooks."); return; }
  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/mook-generator.js");
  try {
    const { openMookGenerator } = await import(`${modulePath}?v=${game.system.version}`);
    await openMookGenerator();
  } catch (err) {
    console.error("Mekton Fusion | Mook generator error", err);
    ui.notifications.error(`Mook generator failed: ${err.message ?? err}`);
  }
})();
