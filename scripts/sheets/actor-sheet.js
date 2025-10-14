// module/script/sheets/actor-sheet.js
import { STAT_DEFAULT_VALUES, applyStatDefaults } from "../../module/data/defaults.js";

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
    // Per-tab (skills, psi, spells) view state; loaded from user flag lazily
    this._tabViewState = {
      skills: { favOnly: false, sortBy: 'name', dir: 'asc' },
      psi: { favOnly: false, sortBy: 'name', dir: 'asc' },
      spells: { favOnly: false, sortBy: 'name', dir: 'asc' }
    };
    this._viewStateLoaded = false;
  }
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mekton-fusion", "sheet", "actor"],
      template: "systems/mekton-fusion/templates/actor/actor-sheet.hbs",
      width: 740,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }],
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      scrollY: [".tab.stats", ".tab.skills", ".tab.psi", ".tab.spells", ".tab.equipment", ".tab.notes"]
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
  //  - Each 10 triggers an additional +d10 (continue while 10s).
  //  - Each 1 triggers an additional -d10 (continue while 1s) (opposite direction explosion).
  // Returns a consolidated Roll (for module parsing) plus breakdown arrays.
  static async _rollBidirectionalExplodingD10() {
    const plusDice = [];
    const minusDice = [];
    // First roll decides branch(es); both chains can occur if new rolls also produce opposite triggers.
    const pendingPlus = [];
    const pendingMinus = [];
    const MAX_EXTRA = 10; // cap on additional dice beyond the first
    let extraCount = 0;
    let capped = false;

    function queue(val) {
      if (val === 10) pendingPlus.push(true);
      if (val === 1) pendingMinus.push(true);
    }

    // roll helper
    async function rollD10() {
      const r = new Roll('1d10');
      await r.evaluate();
      return r.total || 0;
    }

    // Initial roll
    const first = await rollD10();
    plusDice.push(first); // treat first as part of plus sequence mathematically; we'll subtract minusDice later
    queue(first);

    // Process queues breadth-first to allow interleaving opposite explosions
    while ((pendingPlus.length || pendingMinus.length) && !capped) {
      if (pendingPlus.length) {
        pendingPlus.pop();
        const v = await rollD10();
        plusDice.push(v);
        queue(v);
        extraCount++;
      }
      if (pendingMinus.length) {
        pendingMinus.pop();
        const v = await rollD10();
        minusDice.push(v); // values to subtract
        queue(v);
        extraCount++;
      }
      if (extraCount >= MAX_EXTRA) capped = true;
    }

    const plusTotal = plusDice.reduce((a,b)=>a+b,0);
    const minusTotal = minusDice.reduce((a,b)=>a+b,0);
    const net = plusTotal - minusTotal;

    // Build a synthetic Roll expression for compatibility: represent all individual dice.
    // Example: (10+7+10) - (4+3)
    const plusExpr = plusDice.map(d=>d).join('+') || '0';
    const minusExpr = minusDice.length ? `-(${minusDice.map(d=>d).join('+')})` : '';
    const formula = `${plusExpr}${minusExpr}`;
    const total = net;
    // Create Roll object from formula (no dice terms, purely numeric) for compatibility
  const roll = new Roll(formula);
  await roll.evaluate();
  // roll.total reflects evaluated numeric expression; should equal our computed total
    // Attach raw arrays for external modules / debugging
    roll.flags ??= {};
    roll.flags['mekton-fusion'] = { plusDice: [...plusDice], minusDice: [...minusDice], capped };
    return { roll, total, plusDice, minusDice, capped, maxExtra: MAX_EXTRA };
  }

  /** @override */
  async _updateObject(event, formData) {
    // Ensure proper data synchronization when updating actor
    console.log("mekton-fusion | _updateObject called with:", formData);
    console.log("mekton-fusion | Actor ID:", this.actor.id);
    console.log("mekton-fusion | Is Token Actor:", this.actor.isToken);
    console.log("mekton-fusion | Actor Link:", this.actor.token?.actorLink);
    
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

    // Migration: legacy abilities -> stats
    if (ctx.system.abilities && !ctx.system.stats) {
      console.warn("mekton-fusion | Migrating legacy system.abilities -> system.stats (WILL->COOL, MOVE->MA).");
      const abil = ctx.system.abilities; const migrated = {}; const map = { ref: "REF", int: "INT", body: "BODY", tech: "TECH", cool: "COOL", will: "COOL", luck: "LUCK", move: "MA", emp: "EMP", attr: "ATTR", edu: "EDU" };
      for (const [k, data] of Object.entries(abil)) { const upperKey = map[k] || k.toUpperCase(); migrated[upperKey] = { value: this.constructor._num(data?.value, STAT_DEFAULT_VALUES[upperKey] ?? 5) }; }
      ctx.system.stats = applyStatDefaults(migrated);
    }

    // With DataModel schema defining substats, manual seeding is no longer required. Keep a one-time
    // migration path: if legacy actors lack substats container, ensure it's present, but do not write defaults.
    if (!this.actor.system?.substats) {
      await this.actor.update({ 'system.substats': {} });
    }

    // Ensure a body model exists for the paperdoll. If absent, seed with a minimal default structure.
    if (!this.actor.system?.body || !this.actor.system?.body?.locations) {
      console.log('mekton-fusion | Initializing body locations for', this.actor.name);
      const defaultBody = {
        locations: {
          head:   { label: "Head",   sp: 4, spMax: 4, hp: 4, hpMax: 4, ablates: true, itemId: null },
          torso:  { label: "Torso",  sp: 10, spMax: 10, hp: 10, hpMax: 10, ablates: true, itemId: null },
          rArm:   { label: "Right Arm", sp: 5, spMax: 5, hp: 5, hpMax: 5, ablates: true, itemId: null },
          lArm:   { label: "Left Arm",  sp: 5, spMax: 5, hp: 5, hpMax: 5, ablates: true, itemId: null },
          rLeg:   { label: "Right Leg", sp: 6, spMax: 6, hp: 6, hpMax: 6, ablates: true, itemId: null },
          lLeg:   { label: "Left Leg",  sp: 6, spMax: 6, hp: 6, hpMax: 6, ablates: true, itemId: null }
        },
        notes: ""
      };
      try {
        await this.actor.update({ 'system.body': defaultBody });
        console.log('mekton-fusion | Body locations initialized successfully');
        // Refresh context after update
        ctx.system = this.actor.system ?? {};
      } catch (e) {
        console.warn('mekton-fusion | Failed to initialize actor.body default', e);
      }
    } else {
      console.log('mekton-fusion | Body locations found:', this.actor.system.body.locations);
    }
    
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
      hp: makeResource('hp','hp_current'),
      stamina: makeResource('sta','sta_current'),
      vigor: makeResource('rec','rec_current'),
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
          for (const tab of ['skills','psi','spells']) {
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
    const vsSpells = this._tabViewState.spells;

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

    // Build spell Items listing
    const spellItems = this.actor.items.filter(i => i.type === "spell");
    // Determine global Spellcasting skill (COOL) if present
    const spellcastingSkill = flatSkills.find(sk => sk.name.toLowerCase() === 'spellcasting');
    const spellcastingRank = spellcastingSkill ? this.constructor._num(spellcastingSkill.rank, 0) : 0;
    const spellcastingStat = 'COOL';
    const spellcastingStatVal = ctx.system.stats?.[spellcastingStat]?.value ?? 0;
    const spellcastingTotal = spellcastingStatVal + spellcastingRank;
    let spells = spellItems.map(it => {
      const stat = String(it.system?.stat || it.system?.test || "INT").toUpperCase();
      const statVal = ctx.system.stats?.[stat]?.value ?? 0;
      // Legacy per-spell rank retained for backward compatibility but not used in main total
      const legacyRank = this.constructor._num(it.system?.rank, 0);
      const totalGlobal = spellcastingTotal; // COOL + spellcasting rank (no spell stat)
      const custom = !!it.system?.custom;
      return {
        id: it.id,
        name: it.name,
        stat,
        legacyRank,
        spellcasting: spellcastingTotal,
        totalGlobal,
        favorite: !!it.system?.favorite,
        item: it,
        system: it.system,
        school: it.system?.school || 'Unknown',
        cost: it.system?.cost || 0,
        range: it.system?.range || '',
        duration: it.system?.duration || '',
        defense: it.system?.defense || '',
        effect: it.system?.effect || '',
        custom
      };
    });
  // No initial sort; sortList below will use .system.sort as primary

    // Favorites filtering per tab
    if (vsSkills.favOnly) nonPsi = nonPsi.filter(sk => sk.favorite);
    if (vsPsi.favOnly) psiSkills = psiSkills.filter(sk => sk.favorite);
    if (vsSpells.favOnly) spells = spells.filter(sp => sp.favorite);

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
    sortList(spells, vsSpells.sortBy, vsSpells.dir);

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
    ctx.spells = spells;
  ctx.skillItems = flatSkills; // full flat list (pre-tab filtering, for potential future use)
    ctx.hasSkillItems = nonPsi.length > 0;
    ctx.hasPsiSkills = psiSkills.length > 0;
    ctx.hasAnyPsiSkills = flatSkills.filter(sk => sk.category === 'PSI').length > 0; // Total psi skills (before filtering)
    ctx.hasSpells = spells.length > 0;
    ctx.hasAnySpells = spellItems.length > 0; // Total spells (before filtering)
    // Expose per-tab view states
    ctx._skillViewStateSkills = vsSkills;
    ctx._skillViewStatePsi = vsPsi;
    ctx._skillViewStateSpells = vsSpells;

    // Pre-render tab templates to avoid partial-registration timing issues.
    try {
  ctx._tabStatsHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/stats.hbs", ctx);
      ctx._tabSkillsHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/skills.hbs", ctx);
      ctx._tabPsiHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/psi.hbs", ctx);
      ctx._tabSpellsHtml = await renderTemplate("systems/mekton-fusion/templates/actor/tabs/spells.hbs", ctx);
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
      ctx._tabSkillsHtml = ctx._tabSkillsHtml || '';
      ctx._tabPsiHtml = ctx._tabPsiHtml || '';
      ctx._tabSpellsHtml = ctx._tabSpellsHtml || '';
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
    html.on("click", ".skill-roll", ev => this._onRollSkill(ev));
    html.on("click", ".skill-fav", ev => this._onToggleFavorite(ev));
    html.on("change", ".skill-rank", ev => this._onChangeSkillRank(ev));
    html.on("change", ".skill-ip", ev => this._onChangeSkillIP(ev));
    html.on("click", ".seed-skills", ev => this._onSeedSkills(ev));
    html.on("click", ".psi-add-power", ev => this._onAddPsiPower(ev));
    html.on("click", ".spell-add-power", ev => this._onAddSpell(ev));
  html.on("click", ".custom-skill-add", ev => this._onAddCustomSkill(ev));
  html.on("click", ".custom-skill-delete", ev => this._onDeleteCustomSkill(ev));
    html.on("click", ".psi-delete", ev => this._onDeletePsiPower(ev));
    html.on("click", ".spell-delete", ev => this._onDeleteSpell(ev));
    html.on("click", ".spell-fav", ev => this._onToggleSpellFavorite(ev));
    html.on("click", ".spell-roll", ev => this._onRollSpell(ev));
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

    // Quick actions (single handler for body tab buttons)
    html.on('click', '[data-action]', async ev => {
      const btn = ev.currentTarget;
      const action = btn.dataset.action;
      if (action === 'roll-hitloc') {
        console.log('mekton-fusion | Hit location button clicked');
        return await this._rollHitLocation();
      }

      const loc = btn.dataset.loc;
      if (!loc) return;
      const path = `system.body.locations.${loc}`;

      const data = foundry.utils.getProperty(this.actor, path);
      if (!data) return;

      try {
        switch (action) {
          case 'ablate':
            if ((data.sp ?? 0) > 0) await this.actor.update({ [`${path}.sp`]: (data.sp ?? 0) - 1 });
            this.render(false);
            break;
          case 'heal1':
            await this.actor.update({ [`${path}.hp`]: Math.min((data.hp ?? 0) + 1, data.hpMax ?? 0) });
            this.render(false);
            break;
          case 'dmg1':
            await this.actor.update({ [`${path}.hp`]: Math.max((data.hp ?? 0) - 1, 0) });
            this.render(false);
            break;
          case 'adjust-sp':
            const spInput = html.find(`input[data-loc="${loc}"][data-type="sp"]`);
            const spAdjust = parseInt(spInput.val()) || 0;
            if (spAdjust !== 0) {
              const newSP = Math.max((data.sp ?? 0) + spAdjust, 0);
              await this.actor.update({ [`${path}.sp`]: newSP });
              spInput.val(''); // Clear the input after applying
              this.render(false);
            }
            break;
          case 'adjust-hp':
            const hpInput = html.find(`input[data-loc="${loc}"][data-type="hp"]`);
            const hpAdjust = parseInt(hpInput.val()) || 0;
            if (hpAdjust !== 0) {
              const newHP = Math.min(Math.max((data.hp ?? 0) + hpAdjust, 0), data.hpMax ?? 0);
              await this.actor.update({ [`${path}.hp`]: newHP });
              hpInput.val(''); // Clear the input after applying
              this.render(false);
            }
            break;
            this.render(false);
            break;
          case 'unequip':
            await this.actor.update({ [`${path}.itemId`]: null });
            // Refresh icons after unequip
            this._refreshBodyItemIcons();
            this.render(false);
            break;
          case 'show-item':
            this.actor.items.get(btn.dataset.itemId)?.sheet?.render(true);
            break;
        }
      } catch (err) {
        console.warn('mekton-fusion | Body action failed', action, err);
      }
    });

    // Drag armor item → slot
    const zones = html.find('.hit-zone');
    zones.on('dragover', ev => ev.preventDefault());
    zones.on('drop', async ev => {
      ev.preventDefault();
      const loc = ev.currentTarget.dataset.loc;
      const data = TextEditor.getDragEventData(ev);

      // Accept Items only
      if (data?.type !== 'Item') return;

      const item = await fromUuid(data.uuid);
      if (!item || item.type !== 'armor') return;

      // OPTIONAL: pull SP from item.system and set sp/spMax
      const spVal = item.system?.sp ?? 0;
      const path = `system.body.locations.${loc}`;
      try {
        await this.actor.update({
          [`${path}.itemId`]: item.id,
          [`${path}.sp`]: spVal,
          [`${path}.spMax`]: Math.max(spVal, foundry.utils.getProperty(this.actor, `${path}.spMax`) ?? spVal)
        });
        // Refresh icons after equip
        this._refreshBodyItemIcons();
      } catch (err) {
        console.warn('mekton-fusion | Failed equipping armor to body slot', err);
      }
    });
    html.on("change", ".spell-cost", ev => this._onChangeSpellField(ev, 'cost'));
    html.on("change", ".spell-range", ev => this._onChangeSpellField(ev, 'range'));
    html.on("change", ".spell-duration", ev => this._onChangeSpellField(ev, 'duration'));
    html.on("change", ".spell-defense", ev => this._onChangeSpellField(ev, 'defense'));    // Input validation: prevent negative values and enforce max limits
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
    
    html.on("input", ".spell-cost", ev => {
      const input = ev.currentTarget;
      const value = parseInt(input.value);
      const min = parseInt(input.min) || 0;
      const max = parseInt(input.max) || 99;
      
      if (isNaN(value) || value < min) {
        input.value = min;
      } else if (value > max) {
        input.value = max;
      }
    });
    

    // Tab helpers
    const getTabFromEvent = ev => {
      const tabEl = ev.currentTarget.closest('.tab');
      if (tabEl?.dataset.tab === 'psi') return 'psi';
      if (tabEl?.dataset.tab === 'spells') return 'spells';
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
      sortableContainer.addEventListener('drop', this._onDrop.bind(this));
      sortableContainer.addEventListener('dragend', this._onDragEnd.bind(this));
    }
    // Drag and drop for spells reordering
    const sortableSpellsContainer = html.find('.sortable-spells')[0];
    if (sortableSpellsContainer) {
      sortableSpellsContainer.addEventListener('dragstart', this._onDragStart.bind(this));
      sortableSpellsContainer.addEventListener('dragover', this._onDragOver.bind(this));
      sortableSpellsContainer.addEventListener('drop', this._onDropSpell.bind(this));
      sortableSpellsContainer.addEventListener('dragend', this._onDragEnd.bind(this));
    }
    // Substat controls: +/- buttons and direct input changes
    html.on('click', '.substat-incr', ev => this._onAdjustSubstat(ev, +1));
    html.on('click', '.substat-decr', ev => this._onAdjustSubstat(ev, -1));
    html.on('change input', '.substat-input', ev => this._queueSubstatChange(ev));
    html.on('change input', '.resource-input', ev => this._queueSubstatChange(ev));

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
  _onRollHitLocation(ev) {
    ev.preventDefault();
    // Simple random pick among locations
    const keys = Object.keys(this.actor.system?.body?.locations || {});
    if (!keys.length) return ui.notifications.warn('No body locations defined');
    const idx = Math.floor(Math.random() * keys.length);
    const loc = keys[idx];
    ui.notifications.info(`Hit location: ${this.actor.system.body.locations[loc].label}`);
  }

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
      const cur = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.hp ?? 0, 0);
      const max = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.hpMax ?? 0, 0);
      await this.actor.update({ [`system.body.locations.${loc}.hp`]: Math.min(max, cur + amt) });
      this.render(false);
    } catch (e) { console.error('mekton-fusion | Failed heal', e); }
  }

  async _onBodyDamage(ev, amt = 1) {
    ev.preventDefault();
    const loc = ev.currentTarget.dataset?.loc; if (!loc) return;
    try {
      const cur = MektonActorSheet._num(this.actor.system?.body?.locations?.[loc]?.hp ?? 0, 0);
      await this.actor.update({ [`system.body.locations.${loc}.hp`]: Math.max(0, cur - amt) });
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

  // Sample hit location roller (customize to your table)
  async _rollHitLocation() {
    console.log('mekton-fusion | Rolling hit location...');
    // Mekton Fusion hit location: 1d10 map
    const map = { 1:'head', 2:'torso', 3:'torso', 4:'torso', 5:'rArm', 6:'lArm', 7:'rLeg', 8:'rLeg', 9:'lLeg', 10:'lLeg' };
    const roll = new Roll('1d10');
    await roll.evaluate();
    const total = roll.total;
    const loc = map[total] ?? 'torso';
    
    console.log('mekton-fusion | Hit location result:', { total, loc });
    
    // Show the roll in chat with proper label
    const locLabel = {
      head: 'Head',
      torso: 'Torso',
      rArm: 'Right Arm',
      lArm: 'Left Arm',
      rLeg: 'Right Leg',
      lLeg: 'Left Leg'
    }[loc] || loc;
    
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<strong>Hit Location: ${locLabel}</strong>`
    });
    
    // Optional: flash that zone
    const el = this.element.find(`.hit-zone.${loc}`);
    if (el && el.length) {
      el.addClass('active');
      setTimeout(() => el.removeClass('active'), 500);
    }
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
    const name = input.name;
    if (!name) return;
    const m = name.match(/^system\.substats\.([\w-]+)$/);
    if (!m) return;
    const key = m[1];

    // Skip transient empty or '-' while user typing
    const raw = input.value;
    if (raw === '' || raw === '-' || raw === '+') return;
    let val = this.constructor._num(raw, 0);
    if (val < 0) val = 0;

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

  _onDrop(ev) {
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

  /** Create a new spell */
  async _onAddSpell(ev) {
    ev.preventDefault();
    try {
      // Check for duplicate names
      const existingNames = this.actor.items
        .filter(i => i.type === 'spell')
        .map(i => i.name.toLowerCase());
      
      // Prompt for name
      let name;
      try {
        name = await Dialog.prompt({
          title: game.i18n.localize('MF.AddSpell') || 'Add Spell',
          content: `<p>${game.i18n.localize('MF.SpellNamePrompt') || 'Enter name for the new spell:'}</p><input type="text" name="spellName" value="" style="width:100%" placeholder="${game.i18n.localize('MF.NewSpell') || 'New Spell'}"/>`,
          label: game.i18n.localize('MF.Create') || 'Create',
          callback: html => {
            const input = html.find("[name='spellName']").val().trim();
            return input || (game.i18n.localize('MF.NewSpell') || 'New Spell');
          }
        });
      } catch (_) { 
        return; // User cancelled
      }

      // Check for duplicates
      if (existingNames.includes(name.toLowerCase())) {
        ui.notifications.warn(game.i18n.format('MF.DuplicateSpellName', { name }) || `A spell named "${name}" already exists.`);
        return;
      }

      const doc = await this.actor.createEmbeddedDocuments("Item", [{
        name: name,
        type: 'spell',
        system: {
          stat: 'INT',
          school: 'Custom',
          cost: 1,
          range: '',
          duration: '',
          defense: '',
          rank: 0,
          favorite: false,
          custom: true,
          effect: ''
        }
      }]);
      if (doc?.length) {
        const created = doc[0];
        ui.notifications.info(game.i18n.format('MF.CreatedSpell', { name: created.name }));
        this.render(false);
      }
    } catch (e) {
      console.error('mekton-fusion | Failed to create spell', e);
      ui.notifications.error(game.i18n.localize('MF.ErrorCreateSpell') || 'Failed to create spell');
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

  /** Delete a spell */
  async _onDeleteSpell(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-item-id]");
    if (!li) return;
    const item = this.actor.items.get(li.dataset.itemId);
    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize('MF.DeleteSpell') || 'Delete Spell',
      content: game.i18n.format('MF.DeleteSpellConfirm', { name: item.name }) || `Delete spell "${item.name}"?`,
      yes: () => true,
      no: () => false
    });

    if (confirmed) {
      await item.delete();
      ui.notifications.info(game.i18n.format('MF.DeletedSpell', { name: item.name }) || `Deleted spell: ${item.name}`);
      this.render(false);
    }
  }

  /** Change spell field (cost, range, duration, defense) */
  async _onChangeSpellField(ev, fieldName) {
    const input = ev.currentTarget;
    const li = input.closest("[data-item-id]");
    if (!li) return;
    const spell = this.actor.items.get(li.dataset.itemId);
    if (!spell) return;
    
    let val;
    if (fieldName === 'cost') {
      val = MektonActorSheet._num(input.value, 0);
    } else {
      val = String(input.value).trim();
    }
    
    await spell.update({ [`system.${fieldName}`]: val });
  }

  /** Toggle spell favorite */
  async _onToggleSpellFavorite(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-item-id]");
    if (!li) return;
    const spell = this.actor.items.get(li.dataset.itemId);
    if (!spell) return;
    await spell.update({ "system.favorite": !spell.system.favorite });
    this.render(false);
  }

  /** Change spell rank */
  async _onChangeSpellRank(ev) {
    const input = ev.currentTarget;
    const li = input.closest("[data-item-id]");
    if (!li) return;
    const spell = this.actor.items.get(li.dataset.itemId);
    if (!spell) return;
    const val = MektonActorSheet._num(input.value, 0);
    await spell.update({ "system.rank": val });
    
    // Update the total display without full re-render
    const totalCell = li.querySelector('.spell-total');
    if (totalCell) {
      const statSelect = li.querySelector('.spell-stat');
      const stat = statSelect?.value?.toUpperCase() || 'INT';
      const statVal = this.actor.system?.stats?.[stat]?.value ?? 0;
      totalCell.textContent = statVal + val;
    }
  }

  /** Change spell stat */
  async _onChangeSpellStat(ev) {
    const select = ev.currentTarget;
    const li = select.closest("[data-item-id]");
    if (!li) return;
    const spell = this.actor.items.get(li.dataset.itemId);
    if (!spell) return;
    await spell.update({ "system.stat": select.value });
    
    // Update the total display without full re-render
    const totalCell = li.querySelector('.spell-total');
    if (totalCell) {
      const newStat = select.value.toUpperCase();
      const statVal = this.actor.system?.stats?.[newStat]?.value ?? 0;
    const rank = MektonActorSheet._num(li.querySelector('.spell-rank')?.value, 0);
      totalCell.textContent = statVal + rank;
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
            <div>
              <label>${game.i18n.localize('MF.RollDifficultyPrompt')}:</label>
              <input type="number" name="difficulty" placeholder="Optional" style="width:100%"/>
            </div>
          `,
          label: "Roll",
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
            <div>
              <label>${game.i18n.localize('MF.RollDifficultyPrompt')}:</label>
              <input type="number" name="difficulty" placeholder="Optional" style="width:100%"/>
            </div>
          `,
          label: "Roll",
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
    const finalTotal = base + statVal + rank + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    
    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const flavorParts = [`(${plusStr}${minusStr})`, `${statLabel} ${statVal}`];
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
    
    const flavor = `<strong>${this.actor.name}</strong> rolls ${rollTitle} ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>${resultText}`;
    await roll.toMessage({ speaker, flavor });
  }

  /** Roll spell */
  async _onRollSpell(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-item-id]");
    if (!li) return;
    const id = li.dataset.itemId;
    const spell = this.actor.items.get(id);
    if (!spell) return;
      // Build stat list from actor stats keys (fallback to standard set)
      const statKeys = Object.keys(this.actor.system?.stats || { REF:1, INT:1, COOL:1, TECH:1, BODY:1, EMP:1, LUCK:1, MA:1, ATTR:1, EDU:1 })
        .map(k => k.toUpperCase());
      const uniqueStats = Array.from(new Set(statKeys));

      let name, chosenStat;
    const stat = 'COOL'; // All spell casting uses COOL
        const result = await Dialog.prompt({
          title: game.i18n.localize('MF.AddCustomSkill') || 'Add Custom Skill',
          content: `
            <p>${game.i18n.localize('MF.CustomSkillNamePrompt') || 'Enter name for the new custom skill:'}</p>
            <input type="text" name="skillName" value="" style="width:100%; margin-bottom:6px;" placeholder="${game.i18n.localize('MF.NewCustomSkill') || 'New Custom Skill'}"/>
            <label style="display:block; margin-top:4px;">Stat:
              <select name="skillStat" style="width:100%;">
                ${uniqueStats.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </label>
          `,
          label: game.i18n.localize('MF.Create') || 'Create',
          callback: html => {
            const inputName = html.find("[name='skillName']").val().trim();
            const statVal = (html.find("[name='skillStat']").val() || 'REF').toUpperCase();
            return { name: inputName || (game.i18n.localize('MF.NewCustomSkill') || 'New Custom Skill'), stat: statVal };
          }
        });
        if (!result) return; // canceled
        name = result.name;
        chosenStat = result.stat;
    if (!ev.shiftKey) {
      try {
        const result = await Dialog.prompt({
          title: game.i18n.format('MF.RollSimple', { name: spell.name }),
          content: `
            <div style="margin-bottom: 10px;">
              <label>Modifier:</label>
              <input type="number" name="mod" value="0" style="width:100%"/>
            </div>
            <div>
              <label>${game.i18n.localize('MF.RollDifficultyPrompt')}:</label>
          stat: chosenStat || 'REF',
            </div>
          `,
          label: "Roll",
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
    
    const roll = new Roll('1d10');
    await roll.evaluate();
    const diceResult = roll.total;
    const finalTotal = diceResult + spellcastingTotal + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const school = spell.system?.school || 'Unknown';
    const flavorParts = [`1d10: ${diceResult}`, `COOL ${spellcastingStatVal}`];
    if (spellcastingRank) flavorParts.push(`Spellcasting ${spellcastingRank}`);
    if (mod) flavorParts.push(`Mod ${mod >= 0 ? '+' : ''}${mod}`);    let resultText = '';
    if (difficulty !== null) {
      const success = finalTotal >= difficulty;
      resultText = ` vs Difficulty ${difficulty} = <strong style="color: ${success ? 'green' : 'red'}">${success ? 'SUCCESS' : 'FAILURE'}</strong>`;
    }
    
    const rollTitle = difficulty !== null ? 
      game.i18n.format('MF.RollWithDifficulty', { name: spell.name, difficulty }) :
      game.i18n.format('MF.RollSimple', { name: spell.name });
    
    const flavor = `<strong>${this.actor.name}</strong> casts <em>${rollTitle}</em> <small>[${school}]</small> = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>${resultText}`;
    await roll.toMessage({ speaker, flavor });
  }

  /** Drop spell handler */
  _onDropSpell(ev) {
    ev.preventDefault();
    this._saveSpellOrder();
  }

  /** Save spell order */
  async _saveSpellOrder() {
    const container = this.element.find('.sortable-spells')[0];
    if (!container) return;

    const rows = [...container.querySelectorAll('.spell-item-row')];
    const updates = [];
    
    for (let i = 0; i < rows.length; i++) {
      const spellId = rows[i].dataset.itemId;
      const item = this.actor.items.get(spellId);
      if (item && item.type === 'spell') {
        updates.push({ _id: spellId, 'system.sort': i });
      }
    }

    if (updates.length > 0) {
      await this.actor.updateEmbeddedDocuments('Item', updates);
    }
  }
}
