/* empirical_driver.js — P(move | species) OVER REAL LADDER CLICKS, AS A DIFFERENTIAL DRIVER.
 *
 * ROADMAP: the empirical-click arm of the whole-game differential (docs/_reports/2026-08-29-real-
 * game-replay-scope.md §6 Option B, and the companion turn-cap report §5).
 *
 * ================= WHAT THIS IS FOR ===============================================================
 *
 * `engine/game_differential.js` drives both engines with `census-coverage-seeking/v1`: at every
 * decision it clicks whatever reaches the least-exercised census row. That driver is not trying to
 * win, so THE GAMES DO NOT END — 944 of 961 (98.2%) are cut off by the 12-turn cap and 17 reach a
 * natural result. The instrument has therefore never compared a game's ENDING, and severity band 1
 * (DIFFERENT-WINNER) has never once been reachable.
 *
 * THE CONTROL THAT PROVES IT IS THE DRIVER AND NOT THE CAP: `data/_bench-order-12-60.json`, 1,000
 * playouts at THE SAME CAP OF 12, medicham2 driving itself, reaches a result 64.1% of the time.
 * 36x at an identical cap.
 *
 * This module supplies the second arm's action selection and NOTHING ELSE. Same swarm teams, same
 * Mode A pinned dice on both sides, same comparators, same census credit rule. Only the choice of
 * action changes, which is what keeps every divergence a RULE rather than noise.
 *
 * ================= WHY THIS IS NOT `rollout_leaf.pickByPrior` CALLED DIRECTLY =====================
 *
 * IT SHOULD HAVE BEEN, AND THE REASON IT IS NOT IS THE PHOTOGRAPH RULE, NOT TASTE.
 *
 * `engine/rollout_leaf.js:706` already implements this draw and `engine/rollout_leaf.js:606`
 * already loads the table. Requiring that file from `game_differential.js` is not available:
 *
 *   (1) `rollout_leaf.js` requires `engine/medicham2-browser.js` and `engine/board.js` FROM THE LIVE
 *       TREE at module load (lines 24-25). `game_differential.js` loads medicham2 out of a FROZEN
 *       RELEASE. Requiring rollout_leaf would pull a SECOND, LIVE copy of the simulator into a
 *       process whose whole purpose is to read only the snapshot — CLAUDE.md's photograph rule
 *       broken by the act of importing the reuse.
 *   (2) `movePriorFor` reads `data/move-priors.json` off the live tree through a module-level memo.
 *       The differential must read it out of the release, because `data/move-priors.json` IS one of
 *       `engine_release.js`'s frozen SOURCES — the table is part of the engine being measured.
 *   (3) Lifting the sampler out of `rollout_leaf.js` into a shared module would add a require edge
 *       to a frozen SOURCE, which `requireClosure()` then demands be added to SOURCES, which strands
 *       every release cut before today the moment anything opens `rollout_leaf.js` out of one
 *       (CLAUDE.md / LESSONS §12: that reached 168 of 200 releases once already). MEASURE does not
 *       get to impose that on the release ladder to save fifteen lines.
 *
 * SO THE SAMPLING RULE IS DUPLICATED, AND THE DUPLICATION IS PINNED BY A TEST RATHER THAN BY A
 * PROMISE. `tests/test-empirical-driver.js` draws the same rows through BOTH implementations across
 * a sweep of u and asserts they return the same move every time. Two producers of one fact is this
 * repo's most-repeated failure; a test that fails the day they diverge is the only version of it
 * that is safe.
 *
 * THE RULE ITSELF, KEPT BYTE-FOR-BYTE FROM `rollout_leaf.pickByPrior`:
 *   weight(move) = the species' recorded p for that move, or 0.02 if the species is profiled but
 *   this move was never observed on it ("carried but never observed: rare, not impossible").
 *   Draw uniformly on the total and walk.
 *
 * ================= WHAT THE TABLE DOES NOT CARRY, SAID BEFORE ANYONE READS A NUMBER ===============
 *
 *   - NO TARGET MODEL. `data/move-priors.json` is P(move | species) and nothing else. The caller
 *     keeps its existing target rule unchanged. `engine/board.js:377` measures humans double-
 *     targeting 23.4% of the time against ~50% for independent choice, so a target model is a real
 *     missing capability and is filed, not faked here.
 *   - NO SWITCH MODEL. The priors say nothing about WHEN to leave. The switch rate is taken from
 *     `data/rollout-switch-census.json`, which is derived from the RAW replay logs of both human
 *     stores by `engine/rollout_switch_census.js` and is upstream of MEDICHAM (not quarantined).
 *     WHICH body to send is unmodelled and is drawn uniformly over the legal bench — declared,
 *     counted, and not to be read as a behaviour claim.
 *   - ONLY THE TOP 8 MOVES AND TOP 4 LEADS PER SPECIES are in the table (`engine/policy.js`), and a
 *     species needs 15 recorded acts to be profiled at all. So `p` sums to slightly under 1 and the
 *     tail is exactly the 0.02 floor above.
 *
 * ================= NO SILENT FALLBACK ============================================================
 *
 * Every degradation below is a COUNTER the run prints, including its zero. `rollout_leaf.js`'s
 * census fallback is the cautionary case: it degrades loudly to stderr and nobody was reading the
 * line. A counter in the artifact cannot be skimmed past the same way.
 */
