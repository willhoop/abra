#!/usr/bin/env node
/* tests/probe_corner_arm_measures.js — A CORNER-ARM RUN COMPARED NO BOARD AND REPORTED IT AS A CLEAN
 * ZERO
 *   node tests/probe_corner_arm_measures.js --release <id> --census <f> --team-store <d> --games N
 * ==================================================================================================
 *
 * THIS IS AN INSTRUMENT PROBE. NO ENGINE BYTE IS UNDER TEST HERE, and the file says so out loud so
 * that nothing it measures is ever read as a mechanic landing or a strength gain.
 *
 * `engine/game_differential.js` has three arms. `--arm` moves `ARMS_RUN`; it did NOT move the arm
 * whose games become `results`, which was `ARMS[0]` — always `middle` — unconditionally. So a run
 * asking for a corner arm ALONE played 961 games, assigned none of them to `results`, and published
 *
 *     state.games                       0
 *     state.games_board_never_diverged  0
 *     state.turn_boundaries_compared    0
 *
 * The bar the quarantine clause names is `state.games` less `state.games_board_never_diverged`.
 * On that artifact it is `0 - 0 = 0`, which is BYTE-IDENTICAL to a perfect score. A capability was
 * absent and everything reported success — this repository's signature failure, arriving inside the
 * instrument that measures it.
 *
 * WHAT THIS PROBE ASSERTS, each independently:
 *
 *   1. A CORNER ARM RUNS. `--arm top-tie-first` alone plays games AND compares turn boundaries:
 *      `state.games > 0` and `state.turn_boundaries_compared > 0`. Same for `bottom-tie-first`.
 *   2. THE ARTIFACT NAMES THE ARM IT ACTUALLY MEASURED. `pins.primary` and `mode` carry the corner,
 *      not `middle`. A run whose receipt names the wrong arm passes provenance for the wrong reason.
 *   3. THE EXCLUSION IS HONEST AND IT IS NOT `mid_void`. A corner arm has no shared dice STREAM to
 *      desynchronise — both engines answer every draw from a constant — so the middle arm's
 *      low-identity void filter has nothing to filter. The corner arm carries `corner_pin` instead:
 *      a measured receipt that every draw shape on the authority's side and every named stream on
 *      medicham2's side returned exactly ONE value all run. `mid_void` must be null there, rather
 *      than a middle-arm summary silently computed over a corner population.
 *   4. THE EMPTY CASE REFUSES. Under `MEDI_DIFF_LEGACY_PRIMARY=1` — the defect, restored — the run
 *      must EXIT NON-ZERO and its artifact must carry `void: true` with `state` blanked. It must
 *      never print a clean `0 of 0` again. This is the knob-cleared control: the same command line,
 *      one environment variable, and the instrument moves from an answer to a refusal.
 *   5. THE RECEIPT CAN FAIL. `MEDI_CORNER_UNPIN=tgt` hands medicham2 one LIVE stream against the
 *      authority's constant. The receipt must name the stream and the run must refuse to publish.
 *      Claim 3 reads zero on a clean run, which is exactly what a check that asks nothing reads.
 *
 * Every run writes to a scratch artifact under `data/verification/`; none of them can touch
 * `data/game-differential.json`.
 * ================================================================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const GAMES = flag('--games', '60');
const TURNS = flag('--turns', '50');
const CENSUS = flag('--census', 'data/mechanics-census.json');
const STORE = flag('--team-store', 'data/team-pool-frozen');
let RELEASE = flag('--release', null);
if (!RELEASE) RELEASE = JSON.parse(fs.readFileSync(D('data', 'engine-release.json'), 'utf8')).current;

const base = ['--steering', 'empirical', '--release', RELEASE, '--end-state',
              '--census', CENSUS, '--games', GAMES, '--turns', TURNS,
              '--team-store', STORE, '--write'];

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

const run = (label, arm, out, env) => {
  console.log(NL + '  ---- ' + label + ' ------------------------------------------------------');
  const args = [D('engine', 'game_differential.js')].concat(base, ['--arm', arm, '--out', out]);
  console.log('  ' + (env ? Object.keys(env).map(k => k + '=' + env[k]).join(' ') + ' ' : '')
    + 'node engine/game_differential.js ' + args.slice(1).join(' '));
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, args, {
    cwd: D(), encoding: 'utf8', maxBuffer: 1 << 28,
    env: Object.assign({}, process.env, env || {}),
  });
  console.log('  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's   exit ' + r.status);
  let art = null;
  /* WHY the artifact is unreadable is the whole question this probe asks: a run that exited 0
     having written NOTHING (ENOENT) and one that wrote garbage are the two cases it must tell
     apart, and a silent catch collapses them into one. */
  try { art = JSON.parse(fs.readFileSync(out, 'utf8')); }
  catch (e) { art = null; console.log('  ARTIFACT UNREADABLE at ' + out + ': ' + e.message); }
  if (!art) {
    console.log(String(r.stdout || '').split(NL).slice(-30).join(NL));
    console.log(String(r.stderr || '').slice(-3000));
  }
  return { status: r.status, art, tail: String(r.stdout || '').split(NL).slice(-25).join(NL) };
};

