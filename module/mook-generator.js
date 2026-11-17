/**
 * Mook generator, human scale (0.4): the Foundry side. GM only. Copies a
 * template actor from the mook template folder (world setting
 * `mookTemplateFolder`) into N separate, fresh world actors, optionally placing
 * their tokens on the current scene. Pure logic is module/data/mooks.js.
 * Opened from the "Generate Mooks" button in the Actors sidebar header, or
 * the macro macros/generate-mooks.macro.js. No network calls.
 */
import {
  resetMookData, nextMookNames, normalizeMookPattern, clampMookCount, defaultMookFolderPath,
  splitFolderPath, placementOffsets, MOOK_COUNT_MIN, MOOK_COUNT_MAX, MOOK_NAME_TOKEN
} from "./data/mooks.js";
import { escapeHtml } from "./util/escape.js";

const SYSTEM_ID = "mekton-fusion";
const TEMPLATE_FOLDER_SETTING = "mookTemplateFolder";
const DEFAULT_TEMPLATE_FOLDER = "Mook Templates";
/** Create option: the createActor auto-seed skips mooks (a mook is a full copy of its template). */
export const MOOK_CREATE_OPTION = "mfMook";

/** World setting: the name of the Actor folder holding mook templates. Call from init. */
export function registerMookSettings() {
  game.settings.register(SYSTEM_ID, TEMPLATE_FOLDER_SETTING, {
    name: "Mook template folder",
    hint: "The Actor folder (by name) whose NPCs the Generate Mooks button copies. Subfolders are included.",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_TEMPLATE_FOLDER
  });
}

/**
 * Actors sidebar: a GM-only "Generate Mooks" row under the header's create
 * buttons. v13 ActorDirectory is ApplicationV2, so the hook is
 * renderActorDirectory(app, element: HTMLElement, context, options). A partial
 * re-render may keep the header, so this doesn't add the button twice.
 */
export function addMookDirectoryButton(app, element) {
  if (!game.user?.isGM) return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  const actions = root?.querySelector(".directory-header .header-actions");
  if (!actions || root.querySelector(".mf-generate-mooks")) return;
  const row = document.createElement("div");
  row.className = "header-actions action-buttons flexrow mf-mook-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mf-generate-mooks";
  button.innerHTML = `<i class="fa-solid fa-users" inert></i><span>Generate Mooks</span>`;
  button.addEventListener("click", ev => { ev.preventDefault(); openMookGenerator(); });
  row.append(button);
  actions.after(row);
}

/** The template folder and its actors (subfolders included), by name. */
function mookTemplates() {
  const folderName = String(game.settings.get(SYSTEM_ID, TEMPLATE_FOLDER_SETTING) ?? "").trim() || DEFAULT_TEMPLATE_FOLDER;
  const folder = game.folders.find(f => f.type === "Actor" && f.name === folderName) ?? null;
  if (!folder) return { folderName, folder, templates: [], error: null, missing: true };
  const folders = [folder, ...folder.getSubfolders(true)];
  const ids = new Set(folders.map(f => f.id));
  const templates = game.actors.filter(a => ids.has(a._source.folder) && ["npc", "character"].includes(a.type))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!templates.length) {
    return { folderName, folder, templates, error: `The "${folderName}" folder has no NPCs in it. Build a template NPC there first.` };
  }
  return { folderName, folder, templates, error: null };
}