'use strict';

/* The species key. `engine/policy.js:48` writes the table with `s.toLowerCase().replace(/[^a-z0-9]/g,'')`
 * over the ingest's species field, which is exactly Showdown's `species.id` form — MEASURED, not
 * assumed: 336 of the format's 347 legal species ids hit a row directly. The 11 that do not are
 * in-battle cosmetic formes (castformsunny, castformrainy) and pattern formes (vivillon*, alcremie*),
 * which is why `baseId` below exists as a SECOND, SEPARATELY COUNTED lookup rather than as a silent
 * widening of the first. */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE TABLE ---------------------------------------------------------------------------------
 * `bytes` is the raw JSON text. The caller reads it (from a release, from a pin, from the live tree)
 * and says where it came from; this file never decides that, because "which copy of the engine's
 * behaviour table did this run use" is a provenance question and provenance belongs to the caller
 * that holds the release handle. */
function loadPriors(bytes, where) {
  let j;
  try { j = JSON.parse(bytes); }
  catch (e) {
    throw new Error('empirical_driver: ' + (where || 'move-priors') + ' did not parse — ' + e.message
      + '\n  This table IS the driver. Continuing without it would play an unsteered sample and '
      + 'report it as an empirical one.');
  }
  const sp = j && j.species;
  if (!sp || typeof sp !== 'object' || !Object.keys(sp).length) {
    throw new Error('empirical_driver: ' + (where || 'move-priors') + ' carries no `species` rows. '
      + 'That is not a behaviour table, and a run driven by it would be driven by nothing.');
  }
  const byKey = new Map();
  let moveRows = 0, leadRows = 0, acts = 0;
  for (const [k, v] of Object.entries(sp)) {
    const moves = new Map(), lead = new Map();
    for (const m of (v.moves || [])) if (m && m.mv && m.p > 0) { moves.set(String(m.mv), m.p); moveRows++; }
    for (const m of (v.lead || [])) if (m && m.mv && m.p > 0) { lead.set(String(m.mv), m.p); leadRows++; }
    if (!moves.size) continue;                 // a row with no usable move distribution is not a row
    acts += (v.acts || 0);
    byKey.set(norm(k), { moves, lead, acts: v.acts || 0 });
  }
  if (!byKey.size) {
    throw new Error('empirical_driver: ' + (where || 'move-priors') + ' parsed but every species row '
      + 'was empty after filtering p > 0.');
  }
  return { byKey, species: byKey.size, move_rows: moveRows, lead_rows: leadRows,
           acts, generated: (j && j.generated) || null, from: where || null };
}

/* THE VOLUNTARY-SWITCH RATE, READ AND NEVER TYPED.
 *
 * `pct_decisions_with_a_bench_that_are_a_voluntary_switch` is the CONDITIONAL rate and it is the one
 * that matches this denominator: the draw below only happens when a live body is on the bench.
 * `rollout_leaf.js:651` records what using the marginal rate instead cost — a playout switching at
 * 3.9% while claiming 7.7%, every line of the draw correct.
 *
 * ABSENT IS A REFUSAL, NOT A ZERO. A zero switch rate is a driver that cannot leave, and a driver
 * that cannot leave will not end a game like a real one — which is the entire question this arm was
 * built to answer. `rollout_leaf.js` degrades to 0 here and announces it on stderr; this refuses,
 * because a whole measurement would be spent before anyone read the line. */