/* ---- 1 + 2 + 3. THE TWO CORNERS, EACH ON ITS OWN ---------------------------------------------- */
for (const arm of ['top-tie-first', 'bottom-tie-first']) {
  const out = D('data', 'verification', 'game-differential.corner-probe-' + arm + '.json');
  const R = run('CORNER — ' + arm + ' as the only arm', arm, out, null);
  if (!R.art) { claim(false, arm + ' — the run wrote an artifact', 'nothing to judge'); continue; }
  const st = R.art.state || {};
  console.log('  state.games ' + st.games + '   turn_boundaries_compared ' + st.turn_boundaries_compared
    + '   games_board_never_diverged ' + st.games_board_never_diverged
    + '   BOARD-MATERIAL ' + (st.games - st.games_board_never_diverged) + ' of ' + st.games);
  claim(R.status === 0, arm + ' — the run finished', 'exit ' + R.status);
  claim(st.games > 0, arm + ' — A CORNER ARM PLAYS GAMES INTO `results`',
    'state.games = ' + st.games + '. Zero means `--arm` moved ARMS_RUN and not the run primary.');
  claim(st.turn_boundaries_compared > 0, arm + ' — A CORNER ARM COMPARES A BOARD',
    'state.turn_boundaries_compared = ' + st.turn_boundaries_compared
    + '. Zero makes the bar `0 - 0 = 0`, which is indistinguishable from a perfect score.');
  claim(R.art.pins && R.art.pins.primary === arm, arm + ' — the receipt names the arm it measured',
    'pins.primary = ' + (R.art.pins || {}).primary);
  claim(String(R.art.mode || '').indexOf('A/' + arm + '/') === 0,
    arm + ' — `mode` carries the arm, so arms_comparable cannot table a corner against the middle',
    'mode = ' + R.art.mode);
  const cp_ = R.art.corner_pin;
  claim(!!cp_, arm + ' — the corner arm carries a `corner_pin` receipt',
    cp_ ? '' : 'corner_pin is absent — the exclusion question is unanswered.');
  claim(R.art.mid_void === null, arm + ' — `mid_void` is NULL on a corner arm, not a middle summary over a corner population',
    'mid_void = ' + (R.art.mid_void === null ? 'null' : typeof R.art.mid_void));
  if (cp_) {
    console.log('  corner_pin: sd shapes ' + cp_.showdown_draw_shapes + ', medicham streams '
      + cp_.medicham_streams_drawn + ', draws ' + cp_.showdown_draws + '/' + cp_.medicham_draws);
    claim(cp_.showdown_draws > 0 && cp_.medicham_draws > 0,
      arm + ' — the receipt saw draws on BOTH sides',
      'a receipt over zero draws asserts nothing: sd ' + cp_.showdown_draws + ', medi ' + cp_.medicham_draws);
    claim((cp_.showdown_shapes_with_more_than_one_value || []).length === 0,
      arm + ' — every authority draw shape returned ONE value all run',
      JSON.stringify(cp_.showdown_shapes_with_more_than_one_value));
    claim((cp_.medicham_streams_with_more_than_one_value || []).length === 0,
      arm + ' — every medicham2 stream returned ONE value all run (no live LCG leaked into a corner)',
      JSON.stringify(cp_.medicham_streams_with_more_than_one_value));
    claim(cp_.usable_games === st.games,
      arm + ' — nothing is excluded, and the receipt says WHY rather than leaving a 0',
      'usable_games ' + cp_.usable_games + ' of state.games ' + st.games);
  }
}

