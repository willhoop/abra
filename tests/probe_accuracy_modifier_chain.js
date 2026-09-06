/* probe_accuracy_modifier_chain.js — `chainModify` IS NOT A FLOAT MULTIPLY, AND THE ACCURACY TABLE
 * WAS ONE. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_accuracy_modifier_chain.js
 *   PROBE_RELEASE=<id> ...   opens a FROZEN release instead of the live tree (the red-first arm)
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `docs/ENGINE.md` carries this, on release `ab22bc503717`, as an OWED AND UNDIAGNOSED card:
 *
 *     A `sleeppowder` ACCURACY card, and it is one of the remaining 22. `omit-spread ...bo3-2661122292`
 *     t15: the authority's Sleep Powder hits and this engine's misses, and BOTH ENGINES ASKED THE SAME
 *     ADDRESS (`20260813|15|acc|sleeppowder|p11|0`, nth 0) — so they drew the same number and the
 *     difference is the accuracy THRESHOLD, not the die. Compound Eyes is already tabled at x1.3, so
 *     the obvious explanation is wired and the real cause is not yet known.
 *
 * THE CAUSE IS THAT x1.3. `ACCMOD` carried the multiplier as a JavaScript float and `hitChance`
 * multiplied by it; every handler in that table is a `chainModify`, which is 4096ths and truncates.
 * 75 x 1.3 is 97.5 here. The authority's number is 98 — INSTRUMENTED at `randomChance(accuracy, 100)`
 * on that exact game, on turns 13, 14, 15 and 16, not inferred. The shared die landed in the gap.
 *
 * ================= THE AUTHORITY, CITED AND RE-DERIVED ON EVERY RUN =============================
 *
 *   sim/battle.ts:2318-2327   chainModify(n, d):
 *       previousMod = tr(this.event.modifier * 4096);  nextMod = tr(n * 4096 / d);
 *       this.event.modifier = ((previousMod * nextMod + 2048) >> 12) / 4096;
 *   sim/battle.ts:2329-2340   modify(v, mod):
 *       m = tr(mod * 4096);  return tr((tr(v * m) + 2048 - 1) / 4096);
 *   sim/battle.ts:929-933     runEvent, at the very end:
 *       if (typeof relayVar === 'number' && relayVar === Math.abs(Math.floor(relayVar)))
 *         relayVar = this.modify(relayVar, this.event.modifier);
 *   sim/battle-actions.ts:712 hitStepAccuracy:
 *       accuracy = this.battle.runEvent('ModifyAccuracy', target, pokemon, move, accuracy);
 *       ... then the accuracy/evasion stages ... then randomChance(accuracy, 100)
 *
 * So the authority's post-modifier accuracy is ALWAYS AN INTEGER. `tr` is `num >>> 0` (sim/dex.ts:391).
 *
 * AND THE NUMERATOR CANNOT BE RECOVERED FROM THE FLOAT. `tr(1.3 * 4096)` is 5324; Compound Eyes writes
 * 5325. `tr(1.1 * 4096)` is 4505; Wide Lens writes 4505 and Victory Star writes 4506. medicham2 already
 * carries this exact lesson at `MEDI_FALLEN_APPROX` for Supreme Overlord's power table.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  TABLE      every accuracy handler in the format is found, its RAW `chainModify` argument read
 *                 off the live source, and matched against `ACCMOD[...].mod`. A row with a number this
 *                 file did not just derive FAILS — that is what stops the pair being a typed literal.
 *   2  ARITHMETIC medicham2's own `hitChance` is CALLED (never re-implemented here) on a staged pair
 *                 and compared with a reference transcription of `chainModify`/`modify`, across every
 *                 printed accuracy 30..100 for every live row.
 *   3  FIXTURE    the accusing game is found in the PINNED pool and both pairs build.
 *   4  AUTHORITY  the real Showdown number is captured by wrapping `Battle#randomChance` and reading
 *                 the `(n, 100)` calls; the Sleep Powder one must be 98 and not 97.
 *   5  TEST       the accusing game's board no longer parts.
 *   6  CONTROL    `MEDSEEN.accModChainDifferedFromFloat` moved — a chain installed and indistinguish-
 *                 able from what it replaced would pass every arm above.
 *   7  RED        re-run under `MEDI_ACC_MOD_FLOAT=1`; the child MUST fail.
 *   8  SILENT     re-run under `MEDI_WEATHER_FORME_SURVIVES_FAINT=1` — an unrelated knob from the same
 *                 batch — and the child MUST pass.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE ACCURACY MODIFIER CHAIN');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', 'data/team-pool-frozen');
if (process.env.PROBE_RELEASE) process.argv.push('--release', process.env.PROBE_RELEASE);

const G = require(D('engine', 'game_differential.js'));
const MEDI = G.REL.require('engine/medicham2-browser.js',
                           { need: ['hitChance', 'buildMon'], want: ['MEDSEEN', 'MEDFAILS', 'ACCMOD'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const S = CS.sim();
const { Dex } = S;
const dex = Dex.forFormat(CS.FORMAT);

const CHILD = process.env.MEDI_ACC_MOD_FLOAT === '1'
           || process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1';
const C0 = { chained: MEDI.MEDSEEN.accModChained | 0,
             moved: MEDI.MEDSEEN.accModChainMoved | 0,
             differed: MEDI.MEDSEEN.accModChainDifferedFromFloat | 0 };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== THE ACCURACY MODIFIER CHAIN =='
  + (process.env.MEDI_ACC_MOD_FLOAT === '1' ? '   [MEDI_ACC_MOD_FLOAT=1]' : '')
  + (process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1' ? '   [MEDI_WEATHER_FORME_SURVIVES_FAINT=1 — SILENT CONTROL]' : '')
  + (process.env.PROBE_RELEASE ? '   [release ' + process.env.PROBE_RELEASE + ']' : '') + '\n');

/* ---- THE AUTHORITY'S TWO FUNCTIONS, TRANSCRIBED HERE AS THE REFERENCE ------------------------- */
const tr = n => n >>> 0;
const refChain = (modifier, num, den) => ((tr(modifier * 4096) * tr(num * 4096 / (den || 1)) + 2048) >> 12) / 4096;
const refModify = (v, modifier) => { const m = tr(modifier * 4096); return tr((tr(v * m) + 2048 - 1) / 4096); };

