// module/script/sheets/actor-sheet.js
import { STAT_DEFAULT_VALUES, applyStatDefaults } from "../../module/data/defaults.js";

export class MektonActorSheet extends foundry.appv1.sheets.ActorSheet {
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
  scrollY: [".tab.stats", ".tab.skills", ".tab.psi", ".tab.spells"]
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

    ctx.system.stats = applyStatDefaults(ctx.system.stats || {});

    // Ensure stats container exists / normalize values
  const statKeys = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP", "EDU", "PSI"];
    for (const k of statKeys) {
      const path = `stats.${k}.value`;
      const v = foundry.utils.getProperty(ctx.system, path);
      foundry.utils.setProperty(ctx.system, path, MektonActorSheet._num(v, STAT_DEFAULT_VALUES[k] ?? 5));
    }

    // Ensure substats container exists and seed defaults (5) for any missing substats
    ctx.system.substats ??= {};
    const SUBSTAT_KEYS = ['stun','run','leap','hp','sta','enc','rec','punch','kick'];
    // Track keys that need to be persisted back to the actor document
    const toPersist = {};
    for (const key of SUBSTAT_KEYS) {
      const cur = foundry.utils.getProperty(ctx.system, `substats.${key}`);
      // If value missing or empty string, set numeric default 5 (and schedule for persistence)
      if (cur === undefined || cur === null || String(cur).trim() === '') {
        foundry.utils.setProperty(ctx.system, `substats.${key}`, 5);
        toPersist[`system.substats.${key}`] = 5;
      }
    }
    // If we found missing substats, persist them once to the actor document so future renders don't need to seed
    if (Object.keys(toPersist).length > 0) {
      // Fire-and-forget but log failures; avoid blocking getData excessively
      this.actor.update(toPersist).catch(e => console.warn('mekton-fusion | Failed to persist seeded substats', e));
    }

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
    const skillItems = this.actor.items.filter(i => i.type === "skill");
    let needsPsiFix = false;
    let flatSkills = skillItems.map(it => {
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
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Migration: if any PSI category skills had non-PSI stat stored, update documents silently
    if (needsPsiFix) {
      for (const sk of flatSkills) {
        if (sk.category === 'PSI' && sk.item.system?.stat?.toUpperCase?.() !== 'PSI') {
          await sk.item.update({ 'system.stat': 'PSI' });
        }
      }
    }

    // Base stable name sort
    const collator = new Intl.Collator(game.i18n.lang || 'en', { sensitivity: 'base' });
    flatSkills.sort((a,b)=> collator.compare(a.name,b.name));
    // Split into tabs early
    let psiSkills = flatSkills.filter(sk => sk.category === 'PSI');
    let nonPsi = flatSkills.filter(sk => sk.category !== 'PSI');

    // Build spell Items listing
    const spellItems = this.actor.items.filter(i => i.type === "spell");
    let spells = spellItems.map(it => {
      const stat = String(it.system?.stat || it.system?.test || "INT").toUpperCase();
      const statVal = ctx.system.stats?.[stat]?.value ?? 0;
      const rank = this.constructor._num(it.system?.rank, 0);
      const total = statVal + rank;
      const custom = !!it.system?.custom;
      return {
        id: it.id,
        name: it.name,
        stat,
        rank,
        total,
        favorite: !!it.system?.favorite,
        item: it,
        system: it.system,
        school: it.system?.school || 'Unknown',
        cost: it.system?.cost || 0,
        effect: it.system?.effect || '',
        custom
      };
    }).sort((a, b) => collator.compare(a.name, b.name));

    // Favorites filtering per tab
    if (vsSkills.favOnly) nonPsi = nonPsi.filter(sk => sk.favorite);
    if (vsPsi.favOnly) psiSkills = psiSkills.filter(sk => sk.favorite);
    if (vsSpells.favOnly) spells = spells.filter(sp => sp.favorite);

    // Sorting helper
    function sortList(list, sortBy, dir) {
      const factor = dir === 'desc' ? -1 : 1;
      list.sort((a,b) => {
        let av, bv;
        switch (sortBy) {
          case 'stat': av = a.stat; bv = b.stat; return collator.compare(av,bv)*factor || collator.compare(a.name,b.name);
          case 'rank': av = a.rank; bv = b.rank; return (av-bv)*factor || collator.compare(a.name,b.name);
          case 'total': av = a.total; bv = b.total; return (av-bv)*factor || collator.compare(a.name,b.name);
          case 'name':
          default: av = a.name; bv = b.name; return collator.compare(av,bv)*factor;
        }
      });
    }
    sortList(nonPsi, vsSkills.sortBy, vsSkills.dir);
    sortList(psiSkills, vsPsi.sortBy, vsPsi.dir);
    sortList(spells, vsSpells.sortBy, vsSpells.dir);

    // Group non-PSI categories
    const byCategory = new Map();
    for (const sk of nonPsi) {
      if (!byCategory.has(sk.category)) byCategory.set(sk.category, []);
      byCategory.get(sk.category).push(sk);
    }
    const grouped = Array.from(byCategory.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, skills]) => ({ category, skills: skills.sort((a,b)=>a.name.localeCompare(b.name)) }));

