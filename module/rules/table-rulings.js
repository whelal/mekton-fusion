// Table rulings: this table's HOUSE deviations from RAW, and nothing else (see
// ROADMAP.md "Rules policy"). RAW behavior gets no entry here. Code never hardcodes
// a ruling inline -- it reads the named entry, so moving these to game.settings
// toggles later (post-1.0) is a one-file change. Cite the book + section only;
// never quote rule text.

export const TABLE_RULINGS = {
  /**
   * Missile salvo walk (MZ ATM, Missiles / Missile Hit Determination) landing on
   * row 9 (Other) when the target has no wing or tail.
   * "skip"   -- HOUSE: skip to row 10 and keep walking.
   * "reroll" -- that missile alone rerolls a fresh d10 (the 0.3.18 behavior).
   * RAW doesn't cover this case. A single attack's reroll-9 is unaffected.
   */
  salvoWalkEmptyOther: "skip"
};
