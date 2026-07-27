/* fit_joint.js — fit the choice of a PAIR of moves, not two moves separately.
 *
 *   SHOWDOWN_PATH=... node engine/fit_joint.js      ->  data/policy-weights-joint.json
 *
 * WHY A SEPARATE FIT
 * ------------------
 * engine/fit_policy.js asks "which move did this Pokemon click", one Pokemon at a time. That is the
 * wrong question for doubles, and the evidence is measured rather than aesthetic: humans aim both
 * their attacks at the same foe 23.4% of the time, choosing independently produces about 50%, and
 * MAG sits at the 50% end. The play everyone recognises -- one Pokemon Protects to survive a kill
 * while its partner removes the thing that would have killed it -- is not something MAG scores
 * badly. It is something MAG cannot represent, because no number in a single move's vector can mean
 * "my partner is handling it".
 *
 * WHY THE SCORE IS NOT A SUM
 * --------------------------
 * Both of your Pokemon can kill the Charizard. Independently, each scores "I get a kill" -- the best
 * thing on its list. Added together that reads as two kills. What actually happens is one kill, one
 * wasted move, and a free shot from the Kingambit you ignored. So the pair carries its own small set
 * of features (board.js JOINT_FEATURES) alongside the sum, and the fit prices them.
 *
 * WHY THE CANDIDATE LIST IS CAPPED
 * --------------------------------
 * Every pair is ~10 x 10, and over 40,000 joint decisions that is millions of vectors. The cap is
 * TOP-K BY THE SINGLE-MOVE SCORE, which is not a shortcut bolted on: narrowing the branch list is
 * what MAG is FOR. The pair the human actually chose is always kept regardless of its rank, or the
 * fit would only ever see decisions the old model already agreed with -- which would manufacture
 * agreement rather than measure it. How often the chosen pair falls outside the top K is reported,
 * because that number is the honest cost of the cap.
 *
 * The weights land in their OWN file. engine/magnemite.js refuses to load a vector whose feature
 * list does not match, and overwriting the single-move weights with a longer vector would break the
 * player rather than upgrade it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
const D = (...p) => path.join(__dirname, '..', ...p);

const TOPK = +(process.env.TOPK || 6);
const NF = B.FEATURES.length, NJ = B.JOINT_FEATURES.length, NW = NF + NJ;

if (!B.damageEngine()) { console.error('damage engine unavailable — refusing to fit'); process.exit(1); }

/* The single-move weights are the ranker for the cap. Using the fitted vector rather than an
 * arbitrary heuristic keeps the narrowing consistent with what MAG already believes. */
const W1 = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
if ((W1.features || []).join(',') !== B.FEATURES.join(',')) {
  console.error('data/policy-weights.json was fitted against a different feature list — run fit_policy first');
  process.exit(1);
}
const w1 = W1.weights;
const score1 = x => { let s = 0; for (let k = 0; k < NF; k++) s += w1[k] * x[k]; return s; };

const { games } = FP.loadCorpus();
console.log(`JOINT FIT — ${games.length.toLocaleString()} clean open-sheet games, top-${TOPK} per slot\n`);

const rows = [];
const tally = { turns: 0, kept: 0, oneSlot: 0, unmatched: 0, chosenOutsideK: 0 };

