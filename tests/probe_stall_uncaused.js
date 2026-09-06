/* probe_stall_uncaused.js — THE THREE `stall` GAMES THAT PART A BOARD WITH NO PROTOCOL DIVERGENCE,
 * MADE VISIBLE. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_stall_uncaused.js
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `data/game-differential.json` on release `57679ef9a4a3` reads **27 board-material games of 961**,
 * and 5 of them part a BOARD while `protocol_diverged_at_turn` is `null` — the two protocol streams
 * are identical from the first line to the last. Three of the five are one leaf:
 *
 *     omit-weather  t7   ...bo3-2660414382 vs ...bo3-2660511720   p1.active[1].stall  medi 0 / sd 3
 *     omit-weather  t9   ...bo3-2635949496 vs ...bo3-2634741388   p1.active[0].stall  medi 0 / sd 3
 *     omit-spread   t16  ...bo3-2655675221 vs ...bo3-2655657090   p2.active[1].stall  medi 0 / sd 3
 *
 * THEY ARE INVISIBLE TO `--dump-games` BY CONSTRUCTION. That dump writes the lines either side of a
 * PROTOCOL split, and these games have no protocol split — so the only thing any artifact says about
 * them is the one-line leaf above. This file replays exactly those three games under the published
 * pins and prints, at every turn boundary, what each engine believes about every active body's stall
 * clock. Making them visible is the point; the assertion below is what stops them going quiet again.
 *
 * ================= THE AUTHORITY, RE-DERIVED ON EVERY RUN =======================================
 *
 * `data/conditions.ts` `stall` (NO Champions override — `data/mods/champions/conditions.ts` carries
 * `par`, `slp` and `frz` and nothing else):
 *
 *     duration: 2, counterMax: 729,
 *     onStart()   { this.effectState.counter = 3; }
 *     onRestart() { if (counter < counterMax) counter *= 3; this.effectState.duration = 2; }
 *     onStallMove(pokemon) { const c = counter || 1; const success = this.randomChance(1, c);
 *                            if (!success) delete pokemon.volatiles['stall']; return success; }
 *
 * and the duration is spent by `Battle#fieldEvent('Residual')` — `getKey = 'duration'`
 * (sim/battle.ts:487) collects a volatile that carries one even with no `onResidual` handler, and
 * `handler.state.duration--` (sim/battle.ts:516) removes it at zero. TWO residuals with no refresh
 * in between and the volatile is gone.
 *
 * The MEMBERSHIP is derived here rather than typed: every legal move that is `stallingMove` or whose
 * handlers call `addVolatile('stall')`. Printed on every run.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  FIXTURE  the three games are found in the PINNED pool and both pairs build. A game that
 *               cannot be staged is a FAILURE of this file, never a statement about the mechanic.
 *   2  CONTROL  the protocol streams of each replayed game agree (`div === null`) — if they do not,
 *               this replay is not the game the artifact describes and nothing below it means
 *               anything.
 *   3  TEST     at every turn boundary of every replayed game, medicham2's stall counter equals
 *               Showdown's `volatiles.stall.counter` for every active body.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE UNCAUSED STALL GAMES');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

/* THE PINS. `--games 1200` is part of the SAMPLE DEFINITION and not a budget: `buildSwarm` is sized
 * from it, so a different number is a different pool and therefore a different pairing. These are the
 * flags `docs/_reports/2026-09-06-pool-pin-and-remeasure.md` records for the published run. */
const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', 'data/team-pool-frozen');

const G = require(D('engine', 'game_differential.js'));
/* THE ENGINE THE DRIVER ACTUALLY PLAYED, not a second load of the same path. `game_differential.js`
 * opens medicham2 through `REL.require`, which evaluates the release's own copy — a plain
 * `require('engine/medicham2-browser.js')` here returns a DIFFERENT module object whose counters stay
 * at zero all run, which reads exactly like a wire that never fired. Every other probe in this
 * directory that reads a counter goes through this same door for the same reason. */
