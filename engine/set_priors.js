/* set_priors.js — fill the ~2.6 of 4 move slots a replay never revealed, plus item and ability.
 *
 * WHY THIS EXISTS
 * ---------------
 * A Champions replay reveals a mean of 1.38 of four moves per set; 69.7% of sets show no item and
 * 75.5% no ability (measured over 72,367 sets, 2026-07-25). Any simulator handed those sets must
 * invent the rest, and ADR-001 records that WHAT FILLS THE GAP DOMINATES THE RESULT — an early
 * engine comparison filled alphabetically from the learnset, gave Charizard "Acrobatics, Aerial Ace,
 * Air Cutter, Air Slash", and produced a 32-point difference that was almost entirely filler.
 *
 * That failure recurred on 2026-07-25. `packTeam` in champions_sim.js read its fallback from
 * `globalThis.MC`, which only exists when the browser bundle is loaded. Under Node it is undefined,
 * so the fallback was empty and unrevealed slots fell through to a literal ['Tackle']. The first MEW
 * run produced self-play games whose most common move was Tackle, by 4x, over Protect. The data was
 * worthless and nothing failed.
 *
 * WHAT THIS USES INSTEAD
 * ----------------------
 * MOVES: data/move-priors.json — the behaviour-clone, P(move | species) measured from real ladder
 * play (e.g. garchomp over 4,476 observed actions: rockslide .228, earthquake .218, dragonclaw .178).
 * This is a measured distribution, not a guess, and it is the same object the rollout policy uses.
 *
 * ITEM and ABILITY: measured from the CLEAN store, taking the most frequently revealed value per
 * species. Reading the raw store would let a bot that ran one set hundreds of times define the
 * "typical" item for its species.
 *
 * SAMPLED, NOT TOP-K. Slots are drawn from the distribution rather than taking the four most common
 * moves. Two reasons. It is the honest representation of the uncertainty — we do not know the set,
 * and a modal set asserts one we never observed. And it supplies variety across games, which Leela
 * Chess Zero pursues deliberately (policy temperature ~2.25) because a generator that always plays
 * the same line explores a narrow band of states. Draws are seeded, so a run reproduces exactly.
 *
 * WHAT THIS STILL CANNOT DO. It cannot recover the real set. Self-play games are between PLAUSIBLE
 * RECONSTRUCTIONS of observed teams. Any result that turns on exact sets must say so.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let _moves = null;      // species -> [{mv, p}]
let _gear = null;       // species -> {item, ability}

function movePriors() {
  if (_moves) return _moves;
  _moves = {};
  try {
    const j = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));
    for (const [sp, v] of Object.entries(j.species || {})) {
      const rows = (v.moves || []).filter(m => m && m.mv && m.p > 0);
      if (rows.length) _moves[norm(sp)] = rows.map(m => ({ mv: m.mv, p: m.p }));
    }
  } catch (e) { /* leave empty; callers must handle a miss rather than invent */ }
  return _moves;
}

/* Item and ability, measured from the CLEAN store. Cached in memory; the pass is ~1s on 1k games. */
function gearPriors() {
  if (_gear) return _gear;
  _gear = {};
  const item = {}, abil = {};
  try {
    const Q = require('./quality.js');
    for (const g of Q.loadGames()) {
      for (const [sp0, s] of Object.entries(g.sets || {})) {
        const sp = norm(sp0);
        if (s && s.item) { (item[sp] = item[sp] || {})[s.item] = (item[sp][s.item] || 0) + 1; }
        if (s && s.ability) { (abil[sp] = abil[sp] || {})[s.ability] = (abil[sp][s.ability] || 0) + 1; }
      }
    }
  } catch (e) { return _gear; }
  const top = o => o ? Object.entries(o).sort((a, b) => b[1] - a[1])[0][0] : null;
  for (const sp of new Set([...Object.keys(item), ...Object.keys(abil)])) {
    _gear[sp] = { item: top(item[sp]), ability: top(abil[sp]) };
  }
  return _gear;
}

/* Deterministic PRNG so a seeded MEW run reproduces exactly. */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* Draw up to `k` distinct moves from the species prior, proportional to p, excluding `have`. */
function sampleMoves(species, have, k, seed) {
  const pool = (movePriors()[norm(species)] || []).filter(m => !have.some(h => norm(h) === norm(m.mv)));
  const out = [];
  const r = rng(seed);
  const avail = pool.slice();
  while (out.length < k && avail.length) {
    let tot = 0; for (const m of avail) tot += m.p;
    if (tot <= 0) break;
    let x = r() * tot, i = 0;
    for (; i < avail.length; i++) { x -= avail[i].p; if (x <= 0) break; }
    if (i >= avail.length) i = avail.length - 1;
    out.push(avail[i].mv);
    avail.splice(i, 1);
  }
  return out;
}

/* The public call. Returns what is KNOWN plus what was FILLED, so callers can report the split. */
function fillSet(species, known, seed) {
  known = known || {};
  const have = (known.moves || []).slice(0, 4);
  const filled = [];
  let moves = have.slice();
  if (moves.length < 4) {
    const drawn = sampleMoves(species, moves, 4 - moves.length, (seed || 1) + norm(species).length * 7919);
    if (drawn.length) filled.push(`${species}: ${drawn.length} move(s)`);
    moves = moves.concat(drawn);
  }
  const gear = gearPriors()[norm(species)] || {};
  const item = known.item || gear.item || '';
  const ability = known.ability || gear.ability || '';
  if (!known.item && gear.item) filled.push(`${species}: item`);
  if (!known.ability && gear.ability) filled.push(`${species}: ability`);
  return { moves, item, ability, filled, knownMoves: have.length };
}

function coverage() {
  const m = movePriors(), g = gearPriors();
  return { species_with_move_priors: Object.keys(m).length, species_with_gear_priors: Object.keys(g).length };
}

module.exports = { fillSet, movePriors, gearPriors, coverage, sampleMoves };

if (require.main === module) {
  console.log(JSON.stringify(coverage(), null, 2));
  for (const sp of ['garchomp', 'incineroar', 'sinistcha']) {
    console.log(sp, JSON.stringify(fillSet(sp, {}, 42)));
  }
}
