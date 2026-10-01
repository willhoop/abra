/* solver/results/2026-10-01-lost-last-answer/answer_map.js — THE LIVE ANSWER MAP of a MEDICHAM position (2026-10-01).
 *
 *   const AM = require('./answer_map.js').create(API);          // API = a release's medicham_api (solver/arena/engine.js)
 *   const map = AM.answerMap(S, 'A', { n: 16, seed: 1 });
 *   -> { mine: [{ team, name }], theirs: [{ team, name }],
 *        P: [[P(my i beats their j)]],                           // i over my live team, j over their live team
 *        answers: [sum_i P[i][j]],                               // expected answers left to threat j
 *        threats: [sum_j (1 - P[i][j])]                          // expected threats left to my i (their answers to it)
 *        counters: { duels, steps, probes, capped, draws, noMove } }
 *
 * WHAT "i BEATS j" MEANS HERE. A one-on-one played by MEDICHAM from the LIVE position: the battle is cloned, every body
 * but i and j is taken off the board (each side keeps one fainted body to hold its empty second slot, and its fallen
 * count is put back as it was, so Last Respects / Supreme Overlord read the real game), and i and j fight it out turn by
 * turn on the engine's own `step` with the engine's dice. So current HP, boosts, status, the field and its clocks
 * (Tailwind, Trick Room, weather, terrain, screens), priority, items still to trigger, abilities, damage rolls,
 * accuracy, crits and speed ties all come from MEDICHAM; nothing here computes a damage number or a turn order. A speed
 * tie is not drawn once: each of the n duels plays it on its own dice, so both branches are carried at their weight.
 *
 * THE DUEL POLICY (the one modelling choice, stated): each turn, each side picks from its DAMAGING moves (the dex's
 * category; a body with none uses its whole menu less the stalling moves), mega-evolving when it may. The pick is the
 * row (column) with the best mean in a one-turn probe table of my candidates x their candidates, one probe per cell on
 * fresh dice, scored for me as (their HP fraction lost) + 1 if they faint - 1 if I faint. So a priority move that
 * finishes a low foe is found by the engine's own turn order, never by a rule. NOT valued: setup, Protect stalling,
 * switching, and anything a partner would add (Helping Hand, Follow Me, Fake Out from the side). It is a damage race on
 * the live board, which is what "an answer" means in Will's hypothesis. A duel that has not ended after `cap` turns
 * scores 0.5.
 *
 * Read-only on S: everything happens on clones.
 *
 * DELIBERATE BREAK (env ANSWER_MAP_BREAK=fullhp): the duel board restores both bodies to full HP, i.e. the answer map of
 * the team sheets rather than of the live position. solver/tests/test-answer-map.js must go red under it.
 */
'use strict';
const path = require('path');
const X = require(path.join(__dirname, '..', '..', 'human', 'dex.js'));
const toID = X.toID;
const live = m => !!(m && !m.fainted && m.curHP > 0);
const BREAK = (typeof process !== 'undefined' && process.env && process.env.ANSWER_MAP_BREAK) || '';

