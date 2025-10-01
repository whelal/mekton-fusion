// Mekton Fusion: Seed Core Data macro
// Drop this into a Script Macro (or load via hotbar) to rebuild default skills and spells.
(async () => {
  const modulePath = foundry.utils.getRoute("systems/mekton-fusion/module/seed.js");
  try {
    ui.notifications.info("Seeding Mekton Fusion core data…");
    const { seedWorldData } = await import(`${modulePath}?v=${game.system.version}`);
    if (typeof seedWorldData !== "function") throw new Error("seedWorldData export missing");
    await seedWorldData();
    ui.notifications.info("Mekton Fusion seeding complete.");
  } catch (err) {
    console.error("Mekton Fusion | Macro seed error", err);
    ui.notifications.error(`Seeding failed: ${err.message ?? err}`);
  }
})();