for (const g of games) {
  const board = new B.Board();
  const sheet = {};
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (m && m.species) {
        sheet[base(m.species)] = { side, moves: (m.moves || []).map(norm) };
        board.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
      }
    }
    board.setParty(side, ((g.brought || {})[side] || []));
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) board.switchIn(side, 'a', lead[0]);
    if (lead[1]) board.switchIn(side, 'b', lead[1]);
  }

  for (const t of g.turns || []) {
    const ev = t.ev || [];
    for (const e of ev) if (e.t === 'mega' && e.s) { const mn = board.slot(e.s.slice(0, 2), e.s.slice(2)); if (mn) mn.species = norm(e.mon); }

    /* What each side actually did with BOTH slots this turn, before anything resolves. */
    for (const side of ['p1', 'p2']) {
      /* A SWITCH IS ONE OF THE TWO THINGS A SLOT CAN DO, and looking only for move events threw away
       * every turn where one Pokemon switched -- which is a large share of them, and precisely the
       * turns where the two decisions are most likely to be related. A slot whose occupant fainted
       * earlier in the turn is being REPLACED, not choosing, and is excluded. */
      const acted = {};
      const fainted = new Set();
      for (const e of ev) {
        if (e.t === 'f' && e.s) fainted.add(e.s);
        if (!e.s || e.s.slice(0, 2) !== side) continue;
        const L = e.s.slice(2);
        if (acted[L]) continue;
        if (e.t === 'm' && e.mv) acted[L] = { kind: 'move', mv: e.mv, tgt: e.tgt || null };
        else if (e.t === 's' && !fainted.has(e.s)) acted[L] = { kind: 'switch', to: base(e.mon) };
      }
      if (!acted.a || !acted.b) { tally.oneSlot++; continue; }
      tally.turns++;

      const slots = ['a', 'b'].map(L => {
        const user = board.slot(side, L);
        if (!user || user.fainted) return null;
        const sh = sheet[base(user.species)];
        if (!sh) return null;
        const cands = B.candidates(sh.moves, user, board, side, dex);
        if (!cands.length) return null;
        const feats = cands.map(c => B.featuresFor(c, user, board, side, dex,
          c.switchTo ? B.PRIOR_FLOOR : FP.priorFor(user.species, c.move.id)));
        const want = acted[L];
        const chosen = want.kind === 'switch'
          ? cands.findIndex(c => c.switchTo === want.to)
          : cands.findIndex(c => c.move && norm(c.move.id) === norm((dex.moves.get(want.mv) && dex.moves.get(want.mv).id) || want.mv) &&
              (want.tgt ? (c.targetMon && base(c.targetMon.species) === base(want.tgt)) : true));
        return { cands, feats, chosen, scores: feats.map(score1) };
      });
      if (!slots[0] || !slots[1] || slots[0].chosen < 0 || slots[1].chosen < 0) { tally.unmatched++; continue; }

      /* Top-K by single-move score, with the chosen candidate forced in. */
      const pick = s => {
        const order = s.scores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, TOPK).map(p => p[1]);
        if (!order.includes(s.chosen)) { order.push(s.chosen); return { order, outside: true }; }
        return { order, outside: false };
      };
      const pa = pick(slots[0]), pb = pick(slots[1]);
      if (pa.outside || pb.outside) tally.chosenOutsideK++;

      const alts = [];
      let chosenPair = -1;
      for (const ia of pa.order) for (const ib of pb.order) {
        const xa = slots[0].feats[ia], xb = slots[1].feats[ib];
        const j = B.jointFeaturesFor(slots[0].cands[ia], slots[1].cands[ib], xa, xb);
        const v = new Array(NW);
        for (let k = 0; k < NF; k++) v[k] = xa[k] + xb[k];
        for (let k = 0; k < NJ; k++) v[NF + k] = j[k];
        if (ia === slots[0].chosen && ib === slots[1].chosen) chosenPair = alts.length;
        alts.push(v);
      }
      if (chosenPair < 0 || alts.length < 2) { tally.unmatched++; continue; }
      rows.push({ game: g.id || '', alts, chosen: chosenPair });
      tally.kept++;
    }

    /* ---- resolve, exactly as fit_policy does ------------------------------------------------ */
    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) board.switchIn(side, letter, e.mon);
      else if (e.t === 'm' && side) {
        const user = board.slot(side, letter);
        const mv = dex.moves.get(e.mv);
        if (user && mv && mv.exists) {
          const already = (mv.sideCondition && board.hasSide(side, mv.sideCondition)) ||
                          (B.fieldKey(mv) && board.hasField(B.fieldKey(mv)));
          B.noteMove(board, side, user, mv, !already);
        }
        if (e.tgt && (e.tgthp != null || e.dmg)) {
          const foe = side === 'p1' ? 'p2' : 'p1';
          let hit = false;
          for (const s of [foe, side]) { for (const L of ['a', 'b']) {
            const m2 = board.slot(s, L);
            if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) {
              m2.hp = e.tgthp != null ? Math.max(0, e.tgthp / 100) : Math.max(0, m2.hp - e.dmg / 100);
              hit = true; break;
            } } if (hit) break; }
        }
      }
      else if (e.t === 'x' && side) { const m2 = board.slot(side, letter); if (m2) m2.status = norm(e.st); }
      else if (e.t === 'hp' && side) { const m2 = board.slot(side, letter); if (m2 && e.hp != null) m2.hp = Math.max(0, e.hp / 100); }
      else if (e.t === 'b' && side) { const m2 = board.slot(side, letter); if (m2 && e.b) m2.boosts = { ...e.b }; }
      else if (e.t === 'f' && side) { board.faint(side, letter); }
      else if (e.t === 'w' && e.field) { board.setWeather(e.field); }
      else if (e.t === 'fs' && e.field) {
        const mv = dex.moves.get(e.field);
        const k = mv && mv.exists ? B.fieldKey(mv) : norm(e.field);
        if (k) board.startField(k, mv && mv.condition && mv.condition.duration);
      }
    }
    /* endTurn(), NOT turn++. The counter is the visible half; endTurn also rolls
     * stalledThisTurn -> stalledLastTurn, advances turnsActive and moves moveThisTurn into
     * lastMove. Incrementing the number by hand leaves deadStall permanently 0 and every
     * Fake Out permanently legal -- silently, in a replay that otherwise looks correct.
     * engine/fit_policy.js and engine/magnemite.js always called endTurn; every analysis file
     * written on 2026-07-26 did not, and engine/feature_coverage.js is what caught it. */
    board.endTurn();
  }
}

