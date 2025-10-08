// module/script/sheets/mekton-fusion.js
import { MektonActorSheet } from "./actor-sheet.js";
import { MektonFusionItemSheet } from "../../module/sheets/item-sheet.js";
import { ActorDataModel } from "../../module/data/actor-data-model.js";
import { syncActorCoreItems } from "../../module/seed.js";

Hooks.once("init", () => {
  console.log("mekton-fusion | init");

  // Homebrew settings (display-only flags to indicate free, not-for-sale status)
  game.settings.register("mekton-fusion", "homebrew.free", {
    name: "Homebrew: Free",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    hint: "This system is provided free of charge and is not sold on marketplaces."
  });

  game.settings.register("mekton-fusion", "homebrew.notice", {
    name: "Homebrew Notice",
    scope: "world",
    config: true,
    type: String,
    default: "This is unofficial, free content referencing third-party game rules. See HOMEBREW_NOTICE.md in the system folder.",
    hint: "Short notice about homebrew policy and references."
  });

  // Register DataModel for all actor types we use
  CONFIG.Actor.dataModels ||= {};
  for (const t of ["character", "npc", "vehicle"]) {
    CONFIG.Actor.dataModels[t] = ActorDataModel;
  }

  // Use namespaced DocumentSheetConfig (no deprecation warning)
  const DSC = foundry.applications.apps.DocumentSheetConfig;

  // Unregister the core Actor sheet (V1) by specifying the class explicitly
  DSC.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);

  // Register our actor sheet
  DSC.registerSheet(Actor, "mekton-fusion", MektonActorSheet, {
    types: ["character", "npc", "vehicle"], // must match system.json actor types
    makeDefault: true,
    label: "Mekton Actor Sheet"
  });

  // Register our item sheet
  DSC.registerSheet(Item, "mekton-fusion", MektonFusionItemSheet, {
    types: ["skill", "spell"], // handle skills and spells
    makeDefault: true,
    label: "Mekton Item Sheet"
  });

  // Initiative - Keep the fallback formula
  CONFIG.Combat.initiative = {
    formula: "1d10 + @system.stats.REF.value + @system.substats.initiative",
    decimals: 0
  };
});

// Auto-seed skills and spells when actors are created
Hooks.on("createActor", async (actor) => {
  if (["character", "npc"].includes(actor.type)) {
    console.log("mekton-fusion | Auto-seeding new actor:", actor.name);
    try {
      const result = await syncActorCoreItems(actor);
      if (result.created > 0) {
        ui.notifications.info(`Added ${result.created} default skills/spells to ${actor.name}`);
      }
    } catch (err) {
      console.error("mekton-fusion | Auto-seeding failed for", actor.name, err);
    }
  }
});

