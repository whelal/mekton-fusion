// Mekton Fusion: Build Mecha Loadouts Pack macro
// Drop this into a Script Macro (or load via hotbar) to (re)populate the
// system-bundled "Mecha Loadouts" compendium from
// module/data/mecha-loadout-catalog.js. Requires GM permissions (it unlocks
// the pack to write, then relocks it if it was locked). Safe to re-run
// after editing the catalog -- existing entries update in place by name.
(async () => {
  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/build-mecha-loadout-pack.js");
  try {
    ui.notifications.info("Building Mecha Loadouts compendium…");
    const { buildMechaLoadoutPack } = await import(`${modulePath}?v=${game.system.version}`);
    if (typeof buildMechaLoadoutPack !== "function") throw new Error("buildMechaLoadoutPack export missing");
    const { created, updated, total } = await buildMechaLoadoutPack();
    ui.notifications.info(`Mecha Loadouts pack ready: ${created} created, ${updated} updated (${total} total).`);
  } catch (err) {
    console.error("Mekton Fusion | Mecha Loadouts pack build error", err);
    ui.notifications.error(`Mecha Loadouts pack build failed: ${err.message ?? err}`);
  }
})();
