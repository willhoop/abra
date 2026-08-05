/* leaf_position_contrast.js — WHY DO THE TWO LEAF MEASUREMENTS DISAGREE?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/leaf_position_contrast.js
 *
 * THE CONTRADICTION THIS EXISTS TO RESOLVE
 * ----------------------------------------
 * Two stamped artifacts describe the SAME leaf — rollout_leaf.rolloutWinProb at explore=1.0 — and
 * disagree about whether it can rank at all.
 *
 *   data/winrate-backtest.json   turn 0, ladder corpus, no sheets, n=200, h=60
 *                                50.99% of 1,314 decisive calls [48.3, 53.7], ECE 0.1811,
 *                                reliability curve FLAT: says 90-100% and wins 53.6%.
 *   data/rollout-r1-explore-sweep.json  mid-game, open-sheet corpus, sheets set, n=40, h=20
 *                                69.84% of 9,201 positions, ECE 0.0927,
 *                                reliability curve MONOTONE 0.151 -> 0.861.
 *
 * The sweep FLAGS the contradiction itself (`reading_against_the_leaf_calibration`) and refuses to
 * treat either as established. It names two differences. There are SIX, and no measurement has ever
 * held any of them fixed:
 *
 *   1. POSITION   turn 0 vs mid-game (mean turn 3.744). At turn 0 there is no material asymmetry
 *                 AT ALL, so every judge that reads material is reduced to reading matchup.
 *   2. SHEETS     joint_rows.js:116 calls board.setSheet on all four channels, and board.js:727-741
 *                 bakes nature/item/ability/moves onto the tracked mon at switchIn. The sweep's leaf
 *                 knows both teams' exact sets. backtest_winrate.js sets NO sheets, deliberately.
 *   3. CORPUS     fit_policy.loadCorpus() takes games.bo3 + games.OTS + the ~1% of ladder games with
 *                 sheets; the OTS archive is an external collection with a different metagame
 *                 (engine/corpus_shift.js exists to measure that). backtest reads quality.loadGames()
 *                 over the closed-sheet ladder. Different populations.
 *   4. UNIT       positions clustered inside 2,500 games vs one prediction per game.
 *   5. METRIC     the sweep scores every position with a p>=0.5 tie-break (so a tie is scored as a
 *                 p1 call, and p1 wins 52.46% of the sample); the backtest scores only DECISIVE
 *                 calls, |p-0.5| > 0.02, against a 50% null.
 *   6. CONFIG     n=40/h=20 vs n=200/h=60.
 *
 * WHAT THIS RUNS
 * --------------
 * A 2x2 on ONE corpus, ONE config, ONE frozen release, with the same seeds:
 *
 *                    | no sheet          | sheet
 *      turn 0        |  A                |  B
 *      mid-game      |  C                |  D  <- the sweep's condition
 *
 * A is the backtest's condition; D is the sweep's. B-A is the sheet channel at turn 0, C-A is the
 * position effect with the sheet held OFF, D-C is the sheet channel mid-game. Every arm reports BOTH
 * accuracy definitions and its own majority-class baseline, so the metric cannot explain a gap.
 *
 * Plus arm E — turn 0, no sheet, on the CLOSED-SHEET LADDER corpus quality.loadGames() returns.
 * That is the one difference the 2x2 cannot see, because the 2x2 holds the corpus fixed at the
 * open-sheet one. E - A is the corpus, with position, sheets, config and build all held.
 *
 * HOW THE TWO WALKS ARE MADE COMPARABLE. The mid-game arms come from two passes of joint_rows.build
 * over the same games; the second has Board.prototype.setSheet disabled. Nothing in the walk's board
 * mutation reads the sheet — hp/status/faint/weather come off the replay events, and the candidate
 * list comes from click_match.sheetIndex, not from board.sheet — so the two passes must emit the
 * SAME positions. That is asserted position-by-position on (gid, turn, aliveDiff, hpDiff), the same
 * witness pair engine/rollout_r1.js dumps, and the run aborts if it fails rather than reporting a
 * pairing it did not check.
 *
 * WHAT THIS IS NOT. It is not a verdict on whether explore=1.0 makes MILTANK win, and it does not
 * re-run either artifact. It measures which of the six differences carries the gap between them.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const D = (...p) => path.join(__dirname, '..', ...p);

/* ---- STEP 0: THE FROZEN RELEASE ---------------------------------------------------------------
 * ENGINE edits engine/medicham2-browser.js while gates run; that is the normal state. The leaf is
 * read from the snapshot. Same guard and same reasoning as engine/rollout_r1.js:37-69: the corpus
 * walker loads live board.js, so live and snapshot must be byte-identical at load time. */
