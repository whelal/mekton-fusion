#!/usr/bin/env node
// Mekton Fusion: compendium pack builder
// ---------------------------------------
// Regenerates the system-bundled LevelDB compendium packs from plain data
// modules (module/data/*-catalog.js), so the catalog itself stays reviewable
// as data instead of hand-authored LevelDB. Foundry v13 packs are LevelDB
// directories (packs/<name>/), not the old NeDB .db files.
//
// Requires Node + the official pack-compiling CLI:
//   npm i -D @foundryvtt/foundryvtt-cli
//   node scripts/build-packs.mjs
//
// Not runnable in this dev environment (no Node on PATH here, per
// CLAUDE.md) -- written for the maintainer to run locally/in CI.
//
// For day-to-day catalog edits, macros/build-weapons-pack.macro.js is the
// faster path: it writes straight into the already-registered system pack
// from inside a running world (no CLI/build step, no restart needed). Use
// this script when you want the LevelDB pack rebuilt as part of a release
// (e.g. CI) independent of any particular world's state.

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEAPON_CATALOG } from "../module/data/weapon-catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Deterministic 16-char alphanumeric Foundry document id from a name. */
function makeId(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  const base = Math.abs(h).toString(36) + String(name).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return (base + "0000000000000000").slice(0, 16);
}

async function buildPack(label, entries, packName) {
  const srcDir = path.join(ROOT, ".pack-src", packName);
  const packDir = path.join(ROOT, "packs", packName);

  await fs.rm(srcDir, { recursive: true, force: true });
  await fs.mkdir(srcDir, { recursive: true });

  for (const entry of entries) {
    const _id = makeId(entry.name);
    const doc = { _id, ...entry, ownership: { default: 0 } };
    await fs.writeFile(path.join(srcDir, `${_id}.json`), JSON.stringify(doc, null, 2));
  }

  await fs.rm(packDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(packDir), { recursive: true });
  await compilePack(srcDir, packDir, { yaml: false });
  await fs.rm(srcDir, { recursive: true, force: true });

  console.log(`mekton-fusion | Built ${entries.length} entries -> packs/${packName} (${label})`);
}

await buildPack("Personal Weapons (MZ)", WEAPON_CATALOG, "weapons-personal");
