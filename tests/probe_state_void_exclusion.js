#!/usr/bin/env node
/* tests/probe_state_void_exclusion.js — THE BOARD CLAUSE CHARGED THE ENGINE FOR THE RULER'S OWN
 * UNREADABLE GAMES
 *   node tests/probe_state_void_exclusion.js --release <id> --census <f> --team-store <d> --games N
 * ==================================================================================================
 *
 * THIS IS AN INSTRUMENT PROBE. NO ENGINE BYTE IS UNDER TEST HERE, and the file says so out loud so
 * that the delta it measures is never read as a strength gain or as a mechanic landing.
 *
 * `engine/game_differential.js` publishes two headline numbers from one run:
 *
 *     mid_void.diverged_among_usable / mid_void.usable_games      74 / 958   <- protocol, FILTERED
 *     state.games - state.games_board_never_diverged              8 / 961    <- board,    UNFILTERED
 *
 * The denominators are different, and nothing said so. A `low-identity` game is one THIS INSTRUMENT
 * declares unreadable: the shared-address identity of the two dice streams fell under
 * `MID_OVERLAP_FLOOR`, so the two engines were not flipping the same coins and whatever their boards
 * did afterwards is the ruler's doing. The protocol side has excluded those games since the middle
 * arm existed. The board side never did — so the bar everybody reads charged the engine for games
 * the instrument itself had refused to read.
 *
 * WHAT THIS PROBE ASSERTS, and each one can fail on its own:
 *
 *   1. THE FIXTURE REACHES THE RULE. The sample actually contains at least one void game, and at
 *      least one of them parted a board. A run with no void games proves nothing at all, and this
 *      file FAILS rather than printing a quiet pass — six self-tests in this repo have been quiet
 *      rather than green.
 *   2. THE KNOB MOVES THE FIXTURE. `--state-count-void` reproduces the old population exactly:
 *      `games_void_excluded === 0` and the board-material count is the pre-fix one.
 *   3. THE DELTA IS EXACTLY THE VOID GAMES THAT PARTED A BOARD. Not "smaller" — exactly. The
 *      identities are read out of `mid_void.void_game_tags` and matched against the rows that left
 *      `state.first_board_divergences`, so a game that leaves for any OTHER reason fails this.
 *   4. NOTHING ELSE MOVED. The protocol count, the played-game count and the void count are
 *      byte-identical across the two runs, because the only thing that changed is which population
 *      the board clause reads.
 *
 * Both runs write to scratch artifacts under `data/verification/` and NEITHER overwrites
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
const GAMES = flag('--games', '1200');
const TURNS = flag('--turns', '20');
const CENSUS = flag('--census', 'data/verification/census-pin-9446a684709d.json');
const STORE = flag('--team-store', 'data/team-pool-frozen');
let RELEASE = flag('--release', null);
if (!RELEASE) {
  /* THE RELEASE ID COMES OFF THE POINTER FILE, NEVER OFF A PARSE OF `engine_release.js list` — a
   * stale id there produced `M.midEventDice is not a function`, which reads exactly like a broken
   * engine and was a bad command. */
  RELEASE = JSON.parse(fs.readFileSync(D('data', 'engine-release.json'), 'utf8')).current;
}

const base = ['--steering', 'empirical', '--release', RELEASE, '--arm', 'middle',
              '--end-state', '--state', '--census', CENSUS,
              '--games', GAMES, '--turns', TURNS, '--team-store', STORE, '--write'];

const OUT_RED = D('data', 'verification', 'game-differential.void-clause-RED.json');
const OUT_GRN = D('data', 'verification', 'game-differential.void-clause-GREEN.json');

const run = (label, extra, out) => {
  console.log(NL + '  ---- ' + label + ' ------------------------------------------------------');
  const args = [D('engine', 'game_differential.js')].concat(base, extra, ['--out', out]);
  console.log('  node engine/game_differential.js ' + args.slice(1).join(' '));
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, args, { cwd: D(), encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.log(String(r.stdout || '').split(NL).slice(-40).join(NL));
    console.log(String(r.stderr || '').slice(-4000));
    throw new Error(label + ' exited ' + r.status + ' — this probe cannot judge a run that did not finish');
  }
  console.log('  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  return JSON.parse(fs.readFileSync(out, 'utf8'));
};

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};
const bar = a => a.state.games - a.state.games_board_never_diverged;
const tag = r => r.config + ' ' + r.seed;

/* ---- THE RUNS. RED FIRST, so a failure to reproduce the old number stops the file before it can
 *      report a delta against a baseline it never established. ---------------------------------- */
const RED = run('RED — --state-count-void, the pre-2026-09-07 ruler', ['--state-count-void'], OUT_RED);
const GRN = run('GREEN — the corrected board population', [], OUT_GRN);

console.log(NL + '  ================================================================================');
console.log('  RED    board-material ' + bar(RED) + ' of ' + RED.state.games
  + '   (void excluded from the board population: ' + RED.state.games_void_excluded + ')');
console.log('  GREEN  board-material ' + bar(GRN) + ' of ' + GRN.state.games
  + '   (void excluded from the board population: ' + GRN.state.games_void_excluded + ')');