const REL_API = require('./engine_release.js');
/* A RE-CUT OPENS THE RELEASE THE ROWS WERE MEASURED ON, WHICH IS IN THEIR FILENAME.
 * Opening the newest release instead would stamp a re-aggregation of old predictions with a build
 * that never produced them — an artifact describing the file rather than the run, which is
 * data/rollout-r1.json's own stated reason for recording null. */
const RECUT = process.env.RECUT || null;
const RECUT_REL = RECUT ? (String(RECUT).match(/-rows-([0-9a-f]{12})\.jsonl$/) || [])[1] : null;
if (RECUT && !RECUT_REL) {
  console.error(`REFUSING TO RE-CUT: ${RECUT} does not carry a release id in its name ` +
                '(expected …-rows-<12 hex>.jsonl). A re-cut that cannot name its engine is not a measurement.');
  process.exit(1);
}
let REL;
try { REL = REL_API.open(RECUT_REL || process.env.RELEASE || undefined); }
catch (e) {
  console.error('REFUSING TO RUN: ' + e.message);
  console.error('This is a measurement of a leaf, and a leaf is a fact about one specific engine.');
  process.exit(1);
}
if (!RECUT) {
  const drift0 = REL_API.drift(REL.id);
  if (drift0.length) {
    console.error(`REFUSING TO RUN: the live tree has moved off release ${REL.id}:`);
    for (const f of drift0) console.error('  ' + f);
    console.error('Cut a fresh release and re-run.');
    process.exit(1);
  }
}
const CS = REL.require('engine/champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');
const B = require('./board.js');
const RL = REL.require('engine/rollout_leaf.js');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* ---- CONFIG, ALL OF IT STAMPED ----------------------------------------------------------------
 * Defaults are the SWEEP's settings, because the sweep is the arm claiming the leaf works and the
 * honest test moves the sweep's condition toward the backtest's rather than the reverse. */
const GAMES    = parseInt(process.env.GAMES || '600', 10);
const N        = parseInt(process.env.N || '40', 10);
const EXPLORE  = process.env.EXPLORE != null ? Number(process.env.EXPLORE) : 1;
const MAXTURNS = parseInt(process.env.MAXTURNS || '20', 10);
const EVERY    = parseInt(process.env.EVERY || '2', 10);
const OUT      = process.env.OUT || 'data/leaf-position-contrast.json';
const SKIP_MID = !!process.env.SKIP_MID;

/* RECUT was resolved above, before the release was opened, because it decides WHICH release opens.
 *
 * It exists because docs/MEASURE.md §3 records what happens without it: two R1 runs four accuracy
 * points apart were byte-indistinguishable and the published figure could not be recomputed by
 * anyone. Every figure in this artifact is an aggregation over per-position predictions, so with the
 * rows on disk a different subset, a different accuracy definition or a fixed aggregation costs
 * seconds instead of half an hour of rollouts — and the numbers cannot drift, because the
 * predictions do not move.
 *
 *   RECUT=data/leaf-position-contrast-rows-<id>.jsonl node engine/leaf_position_contrast.js */
let w1 = null, allGames = [], games = [];
if (!RECUT) {
  try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
  allGames = FP.loadCorpus().games;
  games = allGames.slice(0, GAMES);
}

console.log('LEAF POSITION CONTRAST — turn 0 vs mid-game, sheet vs no sheet, one leaf\n');
console.log(`  release ${REL.id}`);
if (!RECUT) console.log(`  corpus  ${allGames.length.toLocaleString()} clean open-sheet games, first ${games.length} taken`);
console.log(`  leaf    rolloutWinProb n=${N} explore=${EXPLORE} maxTurns=${MAXTURNS}, every ${EVERY}th turn\n`);

/* ---- THE FOUR ARMS ----------------------------------------------------------------------------*/
const arms = {
  A_turn0_nosheet:  { rows: [], what: 'turn 0, NO sheet — backtest_winrate.js\'s condition, on this corpus' },
  B_turn0_sheet:    { rows: [], what: 'turn 0, open sheet set on both sides' },
  C_mid_nosheet:    { rows: [], what: 'mid-game replay boards, sheet SUPPRESSED' },
  D_mid_sheet:      { rows: [], what: 'mid-game replay boards, open sheet set — the sweep\'s condition' },
  E_turn0_nosheet_ladder: { rows: [], what: 'turn 0, NO sheet, on the CLOSED-SHEET LADDER corpus — ' +
    'backtest_winrate.js\'s condition AND its corpus, at this config and this release' },
};

const labelOf = g => g.winner === (g.p1 && g.p1.name) ? 1 : (g.winner === (g.p2 && g.p2.name) ? 0 : null);