/* ---- 4. THE EMPTY CASE REFUSES — the knob-cleared control ------------------------------------- */
const OUT_L = D('data', 'verification', 'game-differential.corner-probe-LEGACY.json');
const L = run('CONTROL — MEDI_DIFF_LEGACY_PRIMARY=1, the defect restored', 'top-tie-first', OUT_L,
              { MEDI_DIFF_LEGACY_PRIMARY: '1' });
claim(L.status !== 0, 'THE EMPTY CASE EXITS NON-ZERO',
  'exit ' + L.status + '. A run that compared no board must never exit 0.');
if (L.art) {
  claim(L.art.void === true, 'THE EMPTY CASE DECLARES ITSELF VOID',
    'void = ' + JSON.stringify(L.art.void));
  claim(L.art.state === null, 'THE EMPTY CASE BLANKS `state` — a caption is not a quarantine',
    'state = ' + (L.art.state === null ? 'null' : 'PRESENT, and it reads games '
      + (L.art.state.games) + ' / never_diverged ' + L.art.state.games_board_never_diverged
      + ' — the clean-looking zero this probe exists to refuse'));
} else {
  claim(true, 'THE EMPTY CASE WROTE NO ARTIFACT AT ALL', 'also acceptable: nothing to misread');
}

/* ---- 5. THE `corner_pin` RECEIPT CAN FAIL — the second knob-cleared control -------------------
 * Claim 3 above reads "0 shapes with more than one value" on both corners. That is exactly the shape
 * of a check that is asking nothing, so it gets a red arm: `MEDI_CORNER_UNPIN=<stream>` restores the
 * live `M.rngStreams` LCG for ONE medicham2 stream — the failure the receipt exists to catch — and
 * the receipt must NAME it and the run must then REFUSE to publish.
 *
 * `tgt` AND NOT `acc`, AND THE REASON IS A GOOD ONE. Unpinning `acc` is refused EARLIER STILL, by
 * `PIN_CLAIMS` at module load: *"THE PIN IS WRONG — accuracy, crit, secondary and damage are ALL
 * still the corner"*, exit 1 before a single game is played. That is a stronger guard and it is
 * already there. `tgt` (the random-target draw, ROADMAP #478) carries no PIN_CLAIMS row, so it is the
 * stream that reaches the receipt — which is exactly the gap the receipt exists to cover: the claims
 * are a TYPED list and the receipt is over every draw actually taken. */
const OUT_U = D('data', 'verification', 'game-differential.corner-probe-UNPIN.json');
const U = run('CONTROL — MEDI_CORNER_UNPIN=tgt, one stream let through live', 'top-tie-first', OUT_U,
              { MEDI_CORNER_UNPIN: 'tgt' });
if (U.art) {
  const flagged = ((U.art.corner_pin || {}).medicham_streams_with_more_than_one_value || [])
    .concat(((U.art.corner_pin || {}).showdown_shapes_with_more_than_one_value || []));
  claim(U.art.corner_pin === null || flagged.some(x => x.key === 'tgt') || U.art.void === true,
    'THE RECEIPT CATCHES AN UNPINNED STREAM',
    'flagged: ' + JSON.stringify(flagged.map(x => x.key)) + ', void = ' + JSON.stringify(U.art.void));
  claim(U.art.void === true && U.art.state === null,
    'AN UNPINNED CORNER REFUSES TO PUBLISH — a number that cannot separate the engine from the ruler is withheld',
    'void = ' + JSON.stringify(U.art.void) + ', state = ' + (U.art.state === null ? 'null' : 'PRESENT'));
  claim(U.status !== 0, 'AN UNPINNED CORNER EXITS NON-ZERO', 'exit ' + U.status);
  console.log('  refusal: ' + String(U.art.void_reason || '(none)').slice(0, 260));
} else {
  claim(false, 'THE UNPIN CONTROL RAN', 'no artifact — cannot judge');
}

console.log(NL + '  ' + (fails ? 'FAILED ' + fails + ' claim(s)' : 'ALL CLAIMS PASSED'));
process.exit(fails ? 1 : 0);
