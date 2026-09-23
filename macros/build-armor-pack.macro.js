// Mekton Fusion: Build Armor Pack macro
// Drop this into a Script Macro (or load via hotbar) to (re)populate the
// system-bundled "Personal Armor (MZ)" compendium from
// module/data/armor-catalog.js. Requires GM permissions (it unlocks the
// pack to write, then relocks it if it was locked). Safe to re-run after
// editing the catalog -- existing entries update in place by name.
(async () => {
  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/build-armor-pack.js");
  try {
    ui.notifications.info("Building Personal Armor (MZ) compendium…");
    const { buildArmorPack } = await import(`${modulePath}?v=${game.system.version}`);
    if (typeof buildArmorPack !== "function") throw new Error("buildArmorPack export missing");
    const { created, updated, total } = await buildArmorPack();
    ui.notifications.info(`Armor pack ready: ${created} created, ${updated} updated (${total} total).`);
  } catch (err) {
    console.error("Mekton Fusion | Armor pack build error", err);
    ui.notifications.error(`Armor pack build failed: ${err.message ?? err}`);
  }
})();
