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

// Ensure actor sheet synchronization
Hooks.on("updateActor", (actor, changes, options, userId) => {
  console.log("mekton-fusion | Actor updated:", actor.name, changes);
  console.log("mekton-fusion | Actor ID:", actor.id);
  console.log("mekton-fusion | Update options:", options);
  
  // Find all related actor sheets (including token actors and base actors)
  const sheetsToUpdate = [];
  Object.values(ui.windows).forEach(app => {
    if (app.constructor.name === "MektonActorSheet" && app.rendered) {
      // Check if this sheet belongs to the updated actor
      if (app.actor?.id === actor.id) {
        sheetsToUpdate.push({ app, reason: "direct match" });
      } 
      // For unlinked tokens, also check if they share the same name and base prototype
      else if (app.actor?.isToken && !app.actor?.token?.actorLink && actor.name === app.actor.name) {
        sheetsToUpdate.push({ app, reason: "unlinked token with same name" });
      }
      // Check if this is a base actor that has unlinked token sheets open
      else if (!actor.isToken && app.actor?.isToken && !app.actor?.token?.actorLink && app.actor.name === actor.name) {
        sheetsToUpdate.push({ app, reason: "base actor with unlinked token" });
      }
    }
  });
  
  console.log("mekton-fusion | Found", sheetsToUpdate.length, "sheets to update");
  
  // Update all related sheets
  sheetsToUpdate.forEach(({ app, reason }) => {
    console.log("mekton-fusion | Re-rendering actor sheet for:", app.actor.name, "- reason:", reason);
    app.render(false);
  });
  
  // Also refresh any tokens on the canvas
  if (game.canvas?.tokens?.objects?.children) {
    game.canvas.tokens.objects.children.forEach(token => {
      if (token.document?.actorId === actor.id || 
          (!token.document?.actorLink && token.document?.name === actor.name)) {
        console.log("mekton-fusion | Refreshing token for:", actor.name, "- Link status:", token.document.actorLink);
        token.refresh();
      }
    });
  }
  
  // Use a small delay to ensure the update has propagated
  setTimeout(() => {
    sheetsToUpdate.forEach(({ app, reason }) => {
      if (app.rendered) {
        console.log("mekton-fusion | Delayed re-render for:", app.actor.name, "- reason:", reason);
        app.render(false);
      }
    });
  }, 100);
});

// Handle token updates that should propagate to linked actors
Hooks.on("updateToken", (tokenDocument, changes, options, userId) => {
  console.log("mekton-fusion | Token updated:", tokenDocument.name, changes);
  console.log("mekton-fusion | Token actorLink:", tokenDocument.actorLink);
  console.log("mekton-fusion | Has actor data override:", !!tokenDocument.delta);
  
  // If this token has actor data changes, we need to handle synchronization
  if (changes.actorData || (changes.delta && Object.keys(changes.delta).length > 0)) {
    console.log("mekton-fusion | Token has actor data changes");
    
    const baseActor = tokenDocument.actor;
    if (baseActor) {
      // Force re-render of all actor sheets for the base actor
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "MektonActorSheet" && app.rendered) {
          if (app.actor?.id === baseActor.id || (app.actor?.isToken && app.actor.token?.baseActor?.id === baseActor.id)) {
            console.log("mekton-fusion | Re-rendering actor sheet from token update for:", app.actor.name);
            app.render(false);
          }
        }
      });
    }
  }
  
  // Also handle regular token updates for linked actors
  if (tokenDocument.actorLink && tokenDocument.actor) {
    const actor = tokenDocument.actor;
    console.log("mekton-fusion | Token has linked actor:", actor.name);
    
    // Force re-render of all open actor sheets for this actor
    Object.values(ui.windows).forEach(app => {
      if (app.constructor.name === "MektonActorSheet" && app.actor?.id === actor.id && app.rendered) {
        console.log("mekton-fusion | Re-rendering linked actor sheet from token update for:", actor.name);
        app.render(false);
      }
    });
  }
});