console.log(`  joint turns seen ${tally.turns.toLocaleString()} -> ${tally.kept.toLocaleString()} usable`);
console.log(`  dropped: ${tally.oneSlot.toLocaleString()} had only one slot acting, ${tally.unmatched.toLocaleString()} could not be matched`);
console.log(`  the chosen pair fell outside the top ${TOPK} on at least one slot: ` +
            `${tally.chosenOutsideK.toLocaleString()} (${(100 * tally.chosenOutsideK / Math.max(1, tally.kept)).toFixed(1)}%)`);

/* HELD OUT BY GAME, never by decision. Two turns of the same game share teams, players and a
 * metagame, so splitting inside a game leaks the answer across the split. */
const ids = [...new Set(rows.map(r => r.game))];
let h = 0; for (const s of ids) { let a = 0; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; h = a; }
const heldGames = new Set(ids.filter(s => { let a = 0; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; return (a % 5) === 0; }));
const train = rows.filter(r => !heldGames.has(r.game));
const held = rows.filter(r => heldGames.has(r.game));
console.log(`  split ${train.length.toLocaleString()} train / ${held.length.toLocaleString()} held out (by game)\n`);
if (!train.length) { console.error('nothing to fit'); process.exit(1); }

function logLik(w, set) {
  let ll = 0;
  for (const r of set) {
    let max = -Infinity;
    const s = r.alts.map(v => { let t = 0; for (let k = 0; k < NW; k++) t += w[k] * v[k]; if (t > max) max = t; return t; });
    let sum = 0; for (const t of s) sum += Math.exp(t - max);
    ll += s[r.chosen] - max - Math.log(sum);
  }
  return ll / Math.max(1, set.length);
}