const MEDI = G.REL.require('engine/medicham2-browser.js',
                           { want: ['MEDSEEN', 'MEDFAILS', 'stallBoardCounter'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const CHILD = process.env.MEDI_STALL_LAPSE_AT_RESIDUAL_OPEN === '1';
const C0 = { foot: MEDI.MEDSEEN.stallExpireAtResidualFoot,
             lapsed: MEDI.MEDSEEN.stallLapsedUnrefreshed,
             skipped: MEDI.MEDSEEN.stallSurvivedSkippedResidual,
             heldLast: MEDI.MEDSEEN.stallHeldByUnfinishedResidual };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== THE THREE UNCAUSED `stall` GAMES =='
  + (CHILD ? '   [MEDI_STALL_LAPSE_AT_RESIDUAL_OPEN=1]' : '') + '\n');

/* ---- THE AUTHORITY, RE-DERIVED --------------------------------------------------------------- */
{
  const st = dex.conditions.get('stall');
  console.log('  stall (data/conditions.ts, no Champions override): duration=' + st.duration
    + ' counterMax=' + st.counterMax);
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const fam = [];
  for (const m of dex.moves.all()) {
    if (!legal(m)) continue;
    let adds = false;
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (typeof v === 'function' && /addVolatile\(\s*['"]stall['"]\s*\)/.test(String(v))) adds = true;
    }
    if (adds || m.stallingMove) fam.push(m.id + (m.stallingMove ? '/rolls' : '/feeds-only'));
  }
  console.log('  every legal move that touches the volatile, DERIVED: ' + fam.sort().join(', '));
  ok(fam.length > 0, 'the stall family is non-empty', fam.length + ' member(s)');
}

/* ---- THE THREE GAMES, NAMED OFF THE PUBLISHED ARTIFACT ---------------------------------------- */
const WANT = [
  { cfg: 'omit-weather', turn: 7,
    tag: 'gen9championsvgc2026regmbbo3-2660414382 vs gen9championsvgc2026regmbbo3-2660511720',
    leaf: 'p1.active[1].stall' },
  { cfg: 'omit-weather', turn: 9,
    tag: 'gen9championsvgc2026regmbbo3-2635949496 vs gen9championsvgc2026regmbbo3-2634741388',
    leaf: 'p1.active[0].stall' },
  { cfg: 'omit-spread', turn: 16,
    tag: 'gen9championsvgc2026regmbbo3-2655675221 vs gen9championsvgc2026regmbbo3-2655657090',
    leaf: 'p2.active[1].stall' },
];

const t0 = Date.now();
const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
console.log('  pool built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — '
  + SW.out.reduce((a, c) => a + c.picked, 0) + ' teams picked from ' + SW.teams.length);

for (const W of WANT) {
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    ok(false, W.cfg + ' t' + W.turn + ': the pair is in the PINNED pool',
       'a=' + !!ta + ' b=' + !!tb + ' — a FIXTURE fault, never a claim about the mechanic');
    continue;
  }
  const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
  if (!a || !b) { ok(false, W.cfg + ' t' + W.turn + ': both sides build', 'buildPair refused'); continue; }

  const rows = [];
  let SDLOG = null;
  const r = G.playGame(a, b, W.cfg, W.tag, {
    driverSeed: W.cfg + '|' + W.tag,
    onBoundary: (snap, turnIdx, S, battle) => {
      const cells = [];
      for (const [lab, arr, side] of [['p1', S.actA, battle.sides[0]], ['p2', S.actB, battle.sides[1]]]) {
        for (let i = 0; i < 2; i++) {
          const m = arr[i], p = side.active[i];
          const v = p && p.volatiles && p.volatiles.stall;
          cells.push({
            slot: lab + '.a[' + i + ']',
            who: (m ? m.name : '-') + '/' + (p && p.species ? p.species.id : '-'),
            meN: m ? (m.tookProtectTurns | 0) : -1,
            meFresh: m ? !!m._stallFresh : false,
            meFnt: m ? !!m.fainted : null,
            sdCtr: v ? v.counter : 0,
            sdDur: v ? v.duration : 0,
            sdFnt: p ? !!p.fainted : null,
          });
        }
      }
      SDLOG = battle.log;
      rows.push({ t: turnIdx, cells, sdLog: battle.log.length, sdEnded: !!battle.ended,
                  sdWin: battle.winner || null });
    },
  });

  console.log('\n  ---- ' + W.cfg + '  ' + W.tag);
  console.log('       artifact says: board parts at t' + W.turn + ' on ' + W.leaf + '  (medi 0 / sd 3)');
  console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
    + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null)
    + ' endedMedi=' + r.endedMedi + ' endedSd=' + r.endedSd
    + ' void=' + !!r.void + ' err=' + (r.err || '-'));
  if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

  /* THE LAST TURN, BOTH STREAMS. See the header: nothing else in the repository prints these. */
  {
    const prev = rows.length > 1 ? rows[rows.length - 2] : null;
    const last = rows[rows.length - 1];
    console.log('       AUTHORITY, final turn: '
      + JSON.stringify((SDLOG || []).slice(prev ? prev.sdLog : 0)));
    const mt = r.mediTrace || [];
    let k = mt.length - 1; let seen = 0;
    for (; k >= 0; k--) { if (/^\|turn\|/.test(String(mt[k]))) { seen++; if (seen === 1) break; } }
    console.log('       MEDICHAM2, final turn: ' + JSON.stringify(mt.slice(Math.max(0, k))));
    console.log('       sd ended=' + (last ? last.sdEnded : '?') + ' winner=' + (last ? last.sdWin : '?'));
  }

  ok(!r.div, W.cfg + ' t' + W.turn + ': CONTROL — the protocol streams agree end to end',
     r.div ? 'the protocol parted at index ' + r.div.index + ' — this replay is NOT the artifact\'s game'
           : 'no protocol divergence, exactly as the artifact records');

  /* THE TABLE. Only rows where SOMETHING is carrying a clock, or where the two engines disagree —
   * a 20-turn game with four bodies is 80 lines of zeroes otherwise. */
  let printed = 0, mismatch = null;
  for (const row of rows) {
    const live = row.cells.filter(c => c.meN > 0 || c.sdCtr > 0);
    if (!live.length) continue;
    printed++;
    console.log('       t' + String(row.t).padEnd(3) + live.map(c =>
      c.slot + ' ' + c.who + '  me_n=' + c.meN + ' fresh=' + (c.meFresh ? 'Y' : 'n')
      + ' fnt=' + (c.meFnt ? 'Y' : 'n') + '   sd_ctr=' + c.sdCtr + ' dur=' + c.sdDur
      + ' fnt=' + (c.sdFnt ? 'Y' : 'n')).join('\n           '));
    for (const c of live) {
      /* `stallCounter` is medicham2's OWN map from its tally to the authority's denominator —
       * called, never copied, exactly as engine/board_state.js calls it. */
      const meCtr = MEDI.stallBoardCounter(c.meN);
      if (meCtr !== c.sdCtr && !mismatch) mismatch = { t: row.t, c, meCtr };
    }
  }
  if (!printed) console.log('       (no body carried a stall clock at any boundary)');
  ok(!mismatch, W.cfg + ' t' + W.turn + ': every active body\'s stall counter agrees at every boundary',
     mismatch ? 'first disagreement at t' + mismatch.t + ' ' + mismatch.c.slot + ' ' + mismatch.c.who
                + ': medicham2 ' + mismatch.meCtr + ' (tookProtectTurns=' + mismatch.c.meN
                + ', fresh=' + mismatch.c.meFresh + ', fainted=' + mismatch.c.meFnt + ')'
                + ' / showdown ' + mismatch.c.sdCtr + ' (duration=' + mismatch.c.sdDur
                + ', fainted=' + mismatch.c.sdFnt + ')'
              : 'checked ' + rows.length + ' boundaries');
}

/* ================================================================================================
 * 4 — THE COUNTERS. Three boards agreeing is not evidence that the SWEEP still runs: an engine that
 * never expired a stall counter at all would pass every arm above. These say the placement fires,
 * that it still CLEARS on an ordinary turn, and that it held on exactly the turn it should have.
 * ============================================================================================= */
{
  const S = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const foot = S.stallExpireAtResidualFoot - C0.foot;
  const lapsed = S.stallLapsedUnrefreshed - C0.lapsed;
  const held = (S.stallSurvivedSkippedResidual - C0.skipped)
             + (S.stallHeldByUnfinishedResidual - C0.heldLast);
  console.log('\n  COUNTERS across the three replays: stallExpireAtResidualFoot +' + foot
    + '  stallLapsedUnrefreshed +' + lapsed
    + '  (stallSurvivedSkippedResidual + stallHeldByUnfinishedResidual) +' + held
    + '   stallLapseAtResidualOpenRestored=' + F.stallLapseAtResidualOpenRestored);
  ok(foot > 0 || CHILD, 'the FOOT placement is reached',
     'stallExpireAtResidualFoot moved by ' + foot + ' — a zero means the call is present and dead');
  ok(lapsed > 0, 'CONTROL — the sweep still CLEARS an unrefreshed counter on an ordinary turn',
     'stallLapsedUnrefreshed moved by ' + lapsed
     + '. A zero here with the arms above green is an engine that never expires a stall counter at '
     + 'all, which passes every board arm in this file and is a different, worse defect');
  ok(held > 0, 'and a counter was HELD by a residual that did not finish',
     'held ' + held + ' — this is the population the fix changes');
  if (!CHILD) {
    ok(F.stallLapseAtResidualOpenRestored === 0, 'the restore knob is OFF in this process',
       'stallLapseAtResidualOpenRestored=' + F.stallLapseAtResidualOpenRestored);
  } else {
    ok(F.stallLapseAtResidualOpenRestored === 1, 'the restore knob is LIVE in the child',
       'stallLapseAtResidualOpenRestored=' + F.stallLapseAtResidualOpenRestored);
  }
}

/* ================================================================================================
 * 5 — THE RED. The parent re-runs itself under the restore knob and must see it FAIL.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  ---- RE-RUNNING UNDER MEDI_STALL_LAPSE_AT_RESIDUAL_OPEN=1 (the child must FAIL)');
  const r = spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, { MEDI_STALL_LAPSE_AT_RESIDUAL_OPEN: '1' }),
      encoding: 'utf8' });
  const childFailed = r.status !== 0;
  const lines = String(r.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(childFailed, 'the restore knob makes this probe RED',
     childFailed ? 'child exit ' + r.status + ', ' + lines.length + ' FAIL line(s):\n          '
                   + lines.join('\n          ')
                 : 'THE CHILD PASSED — this probe cannot tell the two placements apart and asserts '
                   + 'nothing about where the clock is spent');
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