/** Open the generator dialog (GM only). */
export async function openMookGenerator() {
  if (!game.user?.isGM) { ui.notifications.warn("Only a GM can generate mooks."); return; }
  const { folderName, folder: templateFolder, templates, error, missing } = mookTemplates();
  if (missing) { await offerTemplateFolder(folderName); return; }
  if (error) { ui.notifications.error(error); return; }

  const first = templates[0];
  const options = templates.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  const content = `
    <div class="form-group"><label>Template</label>
      <select name="templateId">${options}</select></div>
    <div class="form-group"><label>Count</label>
      <input type="number" name="count" value="${MOOK_COUNT_MIN}" min="${MOOK_COUNT_MIN}" max="${MOOK_COUNT_MAX}" step="1"></div>
    <div class="form-group"><label>Name</label>
      <input type="text" name="name" value="${escapeHtml(normalizeMookPattern(first.name))}">
      <p class="hint">${MOOK_NAME_TOKEN} is replaced by the number, continuing past mooks already named this way in the folder.</p></div>
    <div class="form-group"><label>Folder</label>
      <input type="text" name="folder" value="${escapeHtml(defaultMookFolderPath(first.name))}">
      <p class="hint">A folder path, e.g. Mooks/Warehouse raid; missing folders are created.</p></div>
    <div class="form-group"><label>Place tokens on the current scene</label>
      <input type="checkbox" name="placeTokens"></div>`;

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Generate Mooks", icon: "fa-solid fa-users" },
    content,
    buttons: [
      {
        action: "generate", label: "Generate", icon: "fa-solid fa-users", default: true,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      },
      { action: "cancel", label: "Cancel" }
    ],
    // Name and Folder each follow the Template until the GM edits them.
    render: (event, dialog) => {
      const form = dialog.element?.querySelector("form") ?? dialog.element;
      const select = form?.querySelector('[name="templateId"]');
      const name = form?.querySelector('[name="name"]');
      const folder = form?.querySelector('[name="folder"]');
      if (!select || !name || !folder) return;
      for (const input of [name, folder]) {
        input.addEventListener("input", () => { input.dataset.edited = "1"; }, { once: true });
      }
      select.addEventListener("change", () => {
        const actor = game.actors.get(select.value);
        if (!actor) return;
        if (!name.dataset.edited) name.value = normalizeMookPattern(actor.name);
        if (!folder.dataset.edited) folder.value = defaultMookFolderPath(actor.name);
      });
    }
  });
  if (!result || typeof result !== "object") return;

  const template = game.actors.get(result.templateId);
  if (!template) { ui.notifications.error("That template no longer exists."); return; }
  const path = splitFolderPath(result.folder);
  if (!path.length) { ui.notifications.error("Give a folder for the mooks."); return; }
  const maxDepth = CONST.FOLDER_MAX_DEPTH ?? 4;
  if (path.length > maxDepth) { ui.notifications.error(`Folders nest at most ${maxDepth} deep.`); return; }

  try {
    await generateMooks({
      template, templateFolder,
      count: clampMookCount(result.count),
      pattern: String(result.name ?? "").trim() || template.name,
      folderPath: path,
      placeTokens: !!result.placeTokens
    });
  } catch (err) {
    console.error("mekton-fusion | Mook generation failed", err);
    ui.notifications.error(`Mook generation failed: ${err.message ?? err}`);
  }
}

/** No template folder yet: offer to create it (top level), then point the GM at it. */
async function offerTemplateFolder(folderName) {
  const create = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Generate Mooks", icon: "fa-solid fa-users" },
    content: `<p>No Actor folder named "${escapeHtml(folderName)}" (the name is a system setting). Create it now?</p>`
  });
  if (!create) return;
  await Folder.create({ name: folderName, type: "Actor", folder: null });
  ui.notifications.info(`Created the "${folderName}" folder. Build template NPCs in it, then Generate Mooks again.`);
}

/** The Actor folder at `names` (top level first), created where missing. */
async function ensureActorFolderPath(names) {
  let parentId = null;
  let folder = null;
  for (const name of names) {
    folder = game.folders.find(f => f.type === "Actor" && f.name === name && (f._source.folder ?? null) === parentId)
      ?? await Folder.create({ name, type: "Actor", folder: parentId });
    parentId = folder.id;
  }
  return folder;
}

/**
 * Create `count` fresh copies of `template` in the folder at `folderPath`:
 * separate world actors with linked prototype tokens, numbered past any
 * existing mooks with the same name pattern in that folder. Whispers the GM.
 * @returns {Promise<Actor[]>}
 */
