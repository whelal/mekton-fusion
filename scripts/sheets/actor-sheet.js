// module/script/sheets/actor-sheet.js
import { MECHA_PRESETS, CREATURE_PRESETS, buildMechaPresetUpdate, buildCreaturePresetUpdate } from "../../module/data/mecha-presets.js";
import { WEAPON_OPTIONS, computeWeaponOptionsEffect, effectiveCombatWa, weaponSupportsOptions, summarizeWeaponOption } from "../../module/data/weapon-options.js";
import { ARMOR_ZONES, ARMOR_KINDS, effectiveCoverage } from "../../module/data/armor-coverage.js";
import { deriveArmorByLocation, seedZoneSP, ablatePersonalArmor } from "../../module/data/armor.js";
import { pickArmorCoverage } from "../../module/sheets/armor-coverage-ui.js";
import { CLOSE_TARGETS, CLOSE_MANEUVERS, MELEE_STRIKE_TARGETS, CLOSE_COMBAT_SKILLS, MOUTH_POSITIONS, maneuverTargets, closeTargetsFor, closeCalledPenalty, defaultCloseTarget, closeHitZone } from "../../module/data/close-combat.js";
import { applyHit, applyPodHit, locationFromRoll, burstHitCount, resolveMeleeParry, resolveEmwParry, parrySucceeds, salvoHitCount, salvoRows, salvoCritCounts, resolveShieldParry } from "../../module/data/mecha-damage.js";
import { SERVO_ROW_LOCATIONS } from "../../module/data/mecha-construction.js";
import { TABLE_RULINGS } from "../../module/rules/table-rulings.js";
import { escapeHtml } from "../../module/util/escape.js";
import { chainText, attackHeader, damageTo, targetLocation, isFriendlyFire } from "../../module/data/attack-card.js";

