/* solver/gary/situation.js — GARY's two keys and its joint-action classes, read off the PUBLIC state only.
 *
 * GARY v1 (the population habit model, solver/PLAN.md §3 N1) is DODUO v1's joint distribution TILTED per
 * (situation bucket x rating band) toward what the population at that band actually clicks. This file defines the
 * three things the tilt is keyed and expressed in. Nothing here is a game fact: a move's category, priority, target
 * type and effectiveness come from the candidate the DODUO v1 featuriser already built (solver/prior/features.js,
 * which reads the Reg M-C dex); this file only sorts them.
 *
 *   bucket(row, t, side, d)  -> one of BUCKETS   (d = the DODUO decision for that side, solver/mag/features.js decide)
 *   band(game, side)         -> one of BANDS     (the deciding player's rating at game start, and the stream)
 *   classBits(d, a, b)       -> a 16-bit mask of the joint (a, b)'s classes, CLASS_NAMES order
 *
 * WHY BUCKETS AND NOT A LEARNED CONTEXT. The bucket is the unit of HYPNO's trust decision: a bucket either passes its
 * held-out gate and is exploited, or fails and plays equilibrium (p = 0). That decision has to be made per a small,
 * named, auditable set of situations with enough held-out decisions each to put a CI on, so the context of the TILT is
 * bucketed even though the base it tilts (DODUO v1) is a learned model of the full public state. The buckets are the
 * coarse situations in which the 2026-09-23 research and this week's ladder post-mortems found human play changes
 * shape: the lead turn, a one-slot board, material ahead / even / behind, and whether speed control (Trick Room or a
 * Tailwind on either side) is up. They are fixed here BEFORE any fit (solver/gary/preregistration.json).
 *
 * BANDS. The bo3 ladder's rating at game start: < 1100, 1100-1199, 1200-1299, 1300+ (1300-1399, 1400-1499 and 1500+
 * hold 2,093 / 272 / 12 player-games of 53,776 in the 2026-09-23 dataset, so they are pooled), `unrated` (challenge
 * games and a missing rating), and `bo1` for every bo1-format game in the open-sheet turn-play stream: its rating is a
 * different ladder's, so it can never be read as a bo3 band. A bo1 decision fits the global tilt and its own band.
 */
'use strict';
const F0 = require('../prior/features.js');

const BUCKETS = ['lead', 'single', 'even', 'even_sc', 'ahead', 'ahead_sc', 'behind', 'behind_sc'];
const BANDS = ['lt1100', '1100', '1200', '1300plus', 'unrated', 'bo1'];
const BO3_PREFIX = 'gen9championsvgc2026regmcbo3-';

const CI = Object.fromEntries(F0.CAND_NAMES.map((n, i) => [n, i]));
const TC = F0.TC;

const BREAK = (typeof process !== 'undefined' && process.env && process.env.GARY_BREAK) || '';

function isBo3(game) { return String(game.id || '').startsWith(BO3_PREFIX) || /\(bo3\)/i.test(String(game.format || '')); }

function bandOfRating(r, rated) {
  if (rated === false || r == null || !Number.isFinite(+r)) return 'unrated';
  r = +r;
  return r < 1100 ? 'lt1100' : r < 1200 ? '1100' : r < 1300 ? '1200' : '1300plus';
}
/* the band of the player deciding for `side` */
function band(game, side) {
  if (!isBo3(game) && game.id) return 'bo1';
  const p = game.players && game.players[side];
  return bandOfRating(p ? p.rating : null, game.rated);
}

/* the bucket of `side`'s decision at turn index t; d = the DODUO decision for that side */
function bucket(row, t, side, d) {
  const turn = row.turns[t];
  if (turn.n === 1 || t === 0) return 'lead';
  const occ = d.slots.filter(Boolean).length;
  if (occ < 2) return 'single';
  const st = turn.state, other = side === 'p1' ? 'p2' : 'p1';
  const ts = row.game.teamsize || { p1: 4, p2: 4 };
  const left = s => (ts[s] || 4) - st.sides[s].mons.filter(m => m.seen && m.fnt).length;
  const diff = left(side) - left(other);
  const sc = st.pseudo && st.pseudo['Trick Room'] != null || !!(st.sides.p1.conditions && st.sides.p1.conditions.Tailwind) ||
             !!(st.sides.p2.conditions && st.sides.p2.conditions.Tailwind);
  const mat = BREAK === 'material' ? 'even' : diff > 0 ? 'ahead' : diff < 0 ? 'behind' : 'even';
  return mat + (sc ? '_sc' : '');
}

const CLASS_NAMES = ['stall_any', 'stall_double', 'switch_any', 'switch_double', 'mega', 'focus_same_foe', 'spread_any',
  'status_any', 'ally_target', 'stall_repeat_any', 'priority_any', 'repeat_move_any', 'immune_any', 'se_any'];
const NB = CLASS_NAMES.length;

/* one candidate's own classes (a slot), as a bit mask over the per-slot subset */
function slotBits(c) {
  if (!c) return 0;
  const f = c.f, a = c.attr;
  let m = 0;
  if (a.stall) m |= 1 << 0;
  if (a.sw) m |= 1 << 2;
  if (a.mega) m |= 1 << 4;
  if (a.spread) m |= 1 << 6;
  if (!a.sw && !a.stall && f[CI.status] === 1) m |= 1 << 7;
  if (a.tc === TC.ally) m |= 1 << 8;
  if (f[CI.stall_repeat] === 1) m |= 1 << 9;
  if (!a.sw && f[CI.pri] > 0) m |= 1 << 10;
  if (!a.sw && !a.stall && f[CI.repeat] === 1) m |= 1 << 11;
  if (f[CI.immune] === 1) m |= 1 << 12;
  if (!a.sw && f[CI.status] !== 1 && f[CI.eff] > 0) m |= 1 << 13;
  return m;
}
/* the joint (a, b): candidate indices into d.slots[0].cands / d.slots[1].cands (an absent slot's index is ignored) */
function classBits(d, a, b) {
  const A = d.slots[0] ? d.slots[0].cands[a] : null, B = d.slots[1] ? d.slots[1].cands[b] : null;
  const ma = slotBits(A), mb = slotBits(B);
  let m = ma | mb;
  if (A && B) {
    if (A.attr.stall && B.attr.stall) m |= 1 << 1;
    if (A.attr.sw && B.attr.sw) m |= 1 << 3;
    const foe = t => t === TC.foeA || t === TC.foeB;
    if (!A.attr.sw && !B.attr.sw && foe(A.attr.tc) && A.attr.tc === B.attr.tc && BREAK !== 'focus') m |= 1 << 5;
  }
  return m;
}

module.exports = { BUCKETS, BANDS, CLASS_NAMES, NB, band, bandOfRating, bucket, classBits, slotBits, isBo3, BREAK };
