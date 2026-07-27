/* fit_policy.js — learn how much a human's move choice depends on the board.
 *
 *   SHOWDOWN_PATH=... node engine/fit_policy.js   ->   data/policy-weights.json
 *
 * WHAT THIS IS
 * ------------
 * A discrete-choice fit. At every decision a real player faced a set of (move, target) pairs and
 * picked one. Each pair is described by the features in engine/board.js — type effectiveness against
 * the actual target, base power, whether the move is already dead on the board, and the behaviour
 * clone's P(move | species). Fitting is conditional logit:
 *
 *     P(pick j) = exp(w . x_j) / sum_k exp(w . x_k)
 *
 * maximised over w by gradient ascent on the log-likelihood of what people really clicked.
 *
 * WHY IT IS A FIT AND NOT A SCORING FUNCTION SOMEBODY WROTE
 * --------------------------------------------------------
 * The obvious way to make a bot aim better is to write `score = damage * effectiveness` and tune the
 * coefficients until the realism report looks right. That is an asserted model, it has as many free
 * parameters as it has terms, and tuning it against the number being reported is circular — the
 * report stops being evidence the moment it becomes the objective.
 *
 * Here the coefficients are estimated from 2,136 clean open-sheet games and the realism report is
 * never consulted during fitting. It is held back as the out-of-sample check, which is the only role
 * it can play honestly.
 *
 * A GREEDY BOT WOULD OVERSHOOT, WHICH IS THE POINT.
 * The target is not "maximise super-effective moves". Humans hit super effectively on 23.4% of moves,
 * not 100%, because they also click Protect, set Tailwind, and hit a resisted button to break a Sash.
 * A max-damage bot sails past 23.4% and is LESS human, not more. Fitting to observed clicks targets
 * the right quantity — it reproduces the rate rather than maximising it.
 *
 * WHY OPEN TEAM SHEETS, AND THE CAVEAT THAT COMES WITH THEM
 * --------------------------------------------------------
 * A choice model needs the CHOICE SET: the moves the player could have clicked. A normal replay only
 * reveals moves that were used, so the alternatives are unobservable and any set reconstructed from
 * revealed moves is biased by revelation — a move is in it BECAUSE it was clicked. Open-sheet games
 * publish all four moves of all six Pokemon up front, so the choice set is known exactly.
 *
 * The caveat, stated rather than buried: open-sheet play is not identical to closed play. Both
 * players can see everything, so there is less bluffing and less hedging against an unknown set.
 * These weights are therefore fitted on a slightly different game than the one the ladder plays. It
 * is the only corpus where the choice set is not guessed, which is why it is used, and the direction
 * of the bias is toward MORE board-reading rather than less.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const Q = require('./quality.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const OUT = D('data', 'policy-weights.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;

/* ---------------------------------------------------------------------------------------------
 * THE BEHAVIOUR CLONE, as a feature
 *
 * Read exactly the table engine/prior_player.js reads, so that "weight 1 on priorLogP and 0 on
 * everything else" reproduces the CURRENT bot's move distribution. That equivalence is what makes
 * the baseline in the report a real baseline rather than a strawman.
 * ------------------------------------------------------------------------------------------- */
function priorTable() {
  const j = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));
  const out = {};
  for (const [sp, v] of Object.entries(j.species || {})) {
    const row = {};
    for (const m of v.moves || []) if (m && m.mv) row[norm(m.mv)] = +m.p || 0;
    out[norm(sp)] = row;
  }
  return out;
}
const PRIORS = priorTable();
const priorFor = (species, moveId) => {
  const r = PRIORS[norm(species)] || PRIORS[base(species)] || null;
  return r ? (r[norm(moveId)] || 0) : 0;
};

