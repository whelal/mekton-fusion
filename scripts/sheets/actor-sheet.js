// module/script/sheets/actor-sheet.js
import { MECHA_PRESETS, CREATURE_PRESETS, buildMechaPresetUpdate, buildCreaturePresetUpdate } from "../../module/data/mecha-presets.js";
import { computeWeaponOptionsEffect } from "../../module/data/weapon-options.js";
import { ARMOR_COVERAGE } from "../../module/data/armor-coverage.js";

/**
 * Parse a weapon's Range field. MZ range is Combat-Max (two numbers), a single
 * number, or "T" for thrown -- never a DV ladder, so this only tells the
 * dialog which side of Combat Range the two numbers are, for display.
 * @param {string} str
 * @returns {{thrown:true}|{combat:number,max:number}|null}
 */
function parseRange(str) {
  if (!str) return null;
  if (/^t$/i.test(str.trim())) return { thrown: true };
  const m = String(str).match(/(\d+)\s*[-\/]\s*(\d+)/);
  if (m) return { combat: +m[1], max: +m[2] };
  const n = Number(String(str).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? { combat: n, max: n } : null;
}

export class MektonActorSheet extends foundry.appv1.sheets.ActorSheet {
  // Sort by .system.sort (or .item.system.sort), then by name
  static bySortThenName(a, b, collator) {
    const as = Number(a.system?.sort ?? a.item?.system?.sort ?? 999999);
    const bs = Number(b.system?.sort ?? b.item?.system?.sort ?? 999999);
    if (as !== bs) return as - bs;
    return collator.compare(a.name, b.name);
  }

  _refreshBodyItemIcons() {
    try {
      const locs = this.actor.system?.body?.locations || {};
      const svgel = this.element[0].querySelector('.mf-doll-svg');
      if (!svgel) return;
      const icons = svgel.querySelectorAll('.item-icon');
      icons.forEach(img => {
        const loc = img.dataset.loc;
        const itemId = locs?.[loc]?.itemId;
        if (itemId) {
          const item = this.actor.items.get(itemId);
          img.setAttribute('href', item?.img || '');
          img.style.display = item?.img ? '' : 'none';
        } else {
          img.setAttribute('href', '');
          img.style.display = 'none';
        }
      });
    } catch (e) { console.warn('mekton-fusion | Failed to refresh body item icons', e); }
  }
  constructor(...args) {
    super(...args);
    // Per-tab (skills, psi) view state; loaded from user flag lazily
    this._tabViewState = {
      skills: { favOnly: false, sortBy: 'name', dir: 'asc' },
      psi: { favOnly: false, sortBy: 'name', dir: 'asc' }
    };
    this._viewStateLoaded = false;
  }
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "actor"],
      template: "systems/mekton-fusion/templates/actor/actor-sheet.hbs",
      width: 940,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }],
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      scrollY: [".tab.stats", ".tab.combat", ".tab.skills", ".tab.psi", ".tab.equipment", ".tab.notes"]
    });
  }

  // Utility: coerce to number and strip commas
  static _num(v, fallback = 0) {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v).replace(/,/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }

  // Exploding d10: roll at least once; while a die shows 10, roll again and accumulate.
  // Bidirectional exploding d10:
  //  - Roll initial d10.
  //  - If initial roll is 10: keep rolling while you get 10s, include the final non-10.
  //  - If initial roll is 1: Critical Failure - roll ONE additional d10 and subtract it (no chain).
  // Returns a consolidated Roll (for module parsing) plus breakdown arrays.
  static async _rollBidirectionalExplodingD10() {
    const plusDice = [];
    const minusDice = [];
    const MAX_EXTRA = 10; // cap on additional dice beyond the first
    let extraCount = 0;
    let capped = false;

    // roll helper
    async function rollD10() {
      const r = new Roll('1d10');
      await r.evaluate();
      return r.total || 0;
    }

    // Initial roll determines the explosion direction
    const first = await rollD10();
    
    if (first === 10) {
      // Upward explosion chain - keep rolling while we get 10s, include final non-10
      plusDice.push(first);
      while (extraCount < MAX_EXTRA) {
        const current = await rollD10();
        extraCount++;
        plusDice.push(current); // Always include the die in upward explosion
        if (current !== 10) {
          // Different value rolled - explosion stops, but this die is included
          break;
        }
        if (extraCount >= MAX_EXTRA) {
          capped = true;
          break;
        }
      }
    } else if (first === 1) {
      // Critical Failure - roll ONE additional d10 and subtract it
      plusDice.push(first); // The initial 1 goes in plus dice
      const criticalFailureRoll = await rollD10();
      minusDice.push(criticalFailureRoll); // Subtract the critical failure roll
      extraCount = 1; // Only one extra roll for critical failure
    } else {
      // Normal roll - no explosion
      plusDice.push(first);
    }

    const plusTotal = plusDice.reduce((a,b)=>a+b,0);
    const minusTotal = minusDice.reduce((a,b)=>a+b,0);
    const net = plusTotal - minusTotal;

    // Build a synthetic Roll expression for compatibility: represent all individual dice.
    // Example: (10+10+4) for upward explosion, or (1)-(7) for critical failure
    let formula;
    if (minusDice.length > 0) {
      const plusExpr = plusDice.map(d=>d).join('+') || '0';
      const minusExpr = minusDice.map(d=>d).join('+');
      formula = `${plusExpr}-(${minusExpr})`;
    } else {
      formula = plusDice.map(d=>d).join('+') || '0';
    }
    
    const total = net;
    // Create Roll object from formula (no dice terms, purely numeric) for compatibility
    const roll = new Roll(formula);
    await roll.evaluate();
    // Attach raw arrays for external modules / debugging
    roll.flags ??= {};
    roll.flags['mekton-fusion'] = { plusDice: [...plusDice], minusDice: [...minusDice], capped };
    return { roll, total, plusDice, minusDice, capped, maxExtra: MAX_EXTRA };
  }

  // Basic Difficulty Levels (Interlock): named GM target numbers.
  static DIFFICULTY_LEVELS = [
    { label: 'Easy', value: 10 },
    { label: 'Average', value: 15 },
    { label: 'Difficult', value: 20 },
    { label: 'Very Difficult', value: 25 },
    { label: 'Nearly Impossible', value: 30 }
  ];

  // Some Situational Modifiers (Interlock): added ON TOP of a task's base
  // Difficulty (preset or custom) -- not added to the roll itself, unlike
  // the attack dialog's Cover/LOS modifiers.
  static SITUATIONAL_MODIFIERS = [
    { label: 'Complex repair', mod: 2 },
    { label: 'Very complex repair', mod: 4 },
    { label: "It's never been done before", mod: 6 },
    { label: "Don't have the right parts", mod: 2 },
    { label: "Don't have the right tools", mod: 3 },
    { label: 'Unfamiliar tools, weapon, or vehicle', mod: 4 },
    { label: 'Under attack or stress', mod: 3 },
    { label: 'Wounded', mod: 2 },
    { label: 'Drunk, drugged, or tired', mod: 4 },
    { label: 'In a hostile environment', mod: 4 },
    { label: 'Lack instructions for task', mod: 2 },
    { label: 'Have never tried this before', mod: 1 },
    { label: 'Difficult acrobatics involved', mod: 5 },
    { label: 'Information hidden, secret, or obscure', mod: 3 },
    { label: 'Well hidden clue, secret door, panel, etc.', mod: 3 },
    { label: 'Very complex program', mod: 5 },
    { label: 'Very complex lock', mod: 5 },
    { label: 'Target on guard or alerted', mod: 3 },
    { label: 'Trying to perform secretive task while under close observation', mod: 4 }
  ];

  /**
   * A preset dropdown, a base-difficulty number input, and a collapsible
   * Situational Modifiers checklist, as one self-contained block. The
   * actual submitted value (a hidden `name="difficulty"` input) is always
   * base + sum(checked modifiers), recomputed live by
   * _bindDifficultyPresetListeners() -- callers MUST pass that as
   * Dialog.prompt's `render` option for the checkboxes/preset to do
   * anything; see that method's doc comment for why.
   */
  static _difficultyPresetHtml() {
    const options = this.DIFFICULTY_LEVELS.map(l => `<option value="${l.value}">${l.label} (${l.value})</option>`).join('');
    const modRows = this.SITUATIONAL_MODIFIERS.map(m =>
      `<label style="display:block; font-weight:normal;"><input type="checkbox" class="mf-situational-mod" data-mod="${m.mod}"/> ${m.label} (+${m.mod})</label>`
    ).join('');
    return `
      <div class="mf-difficulty-group form-group">
        <label>Difficulty Preset</label>
        <select class="mf-diff-preset" style="width:100%">
          <option value="">-- Custom --</option>
          ${options}
        </select>
        <label style="display:block; margin-top:6px;">${game.i18n.localize('MF.RollDifficultyPrompt')}</label>
        <input type="number" class="mf-diff-base" placeholder="Optional" style="width:100%"/>
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;">Situational Modifiers</summary>
          <div style="margin-top:4px;">${modRows}</div>
        </details>
        <p class="mf-diff-total-display" style="margin:6px 0 0; font-size:0.85em; color:#666;"></p>
        <input type="hidden" name="difficulty" class="mf-diff-final"/>
      </div>
    `;
  }

  /**
   * Wires up the live recompute for _difficultyPresetHtml()'s markup:
   * picking a preset fills the base-difficulty input, and checking any
   * Situational Modifier adds its value on top of that base -- the hidden
   * `name="difficulty"` input (what every dialog's callback actually reads)
   * is kept in sync with base + checked modifiers on every change.
   *
   * Must run via Dialog.prompt's `render` option, not a callback that runs
   * after the dialog resolves -- these listeners need to be live *while*
   * the GM is still filling the dialog out. (This is also why the earlier
   * preset-only version used an inline onchange scoped to `.mf-difficulty-group`
   * instead of `closest('form')` -- Dialog.prompt's content isn't wrapped in
   * a <form>. Using `render` here sidesteps that whole question by binding
   * real jQuery listeners the normal way, same as activateListeners.)
   */
  static _bindDifficultyPresetListeners(html) {
    const group = html.find('.mf-difficulty-group');
    if (!group.length) return;
    const presetSel = group.find('.mf-diff-preset');
    const baseInput = group.find('.mf-diff-base');
    const finalInput = group.find('.mf-diff-final');
    const totalDisplay = group.find('.mf-diff-total-display');

    const recompute = () => {
      const base = baseInput.val() === '' ? null : Number(baseInput.val());
      let modSum = 0;
      group.find('.mf-situational-mod:checked').each((_, el) => { modSum += Number(el.dataset.mod) || 0; });

      if (base === null && modSum === 0) {
        finalInput.val('');
        totalDisplay.text('');
        return;
      }
      const total = (base ?? 0) + modSum;
      finalInput.val(total);
      totalDisplay.text(modSum ? `Total Difficulty: ${total} (${base ?? 0} base + ${modSum} situational)` : `Total Difficulty: ${total}`);
    };

    presetSel.on('change', () => { baseInput.val(presetSel.val()); recompute(); });
    baseInput.on('input change', recompute);
    group.find('.mf-situational-mod').on('change', recompute);
  }

  // Human Random Hit Chart (body.hbs): 1d10 -> body location key + label.
  static HIT_LOCATION_CHART = {
    1: ['head', 'Head'],
    2: ['torso', 'Torso'], 3: ['torso', 'Torso'], 4: ['torso', 'Torso'],
    5: ['rArm', 'Right Arm'],
    6: ['lArm', 'Left Arm'],
    7: ['rLeg', 'Right Leg'], 8: ['rLeg', 'Right Leg'],
    9: ['lLeg', 'Left Leg'], 10: ['lLeg', 'Left Leg']
  };

  /** Pure hit-location roll: 1d10 vs the Human Random Hit Chart. */
  static async _rollHitLocationKey() {
    const roll = new Roll('1d10');
    await roll.evaluate();
    const [key, label] = this.HIT_LOCATION_CHART[roll.total] ?? ['torso', 'Torso'];
    return { key, label, roll };
  }

  /**
   * MZ Human Damage Results wound state from a location's CURRENT hits (after
   * damage). No BTM, no wound ladder -- just these threshold bands, flat to
   * every location including the head (no head-doubling, no 12-point cap;
   * both are BTM-coupled CP2020/IU rules MZ doesn't have).
   * @param {string} key - head/torso/rArm/lArm/rLeg/lLeg
   * @param {number} hitsNow
   * @returns {"ok"|"unconscious"|"dead"|"broken"|"shattered"|"severed"}
   */
  static _woundState(key, hitsNow) {
    const limb = key !== 'head' && key !== 'torso';
    if (!limb) return hitsNow <= -2 ? 'dead' : hitsNow <= 0 ? 'unconscious' : 'ok';
    return hitsNow <= -5 ? 'severed' : hitsNow <= -2 ? 'shattered' : hitsNow <= 0 ? 'broken' : 'ok';
  }

  static _woundStateLabel(state) {
    return {
      ok: 'OK', unconscious: 'UNCONSCIOUS', dead: 'DEAD',
      broken: 'BROKEN', shattered: 'SHATTERED (lost without care)', severed: 'SEVERED'
    }[state] ?? state;
  }

  /**
   * Apply already-rolled weapon damage to ONE location on the TARGET actor
   * (never the attacker -- caller passes the target explicitly). Damage
   * chain: subtract that location's SP, apply the remainder to hits (may go
   * negative). Flat to every location, head included -- no armor head-double.
   * Also resolves a Stun/Shock save when this single hit's post-armor damage
   * exceeds half the location's hits BEFORE the hit (1d10 <= substats.stun to
   * stay conscious).
   * @param {Actor} targetActor
   * @param {string} key - head/torso/rArm/lArm/rLeg/lLeg
   * @param {number} dmgTotal - rolled weapon damage (+ BODY mod if applicable), pre-armor
   * @returns {{sp:number, before:number, after:number, hitsNow:number, state:string, stun:object|null}}
   */
  static async _applyLocationDamage(targetActor, key, dmgTotal) {
    const loc = targetActor.system?.body?.locations?.[key];
    const sp = MektonActorSheet._num(loc?.sp, 0);
    const before = MektonActorSheet._num(loc?.hits, 0);
    const after = Math.max(0, dmgTotal - sp);
    const hitsNow = before - after;
    await targetActor.update({ [`system.body.locations.${key}.hits`]: hitsNow });

    const state = MektonActorSheet._woundState(key, hitsNow);

    let stun = null;
    if (after > 0 && after > before / 2) {
      const stunVal = MektonActorSheet._num(targetActor.system?.substats?.stun, 0);
      const stunRoll = new Roll('1d10');
      await stunRoll.evaluate();
      stun = { total: stunRoll.total, stunVal, conscious: stunRoll.total <= stunVal, roll: stunRoll };
    }

    return { sp, before, after, hitsNow, state, stun };
  }

  /** Format an _applyLocationDamage() result as the chat-card HTML fragment (SP/hits/state/stun). */
  static _formatDamageAppliedHtml(applied) {
    const { sp, before, after, hitsNow, state, stun } = applied;
    const stateLabel = MektonActorSheet._woundStateLabel(state);
    const stateColor = state === 'ok' ? '#2a2' : '#c0392b';
    let html = `SP ${sp} soaked, ${after} through. Hits: ${before} &rarr; <strong>${hitsNow}</strong> &mdash; <strong style="color:${stateColor}">${stateLabel}</strong>`;
    if (stun) {
      const stunColor = stun.conscious ? '#2a2' : '#c0392b';
      html += `<br>Stun/Shock check (1d10 &le; ${stun.stunVal}): rolled <strong>${stun.total}</strong> &mdash; <strong style="color:${stunColor}">${stun.conscious ? 'CONSCIOUS' : 'DOWN'}</strong>`;
    }
    return html;
  }

  /** @override */
  async _updateObject(event, formData) {
    // Ensure proper data synchronization when updating actor
    console.log("mekton-fusion | _updateObject called with:", formData);
    console.log("mekton-fusion | Actor ID:", this.actor.id);
    console.log("mekton-fusion | Is Token Actor:", this.actor.isToken);
    console.log("mekton-fusion | Actor Link:", this.actor.token?.actorLink);
    
    // Normalize substats to preserve decimal values for run/leap/swim
    try {
      const decimalFields = ['run', 'leap', 'swim'];
      for (const field of decimalFields) {
        const key = `system.substats.${field}`;
        if (formData[key] !== undefined && formData[key] !== '') {
          formData[key] = parseFloat(formData[key]) || 0;
        }
      }
      // Initiative Mod (MV) is intentionally NOT a named form field (see the
      // data-name comment on its inputs in stats.hbs/mecha.hbs) -- it persists
      // through its own dedicated handler instead, so there's nothing to
      // normalize here anymore.
    } catch (e) {
      console.warn('mekton-fusion | Failed to normalize substats before update', e);
    }
    
    // Call the parent method to handle the update
    const result = await super._updateObject(event, formData);
    
    // For unlinked tokens, we need to manually sync with other sheets. Use multiple heuristics
    // (prototype token, token.actorId, fallback name) to avoid false-positive mismatches.
    function likelySameActorInstance(a, b) {
      if (!a || !b) return false;
      if (a.id === b.id) return true;
      // If either has a token document with a recorded actorId that references the other, match
      try {
        const aToken = a.token ?? {};
        const bToken = b.token ?? {};
        if (aToken.actorId && aToken.actorId === b.id) return true;
        if (bToken.actorId && bToken.actorId === a.id) return true;

        // Compare prototype token definitions when available (stringified compare)
        const aProto = a.prototypeToken ?? a.system?.prototypeToken ?? aToken.prototypeToken ?? null;
        const bProto = b.prototypeToken ?? b.system?.prototypeToken ?? bToken.prototypeToken ?? null;
        if (aProto && bProto) {
          try {
            if (JSON.stringify(aProto) === JSON.stringify(bProto)) return true;
          } catch (e) {
            // ignore stringify errors
          }
        }
      } catch (e) {
        console.warn('mekton-fusion | Error comparing actor prototypes', e);
      }
      // Fallback to name match
      return a.name === b.name;
    }

    if (this.actor.isToken && !this.actor.token?.actorLink) {
      console.log("mekton-fusion | Handling unlinked token update - syncing by heuristics");

      // Find other sheets that likely represent the same actor data and manually update them
      Object.values(ui.windows).forEach(app => {
        if (app.constructor.name === "MektonActorSheet" && app.rendered && app !== this && app.actor) {
          if (likelySameActorInstance(app.actor, this.actor)) {
            console.log("mekton-fusion | Manually syncing unlinked actor (heuristic):", app.actor.name);
            // Only sync to other unlinked tokens or to the base actor (not to linked token sheets)
            if ((!app.actor.isToken) || (app.actor.isToken && !app.actor.token?.actorLink)) {
              // Expand the flat form data into nested object, but strip keys that would
              // cause Foundry to try to update embedded Documents (items/token) on
              // a TokenDocument-backed actor. Such updates throw when the target actor
              // is not a proper base Actor document.
              const expanded = foundry.utils.expandObject(formData);
              const disallowedTopLevel = ['items', 'token', 'prototypeToken', 'actor', 'tokenId'];
              for (const k of disallowedTopLevel) {
                if (Object.prototype.hasOwnProperty.call(expanded, k)) {
                  console.debug(`mekton-fusion | Stripping disallowed update key from sync: ${k}`);
                  delete expanded[k];
                }
              }
              // Also ensure we don't accidentally pass an "actor" object nested under token
              if (expanded.token && typeof expanded.token === 'object') {
                delete expanded.token.actor;
                delete expanded.token.actorId;
              }
              app.actor.update(expanded).catch(err => console.warn("mekton-fusion | Failed to sync unlinked actor data:", err));
            }
          }
        }
      });
    } else {
      console.log("mekton-fusion | Standard linked actor update");
    }
    
    // Force refresh of all related sheets
    console.log("mekton-fusion | Forcing refresh of all related sheets");
    Object.values(ui.windows).forEach(app => {
      if (app.constructor.name === "MektonActorSheet" && 
          app.rendered && 
          app !== this &&
          (app.actor?.id === this.actor.id || 
           (app.actor?.name === this.actor.name && !app.actor?.token?.actorLink))) {
        console.log("mekton-fusion | Force refreshing sheet for:", app.actor.name);
        app.render(false);
      }
    });
    
    return result;
  }

  async getData(options = {}) {
    const ctx = await super.getData(options);
    ctx.actor = this.actor;
    ctx.system = this.actor.system ?? {};
    ctx.items = this.actor.items ?? [];
    ctx.editable = this.isEditable;

    // Debug: Always log body state before template render
    console.log('mekton-fusion | getData body check:', {
      hasBody: !!ctx.system.body,
      hasLocations: !!ctx.system?.body?.locations,
      locationKeys: ctx.system?.body?.locations ? Object.keys(ctx.system.body.locations) : [],
      fullBody: ctx.system?.body
    });

    // Compute resource objects for template (current/max/percent)
    const makeResource = (maxKey, curKey) => {
      // Ensure values are numeric after update
      const maxRaw = foundry.utils.getProperty(ctx.system, `substats.${maxKey}`);
      const curRaw = foundry.utils.getProperty(ctx.system, `substats.${curKey}`);
      const max = MektonActorSheet._num(maxRaw, 0);
      const cur = MektonActorSheet._num(curRaw, max);
      const percent = max > 0 ? Math.round((Number(cur) / Number(max)) * 100) : 0;
      return { max, current: cur, percent };
    };
    ctx.resources = {
      psi: makeResource('psi','psi_current'),
      psihybrid: makeResource('psihybrid','psihybrid_current')
    };

    // Legacy inline skills object (still supported, but prefer Item skills)
    ctx.system.skills ??= {};
    for (const [key, sk] of Object.entries(ctx.system.skills)) {
      if (sk && typeof sk === "object") sk.value = this.constructor._num(sk.value, 0);
      else ctx.system.skills[key] = { label: key, value: this.constructor._num(sk, 0) };
    }

    // Load persisted per-tab view state once (actor-level persistence)
    if (!this._viewStateLoaded) {
      try {
        // Attempt to read from actor flag first
        let saved = await this.actor.getFlag('mekton-fusion', 'tabViewState');
        // Migration: if no actor flag but user flag exists (legacy), copy it over
        if (!saved) {
          const legacy = await game.user.getFlag('mekton-fusion', 'tabViewState');
            if (legacy && typeof legacy === 'object') {
              saved = legacy;
              // Don't delete user flag automatically (safety); could clear later if desired
            }
        }
        if (saved && typeof saved === 'object') {
          for (const tab of ['skills','psi']) {
            if (saved[tab]) this._tabViewState[tab] = foundry.utils.mergeObject(this._tabViewState[tab], saved[tab]);
          }
        }
      } catch (e) { console.warn('mekton-fusion | Failed loading actor tabViewState flag', e); }
      this._viewStateLoaded = true;
      // Debounced saver -> actor flag
      this._saveViewState = foundry.utils.debounce(async () => {
        try { await this.actor.setFlag('mekton-fusion', 'tabViewState', this._tabViewState); }
        catch (e) { console.warn('mekton-fusion | Failed saving actor tabViewState', e); }
      }, 300);
    }

    const vsSkills = this._tabViewState.skills;
    const vsPsi = this._tabViewState.psi;

    // Build skill Items listing (preferred representation)
    let needsPsiFix = false;
      // Use class-level collator cache for efficiency
      if (!MektonActorSheet._collator || MektonActorSheet._collatorLang !== (game.i18n.lang || 'en')) {
        MektonActorSheet._collator = new Intl.Collator(game.i18n.lang || 'en', { sensitivity: 'base' });
        MektonActorSheet._collatorLang = game.i18n.lang || 'en';
      }
      const collator = MektonActorSheet._collator;
    let flatSkills = this.actor.items
      .filter(i => i.type === "skill")
      .map(it => {
        let stat = String(it.system?.stat || "REF").toUpperCase();
        const category = (it.system?.category || stat).toUpperCase();
        // If category is PSI, force stat to PSI regardless of stored stat
        if (category === 'PSI' && stat !== 'PSI') { stat = 'PSI'; needsPsiFix = true; }
        const statVal = ctx.system.stats?.[stat]?.value ?? 0;
        const rank = this.constructor._num(it.system?.rank, 0);
        const total = statVal + rank;
        const nameHasHard = /\(H\)|\[H\]/i.test(it.name);
        const hard = !!it.system?.hard || nameHasHard;
        const custom = !!it.system?.custom; // Track custom/homebrew powers
        return {
          id: it.id,
          name: it.name,
          stat,
          rank,
          total,
          favorite: !!it.system?.favorite,
          item: it,
          system: it.system,
          category,
          hard,
          hasHardMarker: nameHasHard,
          custom
        };
      });

    // Base stable name sort (already sorted above)
    // Split into tabs early
    let psiSkills = flatSkills.filter(sk => sk.category === 'PSI');
    let nonPsi = flatSkills.filter(sk => sk.category !== 'PSI');

  // No initial sort; sortList below will use .system.sort as primary

    // Favorites filtering per tab
    if (vsSkills.favOnly) nonPsi = nonPsi.filter(sk => sk.favorite);
    if (vsPsi.favOnly) psiSkills = psiSkills.filter(sk => sk.favorite);

    // Sorting helper
    function sortList(list, sortBy, dir) {
      const factor = dir === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        // primary: saved manual order
        const order = (Number(a.system?.sort ?? 999999) - Number(b.system?.sort ?? 999999));
        if (order !== 0) return order;

        let av, bv;
        let cmp;
        switch (sortBy) {
          case 'stat':
            av = a.stat; bv = b.stat;
            cmp = collator.compare(av, bv);
            if (cmp !== 0) return cmp * factor;
            // Fallback to name, apply factor
            return collator.compare(a.name, b.name) * factor;
          case 'rank':
            av = a.rank; bv = b.rank;
            cmp = (av - bv) * factor;
            if (cmp !== 0) return cmp;
            return collator.compare(a.name, b.name) * factor;
          case 'total':
            av = a.total; bv = b.total;
            cmp = (av - bv) * factor;
            if (cmp !== 0) return cmp;
            return collator.compare(a.name, b.name) * factor;
          case 'name':
          default:
            av = a.name; bv = b.name;
            return collator.compare(av, bv) * factor;
        }
      });
    }
    sortList(nonPsi, vsSkills.sortBy, vsSkills.dir);
    sortList(psiSkills, vsPsi.sortBy, vsPsi.dir);

  // Extract custom (non-PSI) skills so they can render in their own section at the bottom.
  // We do this AFTER sorting so customSkills preserve the active sort order.
  let customSkills = nonPsi.filter(sk => sk.custom && sk.category !== 'PSI');
  // Remove them from the normal category grouping list to avoid duplicate rows
  nonPsi = nonPsi.filter(sk => !(sk.custom && sk.category !== 'PSI'));

    // Group non-PSI categories (custom skills removed above)
    const byCategory = new Map();
    for (const sk of nonPsi) {
      if (!byCategory.has(sk.category)) byCategory.set(sk.category, []);
      byCategory.get(sk.category).push(sk);
    }
    const grouped = Array.from(byCategory.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, skills]) => ({ category, skills: skills.sort((a,b)=>a.name.localeCompare(b.name)) }));

    ctx.skillGroups = grouped;
    ctx.customSkills = customSkills || [];
    ctx.psiSkills = psiSkills;
  ctx.skillItems = flatSkills; // full flat list (pre-tab filtering, for potential use)
    ctx.hasSkillItems = nonPsi.length > 0;
    ctx.hasPsiSkills = psiSkills.length > 0;
    ctx.hasAnyPsiSkills = flatSkills.filter(sk => sk.category === 'PSI').length > 0; // Total psi skills (before filtering)

    // Filter mecha combat skills for the mecha tab
    const mechaSkillNames = {
      piloting: 'Mecha Piloting (H)',
      fighting: 'Mecha Fighting (H)',
      melee: 'Mecha Melee (H)',
      gunnery: 'Mecha Gunnery (H)',
      missiles: 'Mecha Missiles (H)'
    };
    ctx.mechaSkills = {};
    for (const [key, skillName] of Object.entries(mechaSkillNames)) {
      const skill = flatSkills.find(sk => sk.name === skillName);
      if (skill) {
        ctx.mechaSkills[key] = skill;
      } else {
        // Provide defaults if skill doesn't exist
        ctx.mechaSkills[key] = { name: skillName, rank: 0, total: 0 };
      }
    }
    // Mecha Reflex (MR) is derived (system.mecha.config.mr) in
    // ActorDataModel.prepareDerivedData -- templates read it directly rather than
    // through a shared context value, since MR is weight-dependent.

    // Preset picker option lists (Mecha tab; Body tab's Creature section uses the other).
    ctx.mechaPresetOptions = Object.values(MECHA_PRESETS).map(p => ({ id: p.id, label: p.label }));
    ctx.creaturePresetOptions = Object.values(CREATURE_PRESETS).map(p => ({ id: p.id, label: p.label }));


    // Expose per-tab view states
    ctx._skillViewStateSkills = vsSkills;
    ctx._skillViewStatePsi = vsPsi;

    // Pre-render tab templates to avoid partial-registration timing issues.
    try {
  ctx._tabStatsHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/stats.hbs", ctx);
      ctx._tabCombatHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/combat.hbs", ctx);
      ctx._tabSkillsHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/skills.hbs", ctx);
      ctx._tabPsiHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/psi.hbs", ctx);
      ctx._tabMechaHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/mecha.hbs", ctx);
      ctx._tabEquipmentHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/equipment.hbs", ctx);
      ctx._tabNotesHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/notes.hbs", ctx);
  // Optional paperdoll/body tab (empty by default until filled)
  console.log('mekton-fusion | Before rendering body tab:', {
    hasSystemBody: !!ctx.system?.body,
    hasLocations: !!ctx.system?.body?.locations,
    locations: ctx.system?.body?.locations
  });
  ctx._tabBodyHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/body.hbs", ctx);
    } catch (err) {
      console.error('mekton-fusion | Failed to pre-render actor tab templates', err);
      // Fall back to empty strings so template rendering doesn't throw further
  ctx._tabStatsHtml = ctx._tabStatsHtml || '';
      ctx._tabCombatHtml = ctx._tabCombatHtml || '';
      ctx._tabSkillsHtml = ctx._tabSkillsHtml || '';
      ctx._tabPsiHtml = ctx._tabPsiHtml || '';
      ctx._tabMechaHtml = ctx._tabMechaHtml || '';
      ctx._tabEquipmentHtml = ctx._tabEquipmentHtml || '';
      ctx._tabNotesHtml = ctx._tabNotesHtml || '';
  ctx._tabBodyHtml = ctx._tabBodyHtml || '';
    }

    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Runtime fallback: ensure the Substats block is placed under the Stats tab.
    // Some older or cached templates may leave the markup in the header; move it into the stats container so it displays correctly.
    try {
      const sub = html.find('.substats-wrapper')[0];
      const statsContainer = html.find('.tab.stats .stats-container')[0];
      if (sub && statsContainer && !statsContainer.contains(sub)) {
        statsContainer.appendChild(sub);
      }
    } catch (e) {
      // Non-fatal; best-effort UI fix
      console.debug?.('mekton-fusion | substats relocation failed', e);
    }

    html.on("click", ".item-control.item-edit", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet?.render(true);
    });
    html.on("click", ".ability-roll, .stat-roll", ev => this._onRollStat(ev));
    html.on("click", ".stun-save-roll", ev => this._onRollStunSave(ev));
    html.on("click", ".skill-roll", ev => this._onRollSkill(ev));
    html.on("click", ".skill-fav", ev => this._onToggleFavorite(ev));
    html.on("change", ".skill-rank", ev => this._onChangeSkillRank(ev));
    html.on("change", ".skill-ip", ev => this._onChangeSkillIP(ev));
    html.on("click", ".seed-skills", ev => this._onSeedSkills(ev));
    html.on("click", ".psi-add-power", ev => this._onAddPsiPower(ev));
  html.on("click", ".custom-skill-add", ev => this._onAddCustomSkill(ev));
  html.on("click", ".custom-skill-delete", ev => this._onDeleteCustomSkill(ev));
    html.on("click", ".psi-delete", ev => this._onDeletePsiPower(ev));
  html.on("click", ".link-token-button", ev => this._onLinkTokenClick(ev));
  html.on("click", ".unlink-token-button", ev => this._onUnlinkTokenClick(ev));
  // Paperdoll region clicks
  html.on('click', '.paperdoll-svg .pd-region', ev => this._onPaperdollClick(ev));
    // Legacy: also support newer .hit-zone elements in the redesigned body tab
    // Click a body zone -> focus row + toggle highlight (delegated)
    html.on('click', '.hit-zone', ev => {
      const loc = ev.currentTarget.dataset.loc;
      // Clear previous active markers
      html.find('.hit-zone').removeClass('active');
      // Ensure jQuery wrapped element for class toggling
      const $t = $(ev.currentTarget);
      $t.addClass('active');
      // Focus the first numeric input for that location if present
      const row = html.find(`.mf-row[data-loc="${loc}"] input:first`);
      if (row && row.length) row[0].focus();
    });

    // Quick actions for new single action row
    html.on('click', '#mf-btn-adjust-sp', async ev => {
      ev.preventDefault();
      const loc = html.find('#mf-selected-loc').val();
      if (!loc) return;
      const path = `system.body.locations.${loc}`;
      const data = foundry.utils.getProperty(this.actor, path);
      if (!data) return;
      const spInput = html.find('#mf-adjust-sp');
      const spAdjust = parseInt(spInput.val()) || 0;
      if (spAdjust !== 0) {
        const newSP = Math.max((data.sp ?? 0) + spAdjust, 0);
        await this.actor.update({ [`${path}.sp`]: newSP });
        spInput.val('');
        this.render(false);
      }
    });
    html.on('click', '#mf-btn-adjust-sdp', async ev => {
      ev.preventDefault();
      const loc = html.find('#mf-selected-loc').val();
      if (!loc) return;
      const path = `system.body.locations.${loc}`;
      const data = foundry.utils.getProperty(this.actor, path);
      if (!data) return;
      const sdpInput = html.find('#mf-adjust-sdp');
      const sdpAdjust = parseInt(sdpInput.val()) || 0;
      if (sdpAdjust !== 0) {
        const hitsMax = data.hitsMax ?? 0;
        // Heal (positive adjust) clamps at hitsMax; damage (negative) has no
        // floor -- current wounds can go negative (BOD table's negative Hits tiers).
        let newHits = (data.hits ?? 0) + sdpAdjust;
        if (sdpAdjust > 0) newHits = Math.min(newHits, hitsMax);
        console.log('mekton-fusion | Hits adjust:', { loc, path, sdpAdjust, hitsMax, oldHits: data.hits, newHits });
        // Set the value directly in the input and trigger change event
        const sdpInputField = html.find(`tr[data-loc="${loc}"] input[name="system.body.locations.${loc}.hits"]`);
        if (sdpInputField.length) {
          sdpInputField.val(newHits).trigger('change');
          console.log('mekton-fusion | Hits input set and change triggered:', { loc, newHits });
        } else {
          console.warn('mekton-fusion | Hits input not found for location:', loc);
        }
        sdpInput.val('');
      }
    });

    // Mecha configuration selection
    html.on('click', '[data-action="select-config"]', async ev => {
      ev.preventDefault();
      const configNum = parseInt(ev.currentTarget.dataset.config);
      if (configNum >= 1 && configNum <= 3) {
        await this.actor.update({ 'system.mecha.activeConfig': configNum });
        ui.notifications.info(`Configuration ${configNum} activated`);
      }
    });

    // Mecha image selection
    html.on('click', '[data-action="select-mecha-image"]', async ev => {
      ev.preventDefault();
      const current = this.actor.system.mecha?.imageUrl || "";
      const fp = new FilePicker({
        type: "image",
        current: current,
        callback: async (path) => {
          await this.actor.update({ 'system.mecha.imageUrl': path });
        },
        top: this.position.top + 40,
        left: this.position.left + 10
      });
      fp.browse(current);
    });

    // Mecha image right-click to clear (when image exists)
    html.on('contextmenu', '[data-action="select-mecha-image"]', async ev => {
      ev.preventDefault();
      const currentImage = this.actor.system.mecha?.imageUrl;
      if (currentImage) {
        const confirmed = await Dialog.confirm({
          title: "Clear Mecha Image",
          content: "Remove the current mecha image?",
          yes: () => true,
          no: () => false
        });
        if (confirmed) {
          await this.actor.update({ 'system.mecha.imageUrl': "" });
        }
      }
    });

    // Keep other actions (roll-hitloc, ablate, heal1, dmg1, unequip, show-item) as before

    // Armor equipping runs through _onDropItem/_onDropItemCreate below (the
    // same pipeline that already creates the embedded Item) -- see the
    // comment there for why a separate jQuery-bound drop listener here
    // didn't work. Since armor equips by fixed `coverage` (not by which
    // zone it's dropped on), it can be dropped anywhere on the sheet, same
    // as a weapon -- no zone-specific dragover binding needed here anymore.

    // Input validation: prevent negative values and enforce max limits
    html.on("input", ".skill-rank, .skill-ip", ev => {
      const input = ev.currentTarget;
      const value = parseInt(input.value);
      const min = parseInt(input.min) || 0;
      const max = parseInt(input.max) || 999;
      
      if (isNaN(value) || value < min) {
        input.value = min;
      } else if (value > max) {
        input.value = max;
      }
    });

    // Tab helpers
    const getTabFromEvent = ev => {
      const tabEl = ev.currentTarget.closest('.tab');
      const tab = tabEl?.dataset.tab;
      if (tab === 'psi') return 'psi';
      return 'skills';
    };
    // Favorites toggle
    html.on('click', '.skill-filter-fav-toggle', ev => {
      ev.preventDefault();
      const tab = getTabFromEvent(ev);
      const state = this._tabViewState[tab];
      state.favOnly = !state.favOnly;
      this._saveViewState?.();
      this.render(false);
    });
    // Sort selector
    html.on('change', '.skill-sort-by', ev => {
      const tab = getTabFromEvent(ev);
      const state = this._tabViewState[tab];
      state.sortBy = ev.currentTarget.value;
      this._saveViewState?.();
      this.render(false);
    });
    // Direction toggle
    html.on('click', '.skill-sort-dir', ev => {
      const tab = getTabFromEvent(ev);
      const state = this._tabViewState[tab];
      const btn = ev.currentTarget;
      const dir = btn.dataset.dir === 'asc' ? 'desc' : 'asc';
      state.dir = dir;
      btn.dataset.dir = dir;
      btn.textContent = dir === 'asc' ? '▲' : '▼';
      this._saveViewState?.();
      this.render(false);
    });
    // Drag and drop for psi skills reordering
    const sortableContainer = html.find('.sortable-skills')[0];
    if (sortableContainer) {
      sortableContainer.addEventListener('dragstart', this._onDragStart.bind(this));
      sortableContainer.addEventListener('dragover', this._onDragOver.bind(this));
      sortableContainer.addEventListener('drop', this._onPsiSkillDrop.bind(this));
      sortableContainer.addEventListener('dragend', this._onDragEnd.bind(this));
    }
    // Substat controls: +/- buttons and direct input changes
    html.on('click', '.substat-incr', ev => this._onAdjustSubstat(ev, +1));
    html.on('click', '.substat-decr', ev => this._onAdjustSubstat(ev, -1));
    // Note: substat inputs rely on Foundry's submitOnChange for persistence
    // Resource bars need custom handling for visual preview
    html.on('change input', '.resource-input', ev => this._queueSubstatChange(ev));

    // Keep duplicate Initiative (MV) inputs across tabs (Stats + Mecha) in sync and
    // persist via the queued substat handler. These inputs deliberately have no
    // form `name` (see data-name instead): Foundry's submitOnChange independently
    // submits the whole form on 'change', and with two same-named inputs it
    // collects both into an array -- if that fires before the sync below has
    // propagated the new value to the other duplicate, it can pick the stale one
    // and silently revert the edit. Keeping this field out of Foundry's automatic
    // form collection and persisting it solely through this debounced handler
    // avoids that race entirely.
    html.on('change input', 'input[data-name="system.substats.initiative"]', ev => {
      const val = ev.currentTarget.value;
      html.find('input[data-name="system.substats.initiative"]').each((_, el) => {
        if (el !== ev.currentTarget) el.value = val;
      });
      this._queueSubstatChange?.(ev);
    });

    // Weapon handlers. .weapon-roll (Combat tab Item) and .mecha-weapon-roll (Mecha tab
    // Armament row) share one handler, which dispatches by data attributes.
    html.on('click', '.create-weapon-item', ev => this._onCreateWeapon(ev));
    html.on('click', '.weapon-roll, .mecha-weapon-roll', ev => this._onRollWeapon(ev));
    html.on('click', '.weapon-damage-roll', ev => this._onRollWeaponDamage(ev));
    html.on('click', '.weapon-hitloc-roll', ev => this._onRollHitLocation(ev));
    html.on('click', '.mf-roll-hitloc', ev => this._onRollHitLocation(ev));
    html.on('click', '.item-delete', ev => this._onDeleteWeapon(ev));
    html.on('change', '.weapon-field', ev => this._onChangeWeaponField(ev));

    // Preset loaders (Mecha tab + Body tab's Creature section).
    html.on('click', '.load-preset-btn', ev => this._onLoadMechaPreset(ev));
    html.on('click', '.load-creature-preset-btn', ev => this._onLoadCreaturePreset(ev));

    // (Category collapse feature removed)
    // Refresh body item icons now that listeners are attached
    try { this._refreshBodyItemIcons(); } catch (e) { /* ignore */ }
  }

  /** Focus the inputs for a paperdoll location when the SVG region is clicked */
  _onPaperdollClick(ev) {
    ev.preventDefault();
    const target = ev.currentTarget;
    const loc = target.dataset?.loc;
    if (!loc) return;
    // Deselect other regions
    this.element.find('.paperdoll-svg .pd-region').forEach(el => el.classList.remove('selected'));
    target.classList.add('selected');

    // Focus the first numeric input for that location
    const inputSelector = `[name="system.body.locations.${loc}.sp"]`;
    const input = this.element[0].querySelector(inputSelector);
    if (input) {
      input.focus();
      // also visually highlight the inputs container
      const container = input.closest('.body-loc');
      if (container) {
        this.element.find('.body-loc').forEach(el => el.classList.remove('selected'));
        container.classList.add('selected');
      }
    }
  }

  /**
   * Link the actor to a currently controlled token (if present) by setting actorLink=true
   * If no token is controlled that matches this actor, informs the user to re-place the actor.
   */
  async _onLinkTokenClick(ev) {
    ev.preventDefault();
    // Find a controlled token on the canvas that refers to this actor
    const controlled = canvas?.tokens?.controlled || [];
    let found = null;
    for (const t of controlled) {
      try {
        if (t.document?.actorId === this.actor.id || t.document?.name === this.actor.name) {
          found = t;
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!found) {
      return ui.notifications.warn("No matching controlled token found. Please select the token representing this actor on the canvas and try again.");
    }

    // Confirm with the user before linking
    new Dialog({
      title: "Link Token to Actor",
      content: `<p>Link the selected token '<strong>${found.document.name}</strong>' to actor '<strong>${this.actor.name}</strong>'? This will make the token use the actor's data directly.</p>`,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-link"></i>',
          label: 'Link Token',
          callback: async () => {
            try {
              await found.document.update({ actorLink: true });
              ui.notifications.info("Token linked to actor. Reopening sheets to refresh.");
              // Force re-render of open sheets for this actor
              Object.values(ui.windows).forEach(app => {
                if (app.constructor.name === "MektonActorSheet" && app.actor?.id === this.actor.id) app.render(false);
              });
            } catch (err) {
              console.error('mekton-fusion | Failed to link token to actor', err);
              ui.notifications.error('Failed to link token to actor. See console for details.');
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'confirm'
    }).render(true);
  }

  /**
   * Unlink the actor from a currently controlled token (if present) by setting actorLink=false
   * If no token is controlled that matches this actor, informs the user to re-select the token.
   */
  async _onUnlinkTokenClick(ev) {
    ev.preventDefault();
    const controlled = canvas?.tokens?.controlled || [];
    let found = null;
    for (const t of controlled) {
      try {
        if (t.document?.actorId === this.actor.id || t.document?.name === this.actor.name) {
          found = t;
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!found) {
      return ui.notifications.warn("No matching controlled token found. Please select the token representing this actor on the canvas and try again.");
    }

    new Dialog({
      title: "Unlink Token from Actor",
      content: `<p>Unlink the selected token '<strong>${found.document.name}</strong>' from actor '<strong>${this.actor.name}</strong>'? This will make the token independent of the actor's data.</p>`,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-unlink"></i>',
          label: 'Unlink Token',
          callback: async () => {
            try {
              await found.document.update({ actorLink: false });
              ui.notifications.info("Token unlinked from actor. Reopening sheets to refresh.");
              Object.values(ui.windows).forEach(app => {
                if (app.constructor.name === "MektonActorSheet" && app.actor?.id === this.actor.id) app.render(false);
              });
            } catch (err) {
              console.error('mekton-fusion | Failed to unlink token from actor', err);
              ui.notifications.error('Failed to unlink token from actor. See console for details.');
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'confirm'
    }).render(true);
  }

  /** Handle IP input changes for skills */
  async _onChangeSkillIP(ev) {
    const input = ev.currentTarget;
    const li = input.closest("[data-skill-id]"); if (!li) return;
    const skill = this.actor.items.get(li.dataset.skillId); if (!skill) return;
    const val = MektonActorSheet._num(input.value, 0);
    await skill.update({ "system.ip": val });
  }

  /* ---------- Body tab actions ---------- */

  async _onBodyAblate(ev) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset?.loc; if (!loc) return;
    try {
      const cur = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.sp ?? 0, 0);
      await this.actor.update({ [`system.body.locations.${loc}.sp`]: Math.max(0, cur - 1) });
      this.render(false);
    } catch (e) { console.error('mekton-fusion | Failed ablate', e); }
  }

  async _onBodyHeal(ev, amt = 1) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset?.loc; if (!loc) return;
    try {
      const cur = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.hits ?? 0, 0);
      const max = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.hitsMax ?? 0, 0);
      await this.actor.update({ [`system.body.locations.${loc}.hits`]: Math.min(max, cur + amt) });
      this.render(false);
    } catch (e) { console.error('mekton-fusion | Failed heal', e); }
  }

  async _onBodyDamage(ev, amt = 1) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset?.loc; if (!loc) return;
    try {
      // No floor -- current wounds can go negative (BOD table's negative Hits tiers).
      const cur = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.hits ?? 0, 0);
      await this.actor.update({ [`system.body.locations.${loc}.hits`]: cur - amt });
      this.render(false);
    } catch (e) { console.error('mekton-fusion | Failed damage', e); }
  }

  _onShowBodyItem(ev) {
    ev.preventDefault();
    const id = ev.currentTarget.dataset?.itemId; if (!id) return;
    const item = this.actor.items.get(id);
    if (item) item.sheet?.render(true);
  }

  async _onUnequipBodyItem(ev) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset?.loc; if (!loc) return;
    try {
      await this.actor.update({ [`system.body.locations.${loc}.itemId`]: null });
      this.render(false);
    } catch (e) { console.error('mekton-fusion | Failed unequip', e); }
  }

  /** Increment/decrement a substat by delta and persist immediately */
  async _onAdjustSubstat(ev, delta) {
    ev.preventDefault();
    const btn = ev.currentTarget;
    const card = btn.closest('.substat-card'); if (!card) return;
    const key = card.dataset.subkey;
    const input = card.querySelector('.substat-input'); if (!input) return;
    const cur = MektonActorSheet._num(input.value, 0);
    const next = Math.max(0, cur + delta);
    input.value = next;
    try { await this.actor.update({ [`system.substats.${key}`]: next }); }
    catch (e) { console.warn('mekton-fusion | Failed to update substat', key, e); }
  }

  /** Queue substat/resource input changes; debounced batch update for performance */
  _queueSubstatChange(ev) {
    const input = ev.currentTarget;
    // Initiative Mod reads data-name instead of name (see the activateListeners
    // comment on its change/input binding for why).
    const name = input.name || input.dataset.name;
    if (!name) return;
    const m = name.match(/^system\.substats\.([\w-]+)$/);
    if (!m) return;
    const key = m[1];

    // Skip transient empty or '-' while user typing
    const raw = input.value;
    if (raw === '' || raw === '-' || raw === '+') return;
    let val = this.constructor._num(raw, 0);
    
    // Allow negative values for initiative modifier, but force non-negative for other substats
    if (val < 0 && key !== 'initiative') val = 0;
    
    // Allow decimal values for run, leap, swim
    // For other fields, round to integer if not a resource pair max/current
    const allowDecimals = ['run', 'leap', 'swim', 'hp', 'hp_current', 'sta', 'sta_current', 'rec', 'rec_current', 'psi', 'psi_current', 'psihybrid', 'psihybrid_current'];
    if (!allowDecimals.includes(key)) {
      val = Math.round(val);
    }

    // Initialize batching structures
    this._pendingSubstat = this._pendingSubstat || {};
    this._pendingResourcePairs = this._pendingResourcePairs || {
      hp: ['hp','hp_current'],
      stamina: ['sta','sta_current'],
      vigor: ['rec','rec_current'],
      psi: ['psi','psi_current'],
      psihybrid: ['psihybrid','psihybrid_current']
    };

    this._pendingSubstat[key] = val;

    // If a max changed, clamp its current if queued or existing > new max
    const maxCurrentMap = {
      hp: 'hp_current',
      sta: 'sta_current',
      rec: 'rec_current',
      psi: 'psi_current',
      psihybrid: 'psihybrid_current'
    };
    if (maxCurrentMap[key]) {
      const curKey = maxCurrentMap[key];
      const currentVal = this._pendingSubstat[curKey] ?? this.actor.system?.substats?.[curKey] ?? 0;
      if (currentVal > val) this._pendingSubstat[curKey] = val; // clamp
    }

    // Immediate lightweight DOM preview for resource bars
    const row = input.closest('.resource-row');
    if (row) {
      const bar = row.querySelector('.resource-bar');
      const resource = bar?.dataset?.resource;
      if (resource) {
        const pairMap = {
          hp: ['hp','hp_current'],
          stamina: ['sta','sta_current'],
          vigor: ['rec','rec_current'],
          psi: ['psi','psi_current'],
          psihybrid: ['psihybrid','psihybrid_current']
        };
        const [maxKey, curKey] = pairMap[resource] || [];
        if (maxKey && curKey) {
          const maxVal = (this._pendingSubstat[maxKey] ?? this.actor.system?.substats?.[maxKey] ?? 0);
          const curVal = (this._pendingSubstat[curKey] ?? this.actor.system?.substats?.[curKey] ?? 0);
          const percent = maxVal > 0 ? Math.round((curVal / maxVal) * 100) : 0;
          const fill = row.querySelector('.resource-fill'); if (fill) fill.style.width = percent + '%';
          const values = row.querySelector('.resource-values'); if (values) values.textContent = `${curVal} / ${maxVal}`;
        }
      }
    }

    // Debounce save
    if (!this._flushSubstatsDebounced) {
      this._flushSubstatsDebounced = foundry.utils.debounce(async () => {
        const payload = this._pendingSubstat; this._pendingSubstat = {};
        const updateData = {};
        for (const [k,v] of Object.entries(payload)) {
          updateData[`system.substats.${k}`] = v;
        }
        if (Object.keys(updateData).length) {
          try { await this.actor.update(updateData); } catch (e) { console.warn('mekton-fusion | Batched substat update failed', e); }
        }
      }, 250);
    }
    this._flushSubstatsDebounced();
  }

  /** Immediately flush pending substat changes (called on blur) */
  async _flushSubstats() {
    if (!this._pendingSubstat || Object.keys(this._pendingSubstat).length === 0) return;
    const payload = this._pendingSubstat;
    this._pendingSubstat = {};
    const updateData = {};
    for (const [k,v] of Object.entries(payload)) {
      updateData[`system.substats.${k}`] = v;
    }
    if (Object.keys(updateData).length) {
      try { await this.actor.update(updateData); } catch (e) { console.warn('mekton-fusion | Flush substat update failed', e); }
    }
  }
  /** Handle stat input changes */
  async _onChangeStatInput(ev) {
    const input = ev.currentTarget;
    const name = input.name;
    if (!name) return;
    const match = name.match(/^system\.stats\.(\w+)\.value$/);
    if (!match) return;
    const li = input.closest("[data-skill-id]"); if (!li) return;
    const skill = this.actor.items.get(li.dataset.skillId); if (!skill) return;
    const val = MektonActorSheet._num(input.value, 0);
    await skill.update({ "system.ip": val });
  }

  async _onToggleFavorite(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-skill-id]"); if (!li) return;
    const skill = this.actor.items.get(li.dataset.skillId); if (!skill) return;
    await skill.update({ "system.favorite": !skill.system.favorite });
    this.render(false);
  }

  async _onChangeSkillRank(ev) {
    const input = ev.currentTarget;
    const li = input.closest("[data-skill-id]"); if (!li) return;
    const skill = this.actor.items.get(li.dataset.skillId); if (!skill) return;
    const val = MektonActorSheet._num(input.value, 0);
    await skill.update({ "system.rank": val });
    
    // Update the total display without full re-render
    const totalCell = li.querySelector('.skill-total');
    if (totalCell) {
      const stat = skill.system?.stat?.toUpperCase() || 'REF';
      const statVal = this.actor.system?.stats?.[stat]?.value ?? 0;
      totalCell.textContent = statVal + val;
    }
  }

  async _onSeedSkills(ev) {
    ev.preventDefault();
    try {
      ui.notifications.info("Adding default skills...");
      const { syncActorCoreItems } = await import("../../module/seed.js");
      const result = await syncActorCoreItems(this.actor);
      if (result.created > 0) {
        ui.notifications.info(`Added ${result.created} default skills to ${this.actor.name}`);
        this.render(false); // Refresh the sheet to show new skills
      } else {
        ui.notifications.info("No new skills were needed");
      }
    } catch (err) {
      console.error("mekton-fusion | Manual seeding failed", err);
      ui.notifications.error("Failed to add skills. See console for details.");
    }
  }

  /** Create a new custom Psionic power (skill item with category PSI). */
  async _onAddPsiPower(ev) {
    ev.preventDefault();
    try {
      // Check for duplicate names
      const existingNames = this.actor.items
        .filter(i => i.type === 'skill' && i.system?.category === 'PSI')
        .map(i => i.name.toLowerCase());
      
      // Prompt for name
      let name;
      try {
        name = await Dialog.prompt({
          title: game.i18n.localize('MF.AddPsiPower') || 'Add Psionic Power',
          content: `<p>${game.i18n.localize('MF.PsiPowerNamePrompt') || 'Enter name for the new psionic power:'}</p><input type="text" name="powerName" value="" style="width:100%" placeholder="${game.i18n.localize('MF.NewPsiPower') || 'New Psionic Power'}"/>`,
          label: game.i18n.localize('MF.Create') || 'Create',
          callback: html => {
            const input = html.find("[name='powerName']").val().trim();
            return input || (game.i18n.localize('MF.NewPsiPower') || 'New Psionic Power');
          }
        });
      } catch (_) { 
        return; // User cancelled
      }

      // Check for duplicates
      if (existingNames.includes(name.toLowerCase())) {
        ui.notifications.warn(game.i18n.format('MF.DuplicatePsiPowerName', { name }) || `A psionic power named "${name}" already exists.`);
        return;
      }

      const doc = await this.actor.createEmbeddedDocuments("Item", [{
        name: name,
        type: 'skill',
        system: {
          stat: 'PSI',
          category: 'PSI',
          rank: 0,
          favorite: false,
          hard: false,
          custom: true // Mark as custom/homebrew
        }
      }]);
      if (doc?.length) {
        const created = doc[0];
        ui.notifications.info(game.i18n.format('MF.CreatedPsiPower', { name: created.name }));
        this.render(false);
      }
    } catch (e) {
      console.error('mekton-fusion | Failed to create psi power', e);
      ui.notifications.error(game.i18n.localize('MF.ErrorCreatePsiPower') || 'Failed to create power');
    }
  }

  /** Delete a custom psionic power */
  async _onDeletePsiPower(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-item-id]");
    if (!li) return;
    const item = this.actor.items.get(li.dataset.itemId);
    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize('MF.DeletePsiPower') || 'Delete Psionic Power',
      content: game.i18n.format('MF.DeletePsiPowerConfirm', { name: item.name }) || `Delete psionic power "${item.name}"?`,
      yes: () => true,
      no: () => false
    });

    if (confirmed) {
      await item.delete();
      ui.notifications.info(game.i18n.format('MF.DeletedPsiPower', { name: item.name }) || `Deleted psionic power: ${item.name}`);
      this.render(false);
    }
  }

  /** Drag and drop handlers for skill reordering */
  _onDragStart(ev) {
  const row = ev.target.closest('.skill-item-row');
  if (!row) return;
  // No need to set dataTransfer payload since it's unused in _onDrop
  row.classList.add('dragging');
  }

  _onDragOver(ev) {
    ev.preventDefault();
    const row = ev.target.closest('.skill-item-row');
    if (!row || row.classList.contains('dragging')) return;
    
    const container = row.closest('.sortable-skills');
    const dragging = container.querySelector('.dragging');
    if (!dragging) return;

    const siblings = [...container.querySelectorAll('.skill-item-row:not(.dragging)')];
    const nextSibling = siblings.find(sibling => {
      const rect = sibling.getBoundingClientRect();
      return ev.clientY <= rect.top + rect.height / 2;
    });

    container.insertBefore(dragging, nextSibling);
  }

  /**
   * PSI skill row reordering (native HTML5 DnD, bound directly on
   * .sortable-skills). Named to NOT shadow the base ActorSheet's own
   * _onDrop(event, data) -- Foundry's core DragDrop system calls that method
   * on every drop anywhere on the sheet to parse and dispatch to
   * _onDropItem/_onDropActor/_onDropFolder; a same-named override here would
   * swallow every one of those drops sheet-wide, not just PSI row reordering.
   */
  _onPsiSkillDrop(ev) {
    ev.preventDefault();
    // Order is handled by dragover, just need to save the new order
    this._savePsiSkillOrder();
  }

  _onDragEnd(ev) {
    const row = ev.target.closest('.skill-item-row');
    if (row) row.classList.remove('dragging');
  }

  /** Save the current order of psi skills based on DOM */
  async _savePsiSkillOrder() {
    const container = this.element.find('.sortable-skills')[0];
    if (!container) return;

    const rows = [...container.querySelectorAll('.skill-item-row')];
    const updates = [];
    
    for (let i = 0; i < rows.length; i++) {
      const skillId = rows[i].dataset.skillId;
      const item = this.actor.items.get(skillId);
      if (item && item.system?.category === 'PSI') {
        updates.push({ _id: skillId, 'system.sort': i });
      }
    }

    if (updates.length > 0) {
      await this.actor.updateEmbeddedDocuments('Item', updates);
    }
  }

  /** Create a new generic custom (non-PSI) skill. */
  async _onAddCustomSkill(ev) {
    ev.preventDefault();
    try {
      const existingNames = this.actor.items
        .filter(i => i.type === 'skill' && i.system?.category !== 'PSI' && i.system?.custom)
        .map(i => i.name.toLowerCase());

      // Collect available stats from actor (fallback to common set)
      const statKeys = Object.keys(this.actor.system?.stats || { REF:1, INT:1, COOL:1, TECH:1, BODY:1, EMP:1, LUCK:1, MA:1, ATTR:1, EDU:1 })
        .map(k => k.toUpperCase());
      const stats = Array.from(new Set(statKeys));

      let name, chosenStat;
      try {
        const result = await Dialog.prompt({
          title: game.i18n.localize('MF.AddCustomSkill') || 'Add Custom Skill',
            content: `
              <p>${game.i18n.localize('MF.CustomSkillNamePrompt') || 'Enter name for the new custom skill:'}</p>
              <input type="text" name="skillName" value="" style="width:100%;margin-bottom:6px;" placeholder="${game.i18n.localize('MF.NewCustomSkill') || 'New Custom Skill'}"/>
              <label style="display:block;margin-top:4px;">Stat:
                <select name="skillStat" style="width:100%;">
                  ${stats.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </label>
            `,
          label: game.i18n.localize('MF.Create') || 'Create',
          callback: html => {
            const nm = html.find("[name='skillName']").val().trim();
            const st = (html.find("[name='skillStat']").val() || 'REF').toUpperCase();
            return { name: nm || (game.i18n.localize('MF.NewCustomSkill') || 'New Custom Skill'), stat: st };
          }
        });
        if (!result) return; // cancelled
        name = result.name;
        chosenStat = result.stat;
      } catch (_) { return; }

      if (existingNames.includes(name.toLowerCase())) {
        ui.notifications.warn(game.i18n.format('MF.DuplicateCustomSkillName', { name }) || `A custom skill named "${name}" already exists.`);
        return;
      }

      const doc = await this.actor.createEmbeddedDocuments('Item', [{
        name,
        type: 'skill',
        system: {
          stat: chosenStat || 'REF',
          category: 'CUSTOM',
          rank: 0,
          favorite: false,
          hard: false,
          ip: 0,
          custom: true
        }
      }]);
      if (doc?.length) {
        const created = doc[0];
        ui.notifications.info(game.i18n.format('MF.CreatedCustomSkill', { name: created.name }));
        this.render(false);
      }
    } catch (e) {
      console.error('mekton-fusion | Failed to create custom skill', e);
      ui.notifications.error(game.i18n.localize('MF.ErrorCreateCustomSkill') || 'Failed to create custom skill');
    }
  }

  /** Delete a custom skill (non-PSI) */
  async _onDeleteCustomSkill(ev) {
    ev.preventDefault();
    const btn = ev.currentTarget;
    const id = btn?.dataset.itemId || btn.closest('[data-skill-id]')?.dataset.skillId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (!item || item.type !== 'skill' || !item.system?.custom) return;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize('MF.DeleteCustomSkill') || 'Delete Custom Skill',
      content: game.i18n.format('MF.DeleteCustomSkillConfirm', { name: item.name }) || `Delete custom skill "${item.name}"?`,
      yes: () => true,
      no: () => false
    });
    if (!confirmed) return;
    try {
      await item.delete();
      ui.notifications.info(game.i18n.format('MF.DeletedCustomSkill', { name: item.name }) || `Deleted custom skill: ${item.name}`);
      this.render(false);
    } catch (e) {
      console.error('mekton-fusion | Failed to delete custom skill', e);
      ui.notifications.error(game.i18n.localize('MF.ErrorDeleteCustomSkill') || 'Failed to delete custom skill');
    }
  }

  /** Roll a stat */
  async _onRollStat(ev) {
    ev.preventDefault();
    const button = ev.currentTarget;
    const stat = button.dataset.ability;
    if (!stat) return;
    
    const statSource = this.actor.system?.stats?.[stat];
    const statVal = typeof statSource === 'object' && statSource !== null ? Number(statSource.value) || 0 : Number(statSource) || 0;
    
    let mod = 0;
    let difficulty = null;
    
    if (!ev.shiftKey) {
      try {
        const result = await Dialog.prompt({
          title: game.i18n.format('MF.RollSimple', { name: stat }),
          content: `
            <div style="margin-bottom: 10px;">
              <label>Modifier:</label>
              <input type="number" name="mod" value="0" style="width:100%"/>
            </div>
            ${this.constructor._difficultyPresetHtml()}
          `,
          label: "Roll",
          render: html => this.constructor._bindDifficultyPresetListeners(html),
          callback: html => {
            const modVal = Number(html.find("[name='mod']").val() || 0);
            const diffVal = html.find("[name='difficulty']").val();
            return { mod: modVal, difficulty: diffVal ? Number(diffVal) : null };
          }
        });
        mod = result.mod || 0;
        difficulty = result.difficulty;
      } catch (_) { return; }
    }
    
    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const finalTotal = base + statVal + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    
    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const flavorParts = [`(${plusStr}${minusStr})`, `${stat} ${statVal}`];
    if (mod) flavorParts.push(`Mod ${mod >= 0 ? '+' : ''}${mod}`);
    
    const explodedUp = plusDice.some(d=>d===10) ? 'Up' : '';
    const explodedDown = minusDice.some(d=>d===1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? `<span class="exploding">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span class="exploding cap">[Cap ${maxExtra}]</span>` : '';
    
    let resultText = '';
    if (difficulty !== null) {
      const success = finalTotal >= difficulty;
      resultText = ` vs Difficulty ${difficulty} = <strong style="color: ${success ? 'green' : 'red'}">${success ? 'SUCCESS' : 'FAILURE'}</strong>`;
    }
    
    const rollTitle = difficulty !== null ? 
      game.i18n.format('MF.RollWithDifficulty', { name: stat, difficulty }) :
      game.i18n.format('MF.RollSimple', { name: stat });
    
    const flavor = `<strong>${this.actor.name}</strong> rolls ${rollTitle} ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>${resultText}`;
    await roll.toMessage({ speaker, flavor });
  }

  /** Roll 1d10 for Stun Save */
  async _onRollStunSave(ev) {
    ev.preventDefault();
    const stunVal = Number(this.actor.system?.substats?.stun) || 0;
    const roll = new Roll('1d10');
    await roll.evaluate();
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const flavor = `<strong>${this.actor.name}</strong> rolls Stun Save (${stunVal}) — 1d10 = <strong>${roll.total}</strong> — ${roll.total <= stunVal ? '<span style="color:green">SUCCESS</span>' : '<span style="color:red">FAILURE</span>'}`;
    await roll.toMessage({ speaker, flavor });
  }

  /** Roll a skill */
  async _onRollSkill(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-skill-id]");
    if (!li) return;
    const id = li.dataset.skillId;
    const skill = this.actor.items.get(id);
    if (!skill) return;
    
    const stat = String(skill.system?.stat || "INT").toUpperCase();
    const rank = MektonActorSheet._num(skill.system?.rank, 0);
    const statLabel = stat;
    const statSource = this.actor.system?.stats?.[stat];
    const statVal = typeof statSource === 'object' && statSource !== null ? Number(statSource.value) || 0 : Number(statSource) || 0;

    let mod = 0;
    let difficulty = null;
    
    if (!ev.shiftKey) {
      try {
        const result = await Dialog.prompt({
          title: game.i18n.format('MF.RollSimple', { name: skill.name }),
          content: `
            <div style="margin-bottom: 10px;">
              <label>Modifier:</label>
              <input type="number" name="mod" value="0" style="width:100%"/>
            </div>
            ${this.constructor._difficultyPresetHtml()}
          `,
          label: "Roll",
          render: html => this.constructor._bindDifficultyPresetListeners(html),
          callback: html => {
            const modVal = Number(html.find("[name='mod']").val() || 0);
            const diffVal = html.find("[name='difficulty']").val();
            return { mod: modVal, difficulty: diffVal ? Number(diffVal) : null };
          }
        });
        mod = result.mod || 0;
        difficulty = result.difficulty;
      } catch (_) { return; }
    }
    
    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    // If this is a Mecha skill, use the mech's derived Mecha Reflex (REF +
    // Maneuver Value) instead of the raw REF stat.
    const isMecha = String(skill.system?.category || '').toUpperCase() === 'REF:MECHA' || /MECHA\s+(PILOTING|FIGHTING|MELEE|GUNNERY|MISSILES)/i.test(skill.name || '');
    const mr = isMecha && stat === 'REF' ? Number(this.actor.system?.mecha?.config?.mr ?? 0) : statVal;
    const finalTotal = base + mr + rank + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const flavorParts = [`(${plusStr}${minusStr})`];
    if (isMecha && stat === 'REF') {
      flavorParts.push(`MR ${mr}`);
    } else {
      flavorParts.push(`${statLabel} ${statVal}`);
    }
    if (rank) flavorParts.push(`Rank ${rank}`);
    if (mod) flavorParts.push(`Mod ${mod >= 0 ? '+' : ''}${mod}`);
    
    const explodedUp = plusDice.some(d=>d===10) ? 'Up' : '';
    const explodedDown = minusDice.some(d=>d===1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? `<span class="exploding">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span class="exploding cap">[Cap ${maxExtra}]</span>` : '';
    
    let resultText = '';
    if (difficulty !== null) {
      const success = finalTotal >= difficulty;
      resultText = ` vs Difficulty ${difficulty} = <strong style="color: ${success ? 'green' : 'red'}">${success ? 'SUCCESS' : 'FAILURE'}</strong>`;
    }
    
    const rollTitle = difficulty !== null ? 
      game.i18n.format('MF.RollWithDifficulty', { name: skill.name, difficulty }) :
      game.i18n.format('MF.RollSimple', { name: skill.name });
    
    const flavor = `<strong>${this.actor.name}</strong> rolls ${rollTitle} ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong style="font-size: 1.2em; color: #4a90e2;">${finalTotal}</strong>${resultText}`;
    await roll.toMessage({ speaker, flavor });
  }

  /**
   * Drag-drop a weapon from the compendium (or anywhere else) onto the sheet.
   * Foundry's default drop handling already creates the Item on the actor --
   * this only forces isMecha:false so a dropped catalog weapon lands in the
   * human Combat tab table, unless it's dropped directly over the mecha
   * combat section (matches _onCreateWeapon's own section detection).
   * Hand-made weapons via _onCreateWeapon are untouched by this override.
   */
  async _onDropItem(event, data) {
    this._mfLastDropTarget = event?.target ?? null;
    return super._onDropItem(event, data);
  }

  /**
   * itemData here is plain creation data, not a Document yet -- created via
   * super._onDropItemCreate() below, whose return value we then use for the
   * armor-equip step (needs the created Item's id for body.locations.*.itemId).
   *
   * Armor equipping was originally its own dragover/drop listener bound
   * directly to the paperdoll hit-zones and table rows, using
   * TextEditor.getDragEventData(event) to read the drop payload. That never
   * worked: those listeners were bound via jQuery's .on(), which wraps the
   * native DragEvent in a jQuery Event that does NOT copy over
   * .dataTransfer (jQuery only proxies a fixed allowlist of properties, and
   * dataTransfer isn't in it) -- so getDragEventData's own
   * `"dataTransfer" in event` check silently failed and it always returned
   * {}, no error, no effect. Routing through _onDropItem/_onDropItemCreate
   * instead reuses Foundry's own native-DragEvent dispatch (the same path
   * that already reliably creates dropped weapon Items), sidestepping the
   * jQuery wrapping issue entirely.
   */
  async _onDropItemCreate(itemData) {
    const list = Array.isArray(itemData) ? itemData : [itemData];
    const dropEl = this._mfLastDropTarget;
    const overMecha = !!(dropEl && $(dropEl).closest('.mecha-combat').length);
    for (const data of list) {
      if (data.type !== 'weapon') continue;
      data.system = foundry.utils.mergeObject(data.system ?? {}, { isMecha: overMecha });
    }

    const created = await super._onDropItemCreate(itemData);
    for (const item of Array.isArray(created) ? created : [created]) {
      if (item?.type === 'armor') await this._equipArmorToBody(item);
    }
    return created;
  }

  /**
   * Stamp a just-created armor Item's SP onto the body paperdoll's hit-zone(s).
   * Which zone(s) is fixed by the item's `coverage` (ARMOR_COVERAGE) --
   * a Hat is always head-only, a Jacket is always torso+arms, etc, per the
   * book's Sample Armor Coverage table -- so it doesn't matter where on the
   * sheet the item was actually dropped.
   */
  async _equipArmorToBody(item) {
    const coverage = ARMOR_COVERAGE[item.system?.coverage] ?? ARMOR_COVERAGE.vest;
    if (!coverage.locations.length) {
      ui.notifications.warn(`${item.name} is handheld armor -- it isn't equipped to a body location.`);
      return;
    }

    const spVal = item.system?.sp ?? 0;
    const updates = {};
    for (const loc of coverage.locations) {
      const path = `system.body.locations.${loc}`;
      updates[`${path}.itemId`] = item.id;
      updates[`${path}.sp`] = spVal;
      updates[`${path}.spMax`] = Math.max(spVal, foundry.utils.getProperty(this.actor, `${path}.spMax`) ?? spVal);
    }
    try {
      await this.actor.update(updates);
      this._refreshBodyItemIcons();
    } catch (err) {
      console.warn('mekton-fusion | Failed equipping armor to body slot', err);
    }
  }

  /** Create a new weapon item */
  async _onCreateWeapon(ev) {
    ev.preventDefault();
    // Determine if weapon is for mecha based on which section the button was clicked from
    const section = ev.currentTarget.closest('.combat-section');
    const isMecha = section?.classList.contains('mecha-combat');
    
    try {
      await this.actor.createEmbeddedDocuments('Item', [{
        name: "New Weapon",
        type: "weapon",
        system: {
          name: "New Weapon",
          wa: 0,
          range: "",
          damage: "",
          shots: "",
          bv: "",
          skill: "",
          isMecha: !!isMecha
        }
      }]);
      this.render(false);
    } catch (err) {
      console.error('mekton-fusion | Failed to create weapon', err);
      ui.notifications.error("Failed to create weapon");
    }
  }

  /** Delete a weapon item */
  async _onDeleteWeapon(ev) {
    ev.preventDefault();
    const itemId = ev.currentTarget.dataset.itemId;
    if (!itemId) return;
    
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Weapon",
      content: `Delete weapon "${item.name}"?`,
      yes: () => true,
      no: () => false
    });

    if (confirmed) {
      try {
        await item.delete();
        ui.notifications.info(`Deleted weapon: ${item.name}`);
        this.render(false);
      } catch (err) {
        console.error('mekton-fusion | Failed to delete weapon', err);
        ui.notifications.error("Failed to delete weapon");
      }
    }
  }

  /** Change weapon field */
  async _onChangeWeaponField(ev) {
    const input = ev.currentTarget;
    const tr = input.closest('tr[data-item-id]');
    if (!tr) return;
    
    const itemId = tr.dataset.itemId;
    const field = input.dataset.field;
    if (!itemId || !field) return;

    const item = this.actor.items.get(itemId);
    if (!item) return;

    let val = input.value;

    // wa is the only numeric weapon field; shots/range/damage/bv stay strings
    // so values like "na" / "10 turns" / "2D6+" survive edits untouched.
    if (field === 'wa') {
      val = MektonActorSheet._num(val, 0);
    }

    try {
      await item.update({ [`system.${field}`]: val });
    } catch (err) {
      console.error(`mekton-fusion | Failed to update weapon field ${field}`, err);
      ui.notifications.error(`Failed to update weapon ${field}`);
    }
  }

  /** Roll weapon damage from the formula stored in item.system.damage */
  async _onRollWeaponDamage(ev) {
    ev.preventDefault();
    const button = ev.currentTarget;
    const itemId = button.dataset.itemId;
    if (!itemId) return;

    const weapon = this.actor.items.get(itemId);
    if (!weapon) return;

    const formula = (weapon.system?.damage ?? '').trim();
    if (!formula) {
      ui.notifications.warn(`${weapon.name} has no damage formula set.`);
      return;
    }

    // Validate formula before rolling
    let roll;
    try {
      roll = new Roll(formula);
      await roll.evaluate();
    } catch (err) {
      ui.notifications.error(`Invalid damage formula "${formula}" for ${weapon.name}.`);
      return;
    }

    const weaponName = weapon.system?.name || weapon.name;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const flavor = `<strong>${this.actor.name}</strong> rolls damage for <strong>${weaponName}</strong>: <em>${formula}</em> = <strong style="font-size: 1.2em; color: #c0392b;">${roll.total}</strong>`;
    await roll.toMessage({ speaker, flavor });
  }

  /**
   * Roll hit location (1d10 vs the Human Random Hit Chart, see static
   * HIT_LOCATION_CHART / _rollHitLocationKey). Used by both the weapon row's
   * hit-location button (tags the weapon name) and the Body tab's crosshairs
   * button (generic, also flashes the rolled paperdoll zone).
   */
  async _onRollHitLocation(ev) {
    ev.preventDefault();
    const button = ev.currentTarget;
    const itemId = button.dataset.itemId;

    // Resolve weapon name if called from a weapon button, otherwise generic label
    let weaponLabel = "";
    if (itemId) {
      const weapon = this.actor.items.get(itemId);
      if (weapon) weaponLabel = ` (${weapon.system?.name || weapon.name})`;
    }

    const { key, label, roll } = await this.constructor._rollHitLocationKey();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const flavor = `<strong>${this.actor.name}</strong> hit location${weaponLabel}: rolled <strong>${roll.total}</strong> → <strong style="font-size: 1.1em;">${label}</strong>`;
    await roll.toMessage({ speaker, flavor });

    // Flash the rolled zone on the Body tab's paperdoll, if visible.
    const el = this.element.find(`.hit-zone.${key}`);
    if (el && el.length) {
      el.addClass('active');
      setTimeout(() => el.removeClass('active'), 500);
    }
  }

  /**
   * Load a mecha preset (MECHA_PRESETS) into the Mecha tab.
   * Stamps selection keys only (servos/armament/shields/movement); the
   * ActorDataModel derive pipeline fills Space/Cost/Kills/Weight on re-render.
   * Overwrites the mech's current loadout, so confirm first.
   */
  async _onLoadMechaPreset(ev) {
    ev.preventDefault();
    const row = ev.currentTarget.closest('.preset-loader-row');
    const presetId = row?.querySelector('.preset-select')?.value;
    const preset = presetId ? MECHA_PRESETS[presetId] : null;
    if (!preset) { ui.notifications.warn('Pick a preset before loading.'); return; }

    const confirmed = await Dialog.confirm({
      title: `Load ${preset.label}?`,
      content: `<p>This overwrites the current Servos, Armament, Shields, Movement Systems, and Powerplant on the <strong>Mecha</strong> tab with <strong>${preset.label}</strong>. Continue?</p>`
    });
    if (!confirmed) return;

    const upd = buildMechaPresetUpdate(preset);
    const update = {
      "system.mecha.name": upd.name,
      "system.mecha.servos": upd.servos,
      "system.mecha.weapons": upd.weapons,
      "system.mecha.shields": upd.shields,
      "system.mecha.movementSystems": upd.movementSystems
    };
    if (upd.powerplant) {
      update["system.mecha.powerplant.charge"] = upd.powerplant.charge;
      update["system.mecha.powerplant.source"] = upd.powerplant.source;
      update["system.mecha.powerplant.hot"] = upd.powerplant.hot;
    }
    await this.actor.update(update);
  }

  /**
   * Load a creature preset (CREATURE_PRESETS) into the Body tab's Creature
   * section. Uses the character body-plan/enemy model (BODY + naturalWeapons),
   * not mecha construction. Overwrites BODY, natural armor, and natural
   * weapons, so confirm first.
   */
  async _onLoadCreaturePreset(ev) {
    ev.preventDefault();
    const row = ev.currentTarget.closest('.preset-loader-row');
    const presetId = row?.querySelector('.creature-preset-select')?.value;
    const preset = presetId ? CREATURE_PRESETS[presetId] : null;
    if (!preset) { ui.notifications.warn('Pick a preset before loading.'); return; }

    const confirmed = await Dialog.confirm({
      title: `Load ${preset.label}?`,
      content: `<p>This overwrites BODY, natural armor SP, and natural weapons with <strong>${preset.label}</strong>. Continue?</p>`
    });
    if (!confirmed) return;

    const upd = buildCreaturePresetUpdate(preset);
    const update = {
      name: upd.name,
      "system.stats.BODY.value": upd.bod,
      "system.creature.bodyPlan": upd.bodyPlan,
      "system.creature.armorSP": upd.armorSP,
      "system.creature.naturalWeapons": upd.naturalWeapons
    };
    for (const [key, loc] of Object.entries(upd.locations)) {
      update[`system.body.locations.${key}.sp`] = loc.sp;
      update[`system.body.locations.${key}.spMax`] = loc.spMax;
    }
    await this.actor.update(update);
  }

  /**
   * Roll a weapon attack. Dispatches by source: a Combat tab weapon Item
   * (data-item-id) or a Mecha tab Armament row (data-mech + data-idx).
   */
  async _onRollWeapon(ev) {
    ev.preventDefault();
    const button = ev.currentTarget;
    if (button.dataset.mech !== undefined) return this._rollMechaArmamentRow(button);
    return this._rollWeaponItem(button);
  }

  /**
   * Human-scale attack resolver (MZ core Interlock, not CP2020/IU): 1d10
   * (exploding) + skillTotal + WA + rangeMod + aim + situational mods, vs an
   * optional GM Difficulty. No fixed DV -- opposed Evade/Parry is deferred.
   * On a hit (or no Difficulty given), continues in the SAME chat card: rolls
   * hit location, rolls damage (+ BODY mod if the formula ends in "+"),
   * applies armor/location/hits to the TARGETED token (never the attacker),
   * and resolves a Stun/Shock save if warranted. The standalone
   * .weapon-damage-roll / .weapon-hitloc-roll buttons remain as manual
   * overrides for anything this dialog doesn't cover (e.g. opposed melee).
   */
  async _rollWeaponItem(button) {
    const itemId = button.dataset.itemId;
    if (!itemId) return;

    const weapon = this.actor.items.get(itemId);
    if (!weapon) return;

    const weaponName = weapon.system?.name || weapon.name;
    const wa = MektonActorSheet._num(weapon.system?.wa, 0);

    // Weapon Options (Lasersight, Optical Scope, Smartgun, etc.) modify the
    // Combat Range WA and/or replace the default -4 Maximum Range penalty.
    const optionsEffect = computeWeaponOptionsEffect(weapon.system?.options);
    const maxRangePenalty = optionsEffect.maxRangeMod ?? -4;

    // Resolve the mapped skill -- warn rather than silently treating the
    // attacker as untrained, since a missing skill is very likely a data problem.
    const skillKey = weapon.system?.skill;
    const SKILL_MAP = {
      'archery': 'Archery',
      'automatic-weapon': 'Automatic Weapon',
      'blade': 'Blade',
      'handgun': 'Handgun',
      'hand-to-hand': 'Hand to Hand',
      'rifle': 'Rifle',
      'whip': 'Whip'
    };
    const skillDisplayName = skillKey ? (SKILL_MAP[skillKey] ?? skillKey) : null;
    const skillItem = skillDisplayName ? this.actor.items.find(i => i.type === 'skill' && i.name === skillDisplayName) : null;
    let statVal = 0, rank = 0;
    if (skillItem) {
      statVal = MektonActorSheet._num(this.actor.system?.stats?.[String(skillItem.system?.stat || '').toUpperCase()]?.value, 0);
      rank = MektonActorSheet._num(skillItem.system?.rank, 0);
    } else {
      ui.notifications.warn(`${this.actor.name} has no "${skillDisplayName ?? 'matching'}" skill for ${weaponName} -- rolling with skill total 0.`);
    }
    const skillTotal = statVal + rank;

    // MZ range is Combat-Max, not a DV ladder -- the dialog only needs to know
    // which side of Combat Range applies; show the parsed numbers as a hint.
    const rangeInfo = parseRange(weapon.system?.range);
    const rangeHint = rangeInfo?.thrown ? 'Thrown'
      : rangeInfo ? `Combat ${rangeInfo.combat} / Max ${rangeInfo.max}`
      : 'No range data';

    const COVER_MODS = [
      { key: 'silhouetted', label: 'Silhouetted', mod: 2 },
      { key: 'crouched', label: 'Crouched/Kneeling', mod: -1 },
      { key: 'prone', label: 'Prone', mod: -2 },
      { key: 'half', label: 'Half body visible', mod: -2 },
      { key: 'headshoulders', label: 'Head + Shoulders only', mod: -3 },
      { key: 'headonly', label: 'Head only', mod: -4 },
      { key: 'behind', label: 'Behind someone', mod: -4 },
      { key: 'blinded', label: 'Blinded', mod: -5 }
    ];
    const coverRows = COVER_MODS.map(c =>
      `<label style="display:block;"><input type="checkbox" name="cvr_${c.key}"/> ${c.label} (${c.mod >= 0 ? '+' : ''}${c.mod})</label>`
    ).join('');

    let dlg;
    try {
      dlg = await Dialog.prompt({
        title: `Attack: ${weaponName}`,
        content: `
          <form class="mf-attack-dialog">
            <div class="form-group">
              <label>Range</label>
              <select name="rangeChoice" style="width:100%">
                <option value="0">Combat range (+0)</option>
                <option value="${maxRangePenalty}">Long / at max range (${maxRangePenalty})</option>
              </select>
              <p style="font-size:0.8em; color:#666; margin:2px 0 8px;">${rangeHint}</p>
            </div>
            <div class="form-group">
              <label>Aim (+1/action, max +4)</label>
              <input type="number" name="aim" value="0" min="0" max="4" style="width:100%"/>
            </div>
            <fieldset style="margin:8px 0;">
              <legend>Cover / LOS</legend>
              ${coverRows}
            </fieldset>
            <div class="form-group">
              <label>Other Modifier</label>
              <input type="number" name="other" value="0" style="width:100%"/>
            </div>
            ${this.constructor._difficultyPresetHtml()}
          </form>
        `,
        label: "Attack",
        render: html => this.constructor._bindDifficultyPresetListeners(html),
        callback: html => {
          const rangeMod = Number(html.find("[name='rangeChoice']").val()) || 0;
          const aim = Math.max(0, Math.min(4, Number(html.find("[name='aim']").val()) || 0));
          const other = Number(html.find("[name='other']").val()) || 0;
          const diffRaw = html.find("[name='difficulty']").val();
          const difficulty = diffRaw ? Number(diffRaw) : null;
          let coverMod = 0;
          for (const c of COVER_MODS) {
            if (html.find(`[name='cvr_${c.key}']`).is(':checked')) coverMod += c.mod;
          }
          return { rangeMod, aim, coverMod, other, difficulty };
        }
      });
    } catch (_) { return; } // dialog cancelled

    const { rangeMod, aim, coverMod, other, difficulty } = dlg;
    const mods = coverMod + other;

    // Weapon Options' WA bonus (Lasersight/Smartgun +, Optical Scope -) only
    // applies at Combat Range (rangeMod === 0), per the book -- the dropdown
    // has already swapped in the option-adjusted Max Range penalty above.
    const atCombatRange = rangeMod === 0;
    const effectiveWa = wa + (atCombatRange ? optionsEffect.combatWaBonus : 0);

    // --- Attack roll: 1d10(exploding) + skillTotal + WA + rangeMod + aim + mods ---
    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const attackTotal = base + skillTotal + effectiveWa + rangeMod + aim + mods;

    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const explodedUp = plusDice.some(d => d === 10) ? 'Up' : '';
    const explodedDown = minusDice.some(d => d === 1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? ` <span style="color: #999; font-size: 0.85em;">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span style="color: #999; font-size: 0.85em;">[Cap ${maxExtra}]</span>` : '';

    const waLabel = effectiveWa !== wa ? `WA ${effectiveWa} (${wa} ${optionsEffect.combatWaBonus >= 0 ? '+' : ''}${optionsEffect.combatWaBonus} options)` : `WA ${wa}`;
    const modParts = [`(${plusStr}${minusStr})`, `Skill ${skillTotal}`, waLabel];
    if (rangeMod) modParts.push(`Range ${rangeMod >= 0 ? '+' : ''}${rangeMod}`);
    if (aim) modParts.push(`Aim +${aim}`);
    if (mods) modParts.push(`Mods ${mods >= 0 ? '+' : ''}${mods}`);

    let success = null;
    let resultTag = '';
    if (difficulty !== null) {
      success = attackTotal >= difficulty;
      resultTag = ` vs Difficulty ${difficulty} = <strong style="color: ${success ? 'green' : 'red'}">${success ? 'SUCCESS' : 'FAILURE'}</strong>`;
    }

    let flavor = `<strong>${this.actor.name}</strong> attacks with ${weaponName}${tag}${capTag} = ${modParts.join(' + ')} = <strong style="font-size: 1.2em; color: #4a90e2;">${attackTotal}</strong>${resultTag}`;

    // --- On a hit (success !== false -- a miss is the only thing that skips this) ---
    if (success !== false) {
      const dmgFormulaRaw = (weapon.system?.damage ?? '').trim();
      if (!dmgFormulaRaw) {
        flavor += `<br><em style="font-size:0.85em; color:#999;">No damage formula set on ${weaponName}.</em>`;
      } else {
        // A trailing "+" means the BODY TYPE damage modifier applies, by the
        // "+" marker -- not by weapon type or skill (ranged or melee alike).
        const bodyModApplies = dmgFormulaRaw.endsWith('+');
        const dmgFormula = bodyModApplies ? dmgFormulaRaw.slice(0, -1).trim() : dmgFormulaRaw;

        let dmgRoll = null;
        try {
          dmgRoll = new Roll(dmgFormula || '0');
          await dmgRoll.evaluate();
        } catch (err) {
          flavor += `<br><em style="font-size:0.85em; color:#c0392b;">Invalid damage formula "${dmgFormulaRaw}" for ${weaponName}.</em>`;
        }

        if (dmgRoll) {
          let dmgTotal = dmgRoll.total;
          let bodyModNote = '';
          if (bodyModApplies) {
            const dmgMod = this.actor.system?.derived?.dmg;
            if (dmgMod?.type === 'flat' && dmgMod.value) {
              dmgTotal += dmgMod.value;
              bodyModNote = ` + BODY ${dmgMod.value >= 0 ? '+' : ''}${dmgMod.value}`;
            } else if (dmgMod?.type === 'dice' && dmgMod.value) {
              const bodyRoll = new Roll(dmgMod.value);
              await bodyRoll.evaluate();
              dmgTotal += bodyRoll.total;
              bodyModNote = ` + BODY ${dmgMod.value} (${bodyRoll.total})`;
            }
          }

          const { key, label: locLabel } = await this.constructor._rollHitLocationKey();
          flavor += `<br>Damage: <em>${dmgFormula || 0}</em> = ${dmgRoll.total}${bodyModNote} = <strong style="color:#c0392b;">${dmgTotal}</strong> to <strong>${locLabel}</strong>`;

          // Apply to the TARGET only, never the attacker. Exactly one targeted
          // token -> apply now; otherwise defer via the chat-card button.
          const targets = Array.from(game.user.targets);
          if (targets.length === 1 && targets[0].actor) {
            const targetActor = targets[0].actor;
            const applied = await this.constructor._applyLocationDamage(targetActor, key, dmgTotal);
            flavor += `<br>${targetActor.name}: ${this.constructor._formatDamageAppliedHtml(applied)}`;
          } else {
            flavor += `<br><button type="button" class="mf-apply-damage" data-loc-key="${key}" data-loc-label="${locLabel}" data-dmg="${dmgTotal}">Apply to targeted token</button>`;
          }
        }
      }
    }

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    await roll.toMessage({ speaker, flavor });
  }

  /**
   * Roll a Mecha tab Armament row: 1d10 + MR + Mecha skill (by weapon category) + WA.
   * Reads the row's derived data directly (system.mecha.weapons[idx]) rather than an
   * Item -- this is also the shape mook NPC attacks will read from, since the attack's
   * data already lives on the row.
   */
  async _rollMechaArmamentRow(button) {
    const idx = Number(button.dataset.idx);
    const row = this.actor.system?.mecha?.weapons?.[idx];
    if (!row || !row.category || !row.weaponKey) {
      ui.notifications.warn('Pick a weapon before rolling.');
      return;
    }

    // Weapon category -> the Mecha Combat Skill that attack rolls with it.
    const CATEGORY_SKILL = {
      beam: 'Mecha Gunnery (H)',
      projectile: 'Mecha Gunnery (H)',
      missile: 'Mecha Missiles (H)',
      melee: 'Mecha Melee (H)',
      energyMelee: 'Mecha Melee (H)'
    };
    const skillName = CATEGORY_SKILL[row.category] ?? null;
    const skill = skillName ? this.actor.items.find(i => i.type === 'skill' && i.name === skillName) : null;
    const rank = MektonActorSheet._num(skill?.system?.rank, 0);
    const mr = Number(this.actor.system?.mecha?.config?.mr ?? 0);
    const wa = MektonActorSheet._num(row.wa, 0);

    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const finalTotal = base + mr + rank + wa;

    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const explodedUp = plusDice.some(d => d === 10) ? 'Up' : '';
    const explodedDown = minusDice.some(d => d === 1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? ` <span style="color: #999; font-size: 0.85em;">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span style="color: #999; font-size: 0.85em;">[Cap ${maxExtra}]</span>` : '';

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const weaponName = row.name || 'Weapon';
    const skillLabel = skillName ? skillName.replace(' (H)', '') : 'Skill';
    const damageStr = (row.damage !== undefined && row.damage !== '') ? `${row.damage}K${row.damageNote ? ` (${row.damageNote})` : ''}` : '—';
    const shotsStr = row.shots || '—';
    const locStr = row.loc || 'unassigned';
    const flavor = `<strong>${this.actor.name}</strong> rolls ${weaponName} (${skillLabel})${tag}${capTag} = (${plusStr}${minusStr}) + MR ${mr} + Skill ${rank} + WA ${wa} = <strong style="font-size: 1.2em; color: #4a90e2;">${finalTotal}</strong><br><span style="font-size: 0.85em; color: #666;">Damage ${damageStr} &middot; Shots ${shotsStr} &middot; Loc ${locStr}</span>`;

    await roll.toMessage({ speaker, flavor });
  }
}
