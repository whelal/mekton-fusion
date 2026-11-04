import { test } from "node:test";
import assert from "node:assert/strict";
import { isHelpless, helplessAttack } from "../module/data/helpless.js";
import { TABLE_RULINGS } from "../module/rules/table-rulings.js";

const loc = (hitsMax, wounds, bruises = 0) => ({ hitsMax, hits: hitsMax - wounds, bruises });
const body = (over = {}) => ({ head: loc(4, 0), torso: loc(8, 0), rArm: loc(4, 0), lArm: loc(4, 0), rLeg: loc(4, 0), lLeg: loc(4, 0), ...over });

test("helpless: the Unconscious or Asleep status, or an unconscious head", () => {
  assert.equal(isHelpless({ statuses: new Set(["unconscious"]), locations: body() }), true);
  assert.equal(isHelpless({ statuses: ["sleep"], locations: body() }), true);
  assert.equal(isHelpless({ statuses: new Set(["burning"]), locations: body() }), false);
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ head: loc(4, 0, 4) }) }), true);   // head full of Bruises
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ head: loc(4, 4) }) }), true);      // head at 0 Wounds
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ head: loc(4, 3) }) }), false);
  assert.equal(isHelpless(), false);
});

test("helpless: the Defeated (dead) status, or a dead head or torso", () => {
  assert.equal(isHelpless({ statuses: new Set(["dead"]), locations: body() }), true);
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ torso: loc(8, 10) }) }), true);   // torso at -2
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ head: loc(4, 6) }) }), true);     // head at -2
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ rArm: loc(4, 9) }) }), false);    // severed limb only
});

test("helpless: a torso at 0 (Stun/Shock each turn) is not helpless by itself", () => {
  assert.equal(TABLE_RULINGS.torsoZeroStunCheck, true);
  assert.equal(isHelpless({ statuses: new Set(), locations: body({ torso: loc(8, 8) }) }), false);
});

test("helpless melee: no defense roll, any natural die but 1 hits, no location penalty", () => {
  for (const attackKind of ["melee", "unarmed"]) {
    for (let natural = 2; natural <= 10; natural++) {
      assert.deepEqual(helplessAttack({ attackKind, natural }), { defense: "none", hit: true, locPenalty: false });
    }
    assert.equal(helplessAttack({ attackKind, natural: 1 }).hit, false);   // natural 1 misses (fumble check later)
    assert.equal(helplessAttack({ attackKind, natural: 5, difficulty: 25 }).defense, "none");   // Difficulty ignored
  }
});

test("helpless ranged: no defense, Difficulty 10 by default, the GM's if set; penalties apply", () => {
  assert.equal(TABLE_RULINGS.helplessRangedDifficulty, 10);
  assert.deepEqual(helplessAttack({ attackKind: "ranged", natural: 1 }), { defense: "difficulty", difficulty: 10, locPenalty: true });
  assert.equal(helplessAttack({ attackKind: "ranged", difficulty: 15 }).difficulty, 15);
});