/* ---------------------------------------------------------------------------------------------
 * CORPUS
 *
 * Both open-sheet sources, deduplicated by replay id, every game through engine/quality.js.
 * GARBODOR: the raw store is 87% bots, forfeits and stubs; nothing here touches it unfiltered.
 * ------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------
 * THE OPEN-SHEET METAGAME IS NOT THE CLOSED-SHEET METAGAME, AND THAT IS MEASURED, NOT ASSUMED
 *
 * Open team sheets change the incentives on TEAM BUILDING, not just on play: a surprise set or a
 * bluff item is worth nothing against an opponent who read your sheet before game one. The corpus
 * even ships with a warning saying so ("Different information AND incentive regime ... Do not pool").
 *
 * Measured with engine/corpus_shift.js, the difference in teams is large:
 *
 *     Garchomp     81.6% of open-sheet teams   47.7% of closed      Tyranitar  7.4% v 21.2%
 *     Basculegion  61.3%                       33.2%                Sitrus     8.4% v 17.5% of items
 *     total absolute difference across 109 species: 551.9 points
 *
 * and the difference in BEHAVIOUR GIVEN A BOARD is not:
 *
 *     super effective 35.6% v 37.1%   resisted 15.1% v 15.0%   immune 1.00% v 0.97%
 *     dead moves 1.30% v 1.53%        status 33.9% v 34.1%     Protect 13.9% v 13.8%
 *
 * That distinction is what licenses using this corpus at all. The fit is a CONDITIONAL model,
 * P(choice | board, choice set) — it never learns what to bring, and MEW draws its teams from the
 * clean LADDER store regardless. So the composition shift changes which situations the fit saw, not
 * the behaviour it is learning.
 *
 * It is still a shift, and this function corrects for it the standard way: importance weighting.
 * Each decision is weighted by how much more or less common its acting species is in closed play,
 * which reweights the open-sheet sample to look like the closed-sheet metagame. Nothing here is
 * typed — both shares are counted from the two corpora — and the weights are normalised to mean 1
 * so the log-likelihood stays on its usual scale.
 *
 * Reweighting can quietly destroy a sample by concentrating it on a handful of rows, so the
 * effective sample size (Kish, (sum w)^2 / sum w^2) is reported rather than assumed harmless.
 * ------------------------------------------------------------------------------------------- */
function speciesShares() {
  const cfg = Q.config();
  const count = (games) => {
    const c = {}; let n = 0;
    for (const g of games) {
      n++;
      for (const s of ['p1', 'p2']) for (const sp of ((g.six || {})[s] || [])) {
        const k = base(sp); c[k] = (c[k] || 0) + 1;
      }
    }
    return { c, n };
  };
  const openG = [], closedG = [];
  /* The same behavioural bot set loadCorpus uses. Screening the covariate-shift comparison with a
   * weaker filter than the fit itself would make the two sides incomparable. */
  const bots = Q.behaviouralBots(Q.readStore());
  for (const l of fs.readFileSync(D('data', 'games.ots.jsonl'), 'utf8').split('\n')) {
    if (!l.trim()) continue; let g; try { g = JSON.parse(l); } catch (e) { continue; }
    if (!Q.reasons(g, cfg, bots).length) openG.push(g);
  }
  for (const g of Q.loadGames()) if (!g.openSheet) closedG.push(g);
  const O = count(openG), C = count(closedG);
  const ratio = {};
  for (const sp of new Set([...Object.keys(O.c), ...Object.keys(C.c)])) {
    const o = (O.c[sp] || 0) / Math.max(1, O.n);
    const c = (C.c[sp] || 0) / Math.max(1, C.n);
    /* A species absent from one side gets no ratio; those decisions keep weight 1 rather than 0 or
     * infinity, so the correction never deletes or explodes a slice of the sample. */
    ratio[sp] = (o > 0 && c > 0) ? c / o : 1;
  }
  return { ratio, openGames: O.n, closedGames: C.n };
}

function loadCorpus() {
  const cfg = Q.config();
  /* THE BEHAVIOURAL BOT SET, WHICH THIS USED TO PASS AS `null`.
   *
   * Q.reasons takes it as a third argument and skips the check entirely without it, so the corpus
   * was screened only for accounts that ANNOUNCE themselves as bots. That is the exact filter the
   * project measured as inadequate: six unflagged accounts appearing in 52.2% of the games a
   * name-only check called clean, one of them playing 459 games with a single team.
   *
   * It let one game through out of 3,260 here, because those accounts' other games were already
   * being rejected as forfeits or partial brings. One game is nothing. A disabled check is not --
   * it would have gone on being disabled as the corpus grew. */
  const bots = Q.behaviouralBots(Q.readStore());
  const seen = new Set();
  const games = [];
  const rejected = {};
  const add = (g) => {
    if (!g || !g.openSheet || !g.sheets || !g.sheets.p1 || !g.sheets.p2) return;
    if (g.id && seen.has(g.id)) return;
    const why = Q.reasons(g, cfg, bots);
    if (why.length) { for (const r of why) rejected[r] = (rejected[r] || 0) + 1; return; }
    if (g.id) seen.add(g.id);
    games.push(g);
  };
  /* THREE SOURCES OF KNOWN CHOICE SETS, AND THEY ARE NOT EQUALLY GOOD.
   *
   *   games.bo3.jsonl     OUR OWN scrape of gen9championsvgc2026regmbbo3, whose ruleset carries
   *                       "Force Open Team Sheets" — so EVERY game in it publishes all six sets.
   *                       Same ladder, same regulation, same population as the closed store. This is
   *                       the best of the three and it was sitting unused while the fit ran on an
   *                       external archive.
   *   games.ladder.jsonl  the closed-sheet ladder, whose ruleset carries plain "Open Team Sheets" —
   *                       OPTIONAL, both players must agree. That is why only ~1% of it has sheets,
   *                       and those few are exactly the games usable here.
   *   games.ots.jsonl     the external VGC-Bench archive. Largest, but a different collection with a
   *                       different metagame (engine/corpus_shift.js measures it).
   *
   * All three are deduplicated by replay id and every one goes through quality.js. */
  for (const f of ['games.bo3.jsonl', 'games.ots.jsonl', 'games.ladder.jsonl']) {
    const p = D('data', f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let g; try { g = JSON.parse(line); } catch (e) { continue; }
      add(g);
    }
  }
  return { games, rejected };
}