/* GAME_RULES — the irreducible names, declared in one place (engine/conformance.js S12b).
 *
 * These are NOT mine to choose. The mid-game arms must hand `rolloutWinProb` byte-identically the
 * same field snapshot `engine/rollout_r1.js:224-233` hands it, or arm D is not the sweep's condition
 * and the whole comparison is against a different measurement. Weather and terrain come off the
 * board and out of `RL.terrainOnBoard`; Trick Room and Tailwind have no such reader, so R1 types the
 * two keys and the two durations inline. Copying them without saying so is how two files come to
 * disagree about one fact (CLAUDE.md, FACTS ARE GLOBAL), so they are declared here and the
 * duplication is filed for SEARCH rather than hidden.
 *
 * The durations are the ones R1 passes, not the format's: 5 and 4 are what that harness has always
 * sent, and matching the arm matters more here than being right about a turn counter neither leaf
 * decrements the same way. */
const GAME_RULES = {
  trickRoomKey: 'trickroom', trickRoomTurns: 5,
  tailwindKey: 'tailwind',   tailwindTurns: 4,
  why: 'field keys engine/rollout_r1.js types inline; matched exactly so arm D reproduces the sweep',
};

/* TURN 0. Built the way board.js itself builds a preview position and the way joint_rows.build
 * initialises before its first turn — setSheet FIRST (switchIn bakes it onto the tracked mon), then
 * setParty over the BROUGHT four, then the real leads. Nothing here builds a body; buildSide/dmgMon
 * inside the leaf does, exactly as in a live game. */
function turn0Board(g, withSheet) {
  const bd = new B.Board();
  for (const side of ['p1', 'p2']) {
    if (withSheet) {
      for (const m of (g.sheets && g.sheets[side]) || []) {
        if (m && m.species) bd.setSheet(side, m.species, m);
      }
    }
    bd.setParty(side, ((g.brought || {})[side] || []));
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) bd.switchIn(side, 'a', lead[0]);
    if (lead[1]) bd.switchIn(side, 'b', lead[1]);
  }
  return bd;
}

const aliveOf = (board, sd) => {
  let k = 0;
  for (const L of ['a', 'b']) { const m = board.slot(sd, L); if (m && !m.fainted) k++; }
  return k + board.bench(sd).length;
};
const hpOf = (board, sd) => {
  let h = 0;
  for (const L of ['a', 'b']) { const m = board.slot(sd, L); if (m && !m.fainted) h += (typeof m.hp === 'number' ? m.hp : 1); }
  return h + board.bench(sd).length;
};

const t0 = Date.now();
let gi = 0, noLabel = 0, nulls = 0;
let pairing = 'SKIPPED — SKIP_MID set';

/* THE RE-CUT BRANCH. Rows in, everything below the scoring section unchanged. `pairing` is restated
 * from the dump rather than re-asserted, because the two walks that produced it are not being run —
 * saying "PASSED" about a check this process did not perform is exactly the class of claim the
 * project's own rules forbid. */
