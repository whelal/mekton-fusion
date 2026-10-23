import { ARMOR_ZONES, ZONE_KEYS, COVERAGE_PRESETS, presetForZones, cleanZones, armorTotals } from "../data/armor-coverage.js";

/**
 * Coverage editor for mesh/plate armor: a garment preset select plus one
 * checkbox per zone (picking a preset ticks its zones; ticking a set that
 * matches no preset shows "Custom"), with a live weight/cost line. Its
 * controls carry no `name`, so they stay out of a sheet's submitOnChange form
 * data -- read them with readCoverageEditor().
 */
export function coverageEditorHtml(system, { disabled = false } = {}) {
  const zones = cleanZones(system?.coverage);
  const preset = presetForZones(zones);
  const dis = disabled ? " disabled" : "";
  const options = Object.entries(COVERAGE_PRESETS)
    .map(([k, p]) => `<option value="${k}"${k === preset ? " selected" : ""}>${p.label}</option>`)
    .join("") + `<option value="custom"${preset === "custom" ? " selected" : ""}>Custom</option>`;
  const boxes = ZONE_KEYS.map(z => `<label class="mf-zone-box" title="Hit ${ARMOR_ZONES[z].hit}">`
    + `<input type="checkbox" class="mf-cov-zone" data-zone="${z}"${zones.includes(z) ? " checked" : ""}${dis}/> ${ARMOR_ZONES[z].label}</label>`).join("");
  return `<div class="mf-coverage-editor">
    <select class="mf-cov-preset"${dis}>${options}</select>
    <div class="mf-cov-zones">${boxes}</div>
    <p class="mf-cov-totals"></p>
  </div>`;
}

/** Zones currently ticked in a coverage editor. */
export function readCoverageEditor($root) {
  return cleanZones($root.find(".mf-cov-zone:checked").map((_, el) => el.dataset.zone).get());
}

/** Wire a rendered coverage editor; onChange(zones) fires after each user edit. */
export function bindCoverageEditor($root, system, onChange) {
  const refreshTotals = () => {
    const t = armorTotals({ ...system, coverage: readCoverageEditor($root) });
    $root.find(".mf-cov-totals").text(t.units === null ? ""
      : `${t.units} location${t.units === 1 ? "" : "s"}: ${t.weight} kg, ${t.cost}`);
  };
  $root.find(".mf-cov-preset").on("change", ev => {
    const zones = COVERAGE_PRESETS[ev.currentTarget.value]?.zones;
    if (!zones) return; // "Custom": keep the current ticks
    $root.find(".mf-cov-zone").each((_, el) => { el.checked = zones.includes(el.dataset.zone); });
    refreshTotals();
    onChange?.(readCoverageEditor($root));
  });
  $root.find(".mf-cov-zone").on("change", () => {
    $root.find(".mf-cov-preset").val(presetForZones(readCoverageEditor($root)));
    refreshTotals();
    onChange?.(readCoverageEditor($root));
  });
  refreshTotals();
}

/**
 * Ask how a dropped mesh/plate piece is worn. Resolves to the chosen zones,
 * or null if the dialog is closed (the drop is then cancelled).
 */
export function pickArmorCoverage(itemData) {
  const system = itemData.system ?? {};
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    new Dialog({
      title: `Wear ${itemData.name} as…`,
      content: `<form class="mekton-fusion">${coverageEditorHtml(system)}</form>`,
      buttons: {
        ok: {
          label: "Add",
          callback: html => {
            const zones = readCoverageEditor(html);
            if (!zones.length) { ui.notifications.warn("Pick at least one zone."); finish(null); return; }
            finish(zones);
          }
        },
        cancel: { label: "Cancel", callback: () => finish(null) }
      },
      default: "ok",
      render: html => bindCoverageEditor(html, system),
      close: () => finish(null)
    }).render(true);
  });
}