/* ---------------------------------------------------------------------------------------------
 * REPLAY -> DECISIONS
 *
 * Decisions in a turn are made SIMULTANEOUSLY, before any of that turn's events resolve, so the
 * board a decision is scored against is the board at the START of the turn. Collecting features
 * after applying the turn's own damage would let the model see the future — the single easiest way
 * to produce a fit that looks excellent and cannot be reproduced by a player.
 *
 * The one exception is mega evolution, applied before collection: a player commits to the mega as
 * part of the same choice, so the typing they were choosing with is the mega's.
 * ------------------------------------------------------------------------------------------- */
function decisionsFor(g, tally) {
  const out = [];
  const board = new B.Board();

  const sheet = {};
  for (const side of ['p1', 'p2']) {
    for (const m of g.sheets[side] || []) {
      if (m && m.species) {
        sheet[base(m.species)] = { side, moves: (m.moves || []).map(norm) };
        /* The sheet's nature reaches the board, so the damage estimate is computed against the
         * spreads consistent with it rather than all of them. Public information on this ladder. */
        board.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
      }
    }
  }
  for (const side of ['p1', 'p2']) {
    /* THE BENCH, so a switch is a candidate at all. Without it board.bench() is empty and every
     * switch decision below silently finds nothing to match against -- the feature would be dead
     * weight in the vector rather than obviously broken. */
    board.setParty(side, ((g.brought || {})[side] || []));
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) board.switchIn(side, 'a', lead[0]);
    if (lead[1]) board.switchIn(side, 'b', lead[1]);
  }

  for (const t of g.turns || []) {
    const ev = t.ev || [];
    for (const e of ev) {
      if (e.t !== 'mega' || !e.s) continue;
      const mon = board.slot(e.s.slice(0, 2), e.s.slice(2));
      if (mon) { mon.species = norm(e.mon); }
    }

    /* WHICH SWITCHES WERE A CHOICE. A `t:'s'` covers two different acts: a player deciding to pull
     * something out, and a player being made to replace something that just fainted. Only the first
     * is a decision, and scoring the second would teach the model that switching follows death.
     * A slot whose occupant fainted EARLIER IN THE SAME TURN was forced. */
    const forcedSlot = new Set();
    for (const e of ev) {
      if (e.t === 'f' && e.s) forcedSlot.add(e.s);
      else if (e.t === 's' && e.s && forcedSlot.has(e.s)) forcedSlot.add(e.s + '|used');
    }

    for (const e of ev) {
      if (e.t === 's' && e.s && !forcedSlot.has(e.s)) {
        /* A voluntary switch, scored against the same candidate list the moves are scored against --
         * the whole point is that "bring Torkoal in" competes with "click Earthquake" rather than
         * being decided separately by a coin, which is what happens today. */
        tally.seen++;
        const side = e.s.slice(0, 2), letter = e.s.slice(2);
        const user = board.slot(side, letter);
        if (!user || user.fainted) { tally.noUser++; continue; }
        const sh = sheet[base(user.species)];
        if (!sh) { tally.noSheet++; continue; }
        const cands = B.candidates(sh.moves, user, board, side, dex);
        if (cands.length < 2) { tally.trivial++; continue; }
        const want = base(e.mon);
        const idx = cands.findIndex(c => c.switchTo && c.switchTo === want);
        if (idx < 0) { tally.unmatched++; continue; }
        const feats = cands.map(c => B.featuresFor(c, user, board, side, dex,
          c.switchTo ? B.PRIOR_FLOOR : priorFor(user.species, c.move.id)));
        out.push({ game: g.id || '', sp: base(user.species), feats, chosen: idx });
        tally.kept++;
        continue;
      }
      if (e.t !== 'm' || !e.s || !e.mon || !e.mv) continue;
      tally.seen++;
      const side = e.s.slice(0, 2), letter = e.s.slice(2);
      const user = board.slot(side, letter);
      if (!user || user.fainted) { tally.noUser++; continue; }
      const sh = sheet[base(e.mon)];
      if (!sh) { tally.noSheet++; continue; }

      const cands = B.candidates(sh.moves, user, board, side, dex);
      if (cands.length < 2) { tally.trivial++; continue; }

      /* Which candidate did they actually pick? A stored target is a SPECIES name, not a slot, so a
       * mirror match is genuinely ambiguous; those are counted and dropped rather than guessed. */
      const mvId = norm(dex.moves.get(e.mv) && dex.moves.get(e.mv).id || e.mv);
      const matches = [];
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (!c.move || norm(c.move.id) !== mvId) continue;
        if (!c.targetMon) { matches.push(i); continue; }
        if (e.tgt && base(c.targetMon.species) === base(e.tgt)) matches.push(i);
      }
      if (!matches.length) { tally.unmatched++; continue; }
      if (matches.length > 1) { tally.ambiguous++; continue; }

      const feats = cands.map(c => B.featuresFor(c, user, board, side, dex,
        c.switchTo ? B.PRIOR_FLOOR : priorFor(user.species, c.move.id)));
      out.push({ game: g.id || '', sp: base(e.mon), feats, chosen: matches[0] });
      tally.kept++;
    }

    /* ---- now resolve the turn ---------------------------------------------------------------- */
    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) { board.switchIn(side, letter, e.mon); }
      else if (e.t === 'm' && side) {
        const user = board.slot(side, letter);
        const mv = dex.moves.get(e.mv);
        /* "It worked" offline means the setter was not already up. Nothing in the store says a move
         * failed, so this is the best available reading; it is applied identically by the live
         * player, whose |-fail| lines make it exact. The asymmetry is small and is in the direction
         * of the fit UNDER-counting dead moves, never over-counting them. */
        if (user && mv && mv.exists) {
          const already = (mv.sideCondition && board.hasSide(side, mv.sideCondition)) ||
                          (B.fieldKey(mv) && board.hasField(B.fieldKey(mv)));
          B.noteMove(board, side, user, mv, !already);
        }
        /* Damage lands on the named species. The foe side is searched first because that is where a
         * move almost always points; a mirror match can still put it on the wrong slot, which is the
         * same ambiguity counted at choice time and is why `ambiguous` decisions are dropped. */
        /* ABSOLUTE WHEN THE STORE HAS IT, SUBTRACTION ONLY AS A FALLBACK.
         * Subtracting damage can only ever drift DOWNWARD, because healing was never recorded as an
         * event: no Leftovers tick, no Sitrus, no Regenerator, no residual burn. That is not a
         * theoretical worry, it was measured -- MAG's "guaranteed kill" was followed by an actual
         * death 56.5% of the time, because it was aiming at Pokemon it believed were nearly dead.
         * engine/durable-ingest.js now writes the absolute figure the protocol always stated, and
         * engine/reprocess.js rebuilt the store from the raw logs. 3,849 ladder games predate raw-log
         * archiving and cannot be rebuilt, so the old subtraction still runs for those. */
        if (e.tgt && (e.tgthp != null || e.dmg)) {
          const foeSide = side === 'p1' ? 'p2' : 'p1';
          let hit = false;
          for (const s of [foeSide, side]) {
            for (const L of ['a', 'b']) {
              const m2 = board.slot(s, L);
              if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) {
                m2.hp = e.tgthp != null ? Math.max(0, e.tgthp / 100)
                                        : Math.max(0, m2.hp - e.dmg / 100);
                hit = true; break;
              }
            }
            if (hit) break;
          }
        }
      }
      else if (e.t === 'x' && side) { const m2 = board.slot(side, letter); if (m2) m2.status = norm(e.st); }
      /* Healing and chip damage — Sitrus, Leftovers, Regenerator, burn, sandstorm, Life Orb, Rocky
       * Helmet. Nobody's move, so they cannot ride on one, and before the store carried them every
       * replay in this project believed the board was more damaged than it was. */
      else if (e.t === 'hp' && side) { const m2 = board.slot(side, letter); if (m2 && e.hp != null) m2.hp = Math.max(0, e.hp / 100); }
      /* Stat stages, absolute -- Intimidate, Snarl, Icy Wind, Swords Dance. Written as a whole set
       * by the ingest rather than as a delta, so a dropped event cannot corrupt everything after it. */
      else if (e.t === 'b' && side) { const m2 = board.slot(side, letter); if (m2 && e.b) m2.boosts = { ...e.b }; }
      else if (e.t === 'f' && side) { board.faint(side, letter); }
      else if (e.t === 'w' && e.field) { board.setWeather(e.field); }
      else if (e.t === 'fs' && e.field) {
        const mv = dex.moves.get(e.field);
        const k = mv && mv.exists ? B.fieldKey(mv) : norm(e.field);
        if (k) board.startField(k, mv && mv.condition && mv.condition.duration);
      }
    }
    board.endTurn();
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * CONDITIONAL LOGIT
 * ------------------------------------------------------------------------------------------- */