Hooks.once("ready", () => {
  console.log("mekton-fusion | ready");
  
  // Override Combat.rollInitiative to use exploding dice
  if (CONFIG.Combat.documentClass) {
    const originalCombatRollInitiative = CONFIG.Combat.documentClass.prototype.rollInitiative;
    
    CONFIG.Combat.documentClass.prototype.rollInitiative = async function(ids, formula, updateTurn, messageOptions) {
      // Get combatants to roll for
      const combatants = this.combatants.filter(c => ids.includes(c.id));
      
      for (const combatant of combatants) {
        const actor = combatant.actor;
        if (!actor) continue;
        
        try {
          // Use our exploding d10 system
          const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await MektonActorSheet._rollBidirectionalExplodingD10();
          
          // Get REF and initiative modifier
          const refVal = actor.system?.stats?.REF?.value ?? 0;
          const initMod = actor.system?.substats?.initiative ?? 0;
          const finalTotal = base + refVal + initMod;
          
          // Update the combatant
          await combatant.update({ initiative: finalTotal });
          
          // Create chat message
          const plusStr = plusDice.join(' + ');
          const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
          const flavorParts = [`(${plusStr}${minusStr})`, `REF ${refVal}`];
          if (initMod !== 0) flavorParts.push(`Init Mod ${initMod >= 0 ? '+' : ''}${initMod}`);
          
          const explodedUp = plusDice.some(d => d === 10);
          const explodedDown = minusDice.some(d => d === 1);
          let tag = '';
          if (explodedUp && explodedDown) tag = '<span class="exploding">[Exploding Up/Down]</span>';
          else if (explodedUp) tag = '<span class="exploding">[Exploding Up]</span>';
          else if (explodedDown) tag = '<span class="exploding">[Exploding Down]</span>';
          
          const capTag = capped ? ` <span class="exploding cap">[Cap ${maxExtra}]</span>` : '';
          
          const flavor = `<strong>${actor.name}</strong> rolls Initiative ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>`;
          
          const speaker = ChatMessage.getSpeaker({ actor });
          await roll.toMessage({ speaker, flavor });
          
        } catch (error) {
          console.error("mekton-fusion | Error rolling custom initiative for", actor.name, ":", error);
          // Fall back to original for this combatant
          await originalCombatRollInitiative.call(this, [combatant.id], formula, false, messageOptions);
        }
      }
      
      // Sort combatants if requested
      if (updateTurn) {
        await this.update({ turn: 0 });
      }
      
      return this;
    };
  }
  
  // Override individual combatant rollInitiative as backup
  if (CONFIG.Combatant.documentClass) {
    const originalRollInitiative = CONFIG.Combatant.documentClass.prototype.rollInitiative;
    
    CONFIG.Combatant.documentClass.prototype.rollInitiative = async function(formula) {
      const actor = this.actor;
      if (!actor) return originalRollInitiative.call(this, formula);

      try {
        // Use our exploding d10 system
        const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await MektonActorSheet._rollBidirectionalExplodingD10();
        
        // Get REF and initiative modifier
        const refVal = actor.system?.stats?.REF?.value ?? 0;
        const initMod = actor.system?.substats?.initiative ?? 0;
        const finalTotal = base + refVal + initMod;
        
        // Create flavor text showing the breakdown
        const plusStr = plusDice.join(' + ');
        const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
        const flavorParts = [`(${plusStr}${minusStr})`, `REF ${refVal}`];
        if (initMod !== 0) flavorParts.push(`Init Mod ${initMod >= 0 ? '+' : ''}${initMod}`);
        
        const explodedUp = plusDice.some(d => d === 10);
        const explodedDown = minusDice.some(d => d === 1);
        let tag = '';
        if (explodedUp && explodedDown) tag = '<span class="exploding">[Exploding Up/Down]</span>';
        else if (explodedUp) tag = '<span class="exploding">[Exploding Up]</span>';
        else if (explodedDown) tag = '<span class="exploding">[Exploding Down]</span>';
        
        const capTag = capped ? ` <span class="exploding cap">[Cap ${maxExtra}]</span>` : '';
        
        const flavor = `<strong>${actor.name}</strong> rolls Initiative ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>`;
        
        // Create a roll result and send to chat
        const speaker = ChatMessage.getSpeaker({ actor });
        await roll.toMessage({ speaker, flavor });
        
        // Update the combatant's initiative
        await this.update({ initiative: finalTotal });
        return this;
        
      } catch (error) {
        console.error("mekton-fusion | Error in custom initiative roll:", error);
        // Fall back to original method on error
        return originalRollInitiative.call(this, formula);
      }
    };
  } else {
    console.warn("mekton-fusion | CONFIG.Combatant.documentClass not available for initiative override");
  }
  
  // Migration: ensure stats follow { value } shape for new DataModel
  for (const actor of game.actors.contents ?? []) {
    const stats = actor.system?.stats;
    if (!stats) continue;
    let changed = false;
    for (const [k, v] of Object.entries(stats)) {
      if (v !== null && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value')) continue;
      // v is likely a number or malformed object; wrap
      const numeric = (typeof v === 'number') ? v : Number(v?.value ?? v) || 0;
      stats[k] = { value: numeric };
      changed = true;
    }
    if (changed) {
      actor.update({ 'system.stats': stats }).catch(err => console.warn('mekton-fusion | stat migration failed for actor', actor.id, err));
    }
  }
});
