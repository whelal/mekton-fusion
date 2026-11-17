/**
 * Mook generator, human scale (0.4): pure logic, no Foundry. The GM builds
 * template NPCs with the normal sheet in a world folder (setting
 * `mookTemplateFolder`); the generator copies one N times as fresh, separate
 * world actors. The Foundry side (dialog, folders, tokens) is
 * module/mook-generator.js.
 */
import { zonesOfLocation, effectiveCoverage } from "./armor-coverage.js";
import { seedZoneSP } from "./armor.js";

export const MOOK_COUNT_MIN = 1;
export const MOOK_COUNT_MAX = 20;
/** The number placeholder in a name pattern: a whole word "N". */
export const MOOK_NAME_TOKEN = "N";

/**
 * A fresh copy of an actor's data (the shape `actor.toObject()` returns): no
 * Wounds or Bruises, no recovery remainders, every armor piece back to its
 * base SP on every zone it covers, every zone's active piece cleared, natural
 * armor back to max, no status effects (unconscious, dead, burning, ...), no
 * burning flag and no jammed weapons. Stats, skills, items, In hand and
 * everything else are kept. Ammo state isn't touched. The input isn't changed.
 * @param {object} actorData
 * @returns {object}
 */
export function resetMookData(actorData) {
  const data = structuredClone(actorData ?? {});
  const items = Array.isArray(data.items) ? data.items : [];

  const armorCoverage = [];
  for (const item of items) {
    if (item?.flags?.["mekton-fusion"]) delete item.flags["mekton-fusion"].jammed;
    if (item?.type !== "armor" || !item.system) continue;
    const coverage = effectiveCoverage(item.system);
    item.system.currentSP = seedZoneSP(coverage, item.system.baseSP);
    armorCoverage.push(...coverage);
  }

  const body = data.system?.body;
  for (const [key, loc] of Object.entries(body?.locations ?? {})) {
    if (!loc) continue;
    loc.hits = Number(loc.hitsMax) || 0;
    loc.bruises = 0;
    loc.recoveryRemainder = 0;
    // Natural armor (a location no piece covers) back to max, as Repair Armor does.
    if (!zonesOfLocation(key).some(z => armorCoverage.includes(z))) loc.sp = Number(loc.spMax) || 0;
  }
  for (const zone of Object.values(body?.armorZones ?? {})) {
    if (zone) zone.activeArmorId = "";
  }

  if (data.flags?.["mekton-fusion"]) delete data.flags["mekton-fusion"].burning;
  if (Array.isArray(data.effects)) data.effects = data.effects.filter(e => !(e?.statuses?.length));
  return data;
}

/** "PDF Soldier N" -> "PDF Soldier N"; "PDF Soldier" -> "PDF Soldier N". */
export function normalizeMookPattern(pattern) {
  const p = String(pattern ?? "").trim();
  return new RegExp(`\\b${MOOK_NAME_TOKEN}\\b`).test(p) ? p : `${p} ${MOOK_NAME_TOKEN}`.trim();
}

/** The pattern split at its LAST whole-word "N": [before, after]. */
function splitPattern(pattern) {
  const p = normalizeMookPattern(pattern);
  const re = new RegExp(`\\b${MOOK_NAME_TOKEN}\\b`, "g");
  let at = -1;
  for (let m; (m = re.exec(p));) at = m.index;
  return [p.slice(0, at), p.slice(at + MOOK_NAME_TOKEN.length)];
}

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The next `count` names for a pattern, numbered past the highest number an
 * existing name already uses with that pattern (gaps aren't refilled). The
 * last whole-word "N" in the pattern is the number; a pattern without one gets
 * " N" appended. Matching is exact and case-sensitive.
 * nextMookNames("PDF Soldier N", ["PDF Soldier 3"], 2) -> ["PDF Soldier 4", "PDF Soldier 5"]
 * @param {string} pattern
 * @param {string[]} existingNames
 * @param {number} count
 * @returns {string[]}
 */
export function nextMookNames(pattern, existingNames, count) {
  const [before, after] = splitPattern(pattern);
  const re = new RegExp(`^${escapeRegExp(before)}(\\d+)${escapeRegExp(after)}$`);
  let highest = 0;
  for (const name of existingNames ?? []) {
    const m = re.exec(String(name ?? ""));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return Array.from({ length: n }, (_, k) => `${before}${highest + k + 1}${after}`);
}

/** Count from the dialog, clamped to MOOK_COUNT_MIN..MOOK_COUNT_MAX. */
export function clampMookCount(count) {
  const n = Math.floor(Number(count) || 0);
  return Math.min(MOOK_COUNT_MAX, Math.max(MOOK_COUNT_MIN, n));
}

/**
 * The default target folder path: "Mooks/<template name>". A "/" in the name
 * becomes "-" so it stays one folder; no name gives just "Mooks".
 */
export function defaultMookFolderPath(templateName = "") {
  const name = String(templateName ?? "").replaceAll("/", "-").trim();
  return name ? `Mooks/${name}` : "Mooks";
}

/** A folder path split into its non-empty names: "Mooks/ Warehouse raid/" -> ["Mooks", "Warehouse raid"]. */
export function splitFolderPath(path) {
  return String(path ?? "").split("/").map(s => s.trim()).filter(Boolean);
}

/**
 * Token cells for a compact grid around a centre cell: `count` {di, dj}
 * offsets (rows, columns) from the centre, nearest first (ties: row, then
 * column), skipping cells `isFree` rejects. Searches out to `maxRadius` rings;
 * if that still isn't enough, the remaining offsets ignore `isFree` (just a
 * grid), so it always returns `count` offsets.
 * @param {number} count
 * @param {(di:number, dj:number) => boolean} [isFree]
 * @param {number} [maxRadius]
 * @returns {{di:number, dj:number}[]}
 */
export function placementOffsets(count, isFree = () => true, maxRadius = 10) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const cells = [];
  for (let di = -maxRadius; di <= maxRadius; di++) {
    for (let dj = -maxRadius; dj <= maxRadius; dj++) cells.push({ di, dj });
  }
  // Nearest first by ring (Chebyshev), then by straight-line distance, so the block stays square.
  const ring = c => Math.max(Math.abs(c.di), Math.abs(c.dj));
  const dist = c => c.di * c.di + c.dj * c.dj;
  cells.sort((a, b) => ring(a) - ring(b) || dist(a) - dist(b) || a.di - b.di || a.dj - b.dj);
  const free = cells.filter(c => isFree(c.di, c.dj)).slice(0, n);
  if (free.length < n) {
    const taken = new Set(free.map(c => `${c.di},${c.dj}`));
    for (const c of cells) {
      if (free.length >= n) break;
      if (!taken.has(`${c.di},${c.dj}`)) free.push(c);
    }
  }
  return free;
}
