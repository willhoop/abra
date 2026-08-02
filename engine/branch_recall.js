/* branch_recall.js — how often does MAG's shortlist still contain the move a human actually played?
 *
 *   SHOWDOWN_PATH=... node engine/branch_recall.js
 *
 * WHY THIS IS THE NUMBER THAT MATTERS FOR MAG
 * -------------------------------------------
 * MAG's job is not to pick the best pair. It is to hand a SHORTLIST to the search, so the engine can
 * play each survivor out and PORY can score the boards that result. For that job, ranking the right
 * pair sixth instead of first costs nothing at all — it still gets simulated. Dropping it off the
 * list entirely is unrecoverable: no later stage can score a branch it was never given.
 *
 * So top-1 accuracy is the wrong scoreboard for this model, and RECALL AT K is the right one.
 *
 * WHAT IT SEPARATES
 * -----------------
 * A miss can happen two ways, and they have different fixes, so they are counted apart:
 *
 *   PER-SLOT CAP     each Pokemon is cut to its own top K, then the pairs are formed. A pair dies if
 *                    EITHER half ranked poorly, even when the pair itself was obvious.
 *   PAIR CAP         every pair is scored and the best N pairs are kept. Strictly better recall for
 *                    the same number of branches, and the extra cost is scoring, not simulating.
 *
 * Scoring a pair is arithmetic on a vector. Simulating one is a battle. If the pair cap recovers
 * most of the loss, the fix is free in the only currency that matters.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');
const CM = require('./click_match.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
const D = (...p) => path.join(__dirname, '..', ...p);

if (!B.damageEngine()) { console.error('damage engine unavailable — refusing to report'); process.exit(1); }

const NF = B.FEATURES.length, NJ = B.JOINT_FEATURES.length, NW = NF + NJ;
const W1 = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
const w1 = W1.weights;
let wJ = null;
try {
  const WJ = JSON.parse(fs.readFileSync(D('data', 'policy-weights-joint.json'), 'utf8'));
  if ((WJ.features || []).join(',') === B.FEATURES.join(',') &&
      (WJ.jointFeatures || []).join(',') === B.JOINT_FEATURES.join(',')) wJ = WJ.weights;
} catch (e) { /* the pair ranker simply is not available */ }

const score1 = x => { let s = 0; for (let k = 0; k < NF; k++) s += w1[k] * x[k]; return s; };

const KS = [1, 2, 3, 4, 6, 8, 10, 12];
const NS = [1, 2, 4, 6, 9, 16, 25, 36];
const slotHit = new Array(KS.length).fill(0);
const pairHit = new Array(NS.length).fill(0);
const pairHitJ = new Array(NS.length).fill(0);
let total = 0, everything = 0, altsSum = 0;

for (const g of FP.loadCorpus().games) {
  const board = new B.Board();
  /* Side-keyed and forme-folded — see engine/click_match.js. A species-only key collapsed both
   * players' sets in a mirror, and 58.63% of corpus games have one. */
  const SI = CM.sheetIndex(g, dex);
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (m && m.species) {
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

    for (const side of ['p1', 'p2']) {
      const acted = {}; const fainted = new Set();
      for (const e of ev) {
        if (e.t === 'f' && e.s) fainted.add(e.s);
        if (!e.s || e.s.slice(0, 2) !== side) continue;
        const L = e.s.slice(2);
        if (acted[L]) continue;
        if (e.t === 'm' && e.mv) acted[L] = { kind: 'move', mv: e.mv, tgt: e.tgt || null };
        else if (e.t === 's' && !fainted.has(e.s)) acted[L] = { kind: 'switch', to: base(e.mon) };
      }
      if (!acted.a || !acted.b) continue;

      const slots = ['a', 'b'].map(L => {
        const user = board.slot(side, L);
        if (!user || user.fainted) return null;
        const sh = SI.get(side, user.species);
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
      if (!slots[0] || !slots[1] || slots[0].chosen < 0 || slots[1].chosen < 0) continue;
      total++;
      everything += slots[0].cands.length * slots[1].cands.length;

      /* --- per-slot cap ------------------------------------------------------------------------ */
      const rankIn = s => s.scores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).findIndex(p => p[1] === s.chosen);
      const ra = rankIn(slots[0]), rb = rankIn(slots[1]);
      for (let i = 0; i < KS.length; i++) if (ra < KS[i] && rb < KS[i]) slotHit[i]++;

      /* --- pair cap ---------------------------------------------------------------------------- */
      const pairs = [];
      let chosenIdx = -1;
      for (let ia = 0; ia < slots[0].cands.length; ia++) {
        for (let ib = 0; ib < slots[1].cands.length; ib++) {
          const xa = slots[0].feats[ia], xb = slots[1].feats[ib];
          let s = slots[0].scores[ia] + slots[1].scores[ib];
          let sj = s;
          if (wJ) {
            const jj = B.jointFeaturesFor(slots[0].cands[ia], slots[1].cands[ib], xa, xb);
            sj = 0;
            for (let k = 0; k < NF; k++) sj += wJ[k] * (xa[k] + xb[k]);
            for (let k = 0; k < NJ; k++) sj += wJ[NF + k] * jj[k];
          }
          if (ia === slots[0].chosen && ib === slots[1].chosen) chosenIdx = pairs.length;
          pairs.push({ s, sj });
        }
      }
      if (chosenIdx < 0) continue;
      altsSum += pairs.length;
      const rankOf = key => pairs.map((p, i) => [p[key], i]).sort((a, b) => b[0] - a[0]).findIndex(p => p[1] === chosenIdx);
      const rp = rankOf('s'), rj = wJ ? rankOf('sj') : rp;
      for (let i = 0; i < NS.length; i++) {
        if (rp < NS[i]) pairHit[i]++;
        if (rj < NS[i]) pairHitJ[i]++;
      }
    }

    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) board.switchIn(side, letter, e.mon);
      else if (e.t === 'm' && side) {
        const user = board.slot(side, letter); const mv = dex.moves.get(e.mv);
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
      else if (e.t === 'f' && side) board.faint(side, letter);
      else if (e.t === 'w' && e.field) board.setWeather(e.field);
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

const pc = (a) => (100 * a / Math.max(1, total)).toFixed(1) + '%';
console.log(`BRANCH RECALL — ${total.toLocaleString()} joint decisions\n`);
console.log(`  every pair, no shortlist at all: ${(everything / Math.max(1, total)).toFixed(1)} branches per turn on average\n`);

console.log('  CUTTING EACH POKEMON TO ITS OWN TOP K, THEN PAIRING (what fit_joint does)');
console.log('    K    branches   the human\'s pair survives');
for (let i = 0; i < KS.length; i++) {
  console.log(`   ${String(KS[i]).padStart(2)}    ${String(KS[i] * KS[i]).padStart(8)}   ${pc(slotHit[i]).padStart(7)}`);
}

console.log('\n  SCORING EVERY PAIR AND KEEPING THE BEST N');
console.log('    N    branches   summed score   with the joint terms');
for (let i = 0; i < NS.length; i++) {
  console.log(`   ${String(NS[i]).padStart(2)}    ${String(NS[i]).padStart(8)}   ${pc(pairHit[i]).padStart(10)}   ${pc(pairHitJ[i]).padStart(14)}`);
}

console.log(`
  READ IT BY COLUMN. The branches column is what the search has to SIMULATE, which is the expensive
  part; scoring a pair is arithmetic. If keeping the best N pairs beats cutting each slot to top K at
  the same branch count, the per-slot cap is throwing away recall for nothing.`);