function fit(set, lambda) {
  const w = new Array(NW).fill(0);
  const g = new Array(NW).fill(0);
  const m = new Array(NW).fill(0), v = new Array(NW).fill(0);
  const STEPS = 220, LR = 0.12;
  for (let it = 1; it <= STEPS; it++) {
    g.fill(0);
    for (const r of set) {
      let max = -Infinity;
      const s = r.alts.map(vec => { let t = 0; for (let k = 0; k < NW; k++) t += w[k] * vec[k]; if (t > max) max = t; return t; });
      let sum = 0; const e = s.map(t => { const q = Math.exp(t - max); sum += q; return q; });
      for (let i = 0; i < r.alts.length; i++) {
        const p = e[i] / sum, vec = r.alts[i], ind = (i === r.chosen) ? 1 : 0;
        for (let k = 0; k < NW; k++) g[k] += (ind - p) * vec[k];
      }
    }
    for (let k = 0; k < NW; k++) {
      let gk = g[k] / set.length - lambda * w[k];
      m[k] = 0.9 * m[k] + 0.1 * gk;
      v[k] = 0.999 * v[k] + 0.001 * gk * gk;
      w[k] += LR * (m[k] / (1 - Math.pow(0.9, it))) / (Math.sqrt(v[k] / (1 - Math.pow(0.999, it))) + 1e-8);
    }
  }
  return w;
}

let best = null;
for (const lam of [0, 1e-4, 1e-3, 1e-2]) {
  const w = fit(train, lam);
  const ll = logLik(w, held.length ? held : train);
  if (!best || ll > best.ll) best = { w, ll, lam };
}

/* THE COMPARISON THAT MATTERS. Not "is the joint model good" but "is it better than deciding the two
 * separately", which is what MAG does today. Same held-out pairs, same features, joint terms zeroed. */
const wNoJoint = best.w.slice(); for (let k = NF; k < NW; k++) wNoJoint[k] = 0;
const sumOnly = new Array(NW).fill(0); for (let k = 0; k < NF; k++) sumOnly[k] = w1[k];
const acc = (w, set) => {
  let ok = 0;
  for (const r of set) {
    let bi = 0, bs = -Infinity;
    r.alts.forEach((v, i) => { let t = 0; for (let k = 0; k < NW; k++) t += w[k] * v[k]; if (t > bs) { bs = t; bi = i; } });
    if (bi === r.chosen) ok++;
  }
  return 100 * ok / Math.max(1, set.length);
};
const H = held.length ? held : train;
console.log('HELD-OUT, PREDICTING THE PAIR (higher is better)\n');
console.log(`  two moves decided separately (what MAG does now)  logL ${logLik(sumOnly, H).toFixed(4)}   top-1 ${acc(sumOnly, H).toFixed(1)}%`);
console.log(`  refitted, but joint terms forced to zero          logL ${logLik(wNoJoint, H).toFixed(4)}   top-1 ${acc(wNoJoint, H).toFixed(1)}%`);
console.log(`  with the joint terms                             logL ${logLik(best.w, H).toFixed(4)}   top-1 ${acc(best.w, H).toFixed(1)}%`);
console.log(`\n  regularisation chosen on held-out data: lambda = ${best.lam}`);

console.log('\nWHAT THE PAIR TERMS ARE WORTH\n');
const jw = B.JOINT_FEATURES.map((f, i) => [f, best.w[NF + i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
for (const [f, v] of jw) console.log(`  ${f.padEnd(20)} ${(v >= 0 ? '+' : '') + v.toFixed(3)}`);

fs.writeFileSync(D('data', 'policy-weights-joint.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  source: 'engine/fit_joint.js',
  features: B.FEATURES, jointFeatures: B.JOINT_FEATURES,
  weights: best.w, lambda: best.lam, topK: TOPK,
  corpus: { games: games.length, pairs: rows.length, heldOut: H.length },
  caveat: 'Predicts which PAIR a human clicked. Not evidence that the pair wins more games.',
}, null, 1) + '\n');
console.log('\n  -> data/policy-weights-joint.json');
