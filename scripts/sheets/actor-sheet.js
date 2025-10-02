// module/script/sheets/actor-sheet.js
import { STAT_DEFAULT_VALUES, applyStatDefaults } from "../../module/data/defaults.js";

export class MektonActorSheet extends foundry.appv1.sheets.ActorSheet {
  constructor(...args) {
    super(...args);
    this._skillViewState = { favOnly: false, sortBy: 'name', dir: 'asc' };
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
      closeOnSubmit: true,
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

    // Legacy inline skills object (still supported, but prefer Item skills)
    ctx.system.skills ??= {};
    for (const [key, sk] of Object.entries(ctx.system.skills)) {
      if (sk && typeof sk === "object") sk.value = this.constructor._num(sk.value, 0);
      else ctx.system.skills[key] = { label: key, value: this.constructor._num(sk, 0) };
    }

    // Build skill Items listing (preferred representation)
    const skillItems = this.actor.items.filter(i => i.type === "skill");
    let flatSkills = skillItems.map(it => {
      const stat = String(it.system?.stat || "REF").toUpperCase();
      const statVal = ctx.system.stats?.[stat]?.value ?? 0;
      const rank = this.constructor._num(it.system?.rank, 0);
      const total = statVal + rank;
      const category = it.system?.category || stat;
      const hard = !!it.system?.hard || /\(H\)|\[H\]/i.test(it.name);
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
        hard
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Apply favorites filter - show all skills unless favOnly is checked
    if (this._skillViewState.favOnly) {
      flatSkills = flatSkills.filter(sk => sk.favorite);
    }

    // Sorting
    const { sortBy, dir } = this._skillViewState;
    const factor = dir === 'desc' ? -1 : 1;
    const collator = new Intl.Collator(game.i18n.lang || 'en', { sensitivity: 'base' });
    flatSkills.sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'stat': av = a.stat; bv = b.stat; return collator.compare(av, bv) * factor || collator.compare(a.name,b.name);
        case 'rank': av = a.rank; bv = b.rank; return (av - bv) * factor || collator.compare(a.name,b.name);
        case 'total': av = a.total; bv = b.total; return (av - bv) * factor || collator.compare(a.name,b.name);
        case 'name':
        default: av = a.name; bv = b.name; return collator.compare(av, bv) * factor;
      }
    });

    // Separate PSI category into its own tab
    const psiSkills = flatSkills.filter(sk => sk.category === 'PSI');
    const nonPsi = flatSkills.filter(sk => sk.category !== 'PSI');

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
    ctx.psiSkills = psiSkills.sort((a,b)=>a.name.localeCompare(b.name));
    ctx.skillItems = flatSkills; // full flat list
    ctx.hasSkillItems = nonPsi.length > 0;
    ctx.hasPsiSkills = psiSkills.length > 0;

    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.on("click", ".item-control.item-edit", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet?.render(true);
    });
    html.on("click", ".ability-roll, .stat-roll", ev => this._onRollStat(ev));
    html.on("click", ".skill-roll", ev => this._onRollSkill(ev));
    html.on("click", ".skill-fav", ev => this._onToggleFavorite(ev));
    html.on("change", ".skill-rank", ev => this._onChangeSkillRank(ev));
    html.on("click", ".seed-skills", ev => this._onSeedSkills(ev));

    // Favorites-only filter
    html.on('change', '.skill-filter-fav', ev => {
      this._skillViewState.favOnly = ev.currentTarget.checked;
      this.render(false);
    });

    // Sort selector
    html.on('change', '.skill-sort-by', ev => {
      this._skillViewState.sortBy = ev.currentTarget.value;
      this.render(false);
    });

    // Direction toggle
    html.on('click', '.skill-sort-dir', ev => {
      const btn = ev.currentTarget;
      const dir = btn.dataset.dir === 'asc' ? 'desc' : 'asc';
      this._skillViewState.dir = dir;
      btn.dataset.dir = dir;
      btn.textContent = dir === 'asc' ? '▲' : '▼';
      this.render(false);
    });
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
    // Optimistic UI: adjust displayed total without full re-render (optional)
    this.render(false);
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
}
