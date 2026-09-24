/* solver/mag/features.js — the v1 feature function: v0's features PLUS identity (species) extras.
 *
 * One definition, two consumers, as in v0: build_features.js writes the tensors the trainer reads,
 * and infer.js calls this same function live. The v0 part is solver/prior/features.js UNCHANGED
 * (so v0 keeps reproducing), and the only additions are integer SPECIES identities, read off the
 * dataset row (the open sheets and the public board) — no game fact is typed here.
 *
 * decide(row, t, side, freq) -> v0's decision, with every slot carrying
 *   slot.sx : string[SLOT_X]  species ids  [me, ally, foeA, foeB, my sheet x6, their sheet x6,
 *                             their revealed-and-alive x6 (sheet order, '' if not)]
 *   cand.tx : string          the species id the candidate points at: the target mon for a
 *                             foeA/foeB/ally/self move, the incoming mon for a switch, '' otherwise
 * Empty string = no species (padding). Mapping ids -> embedding rows lives in the model JSON.
 */
'use strict';
const F = require('../prior/features.js');

const SLOT_X_NAMES = ['me', 'ally', 'foeA', 'foeB',
  ...[0, 1, 2, 3, 4, 5].map(i => 'mine' + i), ...[0, 1, 2, 3, 4, 5].map(i => 'theirs' + i), ...[0, 1, 2, 3, 4, 5].map(i => 'theirSeen' + i)];
const SLOT_X = SLOT_X_NAMES.length;
const other = s => (s === 'p1' ? 'p2' : 'p1');

/* the same "active and alive" rule as solver/prior/features.js activeMon */
function activeIdx(sideState, k) {
  const idx = sideState.active[k];
  if (idx == null) return null;
  const m = sideState.mons[idx];
  return m && m.seen && !m.fnt ? m.i : null;
}

function extras(row, t, side, d) {
  const st = row.turns[t].state;
  const S = st.sides[side], O = st.sides[other(side)];
  const mySheet = row.game.sheets[side], theirSheet = row.game.sheets[other(side)];
  const spMine = i => (i == null || !mySheet[i] ? '' : mySheet[i].species_id);
  const spTheirs = i => (i == null || !theirSheet[i] ? '' : theirSheet[i].species_id);
  const foes = [activeIdx(O, 0), activeIdx(O, 1)];
  const six = (sheet, pred) => [0, 1, 2, 3, 4, 5].map(i => (sheet[i] && pred(i) ? sheet[i].species_id : ''));
  for (const s of d.slots) {
    if (!s) continue;
    const k = s.pos === 'a' ? 0 : 1;
    const me = activeIdx(S, k), ally = activeIdx(S, 1 - k);
    s.sx = [spMine(me), spMine(ally), spTheirs(foes[0]), spTheirs(foes[1]),
      ...six(mySheet, () => true), ...six(theirSheet, () => true),
      ...six(theirSheet, i => { const m = O.mons[i]; return !!(m && m.seen && !m.fnt); })];
    for (const c of s.cands) {
      const a = c.attr;
      if (a.sw) c.tx = spMine(a.to);
      else if (c.key === 'LOCKED') c.tx = '';
      else if (a.tc === F.TC.foeA) c.tx = spTheirs(foes[0]);
      else if (a.tc === F.TC.foeB) c.tx = spTheirs(foes[1]);
      else if (a.tc === F.TC.ally) c.tx = spMine(ally);
      else if (a.tc === F.TC.self) c.tx = spMine(me);
      else c.tx = '';
    }
  }
  return d;
}

function decide(row, t, side, freq) { return extras(row, t, side, F.decide(row, t, side, freq)); }

module.exports = { decide, extras, SLOT_X, SLOT_X_NAMES, V0: F, FEATURE_VERSION: 'v1.0' };
