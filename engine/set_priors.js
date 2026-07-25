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
 *
 * KNOWN LIMITATION, MEASURED — low-marginal moves are over-represented on generated sets.
 * Incineroar's priors list eight candidate moves and every set needs four, so even a move with a
 * 0.9% marginal (Close Combat) lands on ~45% of generated sets once the common moves are taken. The
 * top of the ranking is right — Fake Out 82%, Flare Blitz 72%, Parting Shot 67%, matching the
 * marginal order — but the tail is inflated by the four-slot constraint, not by the sampler.
 *
 * Two things cause it and neither is fixed here. P(move | action), which is what move-priors.json
 * measures, is not P(move on set) — a move clicked rarely may still be on many sets, or vice versa.
 * And the candidate pool is only the moves actually OBSERVED, so it is far smaller than the real
 * learnset and offers nothing else to draw. The principled fix is to fit P(set) over a
 * learnset-sized pool with a floor for unobserved moves. Until then, treat generated sets as
 * "typical for the species, with a tech slot more often than reality".
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

/* Pairwise co-occurrence, measured from revealed sets in the CLEAN store.
 * co[sp][a][b] = times a and b were revealed on the same set. solo[sp][a] = times a was revealed. */
let _co = null;
function coocc() {
  if (_co) return _co;
  _co = {};
  try {
    const Q = require('./quality.js');
    for (const g of Q.loadGames()) {
      for (const [sp0, s] of Object.entries(g.sets || {})) {
        const sp = norm(sp0);
        const mv = [...new Set((s.moves || []).map(norm))].filter(Boolean);
        if (mv.length < 1) continue;
        const e = _co[sp] = _co[sp] || { solo: {}, pair: {} };
        for (const a of mv) {
          e.solo[a] = (e.solo[a] || 0) + 1;
          for (const b of mv) if (a !== b) {
            (e.pair[a] = e.pair[a] || {})[b] = (e.pair[a][b] || 0) + 1;
          }
        }
      }
    }
  } catch (err) { /* no store: fall back to independent marginals */ }
  return _co;
}

/* Draw up to `k` distinct moves, CONDITIONAL on what is already on the set.
 *
 * WHY NOT INDEPENDENT MARGINALS. P(move) and P(set) are different objects. Incineroar's marginals
 * are fakeout .302, flareblitz .245, partingshot .184, throatchop .114, darkestlariat .079. Drawing
 * four independently produced "darkestlariat, partingshot, fakeout, throatchop" — it MISSED Flare
 * Blitz, the second most common move on the species, and took BOTH Dark-type physical attacks. Real
 * sets carry one. Independent sampling from correct marginals builds sets no human would build.
 *
 * So each subsequent draw is reweighted by the measured LIFT of a candidate against every move
 * already chosen: lift(m|s) = P(m and s together) / (P(m) * P(s)) approximated from counts. Moves
 * that genuinely travel together (Fake Out with Flare Blitz) get boosted; near-substitutes that
 * rarely co-occur (Darkest Lariat with Throat Chop) get suppressed. Lift is clamped so a single
 * thin cell cannot dominate, and falls back to 1 (independence) when there is no evidence.
 */
function sampleMoves(species, have, k, seed) {
  const sp = norm(species);
  const pool = (movePriors()[sp] || []).filter(m => !have.some(h => norm(h) === norm(m.mv)));
  if (!pool.length) return [];
  const e = coocc()[sp] || { solo: {}, pair: {} };
  const nSets = Math.max(1, Object.values(e.solo).reduce((a, b) => Math.max(a, b), 0));

  /* Lift, SHRUNK BY EVIDENCE. Raw lift is badly biased at small counts: a rare move has a tiny
   * expected co-occurrence, so (both+0.5)/(expected+0.5) is large almost by construction, while a
   * common move sits near 1. Unshrunk, that INVERTS the ranking — Close Combat (marginal 0.9%)
   * landed on 45% of sampled Incineroar sets, and Darkest Lariat (7.9%) matched Flare Blitz (24.5%).
   *
   * So the lift is pulled toward 1 (independence) by how much evidence supports it, n/(n+K) with
   * K=10 — the same shrinkage rule xatu_context.py uses for its context cells (K=12). A pair seen
   * once barely moves the draw; a pair seen fifty times moves it a lot. */
  const K = 10;
  const lift = (a, b) => {
    const sa = e.solo[a], sb = e.solo[b];
    if (!sa || !sb) return 1;                       // no evidence -> independence
    const both = (e.pair[a] || {})[b] || 0;
    const expected = (sa * sb) / nSets;
    if (expected <= 0) return 1;
    const raw = (both + 0.5) / (expected + 0.5);
    const clamped = Math.min(3, Math.max(0.2, raw));
    const n = Math.min(sa, sb);                     // evidence is bounded by the rarer of the two
    const w = n / (n + K);
    return 1 + (clamped - 1) * w;
  };

  const chosen = have.map(norm);
  const out = [];
  const r = rng(seed);
  const avail = pool.slice();
  while (out.length < k && avail.length) {
    /* GEOMETRIC mean of the lifts, not the product. The product compounds: with three moves already
     * chosen a clamped 3x lift becomes 27x, which was enough to put Darkest Lariat (marginal 7.9%)
     * on 80% of sampled Incineroar sets — above Flare Blitz at 24.5%. The geometric mean keeps the
     * adjustment on the scale of a single lift however much context there is, so co-occurrence
     * reshapes the draw without overwhelming the marginal it is adjusting. */
    const w = avail.map(m => {
      if (!chosen.length) return m.p;
      let logsum = 0;
      for (const c of chosen) logsum += Math.log(lift(norm(m.mv), c));
      return m.p * Math.exp(logsum / chosen.length);
    });
    let tot = 0; for (const x of w) tot += x;
    if (tot <= 0) break;
    let t = r() * tot, i = 0;
    for (; i < w.length; i++) { t -= w[i]; if (t <= 0) break; }
    if (i >= w.length) i = w.length - 1;
    out.push(avail[i].mv);
    chosen.push(norm(avail[i].mv));
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