// Handle item creation on actors
Hooks.on("createItem", (item, options, userId) => {
  console.log("mekton-fusion | Item created hook fired:", item.name, "type:", item.type, "on actor:", item.parent?.name);
  
  if (item.parent && (item.type === "skill" || item.type === "spell")) {
    const sourceActor = item.parent;
    console.log("mekton-fusion | Processing item sync for:", item.name, "from actor:", sourceActor.name, "ID:", sourceActor.id);
    
    // Find other actor sheets for the same actor (different sheet instances)
    const allWindows = Object.values(ui.windows);
    console.log("mekton-fusion | Checking", allWindows.length, "windows for related actors");
    
    allWindows.forEach(app => {
      if (app.constructor.name === "MektonActorSheet" && app.rendered && app.actor) {
        console.log("mekton-fusion | Checking app actor:", app.actor.name, "ID:", app.actor.id, "isToken:", app.actor.isToken);
        
        // For linked tokens, both will have the same ID but different isToken status
        if (app.actor.id === sourceActor.id && app.actor.isToken !== sourceActor.isToken) {
          console.log("mekton-fusion | Found linked actor sheet to refresh:", app.actor.name, "isToken:", app.actor.isToken);
          // Just refresh the other sheet since they share the same data
          app.render(false);
        }
      }
    });
  }
});

// Handle item updates on actors
Hooks.on("updateItem", (item, changes, options, userId) => {
  console.log("mekton-fusion | Item updated hook fired:", item.name, "type:", item.type, "changes:", changes, "on actor:", item.parent?.name);
  
  if (item.parent && (item.type === "skill" || item.type === "spell")) {
    const sourceActor = item.parent;
    console.log("mekton-fusion | Processing item update sync for:", item.name, "from actor:", sourceActor.name);
    
    // Find other actor sheets for the same actor (different sheet instances)
    Object.values(ui.windows).forEach(app => {
      if (app.constructor.name === "MektonActorSheet" && 
          app.rendered && 
          app.actor && 
          app.actor.id === sourceActor.id && 
          app.actor.isToken !== sourceActor.isToken) {
        
        console.log("mekton-fusion | Found linked actor sheet to refresh:", app.actor.name, "isToken:", app.actor.isToken);
        // Just refresh the other sheet since they share the same data
        app.render(false);
      }
    });
  }
});

// Handle item deletion on actors
Hooks.on("deleteItem", (item, options, userId) => {
  console.log("mekton-fusion | Item deleted hook fired:", item.name, "type:", item.type, "from actor:", item.parent?.name);
  
  if (item.parent && (item.type === "skill" || item.type === "spell")) {
    const sourceActor = item.parent;
    console.log("mekton-fusion | Processing item deletion sync for:", item.name, "from actor:", sourceActor.name);
    
    // Find other actor sheets for the same actor (different sheet instances)
    Object.values(ui.windows).forEach(app => {
      if (app.constructor.name === "MektonActorSheet" && 
          app.rendered && 
          app.actor && 
          app.actor.id === sourceActor.id && 
          app.actor.isToken !== sourceActor.isToken) {
        
        console.log("mekton-fusion | Found linked actor sheet to refresh:", app.actor.name, "isToken:", app.actor.isToken);
        // Just refresh the other sheet since they share the same data
        app.render(false);
      }
    });
  }
});

// Force synchronization on any actor sheet render
Hooks.on("renderActorSheet", (app, html, data) => {
  if (app.constructor.name === "MektonActorSheet") {
    console.log("mekton-fusion | Actor sheet rendered for:", app.actor.name);
    console.log("mekton-fusion | Is token actor:", app.actor.isToken);
    console.log("mekton-fusion | Actor ID:", app.actor.id);
  }
});

// Handle token actor updates specifically
Hooks.on("updateTokenActor", (tokenActor, changes, options, userId) => {
  console.log("mekton-fusion | Token actor updated:", tokenActor.name, changes);
  
  // This is for unlinked token actors - force refresh of related sheets
  Object.values(ui.windows).forEach(app => {
    if (app.constructor.name === "MektonActorSheet" && app.actor?.id === tokenActor.id && app.rendered) {
      console.log("mekton-fusion | Re-rendering token actor sheet for:", tokenActor.name);
      app.render(false);
    }
  });
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