function switchRateFrom(bytes, where) {
  let j;
  try { j = JSON.parse(bytes); }
  catch (e) {
    throw new Error('empirical_driver: ' + (where || 'rollout-switch-census') + ' did not parse — '
      + e.message);
  }
  const p = j && j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  if (typeof p !== 'number' || !(p > 0)) {
    throw new Error('empirical_driver: ' + (where || 'rollout-switch-census') + ' carries no usable '
      + '`pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch`. Refusing to run: the '
      + 'fallback is a driver that CANNOT SWITCH, and a game that cannot switch does not end like a '
      + 'real one. Rebuild it: node engine/rollout_switch_census.js');
  }
  return { rate: p / 100, pct: p, games: (j.pooled && j.pooled.games) || null,
           decisions_with_a_live_bench: (j.pooled && j.pooled.decisions_with_a_live_bench) || null,
           generated: j.generated || null, from: where || null };
}

/* ---- THE DRAW ----------------------------------------------------------------------------------
 * `ids`  the LEGAL move ids for this body, already filtered by the caller from Showdown's own
 *        request. Legality is never re-decided here.
 * `row`  a byKey entry, or null when the species is not profiled.
 * `lead` true on turn 1, where the table carries its own turn-1 distribution.
 * `u`    a uniform variate in [0,1). Supplied by the caller so the draw is addressable and
 *        reproducible rather than stateful — see game_differential.js's driver address.
 *
 * Returns { id, weights, informed } where `informed` is false when EVERY legal move fell to the
 * 0.02 floor, i.e. the table had nothing to say about this body's actual moveset. That is a distinct
 * state from "no row at all" and it is counted separately, because a uniform draw wearing an
 * empirical label is the failure this arm exists to avoid. */
const UNOBSERVED = 0.02;      // rollout_leaf.js:718 — "carried but never observed: rare, not impossible"

function drawMove(row, ids, lead, u) {
  if (!row || !ids || !ids.length) return null;
  const table = (lead && row.lead && row.lead.size) ? row.lead : row.moves;
  const weights = [];
  let tot = 0, informed = false;
  for (const mv of ids) {
    let w = table.has(mv) ? table.get(mv) : (row.moves.has(mv) ? row.moves.get(mv) : UNOBSERVED);
    if (table.has(mv) || row.moves.has(mv)) informed = true;
    weights.push([mv, w]); tot += w;
  }
  if (!(tot > 0)) return null;
  let x = u * tot;
  for (const [mv, w] of weights) { x -= w; if (x <= 0) return { id: mv, weights, informed }; }
  return { id: weights[weights.length - 1][0], weights, informed };
}

/* ---- THE COUNTERS ------------------------------------------------------------------------------
 * "A capability that cannot prove it ran is assumed broken." Every one of these is printed by the
 * run INCLUDING ITS ZERO, and every one names a state the driver can be in. There is no bucket for
 * "something else happened". */
function counters() {
  return {
    decisions: 0,                 // every empirical decision this driver reached
    move_from_prior: 0,           // a move drawn from the species' recorded distribution
    lead_table_used: 0,           // ... of those, drawn from the turn-1 table
    uninformed_draw: 0,           // a row existed but NONE of the legal moves were in it (all 0.02)
    no_prior_row: 0,              // the species is not profiled at all — the loud state
    row_via_base_forme: 0,        // matched only after falling back to the base species id
    switch_reached_the_draw: 0,   // decisions where a live bench existed
    switch_offered: 0,            // ... the draw said leave
    no_bench: 0,                  // decisions with nowhere to go
    trapped: 0,                   // showdown refused to offer a switch at all
    prefer_narrowed: 0,           // a pair-* configuration restricted the pool before the draw
    ban_narrowed: 0,              // an omit-* configuration removed at least one legal click
    no_move_candidates: 0,        // only switches were available (the caller's own fallbacks apply)
    first_no_prior_row: '',       // the first unprofiled species, named — a bare count sends the
                                  // reader back to guess which row it was
  };
}

/* Resolve a body to a row, counting HOW it resolved. `id` is Showdown's `species.id`; `baseId` is
 * the base forme's id, or null when the caller cannot supply one. */
function rowFor(P, C, id, baseId) {
  const k = norm(id);
  let row = P.byKey.get(k) || null;
  if (row) return row;
  const b = baseId ? norm(baseId) : null;
  if (b && b !== k) {
    row = P.byKey.get(b) || null;
    if (row) { C.row_via_base_forme++; return row; }
  }
  C.no_prior_row++;
  if (!C.first_no_prior_row) C.first_no_prior_row = String(id || '?');
  return null;
}

module.exports = { loadPriors, switchRateFrom, drawMove, counters, rowFor, norm, UNOBSERVED };
