/* probe_stall_sweep_order.js — THE `stall` SWEEP IS A SPEED-ORDERED WALK AND IT STOPS. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_stall_sweep_order.js
 *   SHOWDOWN_PATH=... node tests/probe_stall_sweep_order.js --team-store <dir>
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `tests/probe_stall_uncaused.js` (2026-09-06) moved the `stall` duration sweep to the FOOT of the
 * residual walk and closed three board partings. It left one case DECLARED and not fixed, in as many
 * words, inside `_stallExpire`'s header:
 *
 *     "A TURN THAT ENDS INSIDE ITS OWN RESIDUAL ... This engine models the duration as a per-turn
 *      boolean and cannot express half a residual ... declared, not fixed."
 *
 * The held-out 12,000-game draw on release `18773c22878f` parts 34 boards, and TWO of them are that
 * case (`docs/_reports/2026-09-19-final-remeasure.md` §4 rows 1 and 4, §5 the corner row). This file
 * is the instrument for it. It is a SEPARATE file from `probe_stall_uncaused.js` because that probe's
 * three games are green on both engines and a merged file could not say which half a red arm accuses.
 *
 * ================= THE AUTHORITY, RE-DERIVED ON EVERY RUN =======================================
 *
 * `stall` (data/conditions.ts:439-466; `data/mods/champions/conditions.ts` overrides `par`, `slp` and
 * `frz` and does NOT carry `stall`) has `duration: 2`, `counterMax: 729` and NO `onResidual`.
 *
 *   - It reaches the Residual handler list only because it carries a DURATION. `fieldEvent` sets
 *     `getKey = 'duration'` (sim/battle.ts:486-488) and `findPokemonEventHandlers` pushes a volatile
 *     whose `volatileState[getKey]` is truthy even when `callback === undefined`, with
 *     `end: pokemon.removeVolatile` (sim/battle.ts:1107-1117).
 *   - `resolvePriority` reads `onResidualOrder` off the effect and `stall` has none, so
 *     `handler.order = false` (sim/battle.ts:952). `comparePriority` maps a falsy order to
 *     `4294967296` (sim/battle.ts:405), so every `stall` handler sorts below every numbered residual
 *     handler; among themselves they tie on order and priority and are separated by SPEED, high to
 *     low (sim/battle.ts:407).
 *   - Per iteration: `handler.state.duration--; if (!handler.state.duration) { handler.end.call(...);
 *     if (this.ended) return; continue; }` (sim/battle.ts:517-525). THE `continue` IS THE MECHANIC —
 *     an expiry SKIPS the `this.faintMessages(); if (this.ended) return;` at the foot of the loop body
 *     (sim/battle.ts:564-566). A counter that SURVIVES its decrement falls through to it, so it can
 *     end the walk and leave every SLOWER holder's counter standing.
 *   - A handler whose holder is already `fainted` is skipped whole (sim/battle.ts:511-513), and
 *     `fainted` is written inside `faintMessages` — so a body the perish expiry only ZEROED still
 *     holds its handler.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  AUTHORITY  the constants are read off the format on this run, not typed.
 *   2  FIXTURE    each named game is in the PINNED pool at its own swarm size. A game that cannot be
 *                 staged is a FAILURE of this file, never a statement about the mechanic.
 *   3  CONTROL    the two protocol streams of each replayed game agree end to end. Both games part a
 *                 BOARD with no protocol divergence anywhere, so a protocol split here means the
 *                 replay is not the artifact's game and nothing below it means anything.
 *   4  TEST       at every turn boundary of every replayed game, medicham2's stall counter equals
 *                 Showdown's `volatiles.stall.counter` for every active body.
 *   5  COUNTERS   the new stop FIRED (`stallSweepStoppedByWipe`), and the CONTROL that the sweep still
 *                 clears an unrefreshed counter on an ordinary turn (`stallLapsedUnrefreshed`).
 *   6  RED        the parent re-runs itself under MEDI_STALL_SWEEP_UNORDERED=1 and that child must
 *                 FAIL. A probe that passes under the restored defect asserts nothing.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE STALL SWEEP ORDER');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

/* THE POOL. Repo-relative by default, exactly as every other pinned probe reads it; `--team-store`
 * is honoured when it is already on the command line so this file can be run from a worktree whose
 * `data/team-pool-frozen` is the untracked half of the pin. The path used is PRINTED. */