function logLik(rows, w) {
  let ll = 0, correct = 0;
  for (const r of rows) {
    let max = -Infinity, bestI = 0;
    const s = new Array(r.feats.length);
    for (let j = 0; j < r.feats.length; j++) {
      let v = 0; const f = r.feats[j];
      for (let k = 0; k < w.length; k++) v += w[k] * f[k];
      s[j] = v;
      if (v > max) { max = v; bestI = j; }
    }
    let z = 0;
    for (let j = 0; j < s.length; j++) z += Math.exp(s[j] - max);
    ll += (s[r.chosen] - max) - Math.log(z);
    if (bestI === r.chosen) correct++;
  }
  return { ll: ll / Math.max(1, rows.length), acc: correct / Math.max(1, rows.length) };
}

/* `useIW` estimates on the IMPORTANCE-WEIGHTED sample — each decision counted in proportion to how
 * much more or less common its acting species is in closed-sheet play. Evaluation is always
 * unweighted; the question this answers is "do the estimated weights move when the open-sheet
 * metagame is reweighted to look like the closed one", which is a question about the estimate, not
 * about held-out fit. */
/* STANDARD ERRORS ON THE FITTED WEIGHTS.
 *
 * Every other model in this project ships a confidence interval and this one shipped a bare vector,
 * which also meant the covariate-shift check had nothing to judge "did the weights move" against —
 * it compared the shift to a hand-typed 0.25, exactly the invented constant S12/S13 forbid.
 *
 * For conditional logit the observed information is available in closed form. With p_ij the fitted
 * choice probabilities and xbar_i = sum_j p_ij x_ij,
 *
 *     H = sum_i sum_j p_ij (x_ij - xbar_i)(x_ij - xbar_i)'
 *
 * and the covariance of the estimate is H^-1. One pass, a 12x12 inverse, and every weight gets a
 * standard error — so "this weight moved" becomes a question with a scale rather than a taste. */
