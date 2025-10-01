export function registerSystemSettings() {
  game.settings.register("mekton-fusion", "autoSeedOnReady", {
    name: "Auto-seed core data on Ready",
    hint: "Creates Skills (CP2020) and Spells (Witcher) as World Items if missing.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.registerMenu("mekton-fusion", "seedNow", {
    name: "Seed Core Data Now",
    label: "Run Seeding",
    hint: "Create core Skills and Spells as world Items.",
    icon: "fas fa-seedling",
    type: class extends FormApplication {
      async _onSubmit() { await game.settings.set("mekton-fusion", "autoSeedOnReady", true); ui.notifications.info("Seeding…"); await import("./seed.js").then(m => m.seedWorldData()); }
      render() { super.render(false); } // instantly run
    },
    restricted: true
  });
}