/* ---- 1. THE TABLE, RE-DERIVED OFF THE LIVE FORMAT --------------------------------------------- */
const DERIVED = new Map();
{
  const scan = (kind, e) => {
    for (const k of Object.keys(e)) {
      if (!/ModifyAccuracy/.test(k) || typeof e[k] !== 'function') continue;
      const src = String(e[k]);
      const arr = src.match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
      const num = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
      const set = src.match(/return\s+(\d+)\s*;/);
      if (arr) DERIVED.set(kind + ':' + e.id, { hook: k, mod: [+arr[1], +arr[2]] });
      else if (num) DERIVED.set(kind + ':' + e.id, { hook: k, mod: [tr(+num[1] * 4096), 4096] });
      else if (set) DERIVED.set(kind + ':' + e.id, { hook: k, setTo: +set[1] });
    }
  };
  for (const e of dex.abilities.all()) if (e.exists) scan('ability', e);
  for (const e of dex.items.all()) if (e.exists) scan('item', e);
  const g = dex.conditions.get('gravity');
  if (g && g.onModifyAccuracy) {
    const m = String(g.onModifyAccuracy).match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
    if (m) DERIVED.set('condition:gravity', { hook: 'onModifyAccuracy', mod: [+m[1], +m[2]] });
  }

  const T = MEDI.ACCMOD || {};
  console.log('  ACCURACY HANDLERS IN ' + CS.FORMAT + ', RAW chainModify ARGUMENT, DERIVED THIS RUN:');
  const problems = [];
  for (const [k, d] of [...DERIVED].sort()) {
    const row = T[k];
    const has = row && Array.isArray(row.mod);
    console.log('    ' + k.padEnd(24) + d.hook.padEnd(24)
      + (d.setTo != null ? ('return ' + d.setTo) : ('[' + d.mod.join(', ') + ']')).padEnd(16)
      + '  engine: ' + (!row ? 'NO ROW'
                        : (row.mod ? '[' + row.mod.join(', ') + ']' : (row.setTo != null ? 'setTo ' + row.setTo : 'NO PAIR'))
                        + (row.off ? '   OFF' : '')));
    if (!row) { problems.push(k + ': the format has an accuracy handler and ACCMOD has NO ROW'); continue; }
    if (d.setTo != null) {
      if (row.setTo !== d.setTo) problems.push(k + ': SET-TO format=' + d.setTo + ' engine=' + row.setTo);
      continue;
    }
    if (!has) { problems.push(k + ': the format chainModifies ' + JSON.stringify(d.mod) + ' and ACCMOD carries no `mod` pair'); continue; }
    /* Compared as the RESOLVED nextMod rather than as the literal pair, because `[2048,4096]` and a
     * bare `0.5` are the same modifier and the table is allowed to write either. */
    const want = tr(d.mod[0] * 4096 / d.mod[1]), got = tr(row.mod[0] * 4096 / row.mod[1]);
    if (want !== got) problems.push(k + ': nextMod format=' + want + ' engine=' + got
      + '  (' + JSON.stringify(d.mod) + ' vs ' + JSON.stringify(row.mod) + ')');
  }
  for (const p of problems) console.log('    !! ' + p);
  ok(DERIVED.size > 0, 'the format has accuracy handlers to check against', DERIVED.size + ' found');
  ok(problems.length === 0, 'every ACCMOD row carries the format\'s OWN chainModify argument',
     problems.length ? problems.join('\n          ')
                     : 'all ' + DERIVED.size + ' derived handlers matched — the numbers are READ, not typed');
}