function standardErrors(rows, w, nf) {
  const H = Array.from({ length: nf }, () => new Array(nf).fill(0));
  for (const r of rows) {
    const s = new Array(r.feats.length);
    let max = -Infinity;
    for (let j = 0; j < r.feats.length; j++) {
      let v = 0; const f = r.feats[j];
      for (let k = 0; k < nf; k++) v += w[k] * f[k];
      s[j] = v; if (v > max) max = v;
    }
    let z = 0;
    for (let j = 0; j < s.length; j++) { s[j] = Math.exp(s[j] - max); z += s[j]; }
    const xbar = new Array(nf).fill(0);
    for (let j = 0; j < s.length; j++) {
      const p = s[j] / z, f = r.feats[j];
      for (let k = 0; k < nf; k++) xbar[k] += p * f[k];
    }
    for (let j = 0; j < s.length; j++) {
      const p = s[j] / z, f = r.feats[j];
      const d = new Array(nf);
      for (let k = 0; k < nf; k++) d[k] = f[k] - xbar[k];
      for (let a = 0; a < nf; a++) {
        if (!d[a]) continue;
        for (let b = 0; b < nf; b++) H[a][b] += p * d[a] * d[b];
      }
    }
  }
  /* Gauss-Jordan inverse of a small symmetric matrix; a tiny ridge keeps it invertible if a feature
   * is degenerate in this sample rather than throwing on it. */
  const n = nf;
  const A = H.map((row, i) => row.slice().concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let i = 0; i < n; i++) A[i][i] += 1e-9;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r2 = c + 1; r2 < n; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[piv][c])) piv = r2;
    if (Math.abs(A[piv][c]) < 1e-12) return new Array(nf).fill(NaN);
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
    for (let r2 = 0; r2 < n; r2++) {
      if (r2 === c) continue;
      const f = A[r2][c];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) A[r2][j] -= f * A[c][j];
    }
  }
  return Array.from({ length: nf }, (_, k) => Math.sqrt(Math.max(0, A[k][n + k])));
}

