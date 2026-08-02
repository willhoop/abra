/* click_match.js — the ONE reader of "what did this human actually click".
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Six files replay the store and ask the same two questions -- whose moveset is this, and which
 * candidate did they press -- and every one of them answers with its own three lines:
 *
 *     engine/fit_policy.js        engine/joint_rows.js        engine/branch_recall.js
 *     engine/feature_coverage.js  engine/ko_calibration.js    engine/surprise.js
 *     tests/test-degradation-budgets.js
 *
 * docs/ARTIFACT-ACCESS-RULES.md was written on 2026-08-01 because five private doorways into one
 * species table cost 8.17% of the metagame, silently. R1: **the unit that has to be single-source is
 * the FUNCTION THAT READS the data.** R6: **the second occurrence of a bug must ship the guard
 * against the third.** This is the second occurrence, in a different table, and the guard is
 * tests/test-click-match.js.
 *
 * THREE DEFECTS THIS FIXES, ALL MEASURED BY engine/redirect_audit.js ON 2026-08-02
 * --------------------------------------------------------------------------------
 * The joint fit drops 23.18% of two-slot turns. The roadmap said redirection was "probably most of"
 * that. Measured: redirection is **1.60%** of it. What the drop actually is:
 *
 *  1. **The foe switched in on the same turn — 44.4% of failures, the single biggest cause.**
 *     Switches resolve before moves, so the protocol writes down the mon that ARRIVED while the
 *     human was choosing against the one that LEFT. A human targets a SLOT; the store records a
 *     SPECIES; the matcher compared species and failed. Resolved here by reading the turn's own
 *     switch events back to the slot and asking who was standing in it at decision time.
 *
 *  2. **A mirror collapsed the two sheets — 16.4% of failures, and the silent half is worse.**
 *     `sheet[base(species)]` has no side in the key, so in a mirror one player's set overwrote the
 *     other's. 58.63% of corpus games have at least one species on both sheets. 8.02% of all slots
 *     were scored against the OTHER SIDE'S four moves; **62.16% of those matched anyway and were
 *     fitted against the wrong choice set** -- a wrong denominator, exactly the defect the choice-
 *     lock comment in board.js describes, and nothing counted it. Species Clause makes the base
 *     species unique WITHIN a side, so side+species is a sound key.
 *
 *  3. **In-battle forme changes have no sheet entry — 19.7% of failures.** floette (3,627),
 *     aegislashblade, palafinhero, mimikyubusted, morpekohangry, meowsticm, castformrainy. The
 *     sheet says `Floette-Eternal` and the battle calls the slot `Floette`; Aegislash's sheet says
 *     `Aegislash` and it becomes `Aegislash-Blade` mid-turn. Folded through the DEX's own
 *     `baseSpecies`, never a list, and only when the fold is UNAMBIGUOUS within that side.
 *
 * WHAT IS DELIBERATELY NOT FIXED HERE
 * -----------------------------------
 * Redirection. The protocol prints only the RESOLVED target of a move and never the chosen one --
 * there is no `-activate` line for Follow Me and no record of the original aim -- so a click into a
 * redirector is not recoverable from the store, only from a re-ingest that does not exist. It is
 * 1.55% of all clicks. It is a MISLABEL, not a drop, and it is stated as an honest limit rather
 * than papered over.
 */
'use strict';
const B = require('./board.js');

const norm = B.norm, base = B.baseSpecies;

/* ---------------------------------------------------------------------------------------------
 * 1. THE SHEET, KEYED BY SIDE AS WELL AS SPECIES
 *
 * R3: the accessor takes the RAW name a sheet or a protocol line would write and does its own
 * normalising, so no caller ever holds a half-made key. R2: callers differ by PARAMETER -- `side`
 * -- never by a second lookup.
 * ------------------------------------------------------------------------------------------- */