/* ---- 2. THE ARITHMETIC, THROUGH medicham2's OWN `hitChance` ----------------------------------- */
{
  /* A staged pair, built through the engine's own builder. Compound Eyes is the row the accusing game
   * turns on; Wide Lens is the second live attacker row and Bright Powder the live defender one. */
  const att = MEDI.buildMon('vivillon');
  const def = MEDI.buildMon('archaludon');
  let armed = 0, wrong = [];
  if (!att || !def) {
    ok(false, 'ARITHMETIC — the staged pair builds', 'buildMon refused — a FIXTURE fault');
  } else {
    const field = { weather: '', terrain: '', gravity: 0 };
    const CASES = [
      { label: 'ability:compoundeyes', apply: () => { att.ability = 'compoundeyes'; att.item = ''; def.item = ''; } },
      { label: 'item:widelens', apply: () => { att.ability = 'shielddust'; att.item = 'widelens'; def.item = ''; } },
      { label: 'item:brightpowder', apply: () => { att.ability = 'shielddust'; att.item = ''; def.item = 'brightpowder'; } },
      { label: 'none', apply: () => { att.ability = 'shielddust'; att.item = ''; def.item = ''; } },
    ];
    for (const C of CASES) {
      C.apply();
      const row = (MEDI.ACCMOD || {})[C.label];
      for (const mv of ['sleeppowder', 'hypnosis', 'thunder', 'blizzard', 'focusblast', 'megahorn', 'icebeam']) {
        const m = dex.moves.get(mv);
        if (!m || !m.exists || typeof m.accuracy !== 'number') continue;
        let want = m.accuracy;
        if (row && !row.off && Array.isArray(row.mod)) want = refModify(want, refChain(1, row.mod[0], row.mod[1]));
        const got = MEDI.hitChance(att, def, mv, field, {});
        armed++;
        if (got !== want) wrong.push(C.label + ' ' + mv + ' printed=' + m.accuracy + ' want=' + want + ' got=' + got);
      }
    }
    console.log('\n  ARITHMETIC — ' + armed + ' (row x move) pairs, medicham2\'s own hitChance against the '
      + 'reference transcription of chainModify/modify');
    for (const w of wrong.slice(0, 12)) console.log('    !! ' + w);
    ok(armed > 0, 'the arithmetic arm is armed', armed + ' pair(s)');
    ok(wrong.length === 0, 'ARITHMETIC — hitChance equals the authority\'s truncated chain everywhere',
       wrong.length ? wrong.length + ' disagreement(s), first shown above'
                    : 'all ' + armed + ' pairs agree, including 75 x compoundeyes = 98 (not 97.5)');
  }
}

