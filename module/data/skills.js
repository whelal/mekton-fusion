/**
 * Seeded skills (ROADMAP Interpretations): the MZ core Master Skill List, the
 * profession skills the system uses mechanically (Oratory, EW, Forgery,
 * Fencing, Martial Art, Demolitions, Whip, Archery), and the MZ+ psionic
 * skills (PSI_POWERS below). Profession flavor skills and online-supplement
 * skills are custom skills.
 */
/**
 * Psionic groups (MZ+ ATM Psionic Skills, pp.121-123). Every psionic skill
 * rolls 1D10 + PSI + rank; resistStat is the stat the TARGET resists with.
 */
export const PSI_GROUPS = Object.freeze({
  body:  { label: "Body",  resistStat: "BODY" },
  force: { label: "Force", resistStat: "LUCK" },
  mind:  { label: "Mind",  resistStat: "INT" },
  will:  { label: "Will",  resistStat: "COOL" }
});

/**
 * Psionic skills (MZ+ ATM pp.121-123): group, Psi Points per level, and
 * lensMagnifiable (the book's * marker: an ESPer Lens can magnify it). Data
 * only for now; no mechanics read cost or the Lens flag yet.
 */
export const PSI_POWERS = Object.freeze([
  { name: "Healing",             group: "body",  costPerLevel: 3, lensMagnifiable: false },
  { name: "Levitation",          group: "body",  costPerLevel: 1, lensMagnifiable: true },
  { name: "Regeneration",        group: "body",  costPerLevel: 2, lensMagnifiable: false },
  { name: "Stat Boost",          group: "body",  costPerLevel: 3, lensMagnifiable: false },
  { name: "Teleportation",       group: "body",  costPerLevel: 5, lensMagnifiable: true },
  { name: "Energy Manipulation", group: "force", costPerLevel: 4, lensMagnifiable: true },
  { name: "Psychometry",         group: "force", costPerLevel: 1, lensMagnifiable: false },
  { name: "Pyrokinesis",         group: "force", costPerLevel: 3, lensMagnifiable: true },
  { name: "Retrocognition",      group: "force", costPerLevel: 3, lensMagnifiable: false },
  { name: "Telekinesis",         group: "force", costPerLevel: 3, lensMagnifiable: true },
  { name: "Astral Projection",   group: "mind",  costPerLevel: 2, lensMagnifiable: true },
  { name: "Illusion",            group: "mind",  costPerLevel: 1, lensMagnifiable: false },
  { name: "Precognition",        group: "mind",  costPerLevel: 2, lensMagnifiable: false },
  { name: "Psi Blast",           group: "mind",  costPerLevel: 3, lensMagnifiable: false },
  { name: "Psi Block",           group: "mind",  costPerLevel: 2, lensMagnifiable: true },
  { name: "Suggestion",          group: "mind",  costPerLevel: 3, lensMagnifiable: false },
  { name: "Telepathy",           group: "mind",  costPerLevel: 1, lensMagnifiable: true },
  { name: "Aura Viewing",        group: "will",  costPerLevel: 1, lensMagnifiable: true },
  { name: "Clairvoyance",        group: "will",  costPerLevel: 3, lensMagnifiable: true },
  { name: "Danger Sensing",      group: "will",  costPerLevel: 0, lensMagnifiable: false },
  { name: "Emotion Scan",        group: "will",  costPerLevel: 1, lensMagnifiable: true },
  { name: "Mind Lock",           group: "will",  costPerLevel: 2, lensMagnifiable: false },
  { name: "Possession",          group: "will",  costPerLevel: 4, lensMagnifiable: false },
  // Not in the MZ+ ATM list; source unverified (possibly an online supplement). Cost unknown.
  { name: "Empathy",             group: "will",  costPerLevel: null, lensMagnifiable: false }
]);

/** The PSI fields a seeded psionic skill carries (group, resistStat, costPerLevel, lensMagnifiable). */
export function psiPowerFields(power) {
  return {
    group: power.group,
    resistStat: PSI_GROUPS[power.group].resistStat,
    costPerLevel: power.costPerLevel,
    lensMagnifiable: power.lensMagnifiable
  };
}

