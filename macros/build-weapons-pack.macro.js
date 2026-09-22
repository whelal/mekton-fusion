// Mekton Fusion: Build Weapons Pack macro
// Drop this into a Script Macro (or load via hotbar) to (re)populate the
// system-bundled "Personal Weapons (MZ)" compendium from
// module/data/weapon-catalog.js. Requires GM permissions (it unlocks the
// pack to write, then relocks it if it was locked). Safe to re-run after
// editing the catalog -- existing entries update in place by name.
(async () => {
  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/build-weapons-pack.js");
  try {
    ui.notifications.info("Building Personal Weapons (MZ) compendium…");
    const { buildWeaponsPack } = await import(`${modulePath}?v=${game.system.version}`);
    if (typeof buildWeaponsPack !== "function") throw new Error("buildWeaponsPack export missing");
    const { created, updated, total } = await buildWeaponsPack();
    ui.notifications.info(`Weapons pack ready: ${created} created, ${updated} updated (${total} total).`);
  } catch (err) {
    console.error("Mekton Fusion | Weapons pack build error", err);
    ui.notifications.error(`Weapons pack build failed: ${err.message ?? err}`);
  }
})();
