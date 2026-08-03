/* joint_rows.js — the ONE builder of pair decisions from replays.
 *
 * WHY THIS IS ITS OWN FILE
 * ------------------------
 * `engine/fit_joint.js` grew this loop inline: replay the game, find what BOTH slots did, enumerate
 * each slot's candidates, match the human's click, cap to top-K by the single-move score, and cross
 * the two lists into pair alternatives. Anything that wants to ASK a question about the pair fit --
 * a collinearity audit, a coverage report, a drop-rate budget -- needs exactly those rows.
 *
 * docs/ARTIFACT-ACCESS-RULES.md R1 is about this shape and was written after it cost 8.17% of the
 * metagame: the unit that has to be single-source is the FUNCTION THAT READS, not just the data.
 * The spread-matching defect fixed on 2026-08-01 is the same story again -- `fit_policy.js:432` had
 * the right rule and the second matcher, written later, did not apply it. A second copy of this loop
 * would be the third.
 *
 * Behaviour is fit_joint.js's, moved and not altered. The tally it returns is the one fit_joint
 * printed, so a change here shows up as a changed drop rate in tests/test-degradation-budgets.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./board.js');
const FP = require('./fit_policy.js');
const CM = require('./click_match.js');

const norm = B.norm, base = B.baseSpecies;
const D = (...p) => path.join(__dirname, '..', ...p);

/* The single-move weights are the ranker for the top-K cap. Using the fitted vector rather than an
 * arbitrary heuristic keeps the narrowing consistent with what MAG already believes.
 *
 * RANKER_WEIGHTS overrides which vector that is, and it exists so a candidate marginal vector can be
 * paired with a candidate pair vector WITHOUT overwriting the incumbent first. The alternative --
 * copy the challenger over data/policy-weights.json, fit, copy the old one back -- is how you end up
 * with a shipped artifact nobody can say the provenance of. The file used is recorded in the output.
 * Same shape as fit_policy.js's OUT_WEIGHTS. */
function rankerPath() {
  return process.env.RANKER_WEIGHTS ? path.resolve(process.env.RANKER_WEIGHTS) : D('data', 'policy-weights.json');
}
function loadRanker() {
  const p = rankerPath();
  const W1 = JSON.parse(fs.readFileSync(p, 'utf8'));
  if ((W1.features || []).join(',') !== B.FEATURES.join(',')) {
    throw new Error(`${path.relative(D('.'), p)} was fitted against a different feature list — run fit_policy first`);
  }
  return W1.weights;
}

/* @param games  the corpus from fit_policy.loadCorpus().games
 * @param dex    Dex.forFormat(CS.FORMAT)
 * @param opts   { topK, w1, onRow }
 *
 * `onRow(row)` is for consumers that only need PART of each row. A kept row is ~49 alternatives of
 * 74 numbers; holding every one of them costs gigabytes, and the collinearity audit needs 19 of the
 * 74. Given onRow, rows are handed over and not retained, so the caller decides what to keep.
 *
 * @returns { rows, tally } — rows are { game, alts, chosen }, alts[i] is length FEATURES+JOINT.
 *                            `rows` is empty when onRow was supplied. */