console.log('  ================================================================================' + NL);

/* ---- 1. THE FIXTURE REACHES THE RULE -------------------------------------------------------- */
const voidTags = (GRN.mid_void && GRN.mid_void.void_game_tags) || [];
console.log('  the ' + voidTags.length + ' void game(s) this sample contains, by name:');
for (const v of voidTags) console.log('      ' + v.config + ' ' + v.seed + '   why=' + v.why
  + '  turns=' + v.turns + '  protocol_parted=' + (v.protocol_diverged_at_turn == null ? 'no' : 't' + v.protocol_diverged_at_turn)
  + '  board_parted=' + (v.board_parted_at_turn == null ? 'NO' : 't' + v.board_parted_at_turn));
const voidThatParted = voidTags.filter(v => v.board_parted_at_turn != null);
claim(voidTags.length > 0,
  'THE FIXTURE REACHES THE RULE — the sample contains at least one void game',
  voidTags.length + ' void game(s). Zero would make every claim below vacuous.');
claim(voidThatParted.length > 0,
  'THE KNOB MOVES THE FIXTURE — at least one void game parted a board, so the correction has something to remove',
  voidThatParted.length + ' of ' + voidTags.length + ' void game(s) parted a board.');

/* ---- 2. THE RED ARM IS THE OLD RULER, EXACTLY ------------------------------------------------ */
claim(RED.state.games_void_excluded === 0,
  'RED excludes nothing — --state-count-void reproduces the unfiltered population',
  'games_void_excluded ' + RED.state.games_void_excluded);
claim(RED.state.games === RED.state.games_before_void_exclusion,
  'RED state.games is the whole played population',
  RED.state.games + ' === ' + RED.state.games_before_void_exclusion);
claim(GRN.state.games_void_excluded === voidTags.length,
  'GREEN excludes exactly the void games',
  GRN.state.games_void_excluded + ' excluded, ' + voidTags.length + ' void');

/* ---- 3. THE DELTA IS EXACTLY THE VOID GAMES THAT PARTED A BOARD ------------------------------ */
const redRows = new Set(RED.state.first_board_divergences.map(tag));
const grnRows = new Set(GRN.state.first_board_divergences.map(tag));
const left = [...redRows].filter(t => !grnRows.has(t));
const arrived = [...grnRows].filter(t => !redRows.has(t));
const voidSet = new Set(voidThatParted.map(v => v.config + ' ' + v.seed));
console.log(NL + '  rows that LEFT state.first_board_divergences:');
for (const t of left) console.log('      ' + t + (voidSet.has(t) ? '   [void]' : '   [NOT VOID — this is the failure]'));
if (arrived.length) for (const t of arrived) console.log('      ARRIVED (unexpected): ' + t);
claim(left.length === voidThatParted.length && left.every(t => voidSet.has(t)),
  'every row that left is a void game, and every void game that parted a board left',
  'left ' + left.length + ', void-and-parted ' + voidThatParted.length);
claim(arrived.length === 0,
  'no row ARRIVED — the correction removes games, it does not add any',
  arrived.length + ' arrived');
claim(bar(GRN) === bar(RED) - voidThatParted.length,
  'the bar moved by exactly the number of void games that parted a board',
  bar(RED) + ' - ' + voidThatParted.length + ' = ' + (bar(RED) - voidThatParted.length)
  + ', measured ' + bar(GRN));

/* ---- 4. NOTHING ELSE MOVED ------------------------------------------------------------------- */
claim(RED.diverged === GRN.diverged,
  'the PROTOCOL count is untouched — this correction is about the board clause only',
  'RED ' + RED.diverged + ' / GREEN ' + GRN.diverged);
claim(RED.games === GRN.games,
  'the same games were PLAYED in both runs',
  'RED ' + RED.games + ' / GREEN ' + GRN.games);
claim(RED.mid_void.void_games === GRN.mid_void.void_games
   && RED.mid_void.usable_games === GRN.mid_void.usable_games
   && RED.mid_void.diverged_among_usable === GRN.mid_void.diverged_among_usable,
  'the void verdict itself did not move — the knob changes who is COUNTED, never who is VOID',
  'RED ' + RED.mid_void.void_games + '/' + RED.mid_void.usable_games + '/' + RED.mid_void.diverged_among_usable
  + '  GREEN ' + GRN.mid_void.void_games + '/' + GRN.mid_void.usable_games + '/' + GRN.mid_void.diverged_among_usable);
claim(GRN.state.games === GRN.state.games_before_void_exclusion - GRN.state.games_void_excluded,
  'GREEN state.games is the played population less the exclusions, and both are published',
  GRN.state.games_before_void_exclusion + ' - ' + GRN.state.games_void_excluded + ' = ' + GRN.state.games);

console.log(NL + '  release ' + RELEASE + '   census ' + CENSUS + '   store ' + STORE
  + '   --games ' + GAMES + '   --turns ' + TURNS);
console.log(NL + (fails ? '  ' + fails + ' FAILED' : '  all claims held') + NL);
process.exit(fails ? 1 : 0);