export async function generateMooks({ template, templateFolder = null, count, pattern, folderPath, placeTokens = false }) {
  const target = await ensureActorFolderPath(folderPath);
  // Not in the template folder or under it, or the mooks would become templates.
  if (templateFolder && [target, ...(target.ancestors ?? [])].some(f => f.id === templateFolder.id)) {
    throw new Error("The mooks can't go into the template folder.");
  }
  const existing = game.actors.filter(a => a._source.folder === target.id).map(a => a.name);
  const names = nextMookNames(pattern, existing, clampMookCount(count));

  const fresh = resetMookData(template.toObject());
  delete fresh._id;
  delete fresh._stats;
  delete fresh.sort;
  const data = names.map(name => {
    const d = foundry.utils.deepClone(fresh);
    d.name = name;
    d.folder = target.id;
    d.prototypeToken = { ...(d.prototypeToken ?? {}), name, actorLink: true };   // disposition and art from the template
    return d;   // ownership is the template's (toObject keeps it)
  });
  const actors = await Actor.createDocuments(data, { [MOOK_CREATE_OPTION]: true });

  let placed = 0;
  let sceneName = "";
  if (placeTokens) ({ placed, sceneName } = await placeMookTokens(actors));

  const pathLabel = folderPath.join("/");
  const tokens = placeTokens ? (placed ? ` ${placed} token${placed === 1 ? "" : "s"} placed on ${escapeHtml(sceneName)}.` : " No tokens placed (no scene is being viewed).") : "";
  await ChatMessage.create({
    speaker: { alias: "Mook Generator" },
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
    content: `Generated ${actors.length} &times; ${escapeHtml(template.name)} into ${escapeHtml(pathLabel)}.${tokens}`
  });
  ui.notifications.info(`Generated ${actors.length} × ${template.name} into ${pathLabel}.`);
  return actors;
}

/**
 * One token per actor on the viewed scene, in a compact grid around the
 * centre of the current view, skipping cells an existing token overlaps or
 * that fall outside the scene (placementOffsets falls back to a plain grid
 * when there's no room).
 */
async function placeMookTokens(actors) {
  const scene = canvas?.scene;
  if (!scene || !canvas.ready || !actors.length) return { placed: 0, sceneName: "" };
  const grid = canvas.grid;
  const proto = actors[0].prototypeToken;
  const w = Math.max(1, Number(proto.width) || 1);
  const h = Math.max(1, Number(proto.height) || 1);
  const pxW = w * grid.sizeX;
  const pxH = h * grid.sizeY;
  const centre = { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y };

  let topLeft;
  if (grid.isGridless) {
    topLeft = (di, dj) => ({ x: Math.round(centre.x - pxW / 2 + dj * pxW), y: Math.round(centre.y - pxH / 2 + di * pxH) });
  } else {
    const c = grid.getOffset(centre);
    topLeft = (di, dj) => grid.getTopLeftPoint({ i: c.i + di * h, j: c.j + dj * w });
  }

  const taken = canvas.tokens.placeables.map(t => ({
    x: t.document.x, y: t.document.y, w: t.document.width * grid.sizeX, h: t.document.height * grid.sizeY
  }));
  const rect = canvas.dimensions.sceneRect;
  const overlaps = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  const isFree = (di, dj) => {
    const p = topLeft(di, dj);
    const cell = { x: p.x, y: p.y, w: pxW, h: pxH };
    const inside = cell.x >= rect.x && cell.y >= rect.y && cell.x + cell.w <= rect.x + rect.width && cell.y + cell.h <= rect.y + rect.height;
    return inside && !taken.some(t => overlaps(cell, t));
  };

  const offsets = placementOffsets(actors.length, isFree);
  const tokenData = [];
  for (const [k, actor] of actors.entries()) {
    const { x, y } = topLeft(offsets[k].di, offsets[k].dj);
    const doc = await actor.getTokenDocument({ x, y });
    tokenData.push(doc.toObject());
  }
  const created = await scene.createEmbeddedDocuments("Token", tokenData);
  return { placed: created.length, sceneName: scene.name };
}