function build(games, dex, opts) {
  const TOPK = opts.topK;
  /* onBoard(board, game, turnIndex) — an OBSERVER on the replay, called once per turn just before
   * endTurn(), with the board in the state the players actually faced.
   *
   * It exists so a consumer that needs POSITIONS rather than candidate rows does not have to
   * re-implement this walk. The event application below (hp from tgthp or dmg, status, boosts,
   * faints, weather, field) is fiddly and already got the Sucker Punch claim wrong once; a second
   * copy of it in a rollout harness would be a second thing to keep right. Same replay, same board,
   * one implementation. */
  const onBoard = opts.onBoard || null;
  const maxGames = opts.maxGames || 0;
  const onRow = opts.onRow || null;
  const w1 = opts.w1;
  const NF = B.FEATURES.length, NJ = B.JOINT_FEATURES.length, NW = NF + NJ;
  const score1 = x => { let s = 0; for (let k = 0; k < NF; k++) s += w1[k] * x[k]; return s; };

  const rows = [];
  const tally = { turns: 0, kept: 0, oneSlot: 0, unmatched: 0, ambiguous: 0, chosenOutsideK: 0,
                  /* rankHist[r] = turns whose WORSE slot ranked the human's click at r (0-based).
                   * slotRankHist[r] counts slots, not turns. candCount lets a reader tell a low
                   * truncation rate caused by a good ranker from one caused by a short candidate
                   * list — a slot with 3 options cannot truncate at K=3 and is not evidence. */
                  rankHist: [], slotRankHist: [], candCount: [] };

  let _gi = 0;
  for (const g of games) {
    if (maxGames && _gi >= maxGames) break;
    _gi++;
    const board = new B.Board();
    /* Side-keyed and forme-folded; see engine/click_match.js. `sheet[base(species)]` collapsed both
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

      /* What each side actually did with BOTH slots this turn, before anything resolves. */
      for (const side of ['p1', 'p2']) {
        /* A SWITCH IS ONE OF THE TWO THINGS A SLOT CAN DO, and looking only for move events threw away
         * every turn where one Pokemon switched -- which is a large share of them, and precisely the
         * turns where the two decisions are most likely to be related. A slot whose occupant fainted
         * earlier in the turn is being REPLACED, not choosing, and is excluded. */
        const acted = {};
        const actedAt = {};
        const fainted = new Set();
        for (let i = 0; i < ev.length; i++) {
          const e = ev[i];
          if (e.t === 'f' && e.s) fainted.add(e.s);
          if (!e.s || e.s.slice(0, 2) !== side) continue;
          const L = e.s.slice(2);
          if (acted[L]) continue;
          if (e.t === 'm' && e.mv) { acted[L] = { kind: 'move', mv: e.mv, tgt: e.tgt || null }; actedAt[L] = i; }
          else if (e.t === 's' && !fainted.has(e.s)) { acted[L] = { kind: 'switch', to: base(e.mon) }; actedAt[L] = i; }
        }
        if (!acted.a || !acted.b) { tally.oneSlot++; continue; }
        tally.turns++;

        const foeSide = side === 'p1' ? 'p2' : 'p1';
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
          /* ONE MATCHER, in engine/click_match.js, shared with engine/fit_policy.js.
           *
           * This used to be a second copy, and the copy did not know the rule fit_policy already had:
           * a SPREAD candidate has `targetMon: null` because Earthquake is not aimed, so requiring a
           * target match discarded 1,393 of 1,397 spread clicks and, because a joint turn needs BOTH
           * slots, 70% of the pair fit's data. That is what shipped -4.9863 for spreadFreeBesideAlly:
           * the matcher, not the humans. Two copies is how it happened; one is the fix.
           *
           * THE RECORDED TARGET IS RESOLVED BACK THROUGH THIS TURN'S SWITCHES, which is the largest
           * remaining cause of a failed match at 44.37% (engine/redirect_audit.js, 2026-08-02). */
          const m = CM.matchClick(cands, want, dex,
            want.kind === 'move' ? CM.targetAtDecision(ev, actedAt[L], foeSide, want.tgt, board) : undefined);
          return { cands, feats, chosen: m.chosen, ambiguous: m.ambiguous, scores: feats.map(score1) };
        });
        if (slots[0] && slots[1] && (slots[0].ambiguous || slots[1].ambiguous)) { tally.ambiguous++; continue; }
        if (!slots[0] || !slots[1] || slots[0].chosen < 0 || slots[1].chosen < 0) { tally.unmatched++; continue; }

        /* Top-K by single-move score, with the chosen candidate forced in.
         *
         * THE RANK IS KEPT, NOT JUST WHETHER IT CLEARED K. `chosenOutsideK` answers one K — the one
         * this run happened to be configured with — so deciding between top-3 and top-6 used to mean
         * replaying the whole corpus once per K. The full sorted order is computed here anyway, so the
         * chosen candidate's position in it is free, and the truncation rate for EVERY K is a suffix
         * sum of the histogram. That matters because the search's matrix size is exactly this
         * trade-off: docs/LOOKAHEAD-design.md 6 G2 has cost ruling out top-6, and a search cannot
         * recover value from a branch it never enumerated. */
        const pick = s => {
          const full = s.scores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
          const rank = full.indexOf(s.chosen);      /* 0-based; the chosen index is always a candidate */
          const order = full.slice(0, TOPK);
          if (!order.includes(s.chosen)) { order.push(s.chosen); return { order, outside: true, rank }; }
          return { order, outside: false, rank };
        };
        const pa = pick(slots[0]), pb = pick(slots[1]);
        if (pa.outside || pb.outside) tally.chosenOutsideK++;
        /* PER SLOT and JOINT. A pair survives top-K only if BOTH slots do, so the joint rate is driven
         * by the worse slot and is not the per-slot rate doubled or squared. Recorded separately
         * because the joint one is what bounds the search and the per-slot one is what a reader
         * expects when they hear "top-3". */
        const worst = Math.max(pa.rank, pb.rank);
        if (worst >= 0) {
          tally.rankHist[worst] = (tally.rankHist[worst] || 0) + 1;
          for (const r of [pa.rank, pb.rank]) tally.slotRankHist[r] = (tally.slotRankHist[r] || 0) + 1;
          tally.candCount.push(slots[0].cands.length, slots[1].cands.length);
        }

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
        const row = { game: g.id || '', alts, chosen: chosenPair };
        if (onRow) onRow(row); else rows.push(row);
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
       * Fake Out permanently legal -- silently, in a replay that otherwise looks correct. */
      if (onBoard) onBoard(board, g, _gi);
      board.endTurn();
    }
  }
  return { rows, tally };
}

module.exports = { build, loadRanker, rankerPath };