function fit(rows, nf, lambda, iters, useIW) {
  const w = new Array(nf).fill(0);
  const m = new Array(nf).fill(0), v = new Array(nf).fill(0);
  const lr = 0.05, b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let mass = 0;
  for (const r of rows) mass += useIW ? (r.iw || 1) : 1;
  for (let it = 1; it <= iters; it++) {
    const g = new Array(nf).fill(0);
    for (const r of rows) {
      const iw = useIW ? (r.iw || 1) : 1;
      const s = new Array(r.feats.length);
      let max = -Infinity;
      for (let j = 0; j < r.feats.length; j++) {
        let x = 0; const f = r.feats[j];
        for (let k = 0; k < nf; k++) x += w[k] * f[k];
        s[j] = x; if (x > max) max = x;
      }
      let z = 0;
      for (let j = 0; j < s.length; j++) { s[j] = Math.exp(s[j] - max); z += s[j]; }
      const fc = r.feats[r.chosen];
      for (let k = 0; k < nf; k++) g[k] += iw * fc[k];
      for (let j = 0; j < s.length; j++) {
        const p = s[j] / z, f = r.feats[j];
        for (let k = 0; k < nf; k++) g[k] -= iw * p * f[k];
      }
    }
    for (let k = 0; k < nf; k++) {
      let gk = g[k] / mass - lambda * w[k];
      m[k] = b1 * m[k] + (1 - b1) * gk;
      v[k] = b2 * v[k] + (1 - b2) * gk * gk;
      const mh = m[k] / (1 - Math.pow(b1, it)), vh = v[k] / (1 - Math.pow(b2, it));
      w[k] += lr * mh / (Math.sqrt(vh) + eps);
    }
  }
  return w;
}

