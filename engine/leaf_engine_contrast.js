/* leaf_engine_contrast.js — DOES A MORE CORRECT ENGINE MAKE BETTER PREDICTIONS?
 *
 *   SHOWDOWN_PATH=... node engine/leaf_engine_contrast.js --write
 *   ... --games 1200          a smaller sample (the artifact records the n it actually scored)
 *   ... --shards 6            processes per arm; six is the project cap and RAM is the real one
 *   ... --skip-depth          the leaf contrast only
 *
 * ================= THE QUESTION ===================================================================
 *
 * Ten WIRE rungs landed on 2026-08-06/07 and made MEDICHAM measurably more CORRECT: the mechanics
 * census went 234/235 -> 270/271, the differential's median first-divergence LINE went 13 -> 19, and
 * 33 spread moves carrying 56,524 corpus uses stopped dealing zero damage. The median completed TURN
 * before divergence never moved off 1, at any of the ten rungs.
 *
 * Two instruments therefore disagree about whether the night was a win, and NOBODY HAS EVER MEASURED
 * WHICH ONE PREDICTS THE THING THE ENGINE EXISTS TO SERVE. Every MILTANK decision is an argmax over
 * the rollout leaf, so the leaf is the only instrument whose reading is the project's own objective.
 *
 * This file asks it directly. The SAME positions, the SAME seeds, the SAME rollout budget, scored
 * through TWO FROZEN RELEASES that differ in exactly one file:
 *
 *     BASELINE  cf6a68fa412c   pre-WIRE-1
 *     TOP       dc3c43336539   WIRE 10
 *
 * and then joins per position to the differential's own divergence depth, in lines AND in turns, so
 * the fork can be decided rather than argued:
 *
 *   - line depth predicts leaf error and turn depth does not  ->  the night was a win and line depth
 *     is the right instrument;
 *   - NEITHER predicts it  ->  engine correctness is not what limits the leaf, and ten rungs fixed
 *     something that was not the bottleneck. That is the more important result and it must be said
 *     plainly rather than softened.
 *
 * ================= WHAT THIS FILE DOES NOT DO =====================================================
 *
 * IT DOES NOT SCORE. `engine/leaf_scoring.js` computes every Brier, log-loss, interval, reliability
 * bucket, ECE and noise floor here, and it is VERIFIED against the published `data/winrate-backtest.json`
 * by replaying that artifact's own committed rows — 749 scalars, exact. `engine/game_differential.js`
 * plays every fidelity game and decides every divergence. Nothing here reimplements a rule either of
 * them owns; `status.js` shelling out to `provenance.js` is the same move, and CLAUDE.md's account of
 * `buildMon("Scizor")` is what happens when it is not made.
 *
 * IT DOES NOT READ THE LIVE ENGINE. Both arms load medicham2, board, rollout_leaf and every data file
 * out of `data/releases/<id>/`. The live tree may move under this run and the numbers are unaffected,
 * which is the whole reason `engine/engine_release.js` exists.
 *
 * IT DOES NOT FIT, CUT A RELEASE, OR RUN GIT. A `--release` is always passed to game_differential, so
 * its `if (!REL_ID) ER.cut(...)` branch is never taken: this measurement must not append a cut event
 * describing a tree it did not freeze.
 *
 * ================= THE THREE THINGS THAT DECIDE WHETHER THE ANSWER IS READABLE ====================
 *
 * 1. THE CORPUS IS PHOTOGRAPHED ONCE, IN THE PARENT. `data/games.ladder.jsonl` is append-only and OPS
 *    writes to it hourly; the 2026-08-04 backtest had 53 clean games land between its own two reads of
 *    the store. The parent loads it once, writes an explicit positions file, digests it, and every arm
 *    reads that file. An arm never touches the store.
 *
 * 2. THE DEPTH INSTRUMENT IS STATEFUL AND THAT IS MEASURED, NOT ASSUMED AWAY. game_differential's
 *    driver is coverage-seeking: `CLICKS` and `COV_HITS` carry across games on purpose, so a game's
 *    divergence depth is a function of the position AND of everything played before it. Both arms
 *    traverse the identical order, so the CONTRAST is paired — but the per-position depth used in the
 *    correlation carries driver history as noise, and noise in a predictor attenuates a correlation
 *    toward zero. A REVERSED-ORDER control arm re-measures the baseline depth with the position order
 *    reversed inside each shard; the correlation between the two readings is this instrument's own
 *    reliability, and it is the ceiling on any correlation reported below. Publishing a null without it
 *    would be publishing "my ruler cannot see it" as "there is nothing there".
 *
 * 3. THE POWER IS STATED BEFORE THE RUN AND THE PAIRED SD IS STATED AFTER IT. Two engines scored on
 *    identical positions with identical seeds are highly correlated, so the sd of their per-game
 *    DIFFERENCE is what decides whether this comparison can see anything — not the sample size alone.
 *    There is no prior for that sd, so the vs-coin MDE is computed before the run from the published
 *    prior effect, and the paired MDE is computed from the run's own observed sd and labelled as such.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);

const BASELINE_REL = flag('--baseline-release', 'cf6a68fa412c');
const TOP_REL = flag('--top-release', 'dc3c43336539');
const CENSUS = flag('--census', 'data/wire-ladder-census.pin.json');
const SHARDS = +flag('--shards', 6);
const MAXG = +flag('--games', 0);
const WRITE = has('--write');
const SKIP_DEPTH = has('--skip-depth');
const DIFF_TURNS = +flag('--diff-turns', 12);

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}

const ER = require('./engine_release.js');
const sha12 = ER.sha12;

/* ==================================================================================================
 *  THE ARMS — each runs in its own process so two engines can never share a module cache
 *
 *  `data/engine-data.js` installs `globalThis.MC`. Requiring two releases' copies inside ONE process
 *  would have the second overwrite the first's globals, and medicham2 reads MC lazily — so an arm
 *  could silently score against the other arm's damage table and nothing would report a failure. That
 *  is this project's signature shape and it is removed by construction rather than reasoned about.
 * ================================================================================================== */

function readPositions(file, shard, shards, reverse) {
  const all = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const mine = all.filter((_, i) => i % shards === shard);
  return reverse ? mine.reverse() : mine;
}

/* ---- ARM 1: THE LEAF ---------------------------------------------------------------------------
 * MILTANK's in-game leaf, at MILTANK's own budget, on the brought four a side with the real leads.
 * No sheets are set: `g.sets` in the store is OBSERVED play from the whole replay, so feeding it in
 * would leak the game's own future into the prediction of its outcome, and the closed-sheet ladder is
 * what the bot actually plays under. Same reasoning, same words, as backtest_winrate.js. */