/* ---- 3..6. THE ACCUSING GAME ------------------------------------------------------------------ */
const W = { cfg: 'omit-spread', turn: 15,
  tag: 'gen9championsvgc2026regmbbo3-2661122292 vs gen9championsvgc2026regmbbo3-2661233657',
  leaf: 'p1.active[1].status' };

const Battle = S.Battle;
const realRC = Battle.prototype.randomChance;
const ACCLOG = [];
Battle.prototype.randomChance = function (num, den) {
  if (den === 100) ACCLOG.push({ turn: this.turn, num, move: this.activeMove && this.activeMove.id });
  return realRC.call(this, num, den);
};

const t0 = Date.now();
const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
console.log('\n  pool built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — '
  + SW.out.reduce((a, c) => a + c.picked, 0) + ' teams picked from ' + SW.teams.length);

{
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    ok(false, 'FIXTURE — the pair is in the PINNED pool', 'a=' + !!ta + ' b=' + !!tb);
  } else {
    const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
    ok(!!a && !!b, 'FIXTURE — both sides build', a && b ? 'built' : 'buildPair refused');
    if (a && b) {
      let SDLOG = null; const marks = [];
      const r = G.playGame(a, b, W.cfg, W.tag, {
        driverSeed: W.cfg + '|' + W.tag,
        onBoundary: (snap, turnIdx, St, battle) => { SDLOG = battle.log; marks.push({ t: turnIdx, len: battle.log.length }); },
      });
      console.log('\n  ---- ' + W.cfg + '  ' + W.tag);
      console.log('       artifact says: board parts at t' + W.turn + ' — status medi `brn` / sd `slp`, +7 more leaves');
      console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
        + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null) + ' void=' + !!r.void + ' err=' + (r.err || '-'));
      if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

      const sp = ACCLOG.filter(l => l.move === 'sleeppowder');
      console.log('       AUTHORITY randomChance(n,100) for sleeppowder, INSTRUMENTED: '
        + JSON.stringify(sp.map(l => 't' + l.turn + '=' + l.num)));
      ok(sp.length > 0 && sp.every(l => l.num === 98),
         'AUTHORITY — Compound Eyes\' Sleep Powder is 98, not 97 and not 97.5',
         sp.length ? 'every call reads ' + [...new Set(sp.map(l => l.num))].join('/')
                   : 'NO sleeppowder accuracy call was seen at all — the instrument, not the engine');

      const bt = (r.stateDiv && r.stateDiv.turn) || W.turn;
      const mi = marks.findIndex(m => m.t === bt);
      const from = mi > 0 ? marks[mi - 1].len : 0, to = mi >= 0 ? marks[mi].len : (SDLOG || []).length;
      console.log('       AUTHORITY t' + bt + ': ' + JSON.stringify((SDLOG || []).slice(from, to)));
      const mt = r.mediTrace || [];
      let s0 = -1, e0 = mt.length;
      for (let i = 0; i < mt.length; i++) {
        if (mt[i] === '|turn|' + bt) s0 = i; else if (mt[i] === '|turn|' + (bt + 1)) { e0 = i; break; }
      }
      console.log('       MEDICHAM2 t' + bt + ': ' + JSON.stringify(mt.slice(Math.max(0, s0), e0)));

      ok(!r.stateDiv, 'TEST — no board leaf parts at any boundary',
         r.stateDiv ? 'parted at t' + r.stateDiv.turn + ': '
                      + r.stateDiv.diffs.map(d => d.path + ' medi ' + JSON.stringify(d.medicham)
                                                + ' / sd ' + JSON.stringify(d.showdown)).join('; ')
                    : 'boards identical at all ' + marks.length + ' boundaries');
    }
  }
}
Battle.prototype.randomChance = realRC;