function main() {
  const ITERS = +arg('--iters', 300);
  console.log('FIT POLICY — how much does a human move choice depend on the board?\n');

  const { games, rejected } = loadCorpus();
  if (!games.length) { console.error('no clean open-sheet games found'); process.exit(1); }
  const rej = Object.entries(rejected).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(', ');
  console.log(`  corpus     ${games.length.toLocaleString()} clean open-sheet games`);
  console.log(`  rejected   ${rej}`);

  const tally = { seen: 0, kept: 0, noUser: 0, noSheet: 0, trivial: 0, unmatched: 0, ambiguous: 0 };
  let rows = [];
  for (const g of games) rows = rows.concat(decisionsFor(g, tally));
  console.log(`  decisions  ${tally.seen.toLocaleString()} seen -> ${tally.kept.toLocaleString()} usable`);
  console.log(`             dropped: ${tally.trivial.toLocaleString()} had only one candidate (no information), ` +
              `${tally.noSheet.toLocaleString()} species not on a sheet, ${tally.unmatched.toLocaleString()} click not matched, ` +
              `${tally.ambiguous.toLocaleString()} target ambiguous (mirror), ${tally.noUser.toLocaleString()} no active user`);
  if (rows.length < 500) { console.error('too few decisions to fit'); process.exit(1); }

  /* HELD OUT BY GAME, NOT BY DECISION. Decisions inside one game share teams, players and board, so
   * splitting by decision leaks the answer across the split and every model looks good. */
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const train = rows.filter(r => hash(r.game) % 5 !== 0);
  const test = rows.filter(r => hash(r.game) % 5 === 0);
  console.log(`  split      ${train.length.toLocaleString()} train / ${test.length.toLocaleString()} held out (split by GAME)\n`);

  const nf = B.FEATURES.length;
  const iPrior = B.FEATURE_INDEX.priorLogP;

  /* Baselines. `bot` is literally the current player: sample the behaviour clone, aim at random. */
  const wUniform = new Array(nf).fill(0);
  const wBot = new Array(nf).fill(0); wBot[iPrior] = 1;
  const base0 = logLik(test, wUniform);
  const baseBot = logLik(test, wBot);

  /* The regularisation strength is SELECTED on held-out likelihood, not chosen. */
  let best = null;
  for (const lambda of [0, 1e-5, 1e-4, 1e-3, 1e-2]) {
    const w = fit(train, nf, lambda, ITERS);
    const te = logLik(test, w);
    if (!best || te.ll > best.te.ll) best = { lambda, w, te, tr: logLik(train, w) };
  }

  console.log('HELD-OUT FIT (higher log-likelihood is better; 0 would be perfect prediction)\n');
  const line = (name, r) => console.log(`  ${name.padEnd(34)} logL/decision ${r.ll.toFixed(4).padStart(8)}   top-1 ${(100 * r.acc).toFixed(1).padStart(5)}%`);
  line('uniform over candidates', base0);
  line('behaviour clone alone (current bot)', baseBot);
  line('board-aware fit', best.te);
  console.log(`\n  regularisation selected on held-out data: lambda = ${best.lambda}`);
  console.log(`  in-sample logL ${best.tr.ll.toFixed(4)} against held-out ${best.te.ll.toFixed(4)} ` +
              `(a large gap here would mean the fit is memorising games, not learning play)`);

  /* ---- IS THE FIT AN ARTEFACT OF THE OPEN-SHEET METAGAME? ------------------------------------
   * Re-estimate on the sample reweighted to the closed-sheet species mix and compare the weights.
   * If they barely move, the composition shift does not bias the policy; if they move a lot, these
   * weights describe a metagame the bot does not play in. Automatic, so it is re-checked on every
   * refit rather than argued about once. */
  const SH = speciesShares();
  let iwSum = 0, iwN = 0;
  for (const r of rows) { r.iw = SH.ratio[r.sp] != null ? SH.ratio[r.sp] : 1; iwSum += r.iw; iwN++; }
  const iwMean = iwSum / Math.max(1, iwN);
  for (const r of rows) r.iw /= iwMean;
  let s1 = 0, s2 = 0;
  for (const r of train) { s1 += r.iw; s2 += r.iw * r.iw; }
  const ess = s2 > 0 ? (s1 * s1) / s2 : 0;
  const wIW = fit(train, nf, best.lambda, ITERS, true);
  const teIW = logLik(test, wIW);
  /* HOW MUCH EACH FEATURE ACTUALLY VARIES. A weight is only comparable to another weight if the two
   * things they multiply are on the same scale, and they are not: most features are 0/1 flags while
   * `eff` runs about -4..+2 and `priorLogP` about -7.6..0. Reporting raw weights side by side
   * therefore understates the wide-ranging features. The standard deviation of each feature across
   * every candidate in the corpus turns a weight into "how much this swings a score in practice",
   * which is the quantity a reader actually wants. */
  const spread = (() => {
    const n = new Array(nf).fill(0), mean = new Array(nf).fill(0), m2 = new Array(nf).fill(0);
    for (const r of rows) for (const f of r.feats) for (let k = 0; k < nf; k++) {
      n[k]++; const d = f[k] - mean[k]; mean[k] += d / n[k]; m2[k] += d * (f[k] - mean[k]);
    }
    return m2.map((v, k) => (n[k] > 1 ? Math.sqrt(v / (n[k] - 1)) : 0));
  })();

  const SE = standardErrors(train, best.w, nf);
  /* The shift is judged in STANDARD ERRORS, not against a number chosen here. 1.96 is the same
   * z the project already uses for every Wilson interval, so a shift inside it is a shift this
   * sample could not have distinguished from noise in the first place. */
  let maxMove = 0, whichMove = '', maxZ = 0, whichZ = '';
  for (let k = 0; k < nf; k++) {
    const d = Math.abs(wIW[k] - best.w[k]);
    if (d > maxMove) { maxMove = d; whichMove = B.FEATURES[k]; }
    const z = SE[k] > 0 ? d / SE[k] : 0;
    if (z > maxZ) { maxZ = z; whichZ = B.FEATURES[k]; }
  }
  console.log('\nCOVARIATE SHIFT — open-sheet teams are NOT closed-sheet teams');
  console.log(`  the two metagames differ in composition (engine/corpus_shift.js measures it), so the`);
  console.log(`  fit is re-estimated on a sample reweighted to the closed-sheet species mix.`);
  console.log(`  effective sample size after reweighting: ${Math.round(ess).toLocaleString()} of ${train.length.toLocaleString()} ` +
              `(${(100 * ess / Math.max(1, train.length)).toFixed(0)}% — a small number here would mean the correction ate the sample)`);
  console.log(`  largest weight change: ${whichMove} moved ${maxMove.toFixed(3)}`);
  console.log(`  largest change RELATIVE TO ITS OWN STANDARD ERROR: ${whichZ} at ${maxZ.toFixed(2)} SE`);
  console.log(`  held-out logL reweighted ${teIW.ll.toFixed(4)} against unweighted ${best.te.ll.toFixed(4)}`);
  /* WHICH VECTOR SHIPS.
   *
   * The bot plays in the CLOSED-sheet metagame — MEW samples its teams from the clean ladder store —
   * so when the correction moves a weight further than this sample can resolve, the reweighted
   * estimate is the one that describes the distribution the bot actually plays in. Shipping the
   * unweighted vector in that case would be knowingly fitting the wrong population.
   *
   * An earlier version of this check compared the shift to a hand-typed 0.25 and concluded "stable".
   * That was the invented constant S12/S13 forbid, and it was hiding a real effect: priorLogP has a
   * very tight standard error, so a small absolute move is a large one in the units that matter. */
  const material = maxZ >= 1.96;
  console.log(material
    ? '  -> MATERIAL: a weight moved further than this sample can resolve. The REWEIGHTED vector\n' +
      '     ships, because the bot plays in the closed-sheet metagame, not this one.'
    : '  -> every weight moved less than this sample can resolve; the unweighted vector ships.');
  if (material) {
    console.log('\n  the weights that actually moved (unweighted -> reweighted, in standard errors)');
    const moved = B.FEATURES.map((f, k) => ({ f, a: best.w[k], b: wIW[k], z: SE[k] > 0 ? Math.abs(wIW[k] - best.w[k]) / SE[k] : 0 }))
      .filter(r => r.z >= 1.96).sort((x, y) => y.z - x.z);
    for (const r of moved) {
      console.log(`    ${r.f.padEnd(12)} ${(r.a >= 0 ? '+' : '') + r.a.toFixed(3)} -> ${(r.b >= 0 ? '+' : '') + r.b.toFixed(3)}   ${r.z.toFixed(1)} SE`);
    }
  }
  const shipW = material ? wIW : best.w;

  const gain = best.te.ll - baseBot.ll;
  const accGain = 100 * (best.te.acc - baseBot.acc);
  console.log(`\n  Against the current bot: ${gain >= 0 ? '+' : ''}${gain.toFixed(4)} logL/decision, ` +
              `${accGain >= 0 ? '+' : ''}${accGain.toFixed(1)} points of top-1 accuracy.`);
  if (gain <= 0) {
    console.log('  NEGATIVE RESULT: reading the board did NOT predict human choices better than');
    console.log('  popularity alone. Do not ship these weights on the strength of this run.');
  }

  console.log('\nWHAT THE FIT LEARNED (weight per feature; sign and size are the interesting part)\n');
  const order = B.FEATURES.map((f, i) => [f, best.w[i], SE[i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [f, wv, se] of order) {
    const lo = wv - 1.96 * se, hi = wv + 1.96 * se;
    const crosses = lo <= 0 && hi >= 0;
    console.log(`  ${f.padEnd(12)} ${(wv >= 0 ? '+' : '') + wv.toFixed(3)}   95% CI [${lo.toFixed(3)}, ${hi.toFixed(3)}]` +
      (crosses ? '   <- interval contains zero; this feature is not doing measurable work' : ''));
  }

  const out = {
    generated: new Date().toISOString(),
    features: B.FEATURES,
    weights: shipW,
    weights_unweighted: best.w,
    weights_reweighted_to_closed: wIW,
    shipped: material ? 'reweighted_to_closed' : 'unweighted',
    standardErrors: SE,
    spread,
    lambda: best.lambda,
    corpus: { games: games.length, decisions: rows.length, train: train.length, test: test.length },
    heldOut: {
      uniform: base0, behaviourCloneOnly: baseBot, boardAware: best.te,
      gain_logL: gain, gain_top1_points: accGain,
    },
    covariateShift: {
      note: 'Open-sheet TEAMS differ enormously from closed-sheet teams (551.9 points of total ' +
            'absolute species difference, engine/corpus_shift.js). Open-sheet BEHAVIOUR given a ' +
            'board does not (largest gap 1.49 points). This model is conditional on the board and ' +
            'never learns what to bring, so the composition gap changes which situations were ' +
            'sampled, not what was learned from them.',
      reweighted_max_weight_change: null,   // filled below
      effective_sample_size: null,
    },
    caveat: 'Fitted on open-team-sheet games, the only corpus where the CHOICE SET is known rather ' +
            'than guessed. Known unmodelled gaps: ability-based immunity and priority-blocking ' +
            'abilities (Armor Tail, Queenly Majesty) are invisible to the feature set, which ' +
            'computes immunity from TYPES only; and ~11% of clicks were dropped as unmatched, ' +
            'mostly redirection (Follow Me, Rage Powder). Open-sheet players also average ~185 ' +
            'rating points lower, though measured move quality is close to flat in rating.',
  };
  out.covariateShift.reweighted_max_weight_change = { feature: whichMove, delta: maxMove };
  out.covariateShift.effective_sample_size = { ess: Math.round(ess), of: train.length };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\n  -> ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) main();
module.exports = { decisionsFor, logLik, fit, loadCorpus, priorFor };