    ctx.skillGroups = grouped;
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
    html.on("click", ".seed-skills", ev => this._onSeedSkills(ev));
    html.on("click", ".psi-add-power", ev => this._onAddPsiPower(ev));
    html.on("click", ".spell-add-power", ev => this._onAddSpell(ev));
    html.on("click", ".item-delete", ev => this._onDeletePsiPower(ev));
    html.on("click", ".spell-delete", ev => this._onDeleteSpell(ev));
    html.on("change", ".spell-rank", ev => this._onChangeSpellRank(ev));
    html.on("change", ".spell-stat", ev => this._onChangeSpellStat(ev));
    html.on("click", ".spell-fav", ev => this._onToggleSpellFavorite(ev));
    html.on("click", ".spell-roll", ev => this._onRollSpell(ev));    const getTabFromEvent = ev => {
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
    html.on('change', '.substat-input', ev => this._onChangeSubstat(ev));
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

  /** Handle direct change to a substat input and persist */
  async _onChangeSubstat(ev) {
    const input = ev.currentTarget;
    const card = input.closest('.substat-card'); if (!card) return;
    const key = card.dataset.subkey;
    const val = MektonActorSheet._num(input.value, 0);
    try { await this.actor.update({ [`system.substats.${key}`]: val }); }
    catch (e) { console.warn('mekton-fusion | Failed to update substat', key, e); }
  }

  /** Roll 1d10 + selected stat (with optional modifier) */
  async _onRollStat(ev) {
    ev.preventDefault();
    const btn = ev.currentTarget;
    const rawKey = btn.dataset.ability; if (!rawKey) return;
    const keyMap = { ref: "REF", int: "INT", body: "BODY", tech: "TECH", cool: "COOL", will: "COOL", luck: "LUCK", move: "MA", ma: "MA", emp: "EMP", attr: "ATTR", edu: "EDU" };
    const statKey = keyMap[rawKey.toLowerCase()] || rawKey.toUpperCase();
    const label = statKey;
    // Resolve stat numeric value supporting either numeric or {value:number} structure
    const statSource = this.actor.system?.stats?.[statKey];
    const statVal = typeof statSource === 'object' && statSource !== null ? Number(statSource.value) || 0 : Number(statSource) || 0;
    let mod = 0;
    if (!ev.shiftKey) {
      try {
        mod = Number(await Dialog.prompt({
          title: `Modifier for ${label}`,
          content: `<p>Enter a temporary modifier for ${label} (can be negative):</p><input type="number" name="mod" value="0" style="width:100%"/>`,
          label: "Roll",
          callback: html => Number(html.find("[name='mod']").val() || 0)
        })) || 0;
      } catch (_) { return; }
    }
    // Exploding d10 core roll
  const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const finalTotal = base + statVal + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const parts = [`(${plusStr}${minusStr})`, `${label} ${statVal}`];
    if (mod) parts.push(`Mod ${mod >= 0 ? '+' : ''}${mod}`);
    const explodedUp = plusDice.some(d=>d===10) ? 'Up' : '';
    const explodedDown = minusDice.some(d=>d===1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? `<span class=\"exploding\">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span class=\"exploding cap\">[Cap ${maxExtra}]</span>` : '';
    const flavor = `<strong>${this.actor.name}</strong> rolls <em>${label}</em> ${tag}${capTag} = ${parts.join(' + ')} = <strong>${finalTotal}</strong>`;
    roll.toMessage({ speaker, flavor });
  }

  /** Roll 1d10 + STAT + skill rank (+ optional modifier) */
  async _onRollSkill(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-skill-id]"); if (!li) return;
    const id = li.dataset.skillId; const skill = this.actor.items.get(id); if (!skill) return;
    const stat = String(skill.system?.stat || "REF").toUpperCase();
    const rank = MektonActorSheet._num(skill.system?.rank, 0);
    const statLabel = stat;
    const statSource = this.actor.system?.stats?.[stat];
    const statVal = typeof statSource === 'object' && statSource !== null ? Number(statSource.value) || 0 : Number(statSource) || 0;

    let mod = 0;
    if (!ev.shiftKey) {
      try {
        mod = Number(await Dialog.prompt({
          title: `Modifier for ${skill.name}`,
          content: `<p>Enter a temporary modifier for ${skill.name} (can be negative):</p><input type=\"number\" name=\"mod\" value=\"0\" style=\"width:100%\"/>`,
          label: "Roll",
          callback: html => Number(html.find("[name='mod']").val() || 0)
        })) || 0;
      } catch (_) { return; }
    }
  const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const finalTotal = base + statVal + rank + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const category = skill.system?.category || statLabel;
    const hard = skill.system?.hard || /\(H\)|\[H\]/i.test(skill.name);
    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const flavorParts = [`(${plusStr}${minusStr})`, `${statLabel} ${statVal}`];
    if (rank) flavorParts.push(`Rank ${rank}`);
    if (mod) flavorParts.push(`Mod ${mod >= 0 ? '+' : ''}${mod}`);
    if (hard) flavorParts.push('Hard');
    const explodedUp = plusDice.some(d=>d===10) ? 'Up' : '';
    const explodedDown = minusDice.some(d=>d===1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? `<span class=\"exploding\">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span class=\"exploding cap\">[Cap ${maxExtra}]</span>` : '';
    const flavor = `<strong>${this.actor.name}</strong> rolls <em>${skill.name}</em> <small>[${category}${hard ? '; Hard' : ''}]</small> ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>`;
    roll.toMessage({ speaker, flavor });
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
    ev.dataTransfer.setData('text/plain', row.dataset.skillId);
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
      const rank = parseInt(li.querySelector('.spell-rank')?.value) || 0;
      totalCell.textContent = statVal + rank;
    }
  }

  /** Roll spell */
  async _onRollSpell(ev) {
    ev.preventDefault();
    const li = ev.currentTarget.closest("[data-item-id]");
    if (!li) return;
    const id = li.dataset.itemId;
    const spell = this.actor.items.get(id);
    if (!spell) return;
    
    const stat = String(spell.system?.stat || "INT").toUpperCase();
    const rank = MektonActorSheet._num(spell.system?.rank, 0);
    const statLabel = stat;
    const statSource = this.actor.system?.stats?.[stat];
    const statVal = typeof statSource === 'object' && statSource !== null ? Number(statSource.value) || 0 : Number(statSource) || 0;

    let mod = 0;
    if (!ev.shiftKey) {
      try {
        mod = Number(await Dialog.prompt({
          title: `Modifier for ${spell.name}`,
          content: `<p>Enter a temporary modifier for ${spell.name} (can be negative):</p><input type="number" name="mod" value="0" style="width:100%"/>`,
          label: "Roll",
          callback: html => Number(html.find("[name='mod']").val() || 0)
        })) || 0;
      } catch (_) { return; }
    }
    
    const { roll, total: base, plusDice, minusDice, capped, maxExtra } = await this.constructor._rollBidirectionalExplodingD10();
    const finalTotal = base + statVal + rank + (mod||0);
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const school = spell.system?.school || 'Unknown';
    const cost = spell.system?.cost || 0;
    const plusStr = plusDice.join(' + ');
    const minusStr = minusDice.length ? ' - (' + minusDice.join(' + ') + ')' : '';
    const flavorParts = [`(${plusStr}${minusStr})`, `${statLabel} ${statVal}`];
    if (rank) flavorParts.push(`Rank ${rank}`);
    if (mod) flavorParts.push(`Mod ${mod >= 0 ? '+' : ''}${mod}`);
    if (cost) flavorParts.push(`Cost ${cost}`);
    const explodedUp = plusDice.some(d=>d===10) ? 'Up' : '';
    const explodedDown = minusDice.some(d=>d===1) ? (explodedUp ? '/Down' : 'Down') : '';
    const tag = (explodedUp || explodedDown) ? `<span class="exploding">[Exploding ${explodedUp}${explodedDown}]</span>` : '';
    const capTag = capped ? ` <span class="exploding cap">[Cap ${maxExtra}]</span>` : '';
    const flavor = `<strong>${this.actor.name}</strong> casts <em>${spell.name}</em> <small>[${school}]</small> ${tag}${capTag} = ${flavorParts.join(' + ')} = <strong>${finalTotal}</strong>`;
    roll.toMessage({ speaker, flavor });
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