const ARGV0 = process.argv.slice(2);          /* what the CALLER passed, before this file adds pins */
const tsIdx = process.argv.indexOf('--team-store');
const POOL = tsIdx > 0 ? process.argv[tsIdx + 1] : D('data', 'team-pool-frozen');
if (tsIdx < 0) process.argv.push('--team-store', POOL);
process.argv.push('--steering', 'empirical', '--state', '--end-state', '--turns', '50');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '1200');

const G = require(D('engine', 'game_differential.js'));
/* THE ENGINE THE DRIVER ACTUALLY PLAYED, not a second load of the same path — `game_differential.js`
 * opens medicham2 through `REL.require`, and a plain require here would return a different module
 * object whose counters stay at zero all run, which reads exactly like a wire that never fired. */
const MEDI = G.REL.require('engine/medicham2-browser.js',
                           { want: ['MEDSEEN', 'MEDFAILS', 'stallBoardCounter'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const CHILD = process.env.MEDI_STALL_SWEEP_UNORDERED === '1';
const C0 = { stopped: MEDI.MEDSEEN.stallSweepStoppedByWipe,
             lapsed: MEDI.MEDSEEN.stallLapsedUnrefreshed,
             foot: MEDI.MEDSEEN.stallExpireAtResidualFoot };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== THE `stall` SWEEP IS A WALK, AND IT STOPS =='
  + (CHILD ? '   [MEDI_STALL_SWEEP_UNORDERED=1]' : '') + '\n');
console.log('  release ' + G.REL.id + '   pool ' + POOL);

/* ---- 1 — THE AUTHORITY, RE-DERIVED ----------------------------------------------------------- */
{
  const st = dex.conditions.get('stall');
  console.log('  stall, read off the format on this run: duration=' + st.duration
    + ' counterMax=' + st.counterMax
    + ' onResidual=' + (typeof st.onResidual) + ' onResidualOrder=' + JSON.stringify(st.onResidualOrder));
  ok(st.duration === 2 && !st.onResidual && st.onResidualOrder === undefined,
     'the authority still gives `stall` a duration, no onResidual and NO onResidualOrder',
     'that combination is the whole mechanic: it is collected by fieldEvent\'s getKey=\'duration\' '
     + '(sim/battle.ts:486-488) and sorts below every numbered handler (sim/battle.ts:405, :952)');
}

/* ---- 2..4 — THE GAMES ------------------------------------------------------------------------ */
/* NAMED OFF THE PUBLISHED ARTIFACTS, with the swarm size each one resolves at. `--games` is part of
 * the SAMPLE DEFINITION, not a budget: `buildSwarm` is sized from it, so a different number is a
 * different pool and therefore a different pairing. Each fixture builds its OWN swarm. */
const WANT = [
  { cfg: 'omit-weather', arm: 'middle', games: 12000, turn: 14,
    tag: 'gen9championsvgc2026regmbbo3-2655134691 vs gen9championsvgc2026regmbbo3-2655131779',
    leaf: 'p2.active[1].stall', was: 'medicham 0 / showdown 3',
    from: 'data/verification/game-differential.g12000.json' },
  { cfg: 'omit-spread', arm: 'bottom-tie-first', games: 1200, turn: 11,
    tag: 'gen9championsvgc2026regmbbo3-2662099996 vs gen9championsvgc2026regmbbo3-2662094820',
    leaf: 'p1.active[0].stall', was: 'medicham 0 / showdown 9',
    from: 'data/verification/game-differential.g1200.bottom-tie-first.json' },
];

const SWARMS = new Map();
const swarmAt = (n) => {
  if (!SWARMS.has(n)) {
    const t0 = Date.now();
    const sw = SWARM.buildSwarm(n * 2, { storeDir: POOL });
    console.log('  pool at --games ' + n + ' built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — '
      + sw.out.reduce((a, c) => a + c.picked, 0) + ' teams picked from ' + sw.teams.length);
    SWARMS.set(n, sw);
  }
  return SWARMS.get(n);
};

for (const W of WANT) {
  const SW = swarmAt(W.games);
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    ok(false, W.cfg + ' t' + W.turn + ': the pair is in the PINNED pool at --games ' + W.games,
       'a=' + !!ta + ' b=' + !!tb + ' — a FIXTURE fault, never a claim about the mechanic');
    continue;
  }
  const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
  if (!a || !b) { ok(false, W.cfg + ' t' + W.turn + ': both sides build', 'buildPair refused'); continue; }
  const arm = G.ARM_BY_ID.get(W.arm);
  if (!arm) { ok(false, W.cfg + ': the arm "' + W.arm + '" exists', 'known: '
    + [...G.ARM_BY_ID.keys()].join(', ')); continue; }

  const rows = [];
  const r = G.playGame(a, b, W.cfg, W.tag, {
    arm,
    onBoundary: (snap, turnIdx, S, battle) => {
      const cells = [];
      for (const [lab, arr, side] of [['p1', S.actA, battle.sides[0]], ['p2', S.actB, battle.sides[1]]]) {
        for (let i = 0; i < 2; i++) {
          const m = arr[i], p = side.active[i];
          const v = p && p.volatiles && p.volatiles.stall;
          cells.push({ slot: lab + '.a[' + i + ']',
                       who: (m ? m.name : '-') + '/' + (p && p.species ? p.species.id : '-'),
                       meN: m ? (m.tookProtectTurns | 0) : -1, meFresh: m ? !!m._stallFresh : false,
                       meFnt: m ? !!m.fainted : null,
                       sdCtr: v ? v.counter : 0, sdDur: v ? v.duration : 0,
                       sdFnt: p ? !!p.fainted : null });
        }
      }
      rows.push({ t: turnIdx, cells });
    },
  });

  console.log('\n  ---- ' + W.cfg + '  arm ' + W.arm + '  --games ' + W.games + '  ' + W.tag);
  console.log('       ' + W.from + ' says: board parts at t' + W.turn + ' on ' + W.leaf
    + '  (' + W.was + ')');
  console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
    + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null)
    + ' boundaries=' + r.boundaries + '/' + r.boundariesAgreed
    + ' endedMedi=' + r.endedMedi + ' endedSd=' + r.endedSd + ' err=' + (r.err || '-'));
  if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

  ok(!r.div, W.cfg + ' t' + W.turn + ': CONTROL — the protocol streams agree end to end',
     r.div ? 'the protocol parted at index ' + r.div.index + ' — this replay is NOT the artifact\'s game'
           : 'no protocol divergence, exactly as the artifact records');

  let printed = 0, mismatch = null, corpses = 0;
  for (const row of rows) {
    const live = row.cells.filter(x => x.meN > 0 || x.sdCtr > 0);
    if (!live.length) continue;
    printed++;
    console.log('       t' + String(row.t).padEnd(3) + live.map(x =>
      x.slot + ' ' + x.who + '  me_n=' + x.meN + ' fresh=' + (x.meFresh ? 'Y' : 'n')
      + ' fnt=' + (x.meFnt ? 'Y' : 'n') + '   sd_ctr=' + x.sdCtr + ' dur=' + x.sdDur
      + ' fnt=' + (x.sdFnt ? 'Y' : 'n')).join('\n           '));
    for (const x of live) {
      /* A BODY BOTH ENGINES CALL DEAD IS EXCLUDED, AND COUNTED SO THE EXCLUSION IS VISIBLE. The
       * authority's `faintMessages` runs `clearVolatile(false)` on the corpse, which takes the `stall`
       * volatile with it; medicham2 leaves `tookProtectTurns` standing on a corpse and says so in
       * `_stallExpire`'s header. NOTHING COMPARES THAT LEAF — `engine/board_state.js:834` projects a
       * standing body's counter as `null` and `stall` is in its `POST_FAINT` group — so asserting it
       * here would be asserting a quantity no board reads. It is reported in OWED, not fitted away. */
      if (x.meFnt && x.sdFnt) { corpses++; continue; }
      /* medicham2's OWN map from its tally to the authority's denominator — called, never copied,
       * exactly as engine/board_state.js calls it. */
      const meCtr = MEDI.stallBoardCounter(x.meN);
      if (meCtr !== x.sdCtr && !mismatch) mismatch = { t: row.t, c: x, meCtr };
    }
  }
  if (!printed) console.log('       (no body carried a stall clock at any boundary)');

  /* THE OUTCOME ARM, AND IT IS THE ONE THE ARTIFACT RECORDED: the BOARD, compared by the instrument
   * that published the parting, not by a rule restated here. */
  ok(!r.stateDiv, W.cfg + ' t' + W.turn + ': the BOARD never parts — ' + W.leaf + ' was ' + W.was,
     r.stateDiv ? 'board parted at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs)
                : r.boundariesAgreed + ' of ' + r.boundaries + ' turn boundaries identical');
  ok(!mismatch, W.cfg + ' t' + W.turn + ': every LIVE active body\'s stall counter agrees at every '
     + 'boundary  [' + corpses + ' corpse reading(s) excluded, see the comment]',
     mismatch ? 'first disagreement at t' + mismatch.t + ' ' + mismatch.c.slot + ' ' + mismatch.c.who
                + ': medicham2 ' + mismatch.meCtr + ' (tookProtectTurns=' + mismatch.c.meN
                + ', fresh=' + mismatch.c.meFresh + ', fainted=' + mismatch.c.meFnt + ')'
                + ' / showdown ' + mismatch.c.sdCtr + ' (duration=' + mismatch.c.sdDur
                + ', fainted=' + mismatch.c.sdFnt + ')'
              : 'checked ' + rows.length + ' boundaries');
}