/* ---- THE COUNTERS ----------------------------------------------------------------------------- */
{
  const M = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const chained = (M.accModChained | 0) - C0.chained;
  const moved = (M.accModChainMoved | 0) - C0.moved;
  const differed = (M.accModChainDifferedFromFloat | 0) - C0.differed;
  console.log('\n  COUNTERS across the replay: accModChained +' + chained + '  accModChainMoved +' + moved
    + '  accModChainDifferedFromFloat +' + differed
    + '   accModNoChainPair=' + (F.accModNoChainPair | 0)
    + (F.accModNoChainPair ? ' first=' + F.accModNoChainPairFirst : '')
    + '   accModFloatRestored=' + (F.accModFloatRestored | 0));
  ok(chained > 0 || process.env.MEDI_ACC_MOD_FLOAT === '1', 'the chain is REACHED',
     'accModChained moved by ' + chained + ' — a zero means the accumulator is present and dead');
  ok(differed > 0 || process.env.MEDI_ACC_MOD_FLOAT === '1',
     'CONTROL — the chain DISAGREES with the float multiply it replaced',
     'accModChainDifferedFromFloat moved by ' + differed + '. A zero with the arms above green is a '
     + 'chain that cannot be told apart from what it replaced, which is a green test asking nothing');
  ok((F.accModNoChainPair | 0) === 0, 'no ACCMOD row fell back to a float multiply',
     'accModNoChainPair=' + (F.accModNoChainPair | 0)
     + (F.accModNoChainPair ? ' first=' + F.accModNoChainPairFirst : ''));
  if (process.env.MEDI_ACC_MOD_FLOAT === '1') {
    ok((F.accModFloatRestored | 0) === 1, 'the restore knob is LIVE in the child');
  } else {
    ok((F.accModFloatRestored | 0) === 0, 'the restore knob is OFF in this process');
  }
}

/* ---- THE RED, AND THE SILENT CONTROL ---------------------------------------------------------- */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const run = (env) => spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env), encoding: 'utf8' });

  console.log('\n  ---- RE-RUNNING UNDER MEDI_ACC_MOD_FLOAT=1 (the child must FAIL)');
  const red = run({ MEDI_ACC_MOD_FLOAT: '1' });
  const redLines = String(red.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(red.status !== 0, 'the restore knob makes this probe RED',
     red.status !== 0 ? 'child exit ' + red.status + ', ' + redLines.length + ' FAIL line(s):\n          '
                        + redLines.join('\n          ')
                      : 'THE CHILD PASSED — this probe cannot tell a float multiply from the chain');

  console.log('\n  ---- RE-RUNNING UNDER MEDI_WEATHER_FORME_SURVIVES_FAINT=1 (the SILENT control must PASS)');
  const quiet = run({ MEDI_WEATHER_FORME_SURVIVES_FAINT: '1' });
  const quietLines = String(quiet.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(quiet.status === 0, 'SILENT CONTROL — an unrelated knob from this batch does not move this probe',
     quiet.status === 0 ? 'child exit 0 — the fixes are independent'
                        : 'child exit ' + quiet.status + ', ' + quietLines.length + ' FAIL line(s):\n          '
                          + quietLines.join('\n          '));
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