function sheetIndex(g, dex) {
  const bySide = { p1: Object.create(null), p2: Object.create(null) };
  const byForme = { p1: Object.create(null), p2: Object.create(null) };
  const dexBase = (sp) => {
    const s = dex && dex.species && dex.species.get(sp);
    return s && s.exists ? norm(s.baseSpecies || s.name) : base(sp);
  };
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (!m || !m.species) continue;
      const rec = {
        side,
        species: m.species,
        moves: (m.moves || []).map(norm),
        ability: norm(m.ability || ''),
        item: m.item || '',
        nature: m.nature || '',
      };
      bySide[side][base(m.species)] = rec;
      /* A forme index, and only used when it resolves to exactly ONE set. Two Rotom formes on one
       * side would make the fold ambiguous, and guessing is how the last forme bug stayed hidden. */
      const bf = dexBase(m.species);
      if (!byForme[side][bf]) byForme[side][bf] = [];
      byForme[side][bf].push(rec);
    }
  }
  return {
    /* @param side 'p1' | 'p2'   @param species anything a sheet or protocol line would write */
    get(side, species) {
      const t = bySide[side];
      if (!t) return null;
      const k = base(species);
      if (t[k]) return t[k];
      const cand = byForme[side][dexBase(species)];
      return (cand && cand.length === 1) ? cand[0] : null;
    },
    /* For reporting only: species carried by BOTH sides, which is what used to collide. */
    mirrored() {
      return Object.keys(bySide.p1).filter(k => bySide.p2[k]);
    },
  };
}

/* ---------------------------------------------------------------------------------------------
 * 2. WHO WAS STANDING WHERE THE HUMAN AIMED
 *
 * A human picks a slot. The store records the species that was in it once the turn resolved. When
 * the foe switched, those are different Pokemon -- and switches always resolve first, so this is
 * not a rare race, it is 44.4% of every failed match.
 *
 * @param ev        the turn's events, in resolution order
 * @param upto      index of the acting slot's own event; only earlier events can have moved anyone
 * @param foeSide   the side being aimed at
 * @param tgt       the target species the store recorded
 * @param board     the board as it stood when the decision was made
 * @returns the base species that occupied that slot at DECISION time, or null if it cannot be told
 * ------------------------------------------------------------------------------------------- */
function targetAtDecision(ev, upto, foeSide, tgt, board) {
  if (!tgt) return null;
  const want = base(tgt);
  /* Already there when they chose: nothing to resolve. */
  for (const L of ['a', 'b']) {
    const m = board.slot(foeSide, L);
    if (m && base(m.species) === want) return want;
  }
  /* Otherwise: did it arrive this turn, before this move went off? */
  for (let i = 0; i < upto; i++) {
    const e = ev[i];
    if (e.t !== 's' || !e.s || e.s.slice(0, 2) !== foeSide) continue;
    if (base(e.mon) !== want) continue;
    const was = board.slot(foeSide, e.s.slice(2));
    return was ? base(was.species) : null;
  }
  return null;
}

/* ---------------------------------------------------------------------------------------------
 * 3. THE MATCHER ITSELF
 *
 * Written once, including the two rules that were each learned the hard way:
 *
 *   - a SPREAD candidate has `targetMon: null` because Earthquake is not aimed, so requiring a
 *     target match discarded every spread click -- 1,393 of 1,397, and with them 70% of the pair
 *     fit's data (2026-08-01);
 *   - a stored target is a SPECIES, so a mirror match is genuinely ambiguous and is COUNTED AND
 *     DROPPED rather than guessed.
 *
 * @param want  { kind:'move', mv, tgt } or { kind:'switch', to }
 * @param resolvedTgt  targetAtDecision()'s answer, or undefined to match on the stored target
 * @returns { chosen, ambiguous, sameMove } — chosen is -1 when nothing matched
 * ------------------------------------------------------------------------------------------- */
function matchClick(cands, want, dex, resolvedTgt) {
  if (want.kind === 'switch') {
    const i = cands.findIndex(c => c.switchTo === want.to);
    return { chosen: i, ambiguous: false, sameMove: i >= 0 ? 1 : 0 };
  }
  const mvId = norm((dex.moves.get(want.mv) && dex.moves.get(want.mv).id) || want.mv);
  const tgt = resolvedTgt !== undefined && resolvedTgt !== null ? resolvedTgt : (want.tgt ? base(want.tgt) : null);
  const hits = [];
  let sameMove = 0;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (!c.move || norm(c.move.id) !== mvId) continue;
    sameMove++;
    if (!c.targetMon) { hits.push(i); continue; }        // spread, or self-targeting
    if (tgt && base(c.targetMon.species) === tgt) hits.push(i);
  }
  if (hits.length === 1) return { chosen: hits[0], ambiguous: false, sameMove };
  if (hits.length > 1) return { chosen: -1, ambiguous: true, sameMove };
  return { chosen: -1, ambiguous: false, sameMove };
}

module.exports = { sheetIndex, targetAtDecision, matchClick };