function create(API) {
  const C = { memoHits: 0, duels: 0, steps: 0, probes: 0, capped: 0, draws: 0, noMove: 0, maps: 0 };
  const catOf = new Map();
  const isDamaging = id => {
    if (!catOf.has(id)) { const mv = X.D.moves.get(id); catOf.set(id, mv && mv.exists ? mv.category !== 'Status' : false); }
    return catOf.get(id);
  };
  const isStall = id => { const mv = X.D.moves.get(id); return !!(mv && mv.exists && mv.stallingMove); };

  /* the 1v1 board: i on my side's slot 0, j on theirs; bench emptied; one fainted body holds each slot 1 */
  function duelBoard(S, side, iTeam, jTeam, prune) {
    const T = API.clone(S);
    const sides = side === 'A' ? [['A', iTeam], ['B', jTeam]] : [['B', iTeam], ['A', jTeam]];
    for (const [sd, k] of sides) {
      const sf = sd === 'A' ? T.sfA : T.sfB, team = sf.team, keep = team[k];
      const fallen = sf.fainted;
      const wasActive = (sd === 'A' ? T.actA : T.actB).includes(keep);
      let hold = team.find((m, x) => x !== k && !live(m)) || team.find((m, x) => x !== k);
      hold.curHP = 0; hold.fainted = true;
      if (sd === 'A') { T.actA = [keep, hold]; T.benchA = []; } else { T.actB = [keep, hold]; T.benchB = []; }
      if (!wasActive) { keep._turnsOut = 0; keep._mvActs = 0; }
      if (BREAK === 'fullhp') keep.curHP = keep.st.hp;
      sf.fainted = fallen;
      if (prune) sf.team = [keep, hold];          // the rest leave the copy (smaller clones); nothing can switch in
    }
    return T;
  }

  function candidates(T, sd) {
    const L = API.legalActions(T, sd);
    const slot = L.slots[0];
    if (!slot) return [];
    let opts = slot.options.filter(o => o.kind === 'move' && !o.empty && (o.target == null || o.target === 1));
    if (opts.some(o => o.forced)) return [opts.find(o => o.forced)];
    if (opts.some(o => o.mega)) opts = opts.filter(o => o.mega);
    let dmg = opts.filter(o => isDamaging(o.move));
    if (!dmg.length) dmg = opts.filter(o => !isStall(o.move));
    if (!dmg.length) dmg = opts;
    /* one option per move id (a spread move has one; a single-target move aimed at the live foe) */
    const seen = new Set(), out = [];
    for (const o of dmg) if (!seen.has(o.move)) { seen.add(o.move); out.push(o); }
    return out;
  }
  /* THE PICK IS SHARED BETWEEN DUELS THAT REACH THE SAME COARSE STATE (turn, HP in 32nds, status, boosts, forme): all
   * n duels open on the same board, so the first turn's probe table is built once, not n times. */
  const stateKey = (T, t) => [T.actA[0], T.actB[0]].map(m => m.name + ':' + Math.round(hpf(m) * 32) + ':' + (m.status || '') + ':' + JSON.stringify(m.boosts || {})).join('|') + '|' + t;
  const hpf = m => (m && m.st && m.st.hp ? Math.max(0, m.curHP) / m.st.hp : 0);

  /* one duel turn's picks by the probe table; score is side A's */
  function pick(T, rngProbe) {
    const ca = candidates(T, 'A'), cb = candidates(T, 'B');
    if (!ca.length || !cb.length) { C.noMove++; return null; }
    if (ca.length === 1 && cb.length === 1) return [ca[0], cb[0]];
    const a0 = T.actA[0], b0 = T.actB[0], ha = hpf(a0), hb = hpf(b0);
    const M = ca.map(() => cb.map(() => 0));
    for (let x = 0; x < ca.length; x++) for (let y = 0; y < cb.length; y++) {
      let U;
      try { U = API.step(T, [ca[x], { kind: 'pass' }], [cb[y], { kind: 'pass' }], rngProbe()); } catch (e) { M[x][y] = 0; continue; }
      C.probes++;
      const A = U.actA[0], B = U.actB[0];
      const fa = !live(A) && !live(U.actA[1]) && !(U.benchA || []).some(live), fb = !live(B) && !live(U.actB[1]) && !(U.benchB || []).some(live);
      M[x][y] = (hb - hpf(B)) - (ha - hpf(A)) + (fb ? 1 : 0) - (fa ? 1 : 0);
    }
    let bx = 0, by = 0, bv = -Infinity, wv = Infinity;
    for (let x = 0; x < ca.length; x++) { const v = M[x].reduce((s, z) => s + z, 0) / cb.length; if (v > bv) { bv = v; bx = x; } }
    for (let y = 0; y < cb.length; y++) { let v = 0; for (let x = 0; x < ca.length; x++) v += M[x][y]; v /= ca.length; if (v < wv) { wv = v; by = y; } }
    return [ca[bx], cb[by]];
  }

  /* P(my body at team index iTeam beats their body at jTeam), from S, over n duels */
  function duel(S, side, iTeam, jTeam, o) {
    const n = (o && o.n) || 16, cap = (o && o.cap) || 10;
    let seed = ((o && o.seed) || 1) * 7919 + iTeam * 131 + jTeam * 17;
    const rng = () => API.makeRng(seed++);
    const T0 = duelBoard(S, side, iTeam, jTeam, !!(o && o.prune));   // prune measured: identical P, no faster
    const memo = (o && o.memo === false) ? null : new Map();
    T0.maxTurns = Infinity;
    API.makeLean(T0);
    let win = 0;
    for (let k = 0; k < n; k++) {
      let T = API.clone(T0);
      let r = null;
      for (let t = 0; t < cap; t++) {
        let pk;
        const key = memo && stateKey(T, t);
        if (memo && memo.has(key)) { pk = memo.get(key); C.memoHits++; } else { pk = pick(T, rng); if (memo) memo.set(key, pk); }
        if (!pk) break;
        try { API.stepInPlace(T, [pk[0], { kind: 'pass' }], [pk[1], { kind: 'pass' }], rng()); } catch (e) { break; }
        C.steps++;
        if (API.isTerminal(T)) { r = API.winner(T); break; }
      }
      C.duels++;
      if (r == null) { C.capped++; r = 0.5; }
      else if (r === 0.5) C.draws++;
      win += side === 'A' ? r : 1 - r;
    }
    return win / n;
  }

  function answerMap(S, side, o) {
    C.maps++;
    const sfMe = side === 'A' ? S.sfA : S.sfB, sfOp = side === 'A' ? S.sfB : S.sfA;
    const mine = [], theirs = [];
    sfMe.team.forEach((m, k) => { if (live(m)) mine.push({ team: k, name: m.name, hp: +hpf(m).toFixed(3), sheet: m._solverSheet }); });
    sfOp.team.forEach((m, k) => { if (live(m)) theirs.push({ team: k, name: m.name, hp: +hpf(m).toFixed(3), sheet: m._solverSheet }); });
    const P = mine.map(a => theirs.map(b => +duel(S, side, a.team, b.team, o).toFixed(4)));
    const answers = theirs.map((_, j) => +mine.reduce((s, _, i) => s + P[i][j], 0).toFixed(4));
    const threats = mine.map((_, i) => +theirs.reduce((s, _, j) => s + (1 - P[i][j]), 0).toFixed(4));
    return { mine, theirs, P, answers, threats };
  }

  return { C, answerMap, duel, duelBoard, candidates };
}

module.exports = { create };
