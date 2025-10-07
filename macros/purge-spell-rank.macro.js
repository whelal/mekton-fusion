// Macro: Purge legacy per-spell rank values from all spell items on all actors
// Run as a FoundryVTT macro (GM only)
for (const actor of game.actors.contents) {
  const spells = actor.items.filter(i => i.type === 'spell' && i.system?.rank !== undefined);
  for (const spell of spells) {
    await spell.update({ 'system.rank': null });
    console.log(`Purged rank from spell '${spell.name}' on actor '${actor.name}'`);
  }
}
ui.notifications.info('Legacy per-spell rank values purged from all actors.');