// Tie-break picker for locationFromRoll (several equally valid servos, e.g. two right arms).
const pickIndex = n => Math.floor(Math.random() * n);
const TIER_LABEL = { crit: 'Critical', mega: 'MEGA-CRIT' };

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
    this._mechaMode = 'play';
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

  // The Roll posted to chat: the dice roll plus its numeric modifiers, so the
  // card's big total is the final result rather than the bare die. Only for
  // _rollBidirectionalExplodingD10's purely numeric Roll -- a formula with dice
  // terms would be re-rolled here.
  static async _rollWithMods(roll, mods) {
    const terms = mods.map(n => Number(n) || 0).filter(n => n !== 0);
    const formula = roll.formula + terms.map(n => (n < 0 ? ` - ${-n}` : ` + ${n}`)).join('');
    const out = new Roll(formula);
    await out.evaluate();
    out.flags = roll.flags;
    return out;
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
   * Staged penetration: a hit of at least the personal ablation threshold
   * (ablatePersonalArmor) ablates that location's current SP by 1, whether or
   * not anything gets through. Not applied with ignoreSp (burning is already
   * past the armor, not a new hit).
   * Also resolves a Stun/Shock save when this single hit's post-armor damage
   * exceeds half the location's hits BEFORE the hit (1d10 <= substats.stun to
   * stay conscious).
   * @param {Actor} targetActor
   * @param {string} key - head/torso/rArm/lArm/rLeg/lLeg
   * @param {number} dmgTotal - rolled weapon damage (+ BODY mod if applicable), pre-armor
   * @param {{ignoreSp?: boolean}} [opts] - ignoreSp: damage is already post-armor (burning)
   * @returns {{sp:number, spNow:number, before:number, after:number, hitsNow:number, state:string, stun:object|null}}
   */
  static async _applyLocationDamage(targetActor, key, dmgTotal, { ignoreSp = false } = {}) {
    const loc = targetActor.system?.body?.locations?.[key];
    const sp = ignoreSp ? 0 : MektonActorSheet._num(loc?.sp, 0);
    const before = MektonActorSheet._num(loc?.hits, 0);
    const after = Math.max(0, dmgTotal - sp);
    const hitsNow = before - after;
    const { spNow, belowThreshold } = ignoreSp
      ? { spNow: sp, belowThreshold: false }
      : ablatePersonalArmor(sp, dmgTotal);
    const update = { [`system.body.locations.${key}.hits`]: hitsNow };
    if (spNow !== sp) update[`system.body.locations.${key}.sp`] = spNow;
    await targetActor.update(update);

    const state = MektonActorSheet._woundState(key, hitsNow);

    // No Stun/Shock save for the dead -- head or torso at DEAD, from this hit or an earlier one.
    const locs = targetActor.system?.body?.locations ?? {};
    const dead = ['head', 'torso'].some(k =>
      MektonActorSheet._woundState(k, k === key ? hitsNow : MektonActorSheet._num(locs[k]?.hits, 0)) === 'dead');

    let stun = null;
    if (!dead && after > 0 && after > before / 2) {
      const stunVal = MektonActorSheet._num(targetActor.system?.substats?.stun, 0);
      const stunRoll = new Roll('1d10');
      await stunRoll.evaluate();
      stun = { total: stunRoll.total, stunVal, conscious: stunRoll.total <= stunVal, roll: stunRoll };
    }

    return { sp, spNow, belowThreshold, before, after, hitsNow, state, stun };
  }

  /** Format an _applyLocationDamage() result as the chat-card HTML fragment (SP/hits/state/stun). */
  static _formatDamageAppliedHtml(applied) {
    const { sp, spNow, belowThreshold, before, after, hitsNow, state, stun } = applied;
    const stateLabel = MektonActorSheet._woundStateLabel(state);
    const stateColor = state === 'ok' ? '#2a2' : '#c0392b';
    const ablated = spNow !== undefined && spNow !== sp ? ` (ablated to ${spNow})`
      : belowThreshold ? `, no ablation (&lt;${TABLE_RULINGS.personalArmorAblationThreshold})` : '';
    let html = `SP ${sp} soaked${ablated}, ${after} through. Hits: ${before} &rarr; <strong>${hitsNow}</strong> &mdash; <strong style="color:${stateColor}">${stateLabel}</strong>`;
    if (stun) {
      const stunColor = stun.conscious ? '#2a2' : '#c0392b';
      html += `<br>Stun/Shock check (1d10 &le; ${stun.stunVal}): rolled <strong>${stun.total}</strong> &mdash; <strong style="color:${stunColor}">${stun.conscious ? 'CONSCIOUS' : 'DOWN'}</strong>`;
    }
    return html;
  }

  /**
   * Defender's Evade roll, human scale (MZ p.92): 1D10 (exploding) + REF +
   * Dodge & Escape, -1 if attacked from the flank, -2 from the rear. Free,
   * once per attack. Rolled on the attacker's client (no socket round-trip).
   * @param {Actor} targetActor
   * @param {number} [arcMod=0] - 0 front, -1 flank, -2 rear
   * @returns {Promise<{total:number, label:string, hasSkill:boolean}>}
   */
  static async _rollEvade(targetActor, arcMod = 0) {
    const ref = MektonActorSheet._num(targetActor.system?.stats?.REF?.value, 0);
    const skill = targetActor.items.find(i => i.type === 'skill' && i.name === 'Dodge & Escape');
    const dodge = skill ? MektonActorSheet._num(skill.system?.rank, 0) : 0;
    const { total: die, plusDice, minusDice } = await MektonActorSheet._rollBidirectionalExplodingD10();
    const total = die + ref + dodge + arcMod;
    const parts = [chainText(plusDice, minusDice), `REF ${ref}`, `Dodge ${dodge}`];
    if (arcMod) parts.push(`Arc ${arcMod}`);
    return { total, label: `${parts.join(' + ')} = ${total}`, hasSkill: !!skill };
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
      // Current SP is hand-editable (ablation/repair) but can never exceed the
      // armor-derived spMax. spMax itself isn't a form field anymore.
      for (const locKey of Object.keys(this.actor.system?.body?.locations ?? {})) {
        const spKey = `system.body.locations.${locKey}.sp`;
        if (formData[spKey] === undefined || formData[spKey] === '') continue;
        const max = Number(this.actor.system.body.locations[locKey].spMax) || 0;
        formData[spKey] = Math.min(Math.max(Number(formData[spKey]) || 0, 0), max);
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

    // Armor currently providing each body location's SP (highest wins), for the Body tab's Armor column.
    ctx.armorByLoc = {};
    for (const [loc, a] of Object.entries(deriveArmorByLocation(this.actor))) {
      const item = a.itemId ? this.actor.items.get(a.itemId) : null;
      if (item) ctx.armorByLoc[loc] = { id: item.id, name: item.name, sp: a.sp };
    }

    // Preset picker option lists (Mecha tab; Body tab's Creature section uses the other).
    ctx.mechaPresetOptions = Object.values(MECHA_PRESETS).map(p => ({ id: p.id, label: p.label }));
    ctx.creaturePresetOptions = Object.values(CREATURE_PRESETS).map(p => ({ id: p.id, label: p.label }));


    // Expose per-tab view states
    ctx._skillViewStateSkills = vsSkills;
    ctx._skillViewStatePsi = vsPsi;

    ctx.mechaMode = this._mechaMode;

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

    html.on('click', '.mf-remove-armor', ev => this._onUnequipBodyItem(ev));

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
        // current SP only: ablation/repair, clamped to the armor-derived spMax
        const newSP = Math.min(Math.max((data.sp ?? 0) + spAdjust, 0), data.spMax ?? 0);
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
    // didn't work. Dropping mesh/plate opens the coverage picker; a paperdoll
    // zone ([data-zone]) drop pre-ticks that zone.

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
    html.on('click', '.mf-close-combat', ev => { ev.preventDefault(); this._rollCloseCombat(); });
    html.on('click', '.weapon-damage-roll', ev => this._onRollWeaponDamage(ev));
    html.on('click', '.weapon-options', ev => this._onEditWeaponOptions(ev));
    html.on('click', '.weapon-hitloc-roll', ev => this._onRollHitLocation(ev));
    html.on('click', '.mf-roll-hitloc', ev => this._onRollHitLocation(ev));
    html.on('click', '.item-delete', ev => this._onDeleteWeapon(ev));
    html.on('change', '.weapon-field', ev => this._onChangeWeaponField(ev));

    // I.P. / Eurobucks ledgers (sidebar header receipt buttons).
    html.on('click', '.meta-ledger-btn', ev => this._onOpenLedger(ev));

    // Preset loaders (Mecha tab + Body tab's Creature section).
    html.on('click', '.load-preset-btn', ev => this._onLoadMechaPreset(ev));
    html.on('click', '.load-creature-preset-btn', ev => this._onLoadCreaturePreset(ev));

    // Mecha servo list (add/remove a servo beyond the fixed, undeletable torso row).
    html.on('click', '.mecha-servo-add', ev => this._onMechaServoAdd(ev));
    html.on('click', '.mecha-servo-delete', ev => this._onMechaServoDelete(ev));

    // Mecha Play/Build toggle + play-state controls.
    html.on('click', '.mecha-mode-toggle', ev => {
      ev.preventDefault();
      this._mechaMode = this._mechaMode === 'play' ? 'build' : 'play';
      html.find('.tab.mecha')
        .toggleClass('mf-mode-play', this._mechaMode === 'play')
        .toggleClass('mf-mode-build', this._mechaMode === 'build');
    });
    // -/+ steppers write to a named input, then trigger change so submitOnChange persists it.
    html.on('click', '.mp-step', ev => {
      ev.preventDefault();
      const btn = ev.currentTarget;
      const input = html.find(`input[name="${btn.dataset.target}"]`);
      if (!input.length) return;
      input.val(Math.max(0, (Number(input.val()) || 0) + Number(btn.dataset.delta))).trigger('change');
    });
    html.on('click', '.mp-repair-all', ev => this._onMechaDepot(ev));
    html.on('click', '.mp-apply-hit', ev => this._onMechaApplyHit(ev));
    html.on('click', '.mecha-weapon-burst', ev => this._onMechaBurst(ev));
    html.on('click', '.mp-parry', ev => this._onMechaParry(ev));
    html.on('click', '.mp-reload', ev => this._onMechaReload(ev));

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
      const l = this.actor.system?.body?.locations?.[loc];
      const cur = MektonActorSheet._num(l?.sp ?? 0, 0);
      const max = MektonActorSheet._num(l?.spMax ?? 0, 0);
      await this.actor.update({ [`system.body.locations.${loc}.sp`]: Math.min(max, Math.max(0, cur - 1)) });
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

  /**
   * Remove worn armor from a body location. SP is derived from armor Items
   * (see module/data/armor.js), and one armor Item can cover several
   * locations, so "unequip" means deleting the Item -- the deleteItem hook
   * then recomputes every location. If several pieces cover this location,
   * the user picks which.
   */
  async _onUnequipBodyItem(ev) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset?.loc; if (!loc) return;
    try {
      const coveredLocs = i => new Set(effectiveCoverage(i.system).map(z => ARMOR_ZONES[z].location));
      const covering = this.actor.items.filter(i => i.type === 'armor' && coveredLocs(i).has(loc));
      if (!covering.length) return;

      let target = covering[0];
      if (covering.length > 1) {
        const options = covering.map(i => `<option value="${i.id}">${foundry.utils.escapeHTML(i.name)} (SP ${i.system?.baseSP ?? 0})</option>`).join('');
        const chosenId = await Dialog.prompt({
          title: 'Remove which armor?',
          content: `<div class="form-group"><label>Armor covering this location</label><select name="armorId" style="width:100%">${options}</select></div>`,
          label: 'Remove',
          callback: html => html.find("[name='armorId']").val(),
          rejectClose: false
        });
        target = covering.find(i => i.id === chosenId);
        if (!target) return;
      }

      const others = coveredLocs(target).size > 1
        ? ' It covers other locations too; they lose it as well.' : '';
      const ok = await Dialog.confirm({
        title: `Remove ${target.name}?`,
        content: `<p>Deletes <strong>${foundry.utils.escapeHTML(target.name)}</strong> from this character.${others}</p>`
      });
      if (!ok) return;
      await target.delete();
    } catch (e) { console.error('mekton-fusion | Failed to remove armor', e); }
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
          options: { classes: ['dialog', 'mekton-fusion-dialog'], width: 380 },
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
    
    const flavorParts = [chainText(plusDice, minusDice), `${stat} ${statVal}`];
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
    const shown = await this.constructor._rollWithMods(roll, [statVal, mod]);
    await shown.toMessage({ speaker, flavor });
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
          options: { classes: ['dialog', 'mekton-fusion-dialog'], width: 380 },
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

    const flavorParts = [chainText(plusDice, minusDice)];
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
    const shown = await this.constructor._rollWithMods(roll, [mr, rank, mod]);
    await shown.toMessage({ speaker, flavor });
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
   * super._onDropItemCreate() below.
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

    // mecha-loadout drops stamp system.mecha/system.creature directly (same
    // effect as the Mecha/Body tabs' "Load Preset" pickers) and are never
    // embedded as an inventory Item -- pull them out before the rest go
    // through the normal create pipeline below.
    const loadouts = list.filter(d => d.type === 'mecha-loadout');
    const rest = list.filter(d => d.type !== 'mecha-loadout');
    for (const data of loadouts) {
      await this._applyMechaLoadout(data.system?.preset, data.system?.kind, data.name);
    }
    if (!rest.length) return [];

    for (const data of rest) {
      if (data.type !== 'weapon') continue;
      data.system = foundry.utils.mergeObject(data.system ?? {}, { isMecha: overMecha });
    }

    // Armor coverage (MZ core, Sample Armor Coverage): mesh/plate always opens
    // the picker so the player chooses the zones covered (a paperdoll-zone
    // drop pre-ticks just that zone; closing the picker cancels that piece).
    // Fixed-coverage kinds skip the picker. Each piece's per-zone current SP
    // is seeded from its baseSP. Body-location SP itself is recomputed by the
    // createItem hook in mekton-fusion.js.
    const dropZone = dropEl ? $(dropEl).closest('[data-zone]').attr('data-zone') : null;
    const toCreate = [];
    for (const data of rest) {
      if (data.type === 'armor') {
        const sys = data.system ??= {};
        let zones;
        if (ARMOR_KINDS[sys.kind]?.choosable) {
          zones = await pickArmorCoverage(data, ARMOR_ZONES[dropZone] ? [dropZone] : undefined);
          if (!zones) continue;
        } else {
          zones = effectiveCoverage(sys);
        }
        sys.coverage = zones;
        sys.currentSP = seedZoneSP(zones, sys.baseSP);
      }
      toCreate.push(data);
    }
    if (!toCreate.length) return [];

    const created = await super._onDropItemCreate(toCreate);
    for (const item of Array.isArray(created) ? created : [created]) {
      if (item?.type === 'armor' && !effectiveCoverage(item.system).length) {
        ui.notifications.warn(`${item.name} doesn't cover any body zone.`);
      }
    }
    return created;
  }

  /**
   * Apply a mecha-loadout Item's preset payload to this actor -- the same
   * effect as the Mecha/Body tabs' "Load Preset" pickers
   * (_onLoadMechaPreset/_onLoadCreaturePreset), just sourced from a dropped
   * compendium Item's `system.preset` instead of MECHA_PRESETS/
   * CREATURE_PRESETS[selectedId]. Overwrites the actor's current mecha (or
   * creature) loadout, so confirm first, same as the picker does.
   */
  async _applyMechaLoadout(preset, kind, label) {
    if (!preset || typeof preset !== 'object' || !Object.keys(preset).length) {
      ui.notifications.warn(`${label ?? 'This mecha loadout'} has no preset data to apply.`);
      return;
    }

    const isCreature = kind === 'creature';
    const confirmed = await Dialog.confirm({
      title: `Load ${label}?`,
      content: isCreature
        ? `<p>This overwrites BODY, natural armor SP, and natural weapons with <strong>${label}</strong>. Continue?</p>`
        : `<p>This overwrites the current Servos, Armament, Shields, Movement Systems, and Powerplant on the <strong>Mecha</strong> tab with <strong>${label}</strong>. Continue?</p>`
    });
    if (!confirmed) return;

    if (isCreature) {
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
      return;
    }

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
   * Pick the Weapon Options installed on an owned weapon. Options are
   * ranged-only (see weaponSupportsOptions); checkbox state is written
   * straight to the Item, same as the standalone Item sheet does.
   */
  async _onEditWeaponOptions(ev) {
    ev.preventDefault();
    const weapon = this.actor.items.get(ev.currentTarget.dataset.itemId);
    if (!weapon) return;
    if (!weaponSupportsOptions(weapon.system, weapon.type)) {
      ui.notifications.warn(`${weapon.name} can't take weapon options (melee, thrown, and mecha weapons can't).`);
      return;
    }
    const installed = new Set(weapon.system.options ?? []);
    const rows = Object.entries(WEAPON_OPTIONS).map(([key, opt]) => {
      const summary = summarizeWeaponOption(opt);
      return `<label style="display:block; margin-bottom:4px;">
        <input type="checkbox" name="opt_${key}" ${installed.has(key) ? 'checked' : ''}/> ${foundry.utils.escapeHTML(opt.label)}
        <span style="color:#666; font-size:0.85em;">(${foundry.utils.escapeHTML(summary)})</span>
      </label>`;
    }).join('');

    let keys;
    try {
      keys = await Dialog.prompt({
        title: `Options: ${weapon.name}`,
        content: `<div style="margin-bottom:6px;">${rows}</div>`,
        label: 'Save',
        callback: html => Object.keys(WEAPON_OPTIONS).filter(k => html.find(`[name='opt_${k}']`).is(':checked'))
      });
    } catch (_) { return; } // dialog cancelled
    await weapon.update({ 'system.options': keys });
  }

  /** Balance that existed before the ledger's first entry -- the fixed anchor point for recalculation. */
  static _ledgerBaseline(transactions, fallback = 0) {
    if (!transactions.length) return Number(fallback) || 0;
    return Number(transactions[0].total || 0) - Number(transactions[0].delta || 0);
  }

  /** Recompute running totals for a ledger from a fixed baseline (must be captured before any mutation). */
  static _recalcLedger(baseline, transactions) {
    let running = baseline;
    return transactions.map(t => {
      running += Number(t.delta) || 0;
      return { ...t, total: running };
    });
  }

  /**
   * Open a small ledger dialog for meta.points (I.P.) or meta.eurobucks (cash):
   * shows history, lets you add/edit/delete entries. Each entry is a signed
   * delta + a note; the running total is always recomputed from the ledger's
   * baseline rather than trusted from storage, so edits/deletes mid-history
   * stay consistent.
   */
  async _onOpenLedger(ev) {
    ev.preventDefault();
    const field = ev.currentTarget.dataset.field;
    if (!["points", "eurobucks"].includes(field)) return;
    const label = field === "points" ? "I.P." : "Eurobucks";
    const allowNegative = field === "eurobucks";

    const renderList = (transactions) => {
      const entries = (Array.isArray(transactions) ? transactions : [])
        .map((t, idx) => ({ t, idx }))
        .reverse();
      if (!entries.length) return `<p style="margin:4px 0;">No entries yet.</p>`;
      return `<ul style="list-style:none;margin:0;padding:0;">` + entries.map(({ t, idx }) => {
        const sign = t.delta >= 0 ? '+' : '';
        const when = t.time ? new Date(t.time).toLocaleString() : '';
        const noteText = foundry.utils.escapeHTML(t.note || '');
        return `<li data-index="${idx}" style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #eee;font-size:0.8rem;align-items:baseline;">
          <span style="font-weight:700;white-space:nowrap;">${sign}${t.delta} &rarr; ${t.total}</span>
          <span style="flex:1 1 auto;min-width:0;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${noteText}</span>
          <span style="color:#999;font-size:0.7rem;white-space:nowrap;">${when}</span>
          <button type="button" class="ledger-edit-btn" data-index="${idx}" title="Edit" style="width:20px;height:20px;padding:0;flex:0 0 auto;"><i class="fas fa-pencil-alt"></i></button>
          <button type="button" class="ledger-delete-btn" data-index="${idx}" title="Delete" style="width:20px;height:20px;padding:0;flex:0 0 auto;"><i class="fas fa-trash"></i></button>
        </li>`;
      }).join('') + `</ul>`;
    };

    const buildContent = () => {
      const current = this.actor.system?.meta?.[field] ?? { value: 0, transactions: [] };
      return `
        <div style="margin-bottom:8px;"><strong>Current ${label}: ${current.value}</strong></div>
        <div style="display:flex;gap:6px;align-items:flex-end;margin-bottom:8px;">
          <div style="flex:0 0 70px;"><label style="display:block;font-size:0.72rem;font-weight:700;">Delta</label><input type="number" name="delta" value="0" style="width:100%;box-sizing:border-box;"/></div>
          <div style="flex:1 1 auto;min-width:0;"><label style="display:block;font-size:0.72rem;font-weight:700;">Note</label><input type="text" name="note" style="width:100%;box-sizing:border-box;" placeholder="Reason..."/></div>
          <button type="button" name="addEntry" style="flex:0 0 auto;width:auto;white-space:nowrap;height:26px;padding:0 12px;">Add</button>
        </div>
        <div style="max-height:260px;overflow-y:auto;border-top:1px solid #999;padding-top:6px;">
          ${renderList(current.transactions)}
        </div>
      `;
    };

    /** Apply an updated transactions array against a pre-mutation baseline: recalc totals, persist, refresh. */
    const commit = async (baseline, transactions) => {
      const recalced = this.constructor._recalcLedger(baseline, transactions);
      const finalValue = recalced.length ? recalced[recalced.length - 1].total : baseline;
      const clampedValue = allowNegative ? finalValue : Math.max(0, finalValue);
      await this.actor.update({
        [`system.meta.${field}.value`]: clampedValue,
        [`system.meta.${field}.transactions`]: recalced
      });
      dlg.data.content = buildContent();
      dlg.render(true);
    };

    const dlg = new Dialog({
      title: `${label} Log`,
      content: buildContent(),
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        html.find('[name="addEntry"]').on('click', async () => {
          const deltaVal = Number(html.find('[name="delta"]').val()) || 0;
          const noteVal = String(html.find('[name="note"]').val() || '').trim();
          if (!deltaVal) return;
          const current = this.actor.system?.meta?.[field] ?? { value: 0, transactions: [] };
          const transactions = Array.isArray(current.transactions) ? current.transactions : [];
          const baseline = this.constructor._ledgerBaseline(transactions, current.value);
          const entry = { delta: deltaVal, total: 0, note: noteVal, time: Date.now() };
          await commit(baseline, [...transactions, entry]);
        });

        html.find('.ledger-edit-btn').on('click', async (clickEv) => {
          const idx = Number(clickEv.currentTarget.dataset.index);
          const current = this.actor.system?.meta?.[field] ?? { value: 0, transactions: [] };
          const transactions = Array.isArray(current.transactions) ? current.transactions : [];
          const entry = transactions[idx];
          if (!entry) return;

          const result = await Dialog.prompt({
            title: `Edit ${label} Entry`,
            content: `
              <div style="margin-bottom:8px;"><label style="display:block;font-size:0.72rem;font-weight:700;">Delta</label><input type="number" name="delta" value="${entry.delta}" style="width:100%;box-sizing:border-box;"/></div>
              <div><label style="display:block;font-size:0.72rem;font-weight:700;">Note</label><input type="text" name="note" value="${foundry.utils.escapeHTML(entry.note || '')}" style="width:100%;box-sizing:border-box;"/></div>
            `,
            label: "Save",
            callback: (h) => ({
              delta: Number(h.find('[name="delta"]').val()) || 0,
              note: String(h.find('[name="note"]').val() || '').trim()
            })
          }).catch(() => null);
          if (!result) return;

          const baseline = this.constructor._ledgerBaseline(transactions, current.value);
          const updated = [...transactions];
          updated[idx] = { ...entry, delta: result.delta, note: result.note };
          await commit(baseline, updated);
        });

        html.find('.ledger-delete-btn').on('click', async (clickEv) => {
          const idx = Number(clickEv.currentTarget.dataset.index);
          const current = this.actor.system?.meta?.[field] ?? { value: 0, transactions: [] };
          const transactions = Array.isArray(current.transactions) ? current.transactions : [];
          if (!transactions[idx]) return;
          const confirmed = await Dialog.confirm({
            title: "Delete Entry",
            content: `<p>Delete this ${label} log entry?</p>`,
            yes: () => true,
            no: () => false
          });
          if (!confirmed) return;
          const baseline = this.constructor._ledgerBaseline(transactions, current.value);
          const updated = transactions.filter((_, i) => i !== idx);
          await commit(baseline, updated);
        });
      }
    }, { width: 460 });
    dlg.render(true);
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

    // Area weapons (grenades) resolve their blast around the targeted token instead.
    if (MektonActorSheet._blastOf(weapon)) {
      const weaponLabel = weapon.system?.name || weapon.name;
      const html = await this._resolveBlast(weapon, weaponLabel);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<strong>${this.actor.name}</strong>: ${weaponLabel}${html}`
      });
      return;
    }

    const formula = (weapon.system?.damage ?? '').trim();
    if (!formula) {
      ui.notifications.warn(`${weapon.name} has no damage formula set.`);
      return;
    }

    // Validate formula before rolling (a trailing "+" is stripped and the BODY damage mod added)
    const skillBonus = MektonActorSheet._meleeSkillDamageBonus(this.actor, weapon);
    let result;
    try {
      result = await this._rollDamageFormula(formula, skillBonus);
    } catch (err) {
      ui.notifications.error(`Invalid damage formula "${formula}" for ${weapon.name}.`);
      return;
    }

    const weaponName = weapon.system?.name || weapon.name;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const breakdown = (result.bodyModNote || result.skillBonusNote) ? ` = ${result.roll.total}${result.bodyModNote}${result.skillBonusNote}` : '';
    const flavor = `<strong>${this.actor.name}</strong> rolls damage for <strong>${weaponName}</strong>: <em>${formula}</em>${breakdown} = <strong style="font-size: 1.2em; color: #c0392b;">${result.total}</strong>`;
    await result.roll.toMessage({ speaker, flavor });
  }

  /**
   * Fencing (H) and Martial Art (H) are alternative skills for bladed /
   * hand-to-hand weapons respectively (Blade/Hand to Hand stay the default);
   * choosing them on a weapon's skill field adds floor(rank/2) to its damage
   * -- rank 1 -> +0, rank 2 -> +1, rank 4 -> +2. Flat, not per die, and not
   * affected by the BODY damage mod's own type.
   */
  static _meleeSkillDamageBonus(actor, weapon) {
    const ALT_SKILLS = { fencing: 'Fencing (H)', 'martial-art': 'Martial Art (H)' };
    const skillName = ALT_SKILLS[weapon?.system?.skill];
    if (!skillName) return 0;
    const skillItem = actor.items.find(i => i.type === 'skill' && i.name === skillName);
    return Math.floor(MektonActorSheet._num(skillItem?.system?.rank, 0) / 2);
  }

  /**
   * Roll a weapon damage string. A trailing "+" means the BODY TYPE damage
   * modifier applies (flat or dice) -- by that marker, not by weapon type or
   * skill, ranged or melee alike. Everything before it goes to Foundry's Roll,
   * which rejects the "+" itself. Throws if the remainder isn't a valid formula.
   * `skillBonus` is the flat Fencing/Martial Art add-on (see _meleeSkillDamageBonus).
   * @param {string} raw - e.g. "2D10+", "1D6", "3D6/2+"
   * @param {number} [skillBonus=0]
   * @returns {Promise<{formula:string, roll:Roll, total:number, bodyModApplies:boolean, bodyModNote:string, skillBonusNote:string}>}
   */
  async _rollDamageFormula(raw, skillBonus = 0) {
    const bodyModApplies = raw.endsWith('+');
    const formula = bodyModApplies ? raw.slice(0, -1).trim() : raw;
    const roll = new Roll(formula || '0');
    await roll.evaluate();

    let total = roll.total;
    let bodyModNote = '';
    if (bodyModApplies) {
      const dmgMod = this.actor.system?.derived?.dmg;
      if (dmgMod?.type === 'flat' && dmgMod.value) {
        total += dmgMod.value;
        bodyModNote = ` + BODY ${dmgMod.value >= 0 ? '+' : ''}${dmgMod.value}`;
      } else if (dmgMod?.type === 'dice' && dmgMod.value) {
        const bodyRoll = new Roll(dmgMod.value);
        await bodyRoll.evaluate();
        total += bodyRoll.total;
        bodyModNote = ` + BODY ${dmgMod.value} (${bodyRoll.total})`;
      }
    }
    let skillBonusNote = '';
    if (skillBonus) {
      total += skillBonus;
      skillBonusNote = ` + Skill +${skillBonus}`;
    }
    return { formula, roll, total, bodyModApplies, bodyModNote, skillBonusNote };
  }

  /**
   * Set an actor burning after an incendiary: `burn` maps location -> the damage
   * that location just took (post-armor). Each later round every burning
   * location takes HALF of what it took the round before (rounded down), and
   * stops burning once that would be under 1 (see tickBurning). Re-igniting
   * keeps the higher value per location.
   */
  static async _igniteActor(actor, burn) {
    const existing = actor.getFlag('mekton-fusion', 'burning') ?? {};
    const merged = { ...existing };
    for (const [loc, dmg] of Object.entries(burn)) merged[loc] = Math.max(Number(merged[loc]) || 0, dmg);
    // unset first: setFlag deep-merges objects, which would resurrect locations dropped from `merged`
    await actor.unsetFlag('mekton-fusion', 'burning');
    await actor.setFlag('mekton-fusion', 'burning', merged);
    try { await actor.toggleStatusEffect('burning', { active: true }); } catch (e) { /* visual aid only */ }
  }

  /**
   * Advance every burning actor on the combat's scene by one round: each
   * burning location takes half its previous damage (rounded down) straight to
   * Hits -- it's already past armor -- and the actor stops burning when no
   * location has 1+ left. Runs on the active GM's client at each new round
   * (see the updateCombat hook in mekton-fusion.js).
   */
  static async tickBurning(combat) {
    const scene = combat.scene ?? canvas.scene;
    const actors = new Map();
    for (const t of scene?.tokens ?? []) if (t.actor) actors.set(t.actor.uuid, t.actor);

    const LABEL = { head: 'Head', torso: 'Torso', rArm: 'R Arm', lArm: 'L Arm', rLeg: 'R Leg', lLeg: 'L Leg' };
    for (const actor of actors.values()) {
      const burn = actor.getFlag('mekton-fusion', 'burning');
      if (!burn) continue;

      const next = {};
      const lines = [];
      for (const [loc, last] of Object.entries(burn)) {
        const dmg = Math.floor((Number(last) || 0) / 2);
        if (dmg < 1) continue;
        const applied = await MektonActorSheet._applyLocationDamage(actor, loc, dmg, { ignoreSp: true });
        const wound = applied.state !== 'ok' ? ` <strong style="color:#c0392b">${MektonActorSheet._woundStateLabel(applied.state)}</strong>` : '';
        const stun = applied.stun ? ` [Stun ${applied.stun.total} vs ${applied.stun.stunVal}: ${applied.stun.conscious ? 'ok' : 'DOWN'}]` : '';
        lines.push(`${LABEL[loc] ?? loc} ${dmg} (Hits ${applied.before} &rarr; ${applied.hitsNow})${wound}${stun}`);
        if (Math.floor(dmg / 2) >= 1) next[loc] = dmg;
      }

      await actor.unsetFlag('mekton-fusion', 'burning');
      const stillBurning = Object.keys(next).length > 0;
      if (stillBurning) await actor.setFlag('mekton-fusion', 'burning', next);
      else { try { await actor.toggleStatusEffect('burning', { active: false }); } catch (e) { /* visual aid only */ } }

      if (lines.length) {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> is burning: ${lines.join(', ')}${stillBurning ? '' : ' &mdash; <em>the fire goes out.</em>'}`
        });
      }
    }
  }

  /** {radius, effect} if the weapon is an area weapon (grenade), else null. */
  static _blastOf(weapon) {
    const radius = Number(weapon?.system?.blastRadius) || 0;
    const effect = weapon?.system?.blastEffect || '';
    return radius > 0 && effect ? { radius, effect } : null;
  }

  /**
   * Resolve a grenade-style blast centred on the single targeted token: every
   * token on the scene within `blastRadius` metres (measured centre to centre
   * in scene units -- the scene's distance unit is expected to be metres) is
   * affected, the thrower included if inside the radius.
   *   damage       one damage roll for the whole blast; each target rolls its
   *                own hit location and soaks it through that location's SP
   *   perLocation  every target takes a SEPARATE damage roll on EACH of the six
   *                locations (Incendiary), each soaking through that
   *                location's SP
   *   sleep        each target rolls a Stun/Shock save at -3 (1d10 <= stun - 3
   *                keeps them awake); a failure falls asleep (core "sleep"
   *                status)
   * Returns chat HTML to append to the attack/damage card.
   */
  async _resolveBlast(weapon, weaponName) {
    const { radius, effect } = MektonActorSheet._blastOf(weapon);
    const targets = Array.from(game.user.targets);
    if (targets.length !== 1) {
      return `<br><em style="font-size:0.85em; color:#c0392b;">${weaponName} needs exactly one targeted token as the point of impact (${targets.length} targeted) -- no blast resolved.</em>`;
    }
    if (!canvas?.grid || !canvas.tokens) return '<br><em>No active scene to measure the blast on.</em>';

    const center = targets[0].center;
    const inBlast = canvas.tokens.placeables
      .filter(t => t.actor && canvas.grid.measurePath([center, t.center]).distance <= radius + 1e-6)
      .sort((a, b) => a.name.localeCompare(b.name));

    let html = `<br><strong>Blast</strong> (${radius}m around ${foundry.utils.escapeHTML(targets[0].name)}): ${inBlast.length} in radius`;
    // No friendly-fire prompt for an area blast: everyone in the radius is hit, and the card says who.
    const mine = this._attackerDisposition();
    const friendlies = inBlast.filter(t => isFriendlyFire(mine, t.document?.disposition));
    if (friendlies.length) {
      html += `<br><strong style="color:#c0392b;">Friendly fire:</strong> ${friendlies.map(t => escapeHtml(t.name)).join(', ')}`;
    }
    const unit = (canvas.scene?.grid?.units ?? '').trim().toLowerCase();
    if (unit && !['m', 'meter', 'meters', 'metre', 'metres'].includes(unit)) {
      html += ` <em style="font-size:0.85em; color:#c0392b;">(scene distance unit is "${foundry.utils.escapeHTML(unit)}", not metres -- radius measured in scene units)</em>`;
    }

    // One damage roll for the whole blast (damage effect only).
    let shared = null;
    if (effect === 'damage') {
      try {
        shared = await this._rollDamageFormula((weapon.system?.damage ?? '').trim());
      } catch (err) {
        return html + `<br><em style="font-size:0.85em; color:#c0392b;">Invalid damage formula "${foundry.utils.escapeHTML(weapon.system?.damage ?? '')}" for ${weaponName}.</em>`;
      }
      html += ` -- damage <strong style="color:#c0392b;">${shared.total}</strong>`;
    }

    const LOCS = ['head', 'torso', 'rArm', 'lArm', 'rLeg', 'lLeg'];
    const LABEL = { head: 'Head', torso: 'Torso', rArm: 'R Arm', lArm: 'L Arm', rLeg: 'R Leg', lLeg: 'L Leg' };

    for (const token of inBlast) {
      const actor = token.actor;
      html += `<br>&bull; <strong>${foundry.utils.escapeHTML(token.name)}</strong>: `;
      try {
        if (effect === 'damage') {
          const { key, label } = await this.constructor._rollHitLocationKey();
          const applied = await this.constructor._applyLocationDamage(actor, key, shared.total);
          html += `${label} -- ${this.constructor._formatDamageAppliedHtml(applied)}`;
        } else if (effect === 'perLocation') {
          const parts = [];
          const burn = {};
          for (const key of LOCS) {
            const r = await this._rollDamageFormula((weapon.system?.damage ?? '').trim());
            const applied = await this.constructor._applyLocationDamage(actor, key, r.total);
            if (Math.floor(applied.after / 2) >= 1) burn[key] = applied.after;
            const wound = applied.state !== 'ok' ? ` <strong style="color:#c0392b">${this.constructor._woundStateLabel(applied.state)}</strong>` : '';
            const stun = applied.stun ? ` [Stun ${applied.stun.total} vs ${applied.stun.stunVal}: ${applied.stun.conscious ? 'ok' : 'DOWN'}]` : '';
            parts.push(`${LABEL[key]} ${r.total} (${applied.after} through)${wound}${stun}`);
          }
          html += parts.join(', ');
          if (Object.keys(burn).length) {
            await MektonActorSheet._igniteActor(actor, burn);
            html += ` <em style="color:#c0392b;">-- BURNING (${Object.entries(burn).map(([k, v]) => `${LABEL[k]} next round ${Math.floor(v / 2)}`).join(', ')})</em>`;
          }
        } else if (effect === 'sleep') {
          const stunVal = MektonActorSheet._num(actor.system?.substats?.stun, 0);
          const threshold = stunVal - 3;
          const save = new Roll('1d10');
          await save.evaluate();
          const awake = save.total <= threshold;
          if (!awake) {
            try { await actor.toggleStatusEffect('sleep', { active: true }); } catch (e) { /* status is a visual aid; the result below still stands */ }
          }
          html += `Stun/Shock (1d10 &le; ${stunVal} &minus; 3 = ${threshold}): rolled <strong>${save.total}</strong> &mdash; <strong style="color:${awake ? '#2a2' : '#c0392b'}">${awake ? 'STAYS AWAKE' : 'FALLS ASLEEP'}</strong>`;
        }
      } catch (err) {
        console.error('mekton-fusion | Blast failed for', token.name, err);
        html += `<em style="color:#c0392b;">could not be updated (no permission?) -- GM must apply this one manually</em>`;
      }
    }
    return html;
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

  /** Add a servo (arm/leg/head/wing/tail/pod) beyond the fixed torso row. Defaults to a right arm. */
  async _onMechaServoAdd(ev) {
    ev.preventDefault();
    const servos = this.actor.toObject().system.mecha.servos ?? [];
    servos.push({ id: foundry.utils.randomID(), kind: "arm", side: "r", level: "", extremityKey: "", armor: "" });
    await this.actor.update({ "system.mecha.servos": servos });
  }

  /**
   * Remove a servo (never the torso). Clears any `loc` reference to it on
   * weapons/shields/sensors/movementSystems/subassembly items in the same
   * update, so nothing points at a servo that no longer exists; drops its
   * damage-taken entry and moves a cockpit mounted there back to the torso.
   */
  async _onMechaServoDelete(ev) {
    ev.preventDefault();
    const id = ev.currentTarget.dataset.id;
    if (!id) return;
    const servo = this.actor.system.mecha?.servos?.find(s => s?.id === id);
    if (servo?.kind === "torso") { ui.notifications.warn("The torso can't be removed."); return; }

    const confirmed = await Dialog.confirm({
      title: "Remove Servo?",
      content: `<p>Remove ${servo?.servo ?? "this servo"}? Anything mounted on it (weapons, shields, sensors, movement systems, subassembly items) will show as unassigned.</p>`
    });
    if (!confirmed) return;

    const src = this.actor.toObject().system.mecha;
    const clearLoc = row => row.loc === id ? { ...row, loc: "" } : row;
    const update = {
      "system.mecha.servos": (src.servos ?? []).filter(s => s.id !== id),
      "system.mecha.weapons": (src.weapons ?? []).map(clearLoc),
      "system.mecha.shields": (src.shields ?? []).map(clearLoc),
      "system.mecha.sensors": (src.sensors ?? []).map(clearLoc),
      "system.mecha.movementSystems": (src.movementSystems ?? []).map(clearLoc),
      "system.mecha.subassemblies.items": (src.subassemblies?.items ?? []).map(clearLoc),
      [`system.mecha.damage.-=${id}`]: null
    };
    if (src.subassemblies?.cockpit?.loc === id) update["system.mecha.subassemblies.cockpit.loc"] = "torso";
    await this.actor.update(update);
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

  /** Depot maintenance (not a field action): repair all damage, refill every weapon, restock all clips, restore parry wear. */
  async _onMechaDepot(ev) {
    ev.preventDefault();
    const ok = await Dialog.confirm({ title: 'Depot Maintenance', content: '<p>Repair all damage, rearm every weapon, and restock spare clips?</p>' });
    if (!ok) return;
    const src = this.actor._source.system.mecha;
    const damage = Object.fromEntries(Object.keys(src.damage ?? {}).map(k => [k, { kills: 0, sp: 0 }]));
    const weapons = foundry.utils.deepClone(src.weapons ?? []).map(w => ({ ...w, shotsUsed: 0, clipsUsed: 0, partialClips: '', killsUsed: 0 }));
    const shields = foundry.utils.deepClone(src.shields ?? []).map(s => ({ ...s, spUsed: 0 }));
    await this.actor.update({ 'system.mecha.damage': damage, 'system.mecha.weapons': weapons, 'system.mecha.shields': shields });
  }

  /**
   * Apply one hit of `kills` damage to `actor`'s mecha at servo `loc` (its `id`,
   * aliased via `locKey`): one aimed hit through _applyMechaSalvo, so servos and
   * pods resolve the same way from every Apply button.
   */
  static async _applyMechaHit(actor, loc, kills, { megaCrit = false } = {}) {
    if (!actor.system.mecha?.servos?.some(s => s?.locKey === loc)) {
      ui.notifications.warn(`${actor.name}: no servo at ${loc}.`);
      return null;
    }
    return MektonActorSheet._applyMechaSalvo(actor, { kills, hits: 1, megaCrit, servoId: loc });
  }

  /** Sheet button: prompt for one attack's damage and apply it to this mech. */
  async _onMechaApplyHit(ev) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset.loc;
    let form;
    try {
      form = await Dialog.prompt({
        title: 'Apply Hit',
        content: `<p>Damage from one attack (Kills):</p><input type="number" name="dmg" min="0" value="0" style="width:100%" autofocus/>`
          + `<p><label><input type="checkbox" name="mega"/> Mega-Crit (bypasses armor entirely, no ablation)</label></p>`,
        label: 'Apply',
        callback: html => ({ dmg: Number(html.find("[name='dmg']").val()) || 0, megaCrit: html.find("[name='mega']").is(':checked') })
      });
    } catch (_) { return; }
    if (!form.dmg) return;
    await MektonActorSheet._applyMechaHit(this.actor, loc, form.dmg, { megaCrit: form.megaCrit });
  }

  /**
   * Apply a salvo of `hits` attacks of `kills` damage each to `actor`'s mecha,
   * rolling hit location per the Hit Location Chart (locationFromRoll,
   * mecha-damage.js) unless `servoId` pins an aimed shot. Hits in the same
   * salvo stack sequentially on a working copy of damage-taken, so an earlier
   * hit's ablation/Kills affect how a later hit in the same salvo resolves.
   * One actor.update; one chat card listing every hit's d10 roll and outcome.
   * `missile` (a missile salvo, MZ ATM Missile Hit Determination): with a random
   * location, roll ONE start d10 and walk down the chart one row per missile
   * (salvoRows); crits come from the raw `margin` (salvoCritCounts) and land on the
   * first missiles -- mega-crits, then crits, then normal hits. Several non-missile
   * hits with a margin (mecha autofire, MZ ATM) are counted the same way, each hit
   * rolling its own location. A single hit takes one tier: `megaCrit` (checkbox) or
   * `tier` (critTier of the margin).
   * `chart` "special"/"cinematic" (attacker's choice on a Critical, RAW) posts each
   * Critical hit for manual resolution -- as the walk's row number on that chart
   * when there is one -- and applies nothing for it.
   * A pod (MZ ATM, Pod Servo) resolves through applyPodHit: penetrating Kills go to
   * a weapon mounted in it (its killsUsed), and the pod falls when they all do.
   * `killsPerHit` (parried through-damage) overrides `kills` hit by hit; a 0 entry
   * was stopped by the shield. `extraUpdate` / `intro` are merged into this call's
   * single actor.update and prepended to its chat card.
   */
  static async _applyMechaSalvo(actor, { kills, hits = 1, megaCrit = false, servoId = null, missile = false, margin = null, chart = 'normal', tier = null, killsPerHit = null, extraUpdate = {}, intro = '', extraRolls = [] } = {}) {
    const servos = (actor.system.mecha?.servos ?? []).filter(s => s?.id);
    if (!servos.length) { ui.notifications.warn(`${actor.name}: no servos to hit.`); return null; }
    const servoById = Object.fromEntries(servos.map(s => [s.id, s]));
    const mechName = escapeHtml(actor.system.mecha.name || actor.name);
    // Weapons working copy: a pod hit damages the weapons mounted in it (killsUsed).
    const derivedWeapons = actor.system.mecha?.weapons ?? [];
    const weaponsWork = foundry.utils.deepClone(actor._source.system.mecha.weapons ?? []);
    let weaponsTouched = false;

    // Per-hit crit kind: a missile salvo -- or any multi-hit attack with a margin (mecha
    // autofire uses the salvo method, MZ ATM) -- counts them from the margin onto the
    // first hits; a single hit takes one tier (the Mega-Crit box or the margin's tier).
    const counts = (missile || (margin !== null && hits > 1)) ? salvoCritCounts(margin ?? 0, hits) : null;
    const kindOf = i => counts
      ? (i <= counts.mega ? 'mega' : i <= counts.mega + counts.crit ? 'crit' : 'normal')
      : (megaCrit ? 'mega' : tier === 'crit' ? 'crit' : 'normal');
    const tierLabel = counts
      ? [counts.mega && `${counts.mega} Mega-Crit`, counts.crit && `${counts.crit} Critical`].filter(Boolean).join(', ')
      : (megaCrit ? TIER_LABEL.mega : (TIER_LABEL[tier] ?? ''));
    const dmgText = killsPerHit ? 'damage past the shield' : `${kills}K`;
    const header = `<strong>${mechName}</strong> takes ${hits} hit${hits === 1 ? '' : 's'} of ${dmgText}${tierLabel ? ` — <strong>${tierLabel}</strong>` : ''}`;
    const chartName = chart === 'special' ? 'Special' : chart === 'cinematic' ? 'Cinematic' : null;

    // Running damage-taken per servo, seeded from current state, mutated hit by
    // hit so later hits in this salvo see earlier ones' effects.
    const working = {};
    const takenFor = id => working[id] ?? (working[id] = { kills: servoById[id].dmgKills, sp: servoById[id].dmgSp });

    const rolls = [...extraRolls];
    const lines = [];
    let ejectWarning = false;

    // Missile salvo walk: one start roll, then down the chart one row per missile, wrapping 10 -> 1.
    let walkRows = null;
    const emptyOther = !servos.some(s => s.kind === 'wing' || s.kind === 'tail');
    const skipNine = emptyOther && TABLE_RULINGS.salvoWalkEmptyOther === 'skip';
    if (missile && !servoId) {
      const start = await new Roll('1d10').evaluate();
      rolls.push(start);
      walkRows = salvoRows(start.total, hits, skipNine ? [9] : []);
      lines.push(`<li>Start d10 ${start.total}, walking down the chart${skipNine ? ' (no wing/tail: 9 skipped)' : ''}.</li>`);
    }

    for (let i = 1; i <= hits; i++) {
      const kind = kindOf(i);
      const label = missile ? `Missile ${i}` : `Hit ${i}`;
      const kindTag = kind === 'mega' ? ' (Mega-Crit)' : kind === 'crit' ? ' (Critical)' : '';
      const hitKills = killsPerHit ? (Number(killsPerHit[i - 1]) || 0) : kills;
      if (killsPerHit && hitKills <= 0) {
        lines.push(`<li>${label}: stopped by the shield.</li>`);
        continue;
      }

      // Critical on the Special/Cinematic chart (attacker's choice): the walk's row
      // number is the result on that chart; nothing is applied automatically.
      if (kind === 'crit' && chartName) {
        lines.push(walkRows
          ? `<li>${label}: row ${walkRows[i - 1]} → <strong>Critical</strong>: resolve as ${walkRows[i - 1]} on the ${chartName} chart.</li>`
          : `<li>${label}: <strong>Critical</strong> -- resolve on the ${chartName} chart (attacker's choice).</li>`);
        continue;
      }

      let loc, tag;
      if (walkRows) {
        tag = `row ${walkRows[i - 1]}`;
        loc = locationFromRoll(walkRows[i - 1], servos, pickIndex);
        // TABLE_RULINGS.salvoWalkEmptyOther "reroll": a walked 9 with no wing/tail
        // rerolls a fresh d10 for this missile only ("skip" never reaches here with a 9).
        for (let attempts = 0; loc.reroll && attempts < 20; attempts++) {
          const rr = await new Roll('1d10').evaluate();
          rolls.push(rr);
          tag += ` → reroll d10 ${rr.total}`;
          loc = locationFromRoll(rr.total, servos, pickIndex);
        }
      } else if (servoId) {
        loc = { servoId, special: false, reroll: false };
        tag = 'aimed';
      } else {
        let roll, attempts = 0;
        do {
          roll = await new Roll('1d10').evaluate();
          rolls.push(roll);
          loc = locationFromRoll(roll.total, servos, pickIndex);
          attempts++;
        } while (loc.reroll && attempts < 20);
        tag = `d10 ${roll.total}`;
      }

      if (loc.special) {
        lines.push(`<li>${label}: ${tag} → <strong>Special hit</strong>${kindTag} -- resolve on the Special chart.</li>`);
        continue;
      }
      const servo = loc.servoId ? servoById[loc.servoId] : null;
      if (!servo) {
        lines.push(`<li>${label}: ${tag} → no servo there.</li>`);
        continue;
      }
      if (servo.kind === 'pod') {
        const inPod = weaponsWork.map((w, wi) => ({ w, d: derivedWeapons[wi] }))
          .filter(x => x.d?.weaponKey && x.d.loc === servo.id && Number(x.d.hits) > 0);
        const p = applyPodHit({ maxSP: servo.sp, taken: takenFor(servo.id) }, hitKills,
          inPod.map(x => ({ maxKills: x.d.hits, takenKills: x.w.killsUsed })), { megaCrit: kind === 'mega', rand: pickIndex });
        working[servo.id] = p.taken;
        if (p.wasDestroyed) {
          lines.push(`<li>${label}: ${tag} → ${escapeHtml(servo.servo)} -- already destroyed, no effect.</li>`);
          continue;
        }
        const parts = [`${p.through}K through`, p.ablated ? 'SP -1' : 'SP unaffected'];
        if (p.systemIndex !== null) {
          const x = inPod[p.systemIndex];
          x.w.killsUsed = p.systemTaken;
          weaponsTouched = true;
          parts.push(`to ${escapeHtml(x.d.name || 'weapon')} (Kills ${Math.max(0, x.d.hits - p.systemTaken)}/${x.d.hits})${p.systemDestroyed ? ' <strong>DESTROYED</strong>' : ''}`);
        } else if (p.through > 0 && !inPod.length) {
          parts.push('empty pod: no system to damage');
        }
        if (p.cause === 'armor') parts.push('<strong>POD DESTROYED</strong> (armor gone: its contents are dropped and go offline)');
        else if (p.cause === 'systems') parts.push('<strong>POD DESTROYED</strong> (every weapon in it destroyed)');
        lines.push(`<li>${label}: ${tag} → <strong>${escapeHtml(servo.servo)}</strong>${kindTag}: ${parts.join(' · ')}</li>`);
        if (p.destroyed && actor.system.mecha?.subassemblies?.cockpit?.loc === servo.id) ejectWarning = true;
        continue;
      }

      const r = applyHit({ maxKills: servo.hits, maxSP: servo.sp, taken: takenFor(servo.id) }, hitKills, { megaCrit: kind === 'mega' });
      working[servo.id] = r.taken;

      if (r.wasDestroyed) {
        lines.push(`<li>${label}: ${tag} → ${escapeHtml(servo.servo)} -- already destroyed, no effect.</li>`);
        continue;
      }
      const parts = [`${r.through}K through`, r.ablated ? 'SP -1' : 'SP unaffected'];
      if (r.destroyed) parts.push('<strong>DESTROYED</strong>');
      lines.push(`<li>${label}: ${tag} → <strong>${escapeHtml(servo.servo)}</strong>${kindTag}: ${parts.join(' · ')}</li>`);

      if (r.destroyed && actor.system.mecha?.subassemblies?.cockpit?.loc === servo.id) ejectWarning = true;
    }

    const update = { ...extraUpdate };
    for (const [id, t] of Object.entries(working)) {
      update[`system.mecha.damage.${id}.sp`] = t.sp;
      update[`system.mecha.damage.${id}.kills`] = t.kills;
    }
    if (weaponsTouched) update['system.mecha.weapons'] = weaponsWork;
    if (Object.keys(update).length) await actor.update(update);

    let content = `${intro}${header}:<ul>${lines.join('')}</ul>`;
    if (ejectWarning) content += `<p><strong>Pilot must make an Emergency Ejection roll.</strong></p>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls });
    return { taken: working, rolls };
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
   * Resolve the defense against a human-scale attack total: the single
   * targeted token's opposed Evade, else an optional GM Difficulty. Targets
   * are re-read now: the user may have changed them while the dialog was open.
   * success: true hit / false miss / null no defense (treated as a hit).
   * margin: attack - defense total, or null when there was nothing to beat.
   */
  async _resolveAttackDefense(attackTotal, { defense, difficulty, arcMod }) {
    const targets = Array.from(game.user.targets);
    const targetActor = targets.length === 1 ? targets[0].actor : null;
    let success = null;
    let margin = null;
    let resultTag = '';
    if (defense === 'evade' && targetActor) {
      const ev = await this.constructor._rollEvade(targetActor, arcMod);
      success = attackTotal > ev.total; // Evade >= attack: the attack fails (MZ p.92)
      margin = attackTotal - ev.total;
      const noSkill = ev.hasSkill ? '' : ' <em style="font-size:0.85em; color:#999;">(no Dodge &amp; Escape skill)</em>';
      resultTag = `<br>${escapeHtml(targetActor.name)} Evades: ${ev.label}${noSkill} &mdash; <strong style="color: ${success ? 'green' : 'red'}">${success ? `HIT by ${margin}` : 'EVADED'}</strong>`;
    } else {
      if (defense === 'evade') {
        ui.notifications.warn('Evade needs exactly one targeted token -- resolving with no defense roll.');
      }
      if (difficulty !== null) {
        success = attackTotal > difficulty; // ties go to the defender in all combat (MZ core, Evade Rolls)
        margin = attackTotal - difficulty;
        resultTag = ` vs Difficulty ${difficulty} = <strong style="color: ${success ? 'green' : 'red'}">${success ? 'SUCCESS' : 'FAILURE'}</strong>`;
      }
    }
    return { targetActor, success, margin, resultTag };
  }

  /** Names of the user's targeted tokens, for attack-card headers. */
  static _targetNames() {
    return Array.from(game.user.targets).map(t => t.name);
  }

  /**
   * The attacker's token disposition (CONST.TOKEN_DISPOSITIONS): its own token
   * for a synthetic actor, else its first token on the scene, else the
   * prototype token's.
   */
  _attackerDisposition() {
    const doc = this.actor.token ?? this.actor.getActiveTokens(false, true)[0];
    return doc?.disposition ?? this.actor.prototypeToken?.disposition;
  }

  /**
   * Friendly-fire guard: when a targeted token and the attacker are both
   * FRIENDLY, ask before resolving (Cancel is the default). The GM isn't
   * exempt. Area blasts don't use this; they list friendlies hit instead.
   * @returns {Promise<boolean>} true to go ahead with the attack
   */
  async _confirmFriendlyFire() {
    const mine = this._attackerDisposition();
    const friendly = Array.from(game.user.targets).filter(t => isFriendlyFire(mine, t.document?.disposition));
    if (!friendly.length) return true;
    const names = friendly.map(t => escapeHtml(t.name)).join(', ');
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Friendly Fire' },
      content: `<p>${names} ${friendly.length === 1 ? 'is' : 'are'} friendly. Attack anyway?</p>`,
      yes: { label: 'Attack', default: false },
      no: { label: 'Cancel', default: true }
    });
    return ok === true;
  }

  /** <option>s for a close-combat Location select, each showing its called-shot penalty. */
  static _closeTargetOptions(groups, defaultGroup) {
    const selected = defaultCloseTarget(groups, defaultGroup);
    return closeTargetsFor(groups).map(k => {
      const p = closeCalledPenalty(groups, k, defaultGroup);
      return `<option value="${k}"${k === selected ? ' selected' : ''}>${CLOSE_TARGETS[k].label} (${p >= 0 ? '+' : ''}${p})</option>`;
    }).join('');
  }

  /**
   * A close-combat hit on the chosen target (no location roll). Same shape as
   * _rollHitLocationKey's key/label; `zone` is the armor zone (a leg hit is
   * thigh or lower leg, see closeHitZone).
   */
  static _closeHit(targetKey) {
    const zone = closeHitZone(targetKey);
    const t = CLOSE_TARGETS[targetKey];
    const label = t.group === 'leg' ? ARMOR_ZONES[zone].label
      : t.group === 'eyes' ? `${t.label} (Head)` : t.label;
    return { key: ARMOR_ZONES[zone].location, label, zone };
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
   * (exploding) + skillTotal + WA + rangeMod + aim + situational mods, vs
   * either the target's opposed Evade (MZ p.92; Evade >= attack = miss) or
   * an optional GM Difficulty (table ruling for unaware targets / sneak
   * attacks; a blank Difficulty means no defense roll at all). Parry is not
   * resolved here yet. On a hit (or no Difficulty given), continues in the
   * SAME chat card: per hit, rolls hit location, rolls damage (+ BODY mod if
   * the formula ends in "+"), applies armor/location/hits to the TARGETED
   * token (never the attacker), and resolves a Stun/Shock save if warranted.
   * Burst fire (MZ p.95-96): one hit per point of margin, up to the weapon's
   * BV, each hit rolled and soaked separately. Human scale has no Crits or
   * Mega-Crits (table ruling: armor always applies to characters). Close-contact
   * weapons (CLOSE_COMBAT_SKILLS) pick the hit location instead of rolling it,
   * with a called-shot penalty off the torso (see close-combat.js). The standalone
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
    // Options only count on personal-scale ranged weapons (a weapon whose skill/range
    // was changed to melee after options were installed ignores them).
    const optionsEffect = computeWeaponOptionsEffect(
      weaponSupportsOptions(weapon.system, weapon.type) ? weapon.system?.options : []);
    const maxRangePenalty = optionsEffect.maxRangeMod ?? -4;

    // Resolve the mapped skill -- warn rather than silently treating the
    // attacker as untrained, since a missing skill is very likely a data problem.
    const skillKey = weapon.system?.skill;
    const SKILL_MAP = {
      'archery': 'Archery',
      'athletics': 'Athletics',
      'automatic-weapon': 'Automatic Weapon',
      'blade': 'Blade',
      'fencing': 'Fencing (H)', // alternative to Blade on bladed weapons; see _meleeSkillDamageBonus
      'handgun': 'Handgun',
      'hand-to-hand': 'Hand to Hand',
      'martial-art': 'Martial Art (H)', // alternative to Hand to Hand; see _meleeSkillDamageBonus
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

    // Close contact (melee skill, not thrown): the player picks the location
    // (torso free; others cost TABLE_RULINGS.closeCombatCalledPenalty) instead of rolling it.
    const closeContact = CLOSE_COMBAT_SKILLS.has(String(skillKey ?? '').toLowerCase()) && !rangeInfo?.thrown;

    // Burst Value: a bare number > 1 enables Burst fire ("na", "1", "" = single only).
    const bv = parseInt(weapon.system?.bv, 10) || 1;
    const blast = !!MektonActorSheet._blastOf(weapon);
    const targetsAtRoll = Array.from(game.user.targets);
    const oneTarget = targetsAtRoll.length === 1 && !!targetsAtRoll[0].actor;
    // Area weapons resolve vs a Difficulty (indirect fire, MZ p.97), never Evade.
    const defaultDefense = (oneTarget && !blast) ? 'evade' : 'difficulty';

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
              <label>Defense</label>
              <select name="defense" style="width:100%">
                ${blast ? '' : `<option value="evade" ${defaultDefense === 'evade' ? 'selected' : ''}>Target Evades (opposed: REF + Dodge &amp; Escape)</option>`}
                <option value="difficulty" ${defaultDefense === 'difficulty' ? 'selected' : ''}>GM Difficulty (no defense roll -- unaware / sneak attack)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Attacking target's (Evade only)</label>
              <select name="arc" style="width:100%">
                <option value="0">Front (+0)</option>
                <option value="-1">Flank (-1 to Evade)</option>
                <option value="-2">Rear (-2 to Evade)</option>
              </select>
            </div>
            ${bv > 1 ? `
            <div class="form-group">
              <label>Fire Mode</label>
              <select name="fireMode" style="width:100%">
                <option value="single">Single shot</option>
                <option value="burst" selected>Burst (BV ${bv})</option>
              </select>
            </div>` : ''}
            <div class="form-group">
              <label>Range</label>
              <select name="rangeChoice" style="width:100%">
                <option value="0">Combat range (+0)</option>
                <option value="${maxRangePenalty}">Long / at max range (${maxRangePenalty})</option>
              </select>
              <p style="font-size:0.8em; color:#666; margin:2px 0 8px;">${rangeHint}</p>
            </div>
            ${closeContact ? `
            <div class="form-group">
              <label>Location</label>
              <select name="closeTarget" style="width:100%">${this.constructor._closeTargetOptions(MELEE_STRIKE_TARGETS)}</select>
            </div>` : ''}
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
        options: { classes: ['dialog', 'mekton-fusion-dialog'], width: 400 },
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
          const defense = html.find("[name='defense']").val() || 'difficulty';
          const arcMod = Number(html.find("[name='arc']").val()) || 0;
          const fireMode = html.find("[name='fireMode']").val() || 'single';
          const closeTarget = html.find("[name='closeTarget']").val() || null;
          return { rangeMod, aim, coverMod, other, difficulty, defense, arcMod, fireMode, closeTarget };
        }
      });
    } catch (_) { return; } // dialog cancelled

    const { rangeMod, aim, coverMod, other, difficulty, defense, arcMod, fireMode, closeTarget } = dlg;
    // Area blasts skip the friendly-fire prompt: the card lists friendlies hit instead.
    if (!blast && !(await this._confirmFriendlyFire())) return;
    const mods = coverMod + other;
    const locPenalty = closeTarget ? closeCalledPenalty(MELEE_STRIKE_TARGETS, closeTarget) : 0;

    // Weapon Options' WA bonus (Lasersight/Smartgun +, Optical Scope -) only
    // applies at Combat Range (rangeMod === 0), per the book -- the dropdown
    // has already swapped in the option-adjusted Max Range penalty above.
    const atCombatRange = rangeMod === 0;
    const waResult = atCombatRange ? effectiveCombatWa(weapon.system, optionsEffect.combatWaBonus) : { wa, capped: false };
    const effectiveWa = waResult.wa;

    // --- Attack roll: 1d10(exploding) + skillTotal + WA + rangeMod + aim + mods ---
    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const attackTotal = base + skillTotal + effectiveWa + rangeMod + aim + mods + locPenalty;

    const explodedUp = plusDice.some(d => d === 10) ? 'Up' : '';
    const explodedDown = minusDice.some(d => d === 1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? ` <span style="color: #999; font-size: 0.85em;">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span style="color: #999; font-size: 0.85em;">[Cap ${maxExtra}]</span>` : '';

    const waLabel = effectiveWa !== wa
      ? `WA ${effectiveWa} (${wa} ${optionsEffect.combatWaBonus >= 0 ? '+' : ''}${optionsEffect.combatWaBonus} options${waResult.capped ? ', capped' : ''})`
      : (waResult.capped ? `WA ${wa} (options capped)` : `WA ${wa}`);
    const modParts = [chainText(plusDice, minusDice), `Skill ${skillTotal}`, waLabel];
    if (rangeMod) modParts.push(`Range ${rangeMod >= 0 ? '+' : ''}${rangeMod}`);
    if (aim) modParts.push(`Aim +${aim}`);
    if (mods) modParts.push(`Mods ${mods >= 0 ? '+' : ''}${mods}`);
    if (closeTarget) modParts.push(`${CLOSE_TARGETS[closeTarget].label} ${locPenalty >= 0 ? '+' : ''}${locPenalty}`);

    const { targetActor, success, margin, resultTag } = await this._resolveAttackDefense(attackTotal, { defense, difficulty, arcMod });

    // Burst: one hit per point of margin (> 0 -- a tie is a miss), up to BV.
    // With no defense roll and no Difficulty there's no margin, so a burst lands 1 hit.
    const burst = fireMode === 'burst' && bv > 1;
    const hitCount = burst && margin !== null ? Math.max(0, Math.min(margin, bv)) : 1;

    let flavor = `${attackHeader(escapeHtml(this.actor.name), MektonActorSheet._targetNames(), weaponName)}${tag}${capTag} = ${modParts.join(' + ')} = <strong style="font-size: 1.2em; color: #4a90e2;">${attackTotal}</strong>${resultTag}`;

    // --- On a hit (success !== false -- a miss is the only thing that skips this) ---
    if (success !== false && MektonActorSheet._blastOf(weapon)) {
      // A hit puts the explosion on the targeted token; a miss (success === false) skips it.
      flavor += await this._resolveBlast(weapon, weaponName);
    } else if (success !== false) {
      const dmgFormulaRaw = (weapon.system?.damage ?? '').trim();
      if (!dmgFormulaRaw) {
        flavor += `<br><em style="font-size:0.85em; color:#999;">No damage formula set on ${weaponName}.</em>`;
      } else {
        if (burst) {
          flavor += margin === null
            ? `<br><strong>Burst</strong>: no defense roll or Difficulty to beat -- 1 hit.`
            : `<br><strong>Burst</strong>: ${hitCount} of ${bv} shots hit.`;
        }
        const skillBonus = MektonActorSheet._meleeSkillDamageBonus(this.actor, weapon);
        for (let h = 1; h <= hitCount; h++) {
          let dmg = null;
          try {
            dmg = await this._rollDamageFormula(dmgFormulaRaw, skillBonus);
          } catch (err) {
            flavor += `<br><em style="font-size:0.85em; color:#c0392b;">Invalid damage formula "${dmgFormulaRaw}" for ${weaponName}.</em>`;
            break;
          }

          const { formula: dmgFormula, roll: dmgRoll, total: dmgTotal, bodyModNote, skillBonusNote } = dmg;
          const { key, label: locLabel } = closeTarget
            ? this.constructor._closeHit(closeTarget)
            : await this.constructor._rollHitLocationKey();
          const hitTag = hitCount > 1 ? `Hit ${h}: ` : '';
          flavor += `<br>${hitTag}Damage: <em>${dmgFormula || 0}</em> = ${dmgRoll.total}${bodyModNote}${skillBonusNote} = <strong style="color:#c0392b;">${dmgTotal}</strong> ${damageTo(targetActor?.name, locLabel)}`;

          // Apply to the TARGET only, never the attacker. Exactly one targeted
          // token -> apply now; otherwise defer via a chat-card button per hit.
          if (targetActor) {
            const applied = await this.constructor._applyLocationDamage(targetActor, key, dmgTotal);
            flavor += `<br>${escapeHtml(targetActor.name)}: ${this.constructor._formatDamageAppliedHtml(applied)}`;
          } else {
            flavor += `<br><button type="button" class="mf-apply-damage" data-loc-key="${key}" data-loc-label="${locLabel}" data-dmg="${dmgTotal}" data-attacker="${escapeHtml(this.actor.name)}">Apply to targeted token</button>`;
          }
        }
      }
    }

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const shown = await this.constructor._rollWithMods(roll, [skillTotal, effectiveWa, rangeMod, aim, mods, locPenalty]);
    await shown.toMessage({ speaker, flavor });
  }

  /**
   * Close-combat (brawling) attack, human scale. The player picks a maneuver
   * (CLOSE_MANEUVERS) and a location it can reach, pre-selected to the free
   * one; the chosen location is the hit location (no location roll).
   * 1D10 (exploding) + Hand to Hand or Martial Art + maneuver WA + called-shot
   * penalty + other, vs Evade or a GM Difficulty (same as _rollWeaponItem).
   * Damage per the Hand-to-Hand Attack Table, applied like a weapon hit (a
   * Martial Art attack adds its rank bonus, see _meleeSkillDamageBonus). Chop
   * does no damage: the card reports its Stun effect, which isn't automated.
   */
  async _rollCloseCombat() {
    const SKILLS = { 'hand-to-hand': 'Hand to Hand', 'martial-art': 'Martial Art (H)' };
    const skills = Object.fromEntries(Object.entries(SKILLS).map(([k, name]) => {
      const it = this.actor.items.find(i => i.type === 'skill' && i.name === name);
      const stat = MektonActorSheet._num(this.actor.system?.stats?.[String(it?.system?.stat || '').toUpperCase()]?.value, 0);
      return [k, { name, has: !!it, total: it ? stat + MektonActorSheet._num(it.system?.rank, 0) : 0 }];
    }));
    const defaultSkill = skills['martial-art'].total > skills['hand-to-hand'].total ? 'martial-art' : 'hand-to-hand';
    const targetsAtRoll = Array.from(game.user.targets);
    const oneTarget = targetsAtRoll.length === 1 && !!targetsAtRoll[0].actor;
    const sign = n => `${n >= 0 ? '+' : ''}${n}`;

    const maneuverOptions = Object.entries(CLOSE_MANEUVERS)
      .map(([k, m]) => `<option value="${k}">${m.label} (WA ${sign(m.wa)})</option>`).join('');
    const skillOptions = Object.entries(skills)
      .map(([k, s]) => `<option value="${k}"${k === defaultSkill ? ' selected' : ''}>${s.name} (${sign(s.total)})</option>`).join('');

    const positionOptions = Object.entries(MOUTH_POSITIONS)
      .map(([k, label]) => `<option value="${k}">${label}</option>`).join('');

    const read = html => {
      const m = CLOSE_MANEUVERS[html.find("[name='maneuver']").val()];
      const target = html.find("[name='closeTarget']").val();
      const position = m.positions ? html.find("[name='position']").val() : null;
      return {
        m, target, position,
        locPenalty: closeCalledPenalty(maneuverTargets(m, position), target, m.defaultGroup),
        other: Number(html.find("[name='other']").val()) || 0,
        skill: html.find("[name='skill']").val() || defaultSkill
      };
    };
    const refreshTotal = html => {
      const { m, locPenalty, other } = read(html);
      html.find('.mf-close-total').text(`Modifier: WA ${sign(m.wa)} + location ${sign(locPenalty)}`
        + (other ? ` + other ${sign(other)}` : '') + ` = ${sign(m.wa + locPenalty + other)}`);
    };

    let dlg;
    try {
      dlg = await Dialog.prompt({
        title: 'Close Combat',
        content: `
          <form class="mf-attack-dialog">
            <div class="form-group">
              <label>Maneuver</label>
              <select name="maneuver" style="width:100%">${maneuverOptions}</select>
            </div>
            <div class="form-group mf-close-position" style="display:none;">
              <label>Mouth Position</label>
              <select name="position" style="width:100%">${positionOptions}</select>
            </div>
            <div class="form-group">
              <label>Skill</label>
              <select name="skill" style="width:100%">${skillOptions}</select>
            </div>
            <div class="form-group">
              <label>Location</label>
              <select name="closeTarget" style="width:100%"></select>
            </div>
            <div class="form-group">
              <label>Other Modifier</label>
              <input type="number" name="other" value="0" style="width:100%"/>
            </div>
            <p class="mf-close-total" style="font-weight:600; margin:6px 0;"></p>
            <div class="form-group">
              <label>Defense</label>
              <select name="defense" style="width:100%">
                <option value="evade" ${oneTarget ? 'selected' : ''}>Target Evades (opposed: REF + Dodge &amp; Escape)</option>
                <option value="difficulty" ${oneTarget ? '' : 'selected'}>GM Difficulty (no defense roll -- unaware / sneak attack)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Attacking target's (Evade only)</label>
              <select name="arc" style="width:100%">
                <option value="0">Front (+0)</option>
                <option value="-1">Flank (-1 to Evade)</option>
                <option value="-2">Rear (-2 to Evade)</option>
              </select>
            </div>
            ${this.constructor._difficultyPresetHtml()}
          </form>
        `,
        label: "Attack",
        render: html => {
          this.constructor._bindDifficultyPresetListeners(html);
          // Location list follows the maneuver (and Bite's mouth position),
          // pre-selected to its free location.
          const fillTargets = () => {
            const m = CLOSE_MANEUVERS[html.find("[name='maneuver']").val()];
            html.find('.mf-close-position').toggle(!!m.positions);
            const groups = maneuverTargets(m, m.positions ? html.find("[name='position']").val() : null);
            html.find("[name='closeTarget']").html(this.constructor._closeTargetOptions(groups, m.defaultGroup));
            refreshTotal(html);
          };
          html.find("[name='maneuver'], [name='position']").on('change', fillTargets);
          html.find("[name='closeTarget'], [name='other']").on('change input', () => refreshTotal(html));
          fillTargets();
        },
        options: { classes: ['dialog', 'mekton-fusion-dialog'], width: 400 },
        callback: html => {
          const diffRaw = html.find("[name='difficulty']").val();
          return {
            ...read(html),
            defense: html.find("[name='defense']").val() || 'difficulty',
            arcMod: Number(html.find("[name='arc']").val()) || 0,
            difficulty: diffRaw ? Number(diffRaw) : null
          };
        }
      });
    } catch (_) { return; } // dialog cancelled

    const { m, target, position, locPenalty, other, skill, defense, arcMod, difficulty } = dlg;
    if (!(await this._confirmFriendlyFire())) return;
    const s = skills[skill];
    if (!s.has) ui.notifications.warn(`${this.actor.name} has no "${s.name}" skill -- rolling with skill total 0.`);

    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const attackTotal = base + s.total + m.wa + locPenalty + other;
    const explodedUp = plusDice.some(d => d === 10) ? 'Up' : '';
    const explodedDown = minusDice.some(d => d === 1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? ` <span style="color: #999; font-size: 0.85em;">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span style="color: #999; font-size: 0.85em;">[Cap ${maxExtra}]</span>` : '';
    const parts = [chainText(plusDice, minusDice), `${s.name} ${s.total}`, `WA ${m.wa}`, `${CLOSE_TARGETS[target].label} ${sign(locPenalty)}`];
    if (other) parts.push(`Mods ${sign(other)}`);

    const { targetActor, success, resultTag } = await this._resolveAttackDefense(attackTotal, { defense, difficulty, arcMod });
    const what = `${m.label}${position ? ` (${MOUTH_POSITIONS[position].toLowerCase()})` : ''}`;
    let flavor = `${attackHeader(escapeHtml(this.actor.name), MektonActorSheet._targetNames(), what)}${tag}${capTag} = ${parts.join(' + ')} = <strong style="font-size: 1.2em; color: #4a90e2;">${attackTotal}</strong>${resultTag}`;

    if (success !== false) {
      const { key, label: locLabel } = this.constructor._closeHit(target);
      if (!m.damage) {
        flavor += `<br>Hits ${targetLocation(targetActor?.name, locLabel)}: <strong>${m.effect ?? 'no damage'}</strong> <em style="font-size:0.85em; color:#999;">(resolve per MZ core; not automated)</em>`;
      } else {
        const skillBonus = MektonActorSheet._meleeSkillDamageBonus(this.actor, { system: { skill } });
        let dmg = null;
        try {
          dmg = await this._rollDamageFormula(m.damage, skillBonus);
        } catch (err) {
          flavor += `<br><em style="font-size:0.85em; color:#c0392b;">Invalid damage formula "${m.damage}" for ${m.label}.</em>`;
        }
        if (dmg) {
          const { formula: dmgFormula, roll: dmgRoll, total: dmgTotal, bodyModNote, skillBonusNote } = dmg;
          flavor += `<br>Damage: <em>${dmgFormula || 0}</em> = ${dmgRoll.total}${bodyModNote}${skillBonusNote} = <strong style="color:#c0392b;">${dmgTotal}</strong> ${damageTo(targetActor?.name, locLabel)}`;
          if (targetActor) {
            const applied = await this.constructor._applyLocationDamage(targetActor, key, dmgTotal);
            flavor += `<br>${escapeHtml(targetActor.name)}: ${this.constructor._formatDamageAppliedHtml(applied)}`;
          } else {
            flavor += `<br><button type="button" class="mf-apply-damage" data-loc-key="${key}" data-loc-label="${locLabel}" data-dmg="${dmgTotal}" data-attacker="${escapeHtml(this.actor.name)}">Apply to targeted token</button>`;
          }
        }
      }
    }

    const shown = await this.constructor._rollWithMods(roll, [s.total, m.wa, locPenalty, other]);
    await shown.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor });
  }

  /** Spend `n` ammo for an attack (1 for a single shot or burst; missiles fired for a salvo). Returns false if short. Untracked (∞) always succeeds. */
  async _spendMechaAmmo(idx, n = 1) {
    const row = this.actor.system.mecha?.weapons?.[idx];
    if (!row || row.shotsMax === null) return true;
    if (row.shotsLeft < n) {
      ui.notifications.warn(row.shotsLeft > 0 ? `${row.name}: only ${row.shotsLeft} left.`
        : row.canReload ? `${row.name}: empty -- reload (1 Action).` : `${row.name}: empty, no spare clips.`);
      return false;
    }
    const weapons = foundry.utils.deepClone(this.actor._source.system.mecha.weapons);
    weapons[idx].shotsUsed = (Number(weapons[idx].shotsUsed) || 0) + n;
    await this.actor.update({ 'system.mecha.weapons': weapons });
    return true;
  }

  /** Reload (1 Action): the loaded clip, if not empty, is kept as a partial; load a full spare, else the fullest partial. */
  async _onMechaReload(ev) {
    ev.preventDefault();
    const idx = Number(ev.currentTarget.dataset.idx);
    const row = this.actor.system?.mecha?.weapons?.[idx];
    if (!row?.canReload) { ui.notifications.warn(`${row?.name ?? 'Weapon'}: nothing better to load.`); return; }

    const weapons = foundry.utils.deepClone(this.actor._source.system.mecha.weapons);
    const w = weapons[idx];
    const partials = [...row.partials];
    if (row.shotsLeft > 0) partials.push(row.shotsLeft);       // pulled clip is kept, not discarded

    let loaded, source;
    if (row.fullSparesLeft > 0) {
      loaded = row.shotsMax; source = 'full spare';
      w.clipsUsed = (Number(w.clipsUsed) || 0) + 1;
    } else {
      partials.sort((a, b) => b - a);
      loaded = partials.shift(); source = 'partial clip';
    }
    w.shotsUsed = row.shotsMax - loaded;
    w.partialClips = partials.join(',');
    await this.actor.update({ 'system.mecha.weapons': weapons });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<strong>${escapeHtml(this.actor.name)}</strong> reloads ${row.name} with a ${source} (${loaded}/${row.shotsMax}) — <em>uses 1 Action</em>.`
    });
  }

  /**
   * Burst / missile salvo (one button, `.mecha-weapon-burst`).
   * Burst: attack roll, spend 1 ammo, hits = min(attack - defense, BV), each hit rolled
   * on the servo-aware Hit Location Chart (locationFromRoll) against the targeted mech.
   * Salvo (row.canSalvo -- missile racks): fire 1..shotsLeft missiles in one Action,
   * hits = salvoHitCount (margin x ceil(fired/10), not BV-capped); the card gets an
   * "Apply hit" (.mf-apply-mecha-salvo) button that walks the chart from one start roll.
   */
  async _onMechaBurst(ev) {
    ev.preventDefault();
    const idx = Number(ev.currentTarget.dataset.idx);
    const row = this.actor.system?.mecha?.weapons?.[idx];
    if (!row?.weaponKey) return;
    if (row.shotsMax !== null && row.shotsLeft < 1) {          // empty: no roll, no spend
      ui.notifications.warn(row.canReload ? `${row.name}: empty -- reload (1 Action).` : `${row.name}: empty, no spare clips.`);
      return;
    }
    if (!(await this._confirmFriendlyFire())) return;           // cancelled: no roll, no spend
    const isSalvo = !!row.canSalvo;

    // Same attack math as _rollMechaArmamentRow: 1d10(exploding) + MR + skill rank + WA.
    const CATEGORY_SKILL = { beam: 'Mecha Gunnery (H)', projectile: 'Mecha Gunnery (H)', missile: 'Mecha Missiles (H)', melee: 'Mecha Melee (H)', energyMelee: 'Mecha Melee (H)' };
    const skill = this.actor.items.find(i => i.type === 'skill' && i.name === CATEGORY_SKILL[row.category]);
    const rank = MektonActorSheet._num(skill?.system?.rank, 0);
    const mr = Number(this.actor.system?.mecha?.config?.mr ?? 0);
    const wa = MektonActorSheet._num(row.wa, 0);
    const { roll, total: base } = await this.constructor._rollBidirectionalExplodingD10();
    const attack = base + mr + rank + wa;

    // INTERIM: defense total entered manually. Opposed-roll handshake is deferred.
    let form;
    try {
      form = await Dialog.prompt({
        title: `${row.name} ${isSalvo ? 'salvo' : 'burst'} — attack ${attack}`,
        content: (isSalvo
            ? `<p>Missiles to fire at this target (1–${row.shotsLeft}):</p><input type="number" name="fired" value="${row.shotsLeft}" min="1" max="${row.shotsLeft}" style="width:100%"/>`
              + `<p style="font-size:0.85em;color:#666;">One target per salvo. To split a volley across targets (60 missiles at 3 targets), fire it as separate salvos (three of 20).</p>`
            : '')
          + `<p>Attack total: <strong>${attack}</strong>. Defender's Evade/Defense total:</p><input type="number" name="def" value="0" style="width:100%" autofocus/>`
          + (isSalvo ? ''
            // Burst crits (MZ ATM: the salvo method): the attacker picks the chart once per burst.
            : `<p>Chart for any Critical hits (attacker's choice, once per burst):</p><select name="chart" style="width:100%">`
              + `<option value="normal">Random (Hit Location Chart)</option><option value="special">Special</option><option value="cinematic">Cinematic</option></select>`),
        label: 'Resolve',
        callback: html => ({
          defense: Number(html.find("[name='def']").val()) || 0,
          fired: Math.max(1, Math.min(row.shotsLeft, Math.floor(Number(html.find("[name='fired']").val()) || 1))),
          chart: html.find("[name='chart']").val() || 'normal'
        })
      });
    } catch (_) { return; }                                     // cancelled dialog: nothing fired
    const { defense } = form;
    const fired = isSalvo ? form.fired : 1;
    // A salvo spends 1 per missile fired; a burst spends TABLE_RULINGS.burstAmmoCost whatever its BV.
    const spend = isSalvo ? fired : TABLE_RULINGS.burstAmmoCost;
    if (!(await this._spendMechaAmmo(idx, spend))) return;     // fired: costs ammo, hit, miss or parried

    const margin = attack - defense;
    const dmg = Number(row.damage) || 0;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const who = escapeHtml(this.actor.name);
    // Crits count from the raw margin and land on the first hits: mega, then crit (salvoCritCounts).
    const critTag = c => {
      const parts = [c.mega && `${c.mega} Mega-Crit`, c.crit && `${c.crit} Critical`].filter(Boolean);
      return parts.length ? ` — <strong>${parts.join(', ')}</strong>` : '';
    };

    if (isSalvo) {
      const hits = salvoHitCount(attack, defense, fired);
      const salvoTag = critTag(salvoCritCounts(margin, hits));
      const applyBtn = hits > 0 && dmg > 0
        ? ` <button type="button" class="mf-apply-mecha-salvo" data-kills="${dmg}" data-hits="${hits}" data-margin="${margin}" data-missile="1" title="GM: walk the hit chart and apply damage to the targeted mech">Apply hit</button>`
        : '';
      const content = `${attackHeader(who, MektonActorSheet._targetNames(), `${fired}-missile salvo from ${row.name}`)}: attack ${attack} vs ${defense} → <strong>${hits} hit${hits === 1 ? '' : 's'}</strong>${salvoTag}${applyBtn}`;
      await ChatMessage.create({ speaker, content, rolls: [roll] });
      return;
    }

    // Resolve locations against the targeted mech's actual servos; with no single
    // mech targeted, fall back to the default humanoid layout (same ids/labels).
    const targets = Array.from(game.user.targets);
    const targetServos = targets.length === 1 ? (targets[0].actor?.system?.mecha?.servos ?? []).filter(s => s?.id) : [];
    const servos = targetServos.length ? targetServos
      : SERVO_ROW_LOCATIONS.map(l => ({ id: l.key, kind: l.kind, side: l.side, servo: l.label }));
    const servoById = Object.fromEntries(servos.map(s => [s.id, s]));

    // Autofire crits (MZ ATM: the salvo method): Mega-Crits on the first hits, then Crits,
    // then normal hits. Each hit rolls its OWN location -- no walk (salvo-only).
    const hits = burstHitCount(attack, defense, row.bv);
    const c = salvoCritCounts(margin, hits);
    const chartName = form.chart === 'special' ? 'Special' : form.chart === 'cinematic' ? 'Cinematic' : null;
    const rolls = [roll];
    const lines = [];
    for (let i = 1; i <= hits; i++) {
      const kind = i <= c.mega ? 'mega' : i <= c.mega + c.crit ? 'crit' : 'normal';
      const kindTag = kind === 'mega' ? ' (Mega-Crit)' : kind === 'crit' ? ' (Critical)' : '';
      if (kind === 'crit' && chartName) {
        // The hit's own d10 is the result on the chosen chart; nothing to apply automatically.
        const r = await new Roll('1d10').evaluate();
        rolls.push(r);
        lines.push(`<li>Hit ${i}: <strong>Critical</strong> -- resolve as ${r.total} on the ${chartName} chart</li>`);
        continue;
      }
      let r, loc, attempts = 0;
      do {
        r = await new Roll('1d10').evaluate();
        rolls.push(r);
        loc = locationFromRoll(r.total, servos, pickIndex);
      } while (loc.reroll && attempts++ < 20);
      const servo = loc.servoId ? servoById[loc.servoId] : null;
      lines.push(loc.special ? `<li>Hit ${i}: d10 ${r.total} → Special hit${kindTag} — resolve on the Special chart</li>`
        : !servo ? `<li>Hit ${i}: d10 ${r.total} → no servo there</li>`
        : `<li>Hit ${i}: ${escapeHtml(servo.servo || servo.id)} (d10 ${r.total})${kindTag} <button type="button" class="mf-apply-mecha-hit" data-loc="${escapeHtml(servo.id)}" data-dmg="${dmg}"${kind === 'mega' ? ' data-mega="1"' : ''}>Apply ${dmg}K</button></li>`);
    }
    const content = `${attackHeader(who, targets.map(t => t.name), `${row.name} burst (BV ${row.bv})`)}: attack ${attack} vs ${defense} → <strong>${hits} hit${hits === 1 ? '' : 's'}</strong>${critTag(c)}`
      + (targetServos.length ? '' : ' <small>(no mech targeted: default humanoid chart)</small>')
      + (lines.length ? `<ul>${lines.join('')}</ul>` : '');
    await ChatMessage.create({ speaker, content, rolls });
  }

  /** Read-modify-write one field on one weapons[] row (ArrayField -- never send a partial array). */
  async _setMechaWeaponField(idx, field, value) {
    const weapons = foundry.utils.deepClone(this.actor._source.system.mecha.weapons);
    if (!weapons[idx]) return;
    weapons[idx][field] = value;
    await this.actor.update({ 'system.mecha.weapons': weapons });
  }

  /** Read-modify-write one field on one shields[] row (ArrayField -- never send a partial array). */
  async _setMechaShieldField(idx, field, value) {
    const shields = foundry.utils.deepClone(this.actor._source.system.mecha.shields);
    if (!shields[idx]) return;
    shields[idx][field] = value;
    await this.actor.update({ 'system.mecha.shields': shields });
  }

  /**
   * Declare a Parry Roll (core p.92-93) against one incoming attack, with a
   * shield or a melee/EMW weapon (`.mp-parry` button, data-kind "shield"|"weapon").
   * Parry is a roll, not an automatic stop: 1D10 + MR + Mecha Melee + DA
   * (shields use their own DA; melee weapons/EMWs use their WA as DA) vs the
   * attack total -- ties go to the defender (RAW, as with Evade). Shields parry
   * any attack; melee weapons and EMWs may only parry melee/EMW attacks (not
   * exclusive -- either can parry the other). On a success: a melee weapon
   * spends 1 Kill regardless of damage (destroyed at 0); a shield uses staged
   * penetration (MZ+ ATM, resolveShieldParry): -1 SP per parried hit (a burst/
   * salvo ablates it once per hit), and damage over its current SP passes to
   * the hit's originally rolled location; an EMW doesn't deplete, but an attack whose damage
   * exceeds the EMW's own Damage rating isn't stopped at all.
   */
  async _onMechaParry(ev) {
    ev.preventDefault();
    const btn = ev.currentTarget;
    const kind = btn.dataset.kind;
    const idx = Number(btn.dataset.idx);
    const row = kind === 'shield' ? this.actor.system?.mecha?.shields?.[idx] : this.actor.system?.mecha?.weapons?.[idx];
    if (!row) return;

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const isShield = kind === 'shield';
    if (!isShield && !row.canParry) { ui.notifications.warn(`${row.name || 'This weapon'} can't parry -- melee weapons and EMWs only.`); return; }
    if (row.parryDestroyed) { ui.notifications.warn(`${row.name}: nothing left to parry with -- it's destroyed.`); return; }

    // Damage past a shield goes to each hit's originally rolled location (Interpretation,
    // ROADMAP.md) -- so the parry asks for that location the same way Apply hit does.
    const servos = (this.actor.system.mecha?.servos ?? []).filter(s => s?.id);
    let form;
    try {
      form = await Dialog.prompt({
        title: `Parry with ${row.name}`,
        content: `<p>Attacker's roll total:</p><input type="number" name="atk" value="0" style="width:100%" autofocus/>`
          + `<p>Incoming damage (Kills${isShield ? ' per hit' : ''}):</p><input type="number" name="dmg" min="0" value="0" style="width:100%"/>`
          + (isShield
              ? `<p>Hits (1 for a single shot; the burst/salvo hit count):</p><input type="number" name="hits" min="1" value="1" style="width:100%"/>`
                + `<p>Hit location for damage past the shield:</p><select name="loc" style="width:100%"><option value="">Random (Hit Location Chart)</option>`
                + servos.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.servo || s.id)} (aimed / already rolled)</option>`).join('')
                + `</select>`
                + `<p><label><input type="checkbox" name="missile"/> Missile salvo (random location walks the chart)</label></p>`
                + `<p style="font-size:0.85em;color:#666;">Arc reminder (not enforced): ${escapeHtml(row.arcLabel || 'n/a')}</p>`
              : `<p><label><input type="checkbox" name="melee" checked/> Incoming attack is melee or an EMW</label></p>`),
        label: 'Roll Parry',
        callback: html => ({
          atk: Number(html.find("[name='atk']").val()) || 0,
          dmg: Number(html.find("[name='dmg']").val()) || 0,
          hits: Math.max(1, Math.floor(Number(html.find("[name='hits']").val()) || 1)),
          servoId: html.find("[name='loc']").val() || null,
          missile: html.find("[name='missile']").is(':checked'),
          melee: isShield || html.find("[name='melee']").is(':checked')
        })
      });
    } catch (_) { return; }
    if (!form.melee) { ui.notifications.warn(`${row.name} can only parry melee weapons and EMWs.`); return; }

    // Parry Roll (p.92): 1D10 + MR + Mecha Melee +/- DA. Shields use their DA; melee/EMWs use their WA as DA (p.93).
    const skill = this.actor.items.find(i => i.type === 'skill' && i.name === 'Mecha Melee (H)');
    const rank = MektonActorSheet._num(skill?.system?.rank, 0);
    const mr = Number(this.actor.system?.mecha?.config?.mr ?? 0);
    const da = isShield ? MektonActorSheet._num(row.da, 0) : MektonActorSheet._num(row.wa, 0);
    const { roll, total: base } = await this.constructor._rollBidirectionalExplodingD10();
    const parry = base + mr + rank + da;
    const head = `<strong>${escapeHtml(this.actor.name)}</strong> parries with ${row.name}: ${base} + MR ${mr} + Skill ${rank} + DA ${da} = <strong>${parry}</strong> vs ${form.atk}`;

    if (!parrySucceeds(parry, form.atk)) {
      await ChatMessage.create({ speaker, content: `${head} — <strong>fails, takes the hit</strong>.`, rolls: [roll] });
      return;
    }

    if (isShield) return this._resolveShieldParry(idx, row, form, head, roll);

    let outcome;
    if (!isShield && row.category === 'energyMelee') {
      const r = resolveEmwParry({ emwDamage: row.damage, attackDamage: form.dmg });
      outcome = r.ok ? 'stopped' : `attack (${form.dmg}K) exceeds its Damage (${row.damage}K) — <strong>breezes through</strong>`;
    } else {
      const r = resolveMeleeParry({ killsMax: row.hits, killsUsed: row.killsUsed });
      await this._setMechaWeaponField(idx, 'killsUsed', r.killsUsed);
      outcome = `stopped · Kills ${r.killsBefore} → ${r.killsAfter}${r.destroyed ? ' · <strong>DESTROYED</strong>' : ''}`;
    }
    await ChatMessage.create({ speaker, content: `${head} — ${outcome}.`, rolls: [roll] });
  }

  /**
   * Successful shield parry (resolveShieldParry, RAW): write the shield's new spUsed,
   * then send each hit's pass-through Kills to that hit's originally rolled location
   * (aimed / already-rolled servo, or rolled now -- walked for a missile salvo) via
   * _applyMechaSalvo, so the shield and servo damage land in one actor.update and
   * one chat card. Hits the shield fully stopped apply nothing.
   */
  async _resolveShieldParry(idx, shield, { dmg, hits, servoId, missile }, head, roll) {
    const spBefore = Math.max(0, (Number(shield.sp) || 0) - (Number(shield.spUsed) || 0));
    const p = resolveShieldParry({ spMax: shield.sp, spUsed: shield.spUsed }, dmg, hits);
    const spAfter = Math.max(0, (Number(shield.sp) || 0) - p.spUsed);

    const shields = foundry.utils.deepClone(this.actor._source.system.mecha.shields);
    if (shields[idx]) shields[idx].spUsed = p.spUsed;
    const update = { 'system.mecha.shields': shields };
    const summary = `${head} — parried · shield SP ${spBefore} → ${spAfter}${p.destroyed ? ' · <strong>DESTROYED</strong>' : ''}`;

    if (!p.through.some(k => k > 0)) {
      await this.actor.update(update);
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `${summary} · attack stopped.`, rolls: [roll] });
      return;
    }
    const r = await MektonActorSheet._applyMechaSalvo(this.actor, {
      hits: p.through.length, killsPerHit: p.through, servoId, missile,
      extraUpdate: update, intro: `<p>${summary}</p>`, extraRolls: [roll]
    });
    if (r === null) await this.actor.update(update); // no servos to hit: still record the shield wear
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
    if (!(await this._confirmFriendlyFire())) return;           // cancelled: no roll, no spend
    if (!(await this._spendMechaAmmo(idx))) return;

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

    const explodedUp = plusDice.some(d => d === 10) ? 'Up' : '';
    const explodedDown = minusDice.some(d => d === 1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? ` <span style="color: #999; font-size: 0.85em;">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span style="color: #999; font-size: 0.85em;">[Cap ${maxExtra}]</span>` : '';

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const weaponName = row.name || 'Weapon';
    const skillLabel = skillName ? skillName.replace(' (H)', '') : 'Skill';
    const damageStr = (row.damage !== undefined && row.damage !== '') ? `${row.damage}K${row.damageNote ? ` (${row.damageNote})` : ''}` : '—';
    const shotsStr = row.shots || '—';
    const locStr = row.loc ? escapeHtml(row.locLabel) : 'unassigned';
    const dmgNum = Number(row.damage) || 0;
    const applyBtn = dmgNum > 0 ? ` <button type="button" class="mf-apply-mecha-salvo" data-kills="${dmgNum}" title="GM: roll hit location(s) and apply damage to the targeted mech">Apply hit</button>` : '';
    const flavor = `${attackHeader(escapeHtml(this.actor.name), MektonActorSheet._targetNames(), `${weaponName} (${skillLabel})`)}${tag}${capTag} = ${chainText(plusDice, minusDice)} + MR ${mr} + Skill ${rank} + WA ${wa} = <strong style="font-size: 1.2em; color: #4a90e2;">${finalTotal}</strong><br><span style="font-size: 0.85em; color: #666;">Damage ${damageStr} &middot; Shots ${shotsStr} &middot; Loc ${locStr}</span>${applyBtn}`;

    const shown = await this.constructor._rollWithMods(roll, [mr, rank, wa]);
    await shown.toMessage({ speaker, flavor });
  }
}