/* ---- 5 — THE COUNTERS ------------------------------------------------------------------------ */
{
  const S = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const stopped = S.stallSweepStoppedByWipe - C0.stopped;
  const lapsed = S.stallLapsedUnrefreshed - C0.lapsed;
  const foot = S.stallExpireAtResidualFoot - C0.foot;
  console.log('\n  COUNTERS across the replays: stallSweepStoppedByWipe +' + stopped
    + '  stallLapsedUnrefreshed +' + lapsed + '  stallExpireAtResidualFoot +' + foot
    + '   stallSweepUnorderedRestored=' + F.stallSweepUnorderedRestored);
  ok(stopped > 0 || CHILD, 'the STOP inside the sweep fired',
     'stallSweepStoppedByWipe moved by ' + stopped + '. These two games ARE the population; a zero '
     + 'here with the board arms green would mean the boards agree for some other reason');
  ok(lapsed > 0, 'CONTROL — the sweep still CLEARS an unrefreshed counter on an ordinary turn',
     'stallLapsedUnrefreshed moved by ' + lapsed + '. A zero here with the board arms green is an '
     + 'engine that never expires a stall counter at all, which is a different and worse defect');
  ok(foot > 0, 'CONTROL — the FOOT placement is still reached',
     'stallExpireAtResidualFoot moved by ' + foot);
  ok(CHILD ? F.stallSweepUnorderedRestored === 1 : F.stallSweepUnorderedRestored === 0,
     'the restore knob is ' + (CHILD ? 'LIVE in the child' : 'OFF in this process')
     + ' — stamped at module LOAD',
     'stallSweepUnorderedRestored=' + F.stallSweepUnorderedRestored);
}

/* ---- 6 — THE RED ----------------------------------------------------------------------------- */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  ---- RE-RUNNING UNDER MEDI_STALL_SWEEP_UNORDERED=1 (the child must FAIL)');
  /* THE CALLER'S OWN FLAGS, not this file's pins — re-pushing those in the child would duplicate
   * them. `--team-store` is restated from `POOL` so the child reads the same pool whether or not the
   * caller named one. */
  const argv = ARGV0.filter((x, i, A) => x !== '--team-store' && A[i - 1] !== '--team-store');
  const r = spawnSync(process.execPath, [__filename, '--team-store', POOL, ...argv],
    { env: Object.assign({}, process.env, { MEDI_STALL_SWEEP_UNORDERED: '1' }), encoding: 'utf8' });
  const childFailed = r.status !== 0;
  const lines = String(r.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(childFailed, 'the restore knob makes this probe RED',
     childFailed ? 'child exit ' + r.status + ', ' + lines.length + ' FAIL line(s):\n          '
                   + lines.join('\n          ')
                 : 'THE CHILD PASSED — this probe cannot tell the ordered walk from the all-or-nothing '
                   + 'pass and asserts nothing about where the clock is spent');
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