if (RECUT) {
  const raw = fs.readFileSync(D(RECUT), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  for (const r of raw) { if (arms[r.arm]) arms[r.arm].rows.push(r); else { console.error(`unknown arm ${r.arm}`); process.exit(1); } }
  console.log(`  RE-CUT from ${RECUT}: ${raw.length.toLocaleString()} rows over ` +
              Object.entries(arms).map(([k, v]) => `${k}=${v.rows.length}`).join(' '));
  const nC = arms.C_mid_nosheet.rows.length, nD = arms.D_mid_sheet.rows.length;
  pairing = nC && nD && nC === nD
    ? `RE-CUT — the ${nD.toLocaleString()} paired mid-game rows are carried from the dump; the walk-vs-walk ` +
      'pairing check was performed by the original run and is not re-performed here.'
    : 'RE-CUT — no paired mid-game arms in this dump.';
}

for (const g of (RECUT ? [] : games)) {
  gi++;
  const y = labelOf(g);
  if (y === null) { noLabel++; continue; }
  const seed = gi * 7919;
  for (const [key, withSheet] of [['A_turn0_nosheet', false], ['B_turn0_sheet', true]]) {
    const bd = turn0Board(g, withSheet);
    const rr = RL.rolloutWinProb(bd, 'p1', { n: N, dex, seed, explore: EXPLORE, maxTurns: MAXTURNS });
    if (!rr) { nulls++; continue; }
    arms[key].rows.push({ gid: g.id, turn: 0, p: rr.p, y,
                          aliveDiff: aliveOf(bd, 'p1') - aliveOf(bd, 'p2'),
                          hpDiff: +(hpOf(bd, 'p1') - hpOf(bd, 'p2')).toFixed(6) });
  }
}
if (!RECUT) console.log(`  turn 0: ${arms.A_turn0_nosheet.rows.length} games scored ` +
            `(${noLabel} unlabelled, ${nulls} unbuildable) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

/* ARM E — THE CORPUS, HELD ALONE. Same position policy as A, same config, same release; the only
 * thing that moves is which store the games came from. loadGames() is the ONE definition of a usable
 * game (engine/quality.js) and is what backtest_winrate.js reads. Sorted by date and the SAME
 * held-out newest fifth the backtest scores, so the comparison is against the number it published
 * rather than against a different slice of the same store.
 *
 * The bring/label predicate is backtest_winrate.js:99-110 exactly — brought four with the six as a
 * fallback, at least three a side, a winner matching one of the two names. */
const LADDER_GAMES = parseInt(process.env.LADDER_GAMES || String(GAMES), 10);
if (LADDER_GAMES > 0 && !RECUT) {
  /* THE LIVE quality.js, not the release's — it resolves the 166 MB store relative to its own
   * __dirname and a release does not freeze the store (nor should it). Same class as fit_policy and
   * joint_rows: it is the HARNESS, it decides which games are sampled, and its digest is recorded
   * under harness_digests. The release's copy is byte-identical at load time or the drift guard
   * above would have refused to run. */
  const Q = require('./quality.js');
  const clean = Q.loadGames().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const SPLIT = Math.floor(clean.length * 0.8);
  const held = [];
  for (let i = SPLIT; i < clean.length; i++) {
    const g = clean[i];
    const br = g.brought || {};
    const p1 = (br.p1 || (g.six && g.six.p1) || []).filter(Boolean);
    const p2 = (br.p2 || (g.six && g.six.p2) || []).filter(Boolean);
    if (p1.length < 3 || p2.length < 3) continue;
    if (labelOf(g) === null) continue;
    held.push({ g, p1, p2, gi: i });
  }
  /* EVERY k-th, not the first k: the held-out fifth is date-ordered, so a prefix is the oldest end
   * of it. Thinning keeps the date span. Unset LADDER_GAMES=0 to skip the arm entirely. */
  const step = Math.max(1, Math.ceil(held.length / LADDER_GAMES));
  const take = held.filter((_, i) => i % step === 0);
  for (const h of take) {
    const bd = new B.Board();
    bd.setParty('p1', h.p1); bd.setParty('p2', h.p2);
    const lead = h.g.lead || {};
    const L1 = (lead.p1 && lead.p1.length ? lead.p1 : h.p1).slice(0, 2);
    const L2 = (lead.p2 && lead.p2.length ? lead.p2 : h.p2).slice(0, 2);
    bd.switchIn('p1', 'a', L1[0]); if (L1[1]) bd.switchIn('p1', 'b', L1[1]);
    bd.switchIn('p2', 'a', L2[0]); if (L2[1]) bd.switchIn('p2', 'b', L2[1]);
    const rr = RL.rolloutWinProb(bd, 'p1', { n: N, dex, seed: h.gi * 7919 + 13, explore: EXPLORE, maxTurns: MAXTURNS });
    if (!rr) { nulls++; continue; }
    arms.E_turn0_nosheet_ladder.rows.push({ gid: h.g.id, turn: 0, p: rr.p, y: labelOf(h.g),
                                            aliveDiff: 0, hpDiff: 0 });
  }
  console.log(`  ladder turn 0: ${arms.E_turn0_nosheet_ladder.rows.length} of ${held.length.toLocaleString()} ` +
              `held-out scorable games (every ${step}th) in ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
}

/* MID-GAME. Two passes of the SAME walk over the SAME games. The second disables setSheet at the
 * prototype, which is the only channel by which a sheet reaches the board; the walk's own board
 * mutation (hp, status, faints, weather, field) comes off the replay events and its candidate lists
 * come from click_match.sheetIndex, so the emitted POSITIONS must be identical. Asserted below. */
function walk(tag) {
  const out = [];
  let sampled = 0;
  JR.build(games, dex, {
    topK: 3, w1, maxGames: games.length,
    onRow: () => {},
    onBoard: (board, g, _gi) => {
      sampled++;
      if (sampled % EVERY) return;
      const y = labelOf(g);
      if (y === null) return;
      const field = {
        weather: board.weather || '',
        terrain: RL.terrainOnBoard(board),
        tr: board.hasField(GAME_RULES.trickRoomKey) ? GAME_RULES.trickRoomTurns : 0,
        twA: board.hasSide('p1', GAME_RULES.tailwindKey) ? GAME_RULES.tailwindTurns : 0,
        twB: board.hasSide('p2', GAME_RULES.tailwindKey) ? GAME_RULES.tailwindTurns : 0,
      };
      const rr = RL.rolloutWinProb(board, 'p1', { n: N, dex, seed: _gi * 7919 + sampled, field,
                                                 explore: EXPLORE, maxTurns: MAXTURNS });
      if (!rr) { nulls++; return; }
      out.push({ gid: g.id, turn: board.turn, p: rr.p, y,
                 aliveDiff: aliveOf(board, 'p1') - aliveOf(board, 'p2'),
                 hpDiff: +(hpOf(board, 'p1') - hpOf(board, 'p2')).toFixed(6) });
    },
  });
  console.log(`  mid-game [${tag}]: ${out.length} positions in ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
  return out;
}

if (!SKIP_MID && !RECUT) {
  arms.D_mid_sheet.rows = walk('sheet');
  const realSetSheet = B.Board.prototype.setSheet;
  B.Board.prototype.setSheet = function () { /* suppressed for the no-sheet arm */ };
  try { arms.C_mid_nosheet.rows = walk('no sheet'); }
  finally { B.Board.prototype.setSheet = realSetSheet; }

  /* THE PAIRING CHECK, not an assumption. Two walks are two walks until something says the rows
   * line up. Same convention as the sweep's `pairing_check`. */
  const a = arms.D_mid_sheet.rows, b = arms.C_mid_nosheet.rows;
  if (a.length !== b.length) {
    console.error(`PAIRING FAILED: ${a.length} sheet positions vs ${b.length} no-sheet. Aborting.`);
    process.exit(3);
  }
  let bad = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i].gid !== b[i].gid || a[i].turn !== b[i].turn || a[i].y !== b[i].y ||
        a[i].aliveDiff !== b[i].aliveDiff || Math.abs(a[i].hpDiff - b[i].hpDiff) > 1e-6) bad++;
  }
  if (bad) {
    console.error(`PAIRING FAILED: ${bad} of ${a.length} rows disagree on gid/turn/label/material. Aborting.`);
    process.exit(3);
  }
  pairing = `PASSED — all ${a.length.toLocaleString()} positions agree across the two walks on gid, turn, ` +
            'label, aliveDiff and the continuous HP witness. Suppressing the sheet changed what the leaf ' +
            'KNOWS and did not change which boards were scored.';
  console.log('  ' + pairing.split(' —')[0]);
}

/* ---- SCORING ----------------------------------------------------------------------------------
 * BOTH accuracy definitions on every arm, because the two artifacts use different ones and a
 * difference in metric must not be allowed to masquerade as a difference in leaf.
 *
 *   acc_all       p >= 0.5 counts as a p1 call, every row scored. The sweep's definition. Its null
 *                 is the MAJORITY CLASS, not 0.5 — a tie-break toward p1 on a sample that is 52.5%
 *                 p1 scores above a coin for free.
 *   acc_decisive  only |p - 0.5| > 0.02. The backtest's definition. Its null is 0.5. */
const EPS = 0.02;
const clamp = p => Math.max(EPS, Math.min(1 - EPS, p));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const r4 = x => x == null ? null : Math.round(x * 1e4) / 1e4;

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* CLUSTERED BY GAME. Mid-game rows are ~3.7 positions from one game and they share an outcome, so
 * an unclustered interval on them is too narrow by roughly sqrt(3.7). The bootstrap resamples GAMES,
 * which is the independent unit; at turn 0 each game is one row and it degenerates to the ordinary
 * bootstrap, so the two arms stay comparable. */
function clusterBootstrap(rows, stat, iters) {
  const byGame = new Map();
  for (const r of rows) { if (!byGame.has(r.gid)) byGame.set(r.gid, []); byGame.get(r.gid).push(r); }
  const clusters = [...byGame.values()];
  const rng = mulberry(20260805);
  const bs = [];
  for (let it = 0; it < (iters || 1000); it++) {
    const samp = [];
    for (let i = 0; i < clusters.length; i++) samp.push(...clusters[(Math.floor(rng() * clusters.length)) % clusters.length]);
    const v = stat(samp);
    if (v != null && isFinite(v)) bs.push(v);
  }
  bs.sort((x, y) => x - y);
  return bs.length ? [r4(bs[Math.floor(0.025 * bs.length)]), r4(bs[Math.floor(0.975 * bs.length)])] : [null, null];
}

const accAll = rs => rs.length ? rs.filter(r => (r.p >= 0.5) === (r.y === 1)).length / rs.length : null;
const accDec = rs => {
  const d = rs.filter(r => Math.abs(r.p - 0.5) > EPS);
  return d.length ? d.filter(r => (r.p > 0.5) === (r.y === 1)).length / d.length : null;
};
const brierOf = rs => mean(rs.map(r => (r.p - r.y) * (r.p - r.y)));
const llOf = rs => mean(rs.map(r => -(r.y * Math.log(clamp(r.p)) + (1 - r.y) * Math.log(1 - clamp(r.p)))));

function reliability(rs) {
  const out = [];
  for (let b = 0; b < 10; b++) {
    const lo = b / 10, hi = (b + 1) / 10;
    const idx = rs.filter(r => r.p >= lo && (b === 9 ? r.p <= hi : r.p < hi));
    if (!idx.length) { out.push({ bin: `${(10 * lo).toFixed(0)}-${(10 * hi).toFixed(0)}0%`, n: 0 }); continue; }
    const wins = idx.reduce((s, r) => s + r.y, 0);
    const iv = RL.wilson(wins, idx.length);
    out.push({ bin: `${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}%`, n: idx.length,
               predicted: r4(mean(idx.map(r => r.p))), observed: r4(wins / idx.length),
               observed_ci95: [r4(iv.lo), r4(iv.hi)] });
  }
  return out;
}

/* THE SLOPE IS THE NUMBER THE CONTRADICTION IS ABOUT. ECE measures distance from the diagonal and a
 * FLAT curve at the base rate can have a smaller ECE than a steep one that is merely overconfident —
 * which is how "0.1811 vs 0.0927" understates what separates these two artifacts. The slope of
 * observed-on-predicted is discrimination in the same units as the curve: 1.0 is perfect, 0.0 is a
 * curve that carries no information whatever the confidence says. Weighted by bin count. */
function curveSlope(rel) {
  const b = rel.filter(x => x.n > 0);
  const W = b.reduce((s, x) => s + x.n, 0);
  const mx = b.reduce((s, x) => s + x.n * x.predicted, 0) / W;
  const my = b.reduce((s, x) => s + x.n * x.observed, 0) / W;
  const num = b.reduce((s, x) => s + x.n * (x.predicted - mx) * (x.observed - my), 0);
  const den = b.reduce((s, x) => s + x.n * (x.predicted - mx) * (x.predicted - mx), 0);
  return den > 0 ? num / den : null;
}

function evaluate(rows) {
  if (!rows.length) return null;
  const rel = reliability(rows);
  const N_ = rows.length;
  const filled = rel.filter(b => b.n > 0);
  const ece = filled.reduce((s, b) => s + b.n * Math.abs(b.observed - b.predicted), 0) / N_;
  const conf = filled.filter(b => b.n >= 30);
  const base = mean(rows.map(r => r.y));
  const dec = rows.filter(r => Math.abs(r.p - 0.5) > EPS).length;
  /* NOISE FLOOR (LESSONS 9). The arm split in half BY GAME, so the halves are independent the same
   * way the bootstrap's clusters are. An effect smaller than this spread is not an effect. */
  const gids = [...new Set(rows.map(r => r.gid))];
  const h = new Set(gids.slice(0, Math.floor(gids.length / 2)));
  const h1 = rows.filter(r => h.has(r.gid)), h2 = rows.filter(r => !h.has(r.gid));
  return {
    n: N_, n_games: gids.length,
    base_rate_p1_wins: r4(base),
    majority_class_pct: r4(100 * Math.max(base, 1 - base)),
    acc_all_pct: r4(100 * accAll(rows)),
    acc_all_ci95_pts: clusterBootstrap(rows, rs => 100 * accAll(rs)),
    decisive_calls: dec,
    acc_decisive_pct: r4(100 * accDec(rows)),
    acc_decisive_ci95_pts: clusterBootstrap(rows, rs => 100 * accDec(rs)),
    brier: r4(brierOf(rows)),
    brier_vs_coin_paired: r4(brierOf(rows) - 0.25),
    brier_vs_coin_ci95: clusterBootstrap(rows, rs => brierOf(rs) - 0.25),
    logloss: r4(llOf(rows)),
    ece: r4(ece),
    mce_bins_over_30: conf.length ? r4(Math.max(...conf.map(b => Math.abs(b.observed - b.predicted)))) : null,
    saturated_share: r4((rel[0].n + rel[9].n) / N_),
    curve_slope: r4(curveSlope(rel)),
    reliability_curve: rel,
    noise_floor: {
      split_half_by_game_acc_all: [r4(100 * accAll(h1)), r4(100 * accAll(h2))],
      spread_pts: r4(Math.abs(100 * accAll(h1) - 100 * accAll(h2))),
      note: 'one arm split in half BY GAME. A difference smaller than this spread is not an effect.',
    },
  };
}

/* PAIRED CONTRASTS. Every pair below is scored on IDENTICAL rows, so the information is in the
 * per-row difference and McNemar/the clustered bootstrap are the right instruments. Unpaired
 * comparisons across arms with different n are reported as differences of point estimates and
 * labelled as such. */
function pairedContrast(name, rowsX, rowsY, what) {
  if (!rowsX.length || !rowsY.length || rowsX.length !== rowsY.length) return null;
  const d = rowsX.map((r, i) => ({ gid: r.gid, y: r.y, px: r.p, py: rowsY[i].p }));
  let b = 0, c = 0;
  for (const r of d) {
    const rx = (r.px >= 0.5) === (r.y === 1), ry = (r.py >= 0.5) === (r.y === 1);
    if (rx && !ry) b++; else if (!rx && ry) c++;
  }
  const diff = 100 * (d.filter(r => (r.px >= 0.5) === (r.y === 1)).length -
                      d.filter(r => (r.py >= 0.5) === (r.y === 1)).length) / d.length;
  const half = (b + c) ? 100 * 1.96 * Math.sqrt(b + c) / d.length : 0;
  return { contrast: name, what, n: d.length,
           acc_diff_pts: r4(diff), ci95_pts: [r4(diff - half), r4(diff + half)],
           mcnemar_x_only_right: b, mcnemar_y_only_right: c,
           brier_diff: r4(mean(d.map(r => (r.px - r.y) ** 2 - (r.py - r.y) ** 2))),
           method: 'McNemar sign test on discordant rows; half-width 1.96*sqrt(b+c)/n in points. ' +
                   'The two arms scored the SAME boards with the SAME seeds.' };
}

const results = {};
for (const [k, v] of Object.entries(arms)) results[k] = v.rows.length ? Object.assign({ what: v.what }, evaluate(v.rows)) : { what: v.what, not_run: true };

/* THE SUBSETS THAT INTERPOLATE BETWEEN THE TWO ARTIFACTS. A turn-0 board has aliveDiff 0 and
 * hpDiff 0 by construction, so the mid-game arm restricted to material-symmetric boards is the
 * nearest mid-game position to a preview position, and the gap that SURVIVES that restriction is
 * the part material cannot explain. */
const subsets = {};
if (arms.D_mid_sheet.rows.length) {
  const defs = {
    'aliveDiff==0': r => r.aliveDiff === 0,
    'aliveDiff==0 AND |hpDiff|<0.10': r => r.aliveDiff === 0 && Math.abs(r.hpDiff) < 0.10,
    'aliveDiff==0 AND |hpDiff|<0.02 — a turn-0 board in all but name': r => r.aliveDiff === 0 && Math.abs(r.hpDiff) < 0.02,
    'turn <= 1': r => r.turn <= 1,
    'turn <= 2': r => r.turn <= 2,
    'turn <= 1 AND aliveDiff==0 AND |hpDiff|<0.02': r => r.turn <= 1 && r.aliveDiff === 0 && Math.abs(r.hpDiff) < 0.02,
  };
  for (const [nm, f] of Object.entries(defs)) {
    subsets[nm] = {
      D_mid_sheet: evaluate(arms.D_mid_sheet.rows.filter(f)),
      C_mid_nosheet: evaluate(arms.C_mid_nosheet.rows.filter(f)),
    };
  }
}

const contrasts = [
  pairedContrast('B - A', arms.B_turn0_sheet.rows, arms.A_turn0_nosheet.rows,
    'THE SHEET CHANNEL AT TURN 0. Same boards, same seeds; the only difference is whether the leaf ' +
    'was told the declared nature/item/ability/moves.'),
  pairedContrast('D - C', arms.D_mid_sheet.rows, arms.C_mid_nosheet.rows,
    'THE SHEET CHANNEL MID-GAME. Same boards from two walks, pairing asserted row by row.'),
].filter(Boolean);

const sha12 = rel => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(D(rel))).digest('hex').slice(0, 12); }
  catch (e) { console.error('  digest: ' + rel + ' unreadable: ' + ((e && e.message) || e)); return 'MISSING'; }
};

const out = Object.assign({
  generated: new Date().toISOString(),
  by: 'engine/leaf_position_contrast.js',
  question: 'data/winrate-backtest.json and data/rollout-r1-explore-sweep.json describe the same leaf ' +
            'and disagree about whether it can rank. Which of the six differences between them carries the gap?',
  config: { n_rollouts: N, explore: EXPLORE, max_turns: MAXTURNS, every_nth_turn: EVERY,
            games_requested: RECUT ? null : GAMES, corpus_games_available: RECUT ? null : allGames.length,
            ladder_games_requested: RECUT ? null : LADDER_GAMES,
            corpus: 'engine/fit_policy.js loadCorpus() — clean OPEN-SHEET games from games.bo3.jsonl, ' +
                    'games.ots.jsonl and the ~1% of games.ladder.jsonl carrying sheets',
            note: 'ONE config across all four arms. The two artifacts differ in n (200 vs 40) and horizon ' +
                  '(60 vs 20); both were separately measured not to move the answer — MEASURE ruled out ' +
                  'the budget at turn 0, and the sweep re-ran itself at h=60 (69.86% vs 69.84%).' },
  pairing_check: pairing,
  results,
  contrasts,
  material_symmetric_subsets: subsets,
  runtime_seconds: Math.round((Date.now() - t0) / 1000),
}, REL.stamp(), {
  /* EVERY KEY IN HERE IS A PATH, AND NOTHING ELSE.
   *
   * engine/provenance.js:648 walks this map and calls digestOf() on each KEY; a key that is not a
   * readable file makes the whole artifact `unverifiable` with "stamped input note cannot be read to
   * verify". engine/rollout_r1.js:436 puts a prose `note` in here and so did the first version of
   * this file, which is why data/rollout-r1-explore-sweep.json cannot be digest-verified either.
   * The prose lives beside the map, not inside it. Filed for SEARCH — rollout_r1.js is theirs. */
  source_digests: Object.assign({}, REL.stamp().source_digests, {
    'engine/leaf_position_contrast.js': sha12('engine/leaf_position_contrast.js'),
  }),
  source_digests_note: 'Frozen-release digests plus the generator. Content, not mtime. Every key is a path.',
  harness_digests: {
    'engine/joint_rows.js': sha12('engine/joint_rows.js'),
    'engine/fit_policy.js': sha12('engine/fit_policy.js'),
    'engine/quality.js': sha12('engine/quality.js'),
  },
  harness_digests_note: 'Loaded LIVE — they choose which positions are sampled, not what a rollout is ' +
    'worth. Informational, not verified by provenance.',
  recut: RECUT ? { from_rows: RECUT, note: 'Rebuilt from a committed row dump. No rollouts were run; ' +
    'every figure above is a re-aggregation of the same per-position predictions.' } : null,
});

fs.writeFileSync(D(OUT), JSON.stringify(out, null, 2) + '\n');

/* THE ROWS, DUMPED. Not optional and not a convenience.
 *
 * The R1 retraction (docs/MEASURE.md §3) happened because a run four accuracy points from its
 * successor left no per-position evidence, so two runs were byte-indistinguishable and the published
 * figure could not be recomputed by anyone. Every subset in this artifact is a filter over these
 * rows; anyone who wants a different cut — a different turn threshold, a different material window,
 * a different accuracy definition — re-cuts them in seconds instead of re-running the rollouts.
 * The filename carries the release id for the same reason engine/rollout_r1.js's dumps now do.
 *
 * A RE-CUT NEVER REWRITES THE DUMP IT READ. Re-serialising the same rows adds nothing, and a bug in
 * the arm split would silently truncate the only evidence — the DUMP=rollout-r1-rows.jsonl hazard
 * docs/MEASURE.md §3 records, pointed the other way. */
if (!RECUT) {
  const ROWS = OUT.replace(/\.json$/, '') + '-rows-' + REL.id + '.jsonl';
  fs.writeFileSync(D(ROWS), Object.entries(arms).flatMap(([k, v]) =>
    v.rows.map(r => JSON.stringify(Object.assign({ arm: k }, r)))).join('\n') + '\n');
  console.log(`  wrote ${ROWS}`);
}

/* ---- REPORT -----------------------------------------------------------------------------------*/
const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);
console.log('\n  arm                     n     games   maj%   accAll%   accDec%    Brier     ECE   slope');
console.log('  ' + '-'.repeat(84));
for (const [k, v] of Object.entries(results)) {
  if (v.not_run) { console.log('  ' + pad(k, 20) + '  NOT RUN'); continue; }
  console.log('  ' + pad(k, 20) + padl(v.n, 7) + padl(v.n_games, 8) + padl(v.majority_class_pct.toFixed(1), 7) +
    padl(v.acc_all_pct.toFixed(2), 10) + padl(v.acc_decisive_pct == null ? '-' : v.acc_decisive_pct.toFixed(2), 10) +
    padl(v.brier.toFixed(4), 9) + padl(v.ece.toFixed(4), 8) + padl(v.curve_slope == null ? '-' : v.curve_slope.toFixed(3), 8));
}
console.log('\n  reliability curves (observed win rate per predicted bin)');
for (const [k, v] of Object.entries(results)) {
  if (v.not_run) continue;
  console.log('  ' + pad(k, 20) + v.reliability_curve.map(b => b.n ? b.observed.toFixed(2) : ' -- ').join(' '));
}
console.log('\n  PAIRED CONTRASTS');
for (const c of contrasts) {
  console.log(`  ${c.contrast}  n=${c.n.toLocaleString()}  accuracy ${c.acc_diff_pts >= 0 ? '+' : ''}${c.acc_diff_pts} pts ` +
    `(95% CI ${c.ci95_pts.join(' to ')})  Brier ${c.brier_diff >= 0 ? '+' : ''}${c.brier_diff}`);
}
for (const [nm, s] of Object.entries(subsets)) {
  if (!s.D_mid_sheet) continue;
  console.log(`\n  SUBSET ${nm}`);
  for (const [k, v] of Object.entries(s)) {
    if (!v) continue;
    console.log(`    ${pad(k, 16)} n=${padl(v.n, 6)}  maj ${v.majority_class_pct.toFixed(1)}%  accAll ${v.acc_all_pct.toFixed(2)}%  ` +
      `ECE ${v.ece.toFixed(4)}  slope ${v.curve_slope == null ? '-' : v.curve_slope.toFixed(3)}`);
  }
}
console.log(`\n  wrote ${OUT}`);
