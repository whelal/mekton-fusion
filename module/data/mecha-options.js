/**
 * mekton-fusion: Mecha Options / Subassemblies (Scope A extension)
 * ---------------------------------------------------------------
 * Cost (CP) and Space for the optional "extras" a mecha can mount. Only the
 * mechanical values + the few parameters that affect play are encoded; the
 * book's descriptive text is not reproduced. Short labels are original.
 *
 * cost is in CP. Some options have a cost RANGE (min/max) depending on a
 * chosen sub-feature -- those carry costMin/costMax plus a note key.
 */

const OPTIONS = {
  antitheftCodelock: {
    label: "Anti-theft Code Lock",
    costMin: 0.2, costMax: 0.4, space: 0,
    variant: "alarm adds an audible alert on wrong code (+0.2 CP)",
  },
  damageControl: {
    label: "Damage Control Package",
    cost: 1, space: 1,
    note: "emergency suite: fire retardant, glue bombs, flares, liferaft",
  },
  ejectionSeat: {
    label: "Ejection Seat",
    cost: 1, space: 0,
    // paired with Environment Pod as the two ejection variants
    ejectVariant: "seat",
  },
  environmentPod: {
    label: "Environment Pod",
    cost: 2, space: 1,
    ejectVariant: "pod",
    note: "armored cockpit ejection; preferred in harsh environments",
  },
  spotlights: {
    label: "Spotlights",
    cost: 0.2, space: 0,
    per: "light",
    note: "illuminates 1 hex per light",
  },
  liftwire: {
    label: "Liftwire",
    cost: 0.3, space: 0,
    note: "winch cable to enter cockpit from the ground",
  },
  micromanipulators: {
    label: "Micromanipulators",
    cost: 1, space: 1,
    note: "tool-tipped arms for fine work; mountable in any servo",
  },
  stereoSystem: {
    label: "Stereo System",
    cost: 0.1, space: 0,
    note: "audio / PA",
  },
  storageModule: {
    label: "Storage Module",
    cost: 1, space: 1,
    capacityKg: 500,
    note: "holds up to 500kg equipment",
  },
  weaponLinkage: {
    label: "Weapon Linkage",
    cost: 1, space: 0,
    note: "fire 2+ same-type weapons in one servo at one target on one Action; each shot rolls its own hit location",
    // linkage rules the sheet may enforce:
    linkRules: {
      sameType: true,        // linked weapons must be the same type
      sameServo: true,       // must be mounted in the same servo
      sameTarget: true,      // must target the same opponent
      oneAttackRoll: true,   // resolves on a single Attack roll
      perShotLocation: true, // each shot rolls a separate random location
    },
  },
};

/** Resolve an option's effective cost (uses costMin if a range, else cost). */
function optionCost(key, useMax = false) {
  const o = OPTIONS[key];
  if (!o) return null;
  if (o.cost !== undefined) return o.cost;
  return useMax ? o.costMax : o.costMin;
}

export { OPTIONS, optionCost };