if (has('--leaf-arm')) {
  const rel = flag('--release', null);
  const REL = ER.open(rel);
  REL.require('data/engine-data.js');
  const B = REL.require('engine/board.js');
  const RL = REL.require('engine/rollout_leaf.js');
  const CS = require('./champions_sim.js');
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const N = +flag('--rollouts', 200);
  const EXPLORE = +flag('--explore', 1.0);
  const TURNS = +flag('--horizon', 60);
  const FOE = flag('--foe-policy', 'uniform');
  const rows = readPositions(flag('--positions', null), +flag('--shard', 0), +flag('--shards', 1), false);
  const out = [];
  const t0 = Date.now();
  for (const r of rows) {
    const bd = new B.Board();
    bd.setParty('p1', r.p1); bd.setParty('p2', r.p2);
    bd.switchIn('p1', 'a', r.L1[0]); if (r.L1[1]) bd.switchIn('p1', 'b', r.L1[1]);
    bd.switchIn('p2', 'a', r.L2[0]); if (r.L2[1]) bd.switchIn('p2', 'b', r.L2[1]);
    /* THE SEED IS THE POSITION'S, NOT THE ARM'S. Both engines therefore draw the same playout seeds
     * at the same position, so a difference between the arms is the engine and not the dice. */
    const rr = RL.rolloutWinProb(bd, 'p1', { n: N, dex, seed: r.seed, explore: EXPLORE,
                                             foePolicy: FOE, maxTurns: TURNS });
    out.push({ id: r.id, p: rr ? rr.p : null });
  }
  fs.writeFileSync(flag('--out', null), out.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.error('    leaf shard ' + flag('--shard', 0) + ' rel ' + rel + ': ' + out.length + ' positions, '
    + ((Date.now() - t0) / 1000).toFixed(0) + 's, peak rss '
    + (process.memoryUsage().rss / 1048576).toFixed(0) + ' MB');
  return;
}

/* ---- ARM 2: THE FIDELITY DEPTH -----------------------------------------------------------------
 * The SAME position, played through medicham2 and through the official simulator with every die
 * pinned, and the FIRST protocol divergence recorded — in reduced-stream lines and in completed turns.
 *
 * THE BODIES ARE THE ONES THE LEAF ROLLS OUT, and that is the join that makes the correlation mean
 * anything. The store records which four were brought and nothing about their sets; the leaf builds
 * each of them through `medicham2.buildMon`, which fills the dataset's modal moves, item and ability.
 * So the sheet handed to `buildPair` is read back off `buildMon` rather than off `g.sets` — the
 * question is "how wrong is the engine about the bodies this position's leaf is simulating", and any
 * other set would be measuring fidelity on a board the leaf never sees.
 *
 * `game_differential.js` reads `--release`, `--census` and `--turns` off argv when it is required, so
 * this arm passes them and inherits the pin, the semantic normaliser, the equivalence proofs and the
 * classification without reimplementing any of them. */
if (has('--depth-arm')) {
  const rel = flag('--release', null);
  process.argv.push('--release', rel, '--census', CENSUS, '--turns', String(DIFF_TURNS), '--games', '9');
  const GD = require('./game_differential.js');
  const REL = GD.REL;
  const M = REL.require('engine/medicham2-browser.js');
  const { mcKey } = REL.require('engine/mc_key.js');
  /* mayMiss: this arm keeps only bodies the damage engine has a row for, exactly as the leaf does. */
  const MAY = { mayMiss: 'leaf_engine_contrast keeps only mons the damage engine has a row for' };
  const sheet = names => {
    const out = [];
    for (const s of names) {
      const k = mcKey(s, MAY); if (!k) continue;
      const b = M.buildMon(k, {}); if (!b) continue;
      out.push({ species: k, item: b.item || '', ability: b.ability || '', moves: (b.moves || []).slice() });
    }
    return out;
  };
  const rows = readPositions(flag('--positions', null), +flag('--shard', 0), +flag('--shards', 1), has('--reverse'));
  const out = [];
  const t0 = Date.now();
  for (const r of rows) {
    const a = GD.buildPair(sheet(r.p1)), b = GD.buildPair(sheet(r.p2));
    /* `buildPair` needs FOUR buildable bodies. A position whose bring was three deep, or whose fourth
     * body has no dex row, gets NO READING — `ok: false`. That is a different event from a game that
     * played and never parted, which is `ok: true, diverged: false` and is the BEST fidelity outcome
     * available. Collapsing the two into one null is what would let the best reading and the absent
     * reading average together. */
    if (!a || !b) { out.push({ id: r.id, ok: false, why: 'fewer than four buildable bodies a side' }); continue; }
    let g;
    try { g = GD.playGame(a, b, 'baseline', 'leaf-contrast/' + r.id); }
    catch (e) { out.push({ id: r.id, ok: false, why: 'threw: ' + String((e && e.message) || e).slice(0, 90) }); continue; }
    out.push({ id: r.id, ok: true, depth: g.div ? g.div.index : null, diverged: !!g.div,
               turns: g.turns, lines: g.lines, err: g.err || null });
  }
  fs.writeFileSync(flag('--out', null), out.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.error('    depth shard ' + flag('--shard', 0) + ' rel ' + rel + (has('--reverse') ? ' REVERSED' : '')
    + ': ' + out.length + ' positions, ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  return;
}

/* ==================================================================================================
 *  THE PARENT
 * ================================================================================================== */
const LS = require('./leaf_scoring.js');
const RS = require('./run_stamp.js');
const { loadGames } = require('./quality.js');
const { DEFAULTS } = require('./miltank.js');           // the LIVE search config, not retyped

/* ---- THE TWO RELEASES, AND THE CLAIM THAT THEY DIFFER IN ONE THING ------------------------------
 * A contrast between two releases is only attributable to the engine if the engine is the only thing
 * that changed. `open()` verifies each snapshot has not rotted; this asserts the manifests differ in
 * exactly the files it is prepared to name, and REFUSES rather than reporting a confounded number. */
const RA = ER.open(BASELINE_REL), RB = ER.open(TOP_REL);
const MA = RA.manifest.files, MB = RB.manifest.files;
const DIFFERS = Object.keys(MA).filter(k => MA[k] !== MB[k]);
const EXPECTED_DIFF = ['engine/medicham2-browser.js'];
if (DIFFERS.length !== EXPECTED_DIFF.length || DIFFERS.some(f => !EXPECTED_DIFF.includes(f))) {
  console.error('THE TWO RELEASES DIFFER IN MORE THAN THE SIMULATOR: ' + DIFFERS.join(', '));
  console.error('  A leaf difference could then be the weights, the damage table or the board. Refusing.');
  process.exit(3);
}
if (RA.manifest.showdown_commit !== RB.manifest.showdown_commit) {
  console.error('THE TWO RELEASES NAME DIFFERENT SHOWDOWN COMMITS — the fidelity arm would be scored '
    + 'against two different reference engines. Refusing.');
  process.exit(3);
}

/* ---- THE SCORER PROVES ITSELF BEFORE IT SCORES ANYTHING ----------------------------------------- */
let SCORER_OK = false, SCORER_SAYS = '';
try {
  SCORER_SAYS = execFileSync(process.execPath, ['engine/leaf_scoring.js', '--verify'],
    { cwd: D(), encoding: 'utf8' }).trim();
  SCORER_OK = /ALL MATCH/.test(SCORER_SAYS);
} catch (e) {
  /* ROADMAP #258 — the failure IS reported by the `if (!SCORER_OK)` block below, and this keeps the
   * child's own output so the reason survives; what was missing was any statement that the verifier
   * did not merely disagree, it did not RUN. */
  SCORER_SAYS = String((e && e.stdout) || '') + String((e && e.stderr) || '');
  console.error('  engine/leaf_scoring.js --verify DID NOT RUN TO COMPLETION — '
              + String((e && e.message) || e).split(String.fromCharCode(10))[0]
              + ' (this is not the same as it failing to match)');
}
if (!SCORER_OK) {
  console.error('engine/leaf_scoring.js does NOT reproduce the published data/winrate-backtest.json.\n'
    + 'Every number below would be computed by an unverified scorer. Refusing.\n' + SCORER_SAYS);
  process.exit(3);
}

/* ---- THE CORPUS, PHOTOGRAPHED ONCE -------------------------------------------------------------- */
console.log('\nLEAF vs ENGINE CORRECTNESS — two frozen releases, one sample, paired\n');
console.log('  BASELINE ' + BASELINE_REL + '  cut ' + RA.manifest.cut);
console.log('  TOP      ' + TOP_REL + '  cut ' + RB.manifest.cut);
console.log('  they differ in exactly: ' + DIFFERS.join(', ') + '  (' + MA[DIFFERS[0]] + ' -> ' + MB[DIFFERS[0]] + ')');
console.log('  scorer:  ' + SCORER_SAYS.split('\n').pop().trim());

/* ---- RESUME, AND WHY IT IS A CORRECTNESS FEATURE RATHER THAN A CONVENIENCE ----------------------
 *
 * The first full run of this file was killed by the harness at 65 minutes, after the baseline leaf arm
 * had finished all 8,883 positions and while the top arm was ~90% through. The six baseline shard
 * files were on disk and perfectly good. Re-running from scratch would have thrown them away — and,
 * worse, would have RE-DERIVED THE SAMPLE FROM A STORE THAT HAD GROWN IN THE MEANTIME, so the second
 * run's positions would not have been the first run's positions.
 *
 * So `--work <dir>` reuses the photograph. If `positions.jsonl` is already there it IS the sample:
 * the parent does not open the store at all, and `sample.json` beside it carries the corpus figures as
 * they stood when the photograph was taken. Re-deriving them from today's store would print a corpus
 * line describing a population the arms never scored, which is the exact shape of defect
 * `engine/provenance.js` exists to catch. */
const WORK = flag('--work', null) ? path.resolve(flag('--work', null))
                                  : fs.mkdtempSync(path.join(os.tmpdir(), 'abra-leaf-contrast-'));
fs.mkdirSync(WORK, { recursive: true });
const POS = path.join(WORK, 'positions.jsonl');
const SAMPLE_META = path.join(WORK, 'sample.json');
const RESUMED = fs.existsSync(POS) && fs.existsSync(SAMPLE_META);

let rows, clean_games, SPLIT_DATE, DATE_FIRST, DATE_LAST, noBring, noLabel;
if (RESUMED) {
  rows = fs.readFileSync(POS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const m = JSON.parse(fs.readFileSync(SAMPLE_META, 'utf8'));
  ({ clean_games, split_date: SPLIT_DATE, date_first: DATE_FIRST, date_last: DATE_LAST,
     dropped_no_bring: noBring, dropped_no_label: noLabel } = m);
  console.log('\n  RESUMED from ' + WORK + ' — the sample is the photograph taken at ' + m.taken_at
    + ', not today\'s store. Any arm whose shard files are already complete is reused.');
} else {
  const clean = loadGames().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const SPLIT = Math.floor(clean.length * 0.8);
  clean_games = clean.length;
  SPLIT_DATE = (clean[SPLIT] || {}).date || null;
  DATE_FIRST = (clean[0] || {}).date || null;
  DATE_LAST = (clean[clean.length - 1] || {}).date || null;
  noBring = 0; noLabel = 0; rows = [];
  for (let gi = 0; gi < clean.length; gi++) {
    const g = clean[gi];
    const br = g.brought || {};
    const p1 = (br.p1 || g.six?.p1 || []).filter(Boolean);
    const p2 = (br.p2 || g.six?.p2 || []).filter(Boolean);
    if (p1.length < 3 || p2.length < 3) { noBring++; continue; }
    const w = g.winner;
    const y = w && w === g.p1?.name ? 1 : (w && w === g.p2?.name ? 0 : null);
    if (y === null) { noLabel++; continue; }
    const lead = g.lead || {};
    rows.push({ id: g.id, gi, date: g.date, y, held: gi >= SPLIT,
                r1: g.p1?.rating || null, r2: g.p2?.rating || null,
                p1, p2,
                L1: (lead.p1 && lead.p1.length ? lead.p1 : p1).slice(0, 2),
                L2: (lead.p2 && lead.p2.length ? lead.p2 : p2).slice(0, 2),
                /* THE SAME SEED FORMULA `backtest_winrate.js` USES, so a position scored by both files
                 * draws the same playouts and the two artifacts are comparable rather than merely
                 * similarly named. */
                seed: gi * 7919 + 13 });
  }
  /* SMOKE ONLY. Takes every k-th row, which keeps the date span and the held/not-held mix rather than a
   * tail, and the artifact records the n it actually scored. */
  if (MAXG && rows.length > MAXG) {
    const step = Math.ceil(rows.length / MAXG);
    rows = rows.filter((_, i) => i % step === 0);
    console.log('  --games ' + MAXG + ': THINNED to ' + rows.length + ' — a smoke run, not a published number.');
  }
  fs.writeFileSync(POS, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(SAMPLE_META, JSON.stringify({ taken_at: new Date().toISOString(),
    clean_games, split_date: SPLIT_DATE, date_first: DATE_FIRST, date_last: DATE_LAST,
    dropped_no_bring: noBring, dropped_no_label: noLabel, n: rows.length, thinned_to: MAXG || null }, null, 2));
}
/* THE JOIN KEY MUST BE A KEY. Every arm returns {id, ...} and the parent joins on it; two positions
 * sharing an id would silently become one, and the store is append-only with a documented history of
 * duplicated rows (CHANGELOG 3.1.2, the `merge=union` incident). Checked rather than assumed. */
{
  const seen = new Set(), dup = [];
  for (const r of rows) { if (seen.has(r.id)) dup.push(r.id); seen.add(r.id); }
  if (dup.length) {
    console.error('THE SAMPLE CONTAINS ' + dup.length + ' DUPLICATE GAME IDS (' + dup.slice(0, 5).join(', ')
      + '...). Every arm joins on this key, so two positions would collapse into one. Refusing.');
    process.exit(3);
  }
}
const held = rows.filter(r => r.held);
const POS_DIGEST = crypto.createHash('sha256').update(fs.readFileSync(POS)).digest('hex').slice(0, 12);

console.log('\n  corpus: ' + clean_games.toLocaleString() + ' clean -> ' + rows.length.toLocaleString()
  + ' scorable (' + noBring + ' without a bring, ' + noLabel + ' without a labelled winner)');
console.log('  held-out newest fifth = ' + held.length.toLocaleString() + '   split at ' + SPLIT_DATE);
console.log('  positions file digest ' + POS_DIGEST + ' — every arm reads THIS, never the store');
console.log('  work dir ' + WORK);

/* ---- POWER, BEFORE THE RUN ---------------------------------------------------------------------- */
const PRIOR_EFFECT = 0.5263;
const POWER = {
  vs_coin: {
    test: 'two-sided binomial, H0: P(leaf names the eventual winner) = 0.5',
    alpha: 0.05, power: 0.80,
    prior_effect_used_for_sizing: PRIOR_EFFECT,
    prior_effect_source: 'data/winrate-backtest.json 2026-08-02: 0.5263 on 342 decisive calls',
    n_required_for_prior_effect: LS.nNeeded(PRIOR_EFFECT),
    n_available_full: rows.length, n_available_heldout: held.length,
    mde_full: +LS.mde(rows.length).toFixed(4), mde_heldout: +LS.mde(held.length).toFixed(4),
  },
  paired_engine_vs_engine: {
    test: 'paired two-sided t on the per-position Brier difference (TOP - BASELINE)',
    note: 'THE MDE FOR THIS CANNOT BE COMPUTED BEFORE THE RUN. Two engines on identical positions with '
        + 'identical seeds produce correlated predictions, and it is the sd of their DIFFERENCE that '
        + 'decides what is detectable. No prior for it exists, so it is reported from this run\'s own '
        + 'observed sd, below, and is labelled as observed rather than planned.',
  },
  correlation: {
    test: 'Spearman rho between per-position divergence depth and per-position Brier error',
    n_available: rows.length,
    se_normal_approx: +(1 / Math.sqrt(rows.length - 3)).toFixed(5),
    mde_at_80pct_power: +((1.959963985 + 0.8416212336) / Math.sqrt(rows.length - 3)).toFixed(5),
    note: 'attenuated by measurement error in the DEPTH, which the reversed-order control measures. '
        + 'The reported MDE is the ceiling; divide by the square root of the depth reliability for the '
        + 'true detectable effect.',
  },
};
console.log('\n  POWER (computed BEFORE the run, on the published prior effect, never on this one)');
console.log('    vs a coin: detecting ' + (100 * PRIOR_EFFECT).toFixed(2) + '% needs n='
  + POWER.vs_coin.n_required_for_prior_effect.toLocaleString()
  + '; n=' + rows.length.toLocaleString() + ' buys MDE ' + (100 * POWER.vs_coin.mde_full).toFixed(2) + '%'
  + ' (held-out n=' + held.length.toLocaleString() + ' -> ' + (100 * POWER.vs_coin.mde_heldout).toFixed(2) + '%)');
console.log('    correlation: n=' + rows.length.toLocaleString() + ' buys |rho| >= '
  + POWER.correlation.mde_at_80pct_power.toFixed(3) + ' at 80% power, BEFORE attenuation');
console.log('    engine vs engine: not computable in advance — reported from the observed paired sd');

/* ---- RUNNING THE ARMS --------------------------------------------------------------------------- */
const REUSE_PROOF = {};
/* THE INSTRUMENT, DIGESTED BEFORE AND AFTER THE ARMS. `wire_ladder.js` does this for the same reason:
 * a run that spans an hour has an hour's worth of chances for another division to edit a file it is
 * measuring WITH. The frozen engine files are not here — they are read from two snapshots and cannot
 * move — so this watches only the live instrument. */
const INSTRUMENT = ['engine/leaf_engine_contrast.js', 'engine/leaf_scoring.js',
                    'engine/game_differential.js', 'engine/steering.js', 'engine/diff_swarm.js',
                    'engine/champions_sim.js', 'engine/quality.js', 'engine/miltank.js',
                    'engine/run_stamp.js', 'data/protocol-events.json', CENSUS];
const stampInstrument = () => { const o = {};
  for (const f of INSTRUMENT) {
    try { o[f] = sha12(D(f)); }
    catch (e) {
      /* ROADMAP #258 — 'UNREADABLE' is a real value and will never compare equal to a digest, which
       * is the point; the reason is now printed too, so an instrument file that has gone missing
       * mid-run does not simply appear as a string in a stamp nobody reads. */
      o[f] = 'UNREADABLE';
      console.error('  INSTRUMENT NOT STAMPED — ' + f + ' (' + String((e && e.message) || e).split(String.fromCharCode(10))[0] + ')');
    }
  }
  return o; };

function runShards(kind, rel, extra, tag) {
  const outs = [];
  const kids = [];
  const t0 = Date.now();
  /* Spawned in one batch and waited on together. `spawnSync` cannot do that, so the children are
   * launched with `spawn` and the parent waits for every exit. SHARDS is the cap this project sets
   * at six; RAM is the real ceiling and each arm prints its own peak RSS. */
  const { spawn } = require('child_process');
  for (let k = 0; k < SHARDS; k++) outs.push(path.join(WORK, tag.replace(/[^a-z0-9]+/gi, '_') + '.' + k + '.jsonl'));

  /* AN ARM ALREADY ON DISK IS NOT RE-RUN. A shard writes its file once, at the end, so a file that
   * exists is a shard that completed — there is no half-written state to mistake for a finished one.
   * The count guard below still runs on the reused rows, so a reuse that does not cover the sample
   * fails exactly as a fresh run would. */
  if (outs.every(o => fs.existsSync(o))) {
    const map = new Map();
    let lines = 0;
    for (const o of outs) for (const l of fs.readFileSync(o, 'utf8').split('\n')) if (l) { const j = JSON.parse(l); lines++; map.set(j.id, j); }
    /* THE ID SET, NOT THE COUNT. A count check passes when a re-derived sample has the same SIZE and
     * different MEMBERS, which is exactly what happens when the store grows under a resumed run — and
     * this caught it: a 60-row smoke reused six shard files against a corpus that had gained 116 games.
     * The wrong rows would then have joined to `undefined`, dropped silently, and the artifact would
     * have reported a smaller n with no indication why. */
    const missing = rows.filter(r => !map.has(r.id)).length;
    if (lines === rows.length && map.size === rows.length && missing === 0) {
      /* A REUSED ARM WAS RUN BY WHATEVER THIS FILE SAID AT THE TIME, AND THAT IS NOT NECESSARILY WHAT
       * IT SAYS NOW. The published run reuses a baseline leaf arm produced 47 minutes before resume
       * support was added to this same file — so the artifact would be stamping today's digest over an
       * arm yesterday's code produced. That is the "newer than an input it never read" shape that cost
       * this repo a 7,100-game measurement, arriving through the resume feature.
       *
       * It is not argued, it is REPRODUCED: a slice of the reused arm is re-run by the CURRENT code
       * and compared value for value. Bit-identical or the reuse is refused. The slice is small
       * because the arm is a deterministic function of (release, position, seed) — a disagreement
       * shows up on the first position that has one, not on the thousandth.
       *
       * ONLY THE LEAF ARM, AND THE REASON IS A FINDING RATHER THAN AN EXEMPTION. The first version of
       * this check ran on every arm and REFUSED the depth arm, 16 of 24 positions disagreeing. That is
       * not a code change and it is not a bug: `game_differential`'s driver is COVERAGE-SEEKING and its
       * `CLICKS` / `COV_HITS` carry across games on purpose, so a divergence depth is a function of the
       * position AND of every game played before it. A 24-position slice starts from an empty click
       * history and therefore plays different games — by construction, not by accident.
       *
       * So the depth arm has no per-position reproduction, and saying so is the honest report. What it
       * has instead is the REVERSED-ORDER control, which measures the same quantity the hard way: the
       * same release and the same positions with the driver history deliberately changed, and the
       * correlation between the two readings (rho, in `joint.depth_instrument_reliability`) is exactly
       * how much of a depth reading is the position rather than the run. Weakening the check to make it
       * pass would have thrown that distinction away. */
      const REPRO_N = kind === '--leaf-arm' ? +flag('--repro-slice', 24) : 0;
      if (REPRO_N > 0) {
        const step = Math.max(1, Math.floor(rows.length / REPRO_N));
        const slice = rows.filter((_, i) => i % step === 0).slice(0, REPRO_N);
        const pf = path.join(WORK, '.repro.' + tag.replace(/[^a-z0-9]+/gi, '_') + '.positions.jsonl');
        const of = path.join(WORK, '.repro.' + tag.replace(/[^a-z0-9]+/gi, '_') + '.out.jsonl');
        fs.writeFileSync(pf, slice.map(r => JSON.stringify(r)).join('\n') + '\n');
        const args = ['engine/leaf_engine_contrast.js', kind, '--release', rel, '--positions', pf,
                      '--shard', '0', '--shards', '1', '--out', of, '--census', CENSUS,
                      '--diff-turns', String(DIFF_TURNS)].concat(extra || []);
        try { execFileSync(process.execPath, args, { cwd: D(), stdio: ['ignore', 'ignore', 'ignore'] }); }
        catch (e) {
          console.error('  ' + tag + ': the reproduction slice could not be run (' + String((e && e.message) || e).slice(0, 120)
            + '). A reused arm that cannot be reproduced is not evidence. Refusing.');
          process.exit(4);
        }
        const got = fs.readFileSync(of, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
        const bad = got.filter(g => JSON.stringify(map.get(g.id)) !== JSON.stringify(g));
        if (bad.length) {
          console.error('  ' + tag + ': ' + bad.length + ' of ' + got.length + ' reproduction positions DISAGREE with '
            + 'the stored shard. The shards on disk were produced by different code from what is running now, '
            + 'so reusing them would publish two arms measured by two instruments. Refusing.');
          for (const b of bad.slice(0, 4)) console.error('      ' + b.id + ': stored ' + JSON.stringify(map.get(b.id))
            + '  recomputed ' + JSON.stringify(b));
          process.exit(4);
        }
        REUSE_PROOF[tag] = { reproducible_per_position: true, positions_reproduced: got.length, all_identical: true };
      } else {
        REUSE_PROOF[tag] = { reproducible_per_position: false,
          why: 'game_differential\'s driver is coverage-seeking and stateful across games, so a '
             + 'divergence depth is a function of the position AND of the games played before it. A '
             + 'slice re-run in a fresh process is a different sample by construction. The substitute '
             + 'is joint.depth_instrument_reliability — the same release and positions with the driver '
             + 'order reversed.',
          all_arms_of_this_kind_ran_in_one_invocation: true };
      }
      console.log('  ' + tag.padEnd(26) + map.size + ' positions   REUSED from ' + WORK
        + (REPRO_N > 0 ? '  (' + REUSE_PROOF[tag].positions_reproduced + ' re-run by the current code, bit-identical)'
                       : '  (no per-position reproduction — stateful driver; see depth_instrument_reliability)'));
      return Promise.resolve(map);
    }
    console.log('  ' + tag + ': shard files exist but cover ' + (rows.length - missing) + ' of '
      + rows.length + ' sample positions (' + map.size + ' ids on disk) — re-running the arm rather '
      + 'than publishing a partial one.');
  }
  for (let k = 0; k < SHARDS; k++) {
    const out = outs[k];
    const args = ['engine/leaf_engine_contrast.js', kind, '--release', rel, '--positions', POS,
                  '--shard', String(k), '--shards', String(SHARDS), '--out', out,
                  '--census', CENSUS, '--diff-turns', String(DIFF_TURNS)].concat(extra || []);
    kids.push(spawn(process.execPath, args, { cwd: D(), stdio: ['ignore', 'ignore', 'inherit'] }));
  }
  const done = kids.map(() => false);
  let alive = kids.length, failed = [];
  kids.forEach((c, i) => c.on('exit', (code) => { done[i] = true; alive--; if (code !== 0) failed.push({ shard: i, code }); }));
  /* A blocking wait without a busy loop: Atomics.wait on a SharedArrayBuffer would need a worker, so
   * the parent simply drains its own event loop until every child has exited. */
  const deasync = () => new Promise(res => {
    const tick = () => (alive === 0 ? res() : setTimeout(tick, 250));
    tick();
  });
  return deasync().then(() => {
    if (failed.length) {
      console.error('  ' + tag + ': ' + failed.length + ' shard(s) FAILED — ' + JSON.stringify(failed)
        + '. A run missing a shard is not a run; refusing to publish.');
      process.exit(4);
    }
    const map = new Map();
    let lines = 0;
    for (const o of outs) for (const l of fs.readFileSync(o, 'utf8').split('\n')) if (l) { const j = JSON.parse(l); lines++; map.set(j.id, j); }
    /* THE ARM MUST RETURN EXACTLY THE SAMPLE IT WAS GIVEN. A shard that silently dropped rows, or a
     * duplicate game id collapsing two positions into one map entry, would show up here as a count
     * mismatch and nowhere else — and the whole claim is that the two arms scored IDENTICAL positions. */
    if (lines !== rows.length || map.size !== rows.length) {
      console.error('  ' + tag + ': the arm returned ' + lines + ' rows over ' + map.size + ' distinct ids '
        + 'for a sample of ' + rows.length + '. The arms would not be scoring the same positions. Refusing.');
      process.exit(4);
    }
    console.log('  ' + tag.padEnd(26) + map.size + ' positions   ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    return map;
  });
}

const LEAF_CFG = { n_rollouts: DEFAULTS.n, explore: DEFAULTS.explore, foePolicy: DEFAULTS.foePolicy,
                   maxTurns: DEFAULTS.turns,
                   source: 'engine/miltank.js DEFAULTS — the live in-game leaf, read not retyped' };
const leafArgs = ['--rollouts', String(LEAF_CFG.n_rollouts), '--explore', String(LEAF_CFG.explore),
                  '--horizon', String(LEAF_CFG.maxTurns), '--foe-policy', LEAF_CFG.foePolicy];

(async function main() {
  console.log('\n  ARMS (' + SHARDS + ' processes each, arms run one at a time so six is the ceiling)');
  const t0 = Date.now();
  const instrument_before = stampInstrument();
  const leafA = await runShards('--leaf-arm', BASELINE_REL, leafArgs, 'leaf/baseline');
  const leafB = await runShards('--leaf-arm', TOP_REL, leafArgs, 'leaf/top');
  let depthA = null, depthB = null, depthRev = null;
  if (!SKIP_DEPTH) {
    depthA = await runShards('--depth-arm', BASELINE_REL, [], 'depth/baseline');
    depthB = await runShards('--depth-arm', TOP_REL, [], 'depth/top');
    /* THE DEPTH INSTRUMENT'S OWN NOISE FLOOR. Same release, same positions, order reversed inside each
     * shard, so the coverage-seeking driver arrives at every position with a different history. What
     * survives is the part of the depth that is a property of the POSITION; what does not is the part
     * that is a property of the run. Without this a null correlation cannot be told from a ruler with
     * no resolution. */
    depthRev = await runShards('--depth-arm', BASELINE_REL, ['--reverse'], 'depth/baseline-reversed');
  }
  console.log('  all arms done in ' + ((Date.now() - t0) / 1000 / 60).toFixed(1) + ' min');
  const instrument_after = stampInstrument();
  const instrument_moved = INSTRUMENT.filter(f => instrument_before[f] !== instrument_after[f]);
  console.log('  INSTRUMENT UNDER THE RUN: ' + (instrument_moved.length
    ? 'MOVED — ' + instrument_moved.join(', ') + '. The arms were NOT all measured with the same tools.'
    : 'all ' + INSTRUMENT.length + ' watched files byte-identical before and after every arm'));

  /* ---- JOIN ------------------------------------------------------------------------------------- */
  const joined = rows.map(r => {
    const a = leafA.get(r.id), b = leafB.get(r.id);
    const da = depthA && depthA.get(r.id), db = depthB && depthB.get(r.id), dr = depthRev && depthRev.get(r.id);
    /* `okX` is "this position produced a fidelity reading at all"; `divX` is "it parted"; `dX` is
     * WHERE it parted and is null exactly when it never did. Three fields because they are three
     * different facts and the first version of this file had two. */
    const R = (d) => d && d.ok ? { ok: true, div: !!d.diverged, d: d.diverged ? d.depth : null, t: d.turns, ln: d.lines }
                               : { ok: false, div: null, d: null, t: null, ln: null };
    const ra = R(da), rb = R(db), rr = R(dr);
    return { id: r.id, date: r.date, held: r.held, y: r.y, r1: r.r1, r2: r.r2,
             pA: a ? a.p : null, pB: b ? b.p : null,
             okA: ra.ok, okB: rb.ok, okR: rr.ok,
             divA: ra.div, divB: rb.div, divR: rr.div,
             dA: ra.d, dB: rb.d, dR: rr.d,
             tA: ra.t, tB: rb.t, lnA: ra.ln, lnB: rb.ln };
  });
  fs.writeFileSync(D('data', 'leaf-engine-contrast-rows.jsonl'),
    joined.map(j => JSON.stringify(j)).join('\n') + '\n');

  /* ---- 1. EACH ARM, ON ITS OWN --------------------------------------------------------------- */
  const blockOf = (sel, key) => LS.evaluate(joined.filter(sel).map(j => ({ p: j[key], y: j.y, r1: j.r1, r2: j.r2 })));
  const arms = {
    baseline: { release: BASELINE_REL, medicham2: MA['engine/medicham2-browser.js'],
                full: blockOf(() => true, 'pA'), held_out_fifth: blockOf(j => j.held, 'pA') },
    top: { release: TOP_REL, medicham2: MB['engine/medicham2-browser.js'],
           full: blockOf(() => true, 'pB'), held_out_fifth: blockOf(j => j.held, 'pB') },
  };

  /* ---- 2. THE TWO ENGINES AGAINST EACH OTHER, PAIRED ----------------------------------------- */
  const both = joined.filter(j => j.pA != null && j.pB != null);
  const dBrier = both.map(j => LS.brier(j.pB, j.y) - LS.brier(j.pA, j.y));
  const dLL = both.map(j => LS.logloss(j.pB, j.y) - LS.logloss(j.pA, j.y));
  const sd = arr => { const m = LS.mean(arr); return Math.sqrt(arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1)); };
  const sdB = sd(dBrier);
  /* McNEMAR ON THE DECISIVE CALLS. Accuracy is a proportion over a set that is not the same in the two
   * arms, so an unpaired difference of two Wilson intervals throws away the pairing. The information
   * is in the positions where exactly one of the two engines got it right. */
  let mcBoth = 0, mcOnlyA = 0, mcOnlyB = 0, mcNeither = 0, mcN = 0;
  for (const j of both) {
    const decA = Math.abs(j.pA - 0.5) > 0.02, decB = Math.abs(j.pB - 0.5) > 0.02;
    if (!decA || !decB) continue;
    mcN++;
    const okA = (j.pA > 0.5) === (j.y === 1), okB = (j.pB > 0.5) === (j.y === 1);
    if (okA && okB) mcBoth++; else if (okA) mcOnlyA++; else if (okB) mcOnlyB++; else mcNeither++;
  }
  const disc = mcOnlyA + mcOnlyB;
  const mcZ = disc ? (mcOnlyB - mcOnlyA) / Math.sqrt(disc) : 0;
  /* AND THE NOISE FLOOR FOR THE PAIRED DELTA ITSELF. Splitting the position set in half and computing
   * the delta separately in each half says how much of a delta this n can resolve. An effect smaller
   * than the spread between the halves is not an effect. */
  const h = Math.floor(dBrier.length / 2);
  const dHalf = [LS.mean(dBrier.slice(0, h)), LS.mean(dBrier.slice(h))];

  const contrast = {
    n_paired: both.length,
    brier_top_minus_baseline: LS.pairedCI(dBrier),
    log_loss_top_minus_baseline: LS.pairedCI(dLL),
    negative_means: 'the WIRE 10 engine predicts BETTER than the pre-WIRE-1 engine',
    paired_sd: +sdB.toFixed(6),
    observed_mde_80pct: +LS.pairedMDE(sdB, both.length).toFixed(6),
    correlation_between_the_two_leaves: +LS.pearson(both.map(j => j.pA), both.map(j => j.pB)).toFixed(4),
    identical_predictions: both.filter(j => j.pA === j.pB).length,
    mcnemar: { decisive_in_both: mcN, both_right: mcBoth, only_baseline_right: mcOnlyA,
               only_top_right: mcOnlyB, both_wrong: mcNeither, discordant: disc,
               z: +mcZ.toFixed(4), p_value_two_sided: +LS.normP(mcZ).toFixed(4),
               note: 'exact discordant-pair test on the positions where both engines made a decisive call.' },
    noise_floor: { split_half_delta: dHalf.map(x => +x.toFixed(6)),
                   split_half_delta_spread: +Math.abs(dHalf[0] - dHalf[1]).toFixed(6),
                   note: 'the position set split in half and the paired delta computed in each. A delta '
                       + 'smaller than this spread is not an effect.' },
  };

  /* ---- 3. THE JOINT ANSWER — THE FORK -------------------------------------------------------- */
  let joint = { not_run: 'the depth arms were skipped (--skip-depth)' };
  if (!SKIP_DEPTH) {
    const err = (p, y) => LS.brier(p, y);
    /* A position with NO READING is dropped, never imputed. A position that PLAYED AND NEVER PARTED is
     * kept and ranked DEEPEST — that is an order statement (it parted later than any game that parted)
     * and not an imputed number, which is `engine/wire_ladder.js`'s own convention for the same field.
     * Spearman is a rank statistic, so Infinity is exact here rather than a stand-in. */
    const rk = (ok, div, d) => (!ok ? null : (div ? d : Infinity));
    const withA = joined.filter(j => j.pA != null && j.okA).map(j => ({ j, d: rk(j.okA, j.divA, j.dA), e: err(j.pA, j.y), p: j.pA, t: j.tA }));
    const withB = joined.filter(j => j.pB != null && j.okB).map(j => ({ j, d: rk(j.okB, j.divB, j.dB), e: err(j.pB, j.y), p: j.pB, t: j.tB }));

    const bins = (sel, edges) => {
      const out = [];
      const rowFor = (label, g) => {
        if (!g.length) return { depth: label, n: 0 };
        let dec = 0, cor = 0;
        for (const x of g) if (Math.abs(x.p - 0.5) > 0.02) { dec++; if ((x.p > 0.5) === (x.j.y === 1)) cor++; }
        return { depth: label, n: g.length, mean_brier: +LS.mean(g.map(x => x.e)).toFixed(4),
                 decisive: dec, accuracy: dec ? +(cor / dec).toFixed(4) : null };
      };
      for (let i = 0; i < edges.length; i++) {
        const lo = edges[i], hi = i + 1 < edges.length ? edges[i + 1] : Infinity;
        out.push(rowFor(lo + '-' + (hi === Infinity ? 'max' : hi - 1),
                        sel.filter(x => Number.isFinite(x.d) && x.d >= lo && x.d < hi)));
      }
      out.push(rowFor('NEVER PARTED', sel.filter(x => x.d === Infinity)));
      return out;
    };
    const EDGES = [0, 5, 10, 15, 20, 30, 50];

    /* THE DEPTH INSTRUMENT'S RELIABILITY, measured not assumed. */
    const rel2 = joined.filter(j => j.okA && j.okR);
    const rA = rel2.map(j => rk(true, j.divA, j.dA)), rR = rel2.map(j => rk(true, j.divR, j.dR));
    const depthReliability = {
      n: rel2.length,
      spearman_forward_vs_reversed: LS.spearman(rA, rR, 400),
      identical_readings: rel2.filter((j, i) => rA[i] === rR[i]).length,
      note: 'the SAME release and the SAME positions with the driver order reversed inside each shard. '
          + 'This is how much of the divergence depth is a property of the POSITION rather than of the '
          + 'run, and it is the CEILING on any correlation below: a correlation cannot exceed the square '
          + 'root of its predictor\'s own reliability. A null here would indict the instrument, not the '
          + 'world, and publishing one without this control would be publishing "my ruler cannot see it" '
          + 'as "there is nothing there".',
    };

    const spread = arr => { const s = new Set(arr); return { distinct_values: s.size,
      values: [...s].sort((a, b) => a - b).slice(0, 14),
      share_at_mode: +(Math.max(...[...s].map(v => arr.filter(x => x === v).length)) / arr.length).toFixed(4) }; };

    joint = {
      question: 'does per-position ENGINE FIDELITY predict per-position LEAF ERROR — in LINES, and in TURNS?',
      coverage: { positions_with_a_reading_baseline: withA.length, positions_with_a_reading_top: withB.length,
                  never_parted_baseline: withA.filter(x => x.d === Infinity).length,
                  never_parted_top: withB.filter(x => x.d === Infinity).length,
                  no_reading: joined.filter(j => !j.okA || !j.okB).length,
                  why_no_reading: 'fewer than four buildable bodies a side, or the paired game threw' },
      depth_instrument_reliability: depthReliability,
      lines: {
        baseline: LS.spearman(withA.map(x => x.d), withA.map(x => x.e), 400),
        top: LS.spearman(withB.map(x => x.d), withB.map(x => x.e), 400),
        binned_baseline: bins(withA, EDGES),
        binned_top: bins(withB, EDGES),
        note: 'NEGATIVE rho is the hypothesis: a position the engine simulates correctly for longer has '
            + 'a SMALLER leaf error. Positive rho is the opposite of the hypothesis.',
      },
      turns: {
        baseline: LS.spearman(withA.map(x => x.t), withA.map(x => x.e), 400),
        top: LS.spearman(withB.map(x => x.t), withB.map(x => x.e), 400),
        spread_baseline: spread(withA.map(x => x.t)),
        spread_top: spread(withB.map(x => x.t)),
        note: 'a predictor with almost no spread cannot predict anything. The distinct-value count and '
            + 'the share sitting at the modal value are printed BESIDE the correlation so a null is read '
            + 'as a degenerate variable rather than as a measured absence of effect.',
      },
      /* THE SHARPEST FORM OF THE FORK. Not "is a high-fidelity position an easy one" — but "did the
       * positions where WIRE 10 pushed the divergence DEEPER get a BETTER leaf". Both sides are
       * differences, so every position-level confound constant across the two engines cancels. */
      change_in_depth_vs_change_in_error: (() => {
        /* A NUMERIC DELTA NEEDS TWO NUMBERS. Positions where one arm never parted have no finite
         * change and are reported as a TRANSITION count instead of being given a made-up magnitude. */
        const num = joined.filter(j => j.pA != null && j.pB != null && j.okA && j.okB && j.divA && j.divB);
        const dd = num.map(j => j.dB - j.dA);
        const de = num.map(j => err(j.pB, j.y) - err(j.pA, j.y));
        const trans = (a, b) => joined.filter(j => j.pA != null && j.pB != null && j.okA && j.okB
                                                && j.divA === a && j.divB === b);
        const meanDe = g => g.length ? +LS.mean(g.map(j => err(j.pB, j.y) - err(j.pA, j.y))).toFixed(5) : null;
        return {
          n: num.length,
          positions_where_depth_improved: dd.filter(x => x > 0).length,
          positions_where_depth_worsened: dd.filter(x => x < 0).length,
          positions_unchanged: dd.filter(x => x === 0).length,
          median_depth_change: dd.length ? dd.slice().sort((a, b) => a - b)[Math.floor(dd.length / 2)] : null,
          spearman: LS.spearman(dd, de, 400),
          mean_error_change_where_depth_improved: dd.some(x => x > 0)
            ? +LS.mean(de.filter((_, i) => dd[i] > 0)).toFixed(5) : null,
          mean_error_change_where_depth_unchanged: dd.some(x => x === 0)
            ? +LS.mean(de.filter((_, i) => dd[i] === 0)).toFixed(5) : null,
          mean_error_change_where_depth_worsened: dd.some(x => x < 0)
            ? +LS.mean(de.filter((_, i) => dd[i] < 0)).toFixed(5) : null,
          /* THE LARGEST FIDELITY IMPROVEMENT AVAILABLE: a position that used to part and now never
           * does. If engine correctness limits the leaf at all, it should show here or nowhere. */
          transitions: {
            parted_then_never_parted: { n: trans(true, false).length, mean_error_change: meanDe(trans(true, false)) },
            never_parted_then_parted: { n: trans(false, true).length, mean_error_change: meanDe(trans(false, true)) },
            parted_in_both: { n: trans(true, true).length, mean_error_change: meanDe(trans(true, true)) },
            never_parted_in_either: { n: trans(false, false).length, mean_error_change: meanDe(trans(false, false)) },
          },
          note: 'NEGATIVE rho is the hypothesis: pushing the divergence deeper at a position lowers the '
              + 'leaf error at that position.',
        };
      })(),
    };
  }

  /* ---- THE ARTIFACT ---------------------------------------------------------------------------- */
  const out = {
    generated: new Date().toISOString(),
    by: 'engine/leaf_engine_contrast.js',
    question: 'DOES A MORE CORRECT ENGINE MAKE BETTER PREDICTIONS? The same positions and the same '
            + 'seeds scored through two frozen releases that differ in exactly one file, joined per '
            + 'position to that position\'s protocol-divergence depth against the official simulator.',
    releases: {
      baseline: { id: BASELINE_REL, cut: RA.manifest.cut, why: RA.manifest.why,
                  medicham2: MA['engine/medicham2-browser.js'] },
      top: { id: TOP_REL, cut: RB.manifest.cut, why: RB.manifest.why,
             medicham2: MB['engine/medicham2-browser.js'] },
      differ_in: DIFFERS,
      showdown_commit: RA.manifest.showdown_commit,
      note: 'ASSERTED, not assumed: this run refuses to start unless the two manifests differ in '
          + 'engine/medicham2-browser.js and in nothing else, so a leaf difference cannot be the '
          + 'weights, the damage table, the board or the tag file.',
    },
    /* CONTENT, NOT MTIME. engine/provenance.js verifies source_digests by content; an artifact that
     * rests on mtime breaks its ratchet. The 23 frozen engine files are NOT stamped here — this run
     * reads two snapshots and never the live copies, and stamping the live ones would mark this
     * artifact UNSAFE the moment ENGINE touches a file it did not read. Each release carries its own
     * digest set above. */
    source_digests: RS.sourceDigests(INSTRUMENT),
    instrument_under_the_run: { before: instrument_before, after: instrument_after,
      moved: instrument_moved, nothing_moved: instrument_moved.length === 0,
      note: 'the LIVE instrument, digested before the first arm and after the last. The 23 frozen '
          + 'engine files are not watched here because they are read from two immutable snapshots.' },
    positions_file_digest: POS_DIGEST,
    /* AN ARM READ OFF DISK IS ONLY EVIDENCE IF TODAY'S CODE STILL PRODUCES IT. */
    reused_arms: Object.keys(REUSE_PROOF).length ? REUSE_PROOF : null,
    reused_arms_note: Object.keys(REUSE_PROOF).length
      ? 'these arms were read from a previous run\'s shard files. Each had a slice re-run by the code '
      + 'in this file and every recomputed value was bit-identical to the stored one, so the reuse is '
      + 'a reproduction rather than a trust.' : 'every arm was run in this invocation.',
    scorer_verification: { command: 'node engine/leaf_scoring.js --verify', passed: SCORER_OK,
                           says: SCORER_SAYS.split('\n').map(s => s.trim()).filter(Boolean) },
    corpus: {
      clean_games, n_games: rows.length, scorable: rows.length,
      dropped_no_bring: noBring, dropped_no_label: noLabel,
      held_out_games: held.length,
      split: 'sorted by date, oldest 80% / newest 20%',
      split_date: SPLIT_DATE, date_first: DATE_FIRST, date_last: DATE_LAST,
      thinned_to: MAXG || null,
      photographed_at: RESUMED ? JSON.parse(fs.readFileSync(SAMPLE_META, 'utf8')).taken_at : null,
      resumed: RESUMED,
      position: 'turn 0: the BROUGHT four a side, real leads from g.lead, no sheets set',
      why_no_sheets: 'g.sets is observed play from the whole replay; feeding it in would leak the '
                   + 'outcome into its own prediction. The closed-sheet ladder is also what the bot plays.',
    },
    leaf_config: LEAF_CFG,
    depth_config: { instrument: 'engine/game_differential.js playGame, mode A, every die pinned',
                    census_pin: CENSUS, max_turns: DIFF_TURNS,
                    bodies: 'medicham2.buildMon of each brought species — the dataset\'s modal moves, '
                          + 'item and ability, which is exactly what the leaf rolls out',
                    caveat: 'the driver is coverage-seeking and STATEFUL across games, so a per-position '
                          + 'depth carries driver history. Both arms traverse the identical order so the '
                          + 'CONTRAST is paired; the reversed-order control measures what the noise costs '
                          + 'the correlation.' },
    power: POWER,
    arms,
    engine_vs_engine: contrast,
    joint: joint,
    rows: 'data/leaf-engine-contrast-rows.jsonl — per position: both leaf predictions, both depths, '
        + 'the reversed-order depth, the label and both ratings. The curves can be re-cut without '
        + 'replaying the rollouts.',
  };

  /* ---- THE VERDICT, DERIVED FROM THE NUMBERS ---------------------------------------------------- */
  const b = contrast.brier_top_minus_baseline;
  const beats = b.ci95[1] < 0 ? 'BETTER than' : (b.ci95[0] > 0 ? 'WORSE than' : 'NOT SEPARATED from');
  const belowFloor = Math.abs(b.mean) < contrast.noise_floor.split_half_delta_spread;
  const lineRho = SKIP_DEPTH ? null : joint.change_in_depth_vs_change_in_error.spearman;
  out.verdict =
    'The WIRE 10 engine\'s leaf is ' + beats + ' the pre-WIRE-1 engine\'s on Brier over ' +
    contrast.n_paired.toLocaleString() + ' paired positions (' + (b.mean >= 0 ? '+' : '') + b.mean +
    ', 95% CI ' + b.ci95[0] + ' to ' + b.ci95[1] + '; negative is better)' +
    (belowFloor ? ', and the effect is INSIDE its own split-half noise floor of '
      + contrast.noise_floor.split_half_delta_spread : '') + '. ' +
    'Both engines\' leaves remain worse than a coin: Brier vs coin ' +
    arms.baseline.full.brier.vs_coin_paired.mean + ' (baseline) and ' +
    arms.top.full.brier.vs_coin_paired.mean + ' (top). ' +
    (SKIP_DEPTH ? 'Depth not measured.'
      : 'Change in divergence depth vs change in leaf error: rho ' + lineRho.rho +
        ' [' + lineRho.ci95_bootstrap.join(', ') + '] on n=' + lineRho.n + '.');

  /* ---- REPORT ----------------------------------------------------------------------------------- */
  const pad = (s, n) => String(s).padEnd(n);
  const padl = (s, n) => String(s).padStart(n);
  console.log('\n  ================ EACH ENGINE, ON THE SAME POSITIONS ================');
  for (const [name, a] of Object.entries(arms)) {
    for (const [scope, e] of [['full', a.full], ['held-out fifth', a.held_out_fifth]]) {
      if (!e) continue;
      console.log('  ' + pad(name + ' [' + scope + ']', 26) + 'n=' + e.n_games_scored
        + '  Brier ' + e.brier.model + ' vs coin 0.25 (paired ' + e.brier.vs_coin_paired.mean
        + ' CI ' + e.brier.vs_coin_paired.ci95.join(' to ') + ')');
      console.log('  ' + pad('', 26) + 'log-loss ' + e.log_loss.model + '   discrimination '
        + (100 * e.discrimination.accuracy).toFixed(2) + '% of ' + e.discrimination.decisive_calls
        + ' decisive (CI ' + (100 * e.discrimination.accuracy_ci95_wilson[0]).toFixed(2) + '-'
        + (100 * e.discrimination.accuracy_ci95_wilson[1]).toFixed(2) + ', p=' + e.discrimination.p_value_two_sided + ')');
      console.log('  ' + pad('', 26) + 'ECE ' + e.calibration.ece + '  MCE ' + e.calibration.mce_buckets_over_30
        + '  extreme-bucket share ' + e.calibration.share_in_extreme_buckets
        + '  noise floor: Brier ' + e.noise_floor.split_half_brier_spread + ', acc ' + e.noise_floor.split_half_accuracy_spread);
    }
  }
  console.log('\n  RELIABILITY CURVE — top engine, full sample');
  console.log('    ' + pad('bucket', 10) + padl('n', 7) + padl('pred', 8) + padl('obs', 8) + '   95% CI');
  for (const bk of arms.top.full.reliability_curve) {
    if (!bk.n) { console.log('    ' + pad(bk.bucket, 10) + padl(0, 7)); continue; }
    console.log('    ' + pad(bk.bucket, 10) + padl(bk.n, 7) + padl(bk.mean_predicted.toFixed(3), 8)
      + padl(bk.observed.toFixed(3), 8) + '   ' + bk.observed_ci95.map(x => x.toFixed(3)).join(' - ')
      + '   gap ' + (bk.gap >= 0 ? '+' : '') + bk.gap.toFixed(3));
  }
  console.log('\n  ================ THE TWO ENGINES AGAINST EACH OTHER ================');
  console.log('    paired on ' + contrast.n_paired.toLocaleString() + ' positions; the two leaves correlate r='
    + contrast.correlation_between_the_two_leaves + ', ' + contrast.identical_predictions + ' predictions identical');
  console.log('    Brier    TOP - BASELINE  ' + b.mean + '  CI ' + b.ci95.join(' to ') + '   (negative = TOP better)');
  console.log('    log-loss TOP - BASELINE  ' + contrast.log_loss_top_minus_baseline.mean
    + '  CI ' + contrast.log_loss_top_minus_baseline.ci95.join(' to '));
  console.log('    observed paired sd ' + contrast.paired_sd + ' -> this n detects |delta| >= '
    + contrast.observed_mde_80pct + ' at 80% power');
  console.log('    split-half noise floor on the delta: ' + contrast.noise_floor.split_half_delta_spread);
  console.log('    McNemar on ' + contrast.mcnemar.decisive_in_both + ' doubly-decisive calls: only-top-right '
    + contrast.mcnemar.only_top_right + ', only-baseline-right ' + contrast.mcnemar.only_baseline_right
    + ', z=' + contrast.mcnemar.z + ' p=' + contrast.mcnemar.p_value_two_sided);
  if (!SKIP_DEPTH) {
    console.log('\n  ================ THE FORK: DOES FIDELITY PREDICT LEAF ERROR? ================');
    const dr = joint.depth_instrument_reliability;
    console.log('    depth instrument reliability (same release, order reversed): rho '
      + dr.spearman_forward_vs_reversed.rho + ' [' + dr.spearman_forward_vs_reversed.ci95_bootstrap.join(', ')
      + '] on n=' + dr.n + ';  ' + dr.identical_readings + ' readings identical');
    for (const which of ['lines', 'turns']) {
      for (const armName of ['baseline', 'top']) {
        const s = joint[which][armName];
        console.log('    ' + pad(which + ' / ' + armName, 20) + 'rho ' + String(s.rho).padStart(9)
          + '  [' + s.ci95_bootstrap.join(', ') + ']  n=' + s.n + '  p=' + s.p_value_two_sided_normal
          + '  MDE ' + s.mde_at_80pct_power);
      }
    }
    console.log('    turn depth spread: baseline ' + JSON.stringify(joint.turns.spread_baseline)
      + '  top ' + JSON.stringify(joint.turns.spread_top));
    const c = joint.change_in_depth_vs_change_in_error;
    console.log('    CHANGE in depth vs CHANGE in error: rho ' + c.spearman.rho + ' ['
      + c.spearman.ci95_bootstrap.join(', ') + '] on n=' + c.n
      + '  (deeper at ' + c.positions_where_depth_improved + ', shallower at ' + c.positions_where_depth_worsened
      + ', unchanged at ' + c.positions_unchanged + ')');
    console.log('    binned by line depth, TOP engine:');
    console.log('      ' + pad('depth', 10) + padl('n', 7) + padl('mean Brier', 12) + padl('accuracy', 10));
    for (const bn of joint.lines.binned_top) {
      if (!bn.n) { console.log('      ' + pad(bn.depth, 10) + padl(0, 7)); continue; }
      console.log('      ' + pad(bn.depth, 10) + padl(bn.n, 7) + padl(bn.mean_brier, 12)
        + padl(bn.accuracy == null ? '-' : bn.accuracy, 10));
    }
  }
  console.log('\n  ' + out.verdict + '\n');

  if (WRITE) {
    fs.writeFileSync(D('data', 'leaf-engine-contrast.json'), JSON.stringify(out, null, 2) + '\n');
    console.log('  -> data/leaf-engine-contrast.json  (+ data/leaf-engine-contrast-rows.jsonl)');
  } else {
    console.log('  NOT WRITTEN — pass --write. data/leaf-engine-contrast-rows.jsonl was written anyway '
      + 'so a long run is never lost to a missing flag.');
  }
  console.log('  work dir: ' + WORK);
})();