function psiSeedEntry(power) {
  return { name: power.name, type: "skill", system: { stat: "PSI", category: "PSI", rank: 0, favorite: false, ip: 0, ...psiPowerFields(power) } };
}

export const CP2020_SKILLS = [
  // ATTR (Personal Presence)
  { name: "Personal Grooming", type: "skill", system: { stat: "ATTR", category: "ATTR", rank: 0, favorite: false, ip: 0 } },
  { name: "Wardrobe & Style", type: "skill", system: { stat: "ATTR", category: "ATTR", rank: 0, favorite: false, ip: 0 } },

  // COOL (Social / Mental Resilience)
  { name: "Oratory", type: "skill", system: { stat: "COOL", category: "COOL", rank: 0, favorite: false, ip: 0 } },
  { name: "Interrogation (H)", type: "skill", system: { stat: "COOL", category: "COOL", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Intimidate (H)", type: "skill", system: { stat: "COOL", category: "COOL", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Persuasion and Fast Talk (H)", type: "skill", system: { stat: "COOL", category: "COOL", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Resist Torture/Drugs (H)", type: "skill", system: { stat: "COOL", category: "COOL", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Streetwise", type: "skill", system: { stat: "COOL", category: "COOL", rank: 0, favorite: false, ip: 0 } },

  // EMP (Emotional / Interaction / Bio Mod)
  { name: "Acting", type: "skill", system: { stat: "EMP", category: "EMP", rank: 0, favorite: false, ip: 0 } },
  { name: "Human Perception", type: "skill", system: { stat: "EMP", category: "EMP", rank: 0, favorite: false, ip: 0 } },
  { name: "Interview", type: "skill", system: { stat: "EMP", category: "EMP", rank: 0, favorite: false, ip: 0 } },
  { name: "Leadership", type: "skill", system: { stat: "EMP", category: "EMP", rank: 0, favorite: false, ip: 0 } },
  { name: "Seduction", type: "skill", system: { stat: "EMP", category: "EMP", rank: 0, favorite: false, ip: 0 } },
  { name: "Social", type: "skill", system: { stat: "EMP", category: "EMP", rank: 0, favorite: false, ip: 0 } },

  // INT (Knowledge / Awareness)
  { name: "Awareness/Notice", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Compose or Write", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Disguise", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Gamble (H)", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Know Language", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Programming (H)", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Shadowing/Avoid Pursuit (H)", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Survival", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Teaching (H)", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Expert: Security Systems", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert: Archeology", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert: Literature", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert: Chemistry", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert: Military Intelligence", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert: Navigation", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "Expert: Tactics", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },
  { name: "EW/Electronic Warfare", type: "skill", system: { stat: "INT", category: "INT", rank: 0, favorite: false, ip: 0 } },

  // REF - Personal Combat
  { name: "Archery", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Automatic Weapon", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Blade", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Dodge & Escape", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Fencing (H)", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Handgun", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Hand to Hand", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Martial Art (H)", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Rifle", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },
  { name: "Whip", type: "skill", system: { stat: "REF", category: "REF:Combat", rank: 0, favorite: false, ip: 0 } },

  // REF - Mecha Combat (all Hard)
  { name: "Mecha Fighting (H)", type: "skill", system: { stat: "REF", category: "REF:Mecha", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Mecha Gunnery (H)", type: "skill", system: { stat: "REF", category: "REF:Mecha", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Mecha Melee (H)", type: "skill", system: { stat: "REF", category: "REF:Mecha", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Mecha Missiles (H)", type: "skill", system: { stat: "REF", category: "REF:Mecha", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Mecha Piloting (H)", type: "skill", system: { stat: "REF", category: "REF:Mecha", rank: 0, favorite: false, ip: 0, hard: true } },

  // REF - Non-Combat / Utility
  { name: "Aircraft/Shuttle Pilot", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },
  { name: "Athletics", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },
  { name: "Dance", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },
  { name: "Driving", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },
  { name: "Stealth", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },
  { name: "Swimming", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },
  { name: "Zero Gee", type: "skill", system: { stat: "REF", category: "REF:Utility", rank: 0, favorite: false, ip: 0 } },

  // TECH
  { name: "Basic Repair", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },
  { name: "Demolitions (H)", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "First Aid", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },
  { name: "Jury Rig", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },
  { name: "Mecha Design (H)", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Mecha Tech (H)", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Medical (H)", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Play Musical Instrument", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },
  { name: "Paint or Draw", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },
  { name: "Photography & Film", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },
  { name: "Pick Lock (H)", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Pickpocket (H)", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0, hard: true } },
  { name: "Forgery", type: "skill", system: { stat: "TECH", category: "TECH", rank: 0, favorite: false, ip: 0 } },

  // PSI: built from PSI_POWERS below
  ...PSI_POWERS.map(psiSeedEntry)
];

/**
 * Skills dropped from the seed list by the skill cleanup. psi: which category
 * the name is matched in (Regeneration is removed only as the old EMP copy;
 * the PSI Regeneration stays). The plain "Resist Magic"/"Spellcasting" are
 * the pre-0.0.10 names of the first two.
 */
export const REMOVED_SKILLS = Object.freeze([
  { name: "Resist Magic (2)", psi: false },
  { name: "Spellcasting (2)", psi: false },
  { name: "Resist Magic", psi: false },
  { name: "Spellcasting", psi: false },
  { name: "Regeneration", psi: false },
  { name: "Education/General", psi: false },
  { name: "Endurance", psi: false },
  { name: "Courage", psi: false },
  { name: "Hacking (H)", psi: false },
  { name: "Cybertech", psi: false },
  { name: "Electronics", psi: false },
  { name: "Mechanics", psi: false },
  // PSI duplicates
  { name: "Illusion Generation", psi: true },   // = Illusion
  { name: "Postcognition", psi: true }          // = Retrocognition
]);

/**
 * Renamed skills (rank and IP kept). Applied only when the actor has no skill
 * with the new name yet; otherwise the old one is treated as removed.
 * Recognition was a typo for Precognition.
 */
export const RENAMED_SKILLS = Object.freeze([
  { from: "Tactics", to: "Expert: Tactics", psi: false },
  { from: "Stat Boost (phys)", to: "Stat Boost", psi: true },
  { from: "Danger Sense", to: "Danger Sensing", psi: true },
  { from: "Recognition", to: "Precognition", psi: true }
]);

/**
 * PSI tab rows grouped Body, Force, Mind, Will, then any power with no group
 * (custom powers) under "Other". Keeps each list's order; empty groups are left out.
 * @param {Array<{system?:{group?:string}}>} skills - already sorted
 * @returns {Array<{key:string, label:string, resistStat:string, skills:Array}>}
 */
export function groupPsiSkills(skills) {
  const groups = [
    ...Object.entries(PSI_GROUPS).map(([key, g]) => ({ key, label: g.label, resistStat: g.resistStat, skills: [] })),
    { key: "other", label: "Other", resistStat: "", skills: [] }
  ];
  const byKey = new Map(groups.map(g => [g.key, g]));
  for (const sk of skills) (byKey.get(sk.system?.group) ?? byKey.get("other")).skills.push(sk);
  return groups.filter(g => g.skills.length);
}

/** Old names the default-skill sync collapses into "Mecha Gunnery (H)" (module/seed.js). */
export const LEGACY_MECHA_GUNNERY_NAMES = Object.freeze(["Mecha Gunnery", "Mecha Gunnery [H]"]);

/**
 * Legacy skill renames introduced in 0.0.10, applied by the default-skill sync.
 * (Resist Magic and Spellcasting were renamed too; the skill cleanup removed
 * them, see REMOVED_SKILLS.)
 */
export const LEGACY_SKILL_RENAMES = Object.freeze({
  "Military Intelligence": "Expert: Military Intelligence"
});

/**
 * Every name the system has ever seeded under: the current seed list, removed
 * skills, and old pre-rename names (cleanup renames, legacy renames, old
 * Mecha Gunnery spellings, the purged non-PSI "Stat Boost"). A skill with any
 * other name was made by the GM or a player.
 */
export const KNOWN_SKILL_NAMES = Object.freeze(new Set([
  ...CP2020_SKILLS.map(s => s.name),
  ...REMOVED_SKILLS.map(s => s.name),
  ...RENAMED_SKILLS.map(r => r.from),
  ...Object.keys(LEGACY_SKILL_RENAMES),
  ...LEGACY_MECHA_GUNNERY_NAMES,
  "Stat Boost"
]));
