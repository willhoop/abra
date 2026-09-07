/* probe_pressure_terrain_target.js — PRESSURE IS PRICED OFF THE TARGET LIST THE TERRAIN LEAVES,
 * NOT OFF THE DEX'S STATIC `move.target`. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_pressure_terrain_target.js
 *   PROBE_RELEASE=<id> ...   opens a FROZEN release instead of the live tree (the red-first arm)
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `data/game-differential.json` on release `ab22bc503717` reads 22 board-material games of 961, and
 * TWO of them part a board while `protocol_diverged_at_turn` is `null`. This is the other one:
 *
 *     baseline  t6  ...bo3-2661571698 vs ...bo3-2661611862
 *       p1.pp[1].expandingforce   medi 1 SPENT  sd 2 SPENT
 *
 * (`board_state.js` compares PP AS WHAT HAS BEEN SPENT — see its `pp-is-what-has-been-spent` mapping —
 * so the authority took one MORE PP than this engine did.) The turn is a Meowstic's Expanding Force
 * under Psychic Terrain into a Houndoom and a Pressure Absol. The only line that differs is the
 * `[spread]` field on the `|move|`, which the semantic normaliser collapses — so the game has no
 * protocol divergence, no cause, no class, and nothing in any artifact to grep.
 *
 * ================= THE AUTHORITY, CITED AND NOT REMEMBERED ======================================
 *
 * `BattleActions#useMoveInner`, sim/battle-actions.ts:
 *     let baseTarget = move.target;
 *     ... singleEvent('ModifyMove', ...)                     <- Expanding Force rewrites move.target
 *     if (baseTarget !== move.target) target = getRandomTarget(pokemon, move);   // :440-443
 *     const { targets, pressureTargets } = pokemon.getMoveTargets(move, target); // :467
 *     for (const source of pressureTargets) extraPP += runEvent('DeductPP', source, pokemon, move);
 *     if (extraPP > 0) pokemon.deductPP(..., extraPP);                            // :471-482
 *
 * So the target list Pressure is charged off is resolved AFTER the rewrite. And the rewrite itself is
 * `expandingforce.onModifyMove` (data/moves.ts:4953-4964, no Champions override — checked by key on
 * every run below): `if (this.field.isTerrain('psychicterrain') && source.isGrounded()) move.target =
 * 'allAdjacentFoes'`.
 *
 * Pressure is `onDeductPP(target, source) { if (target.isAlly(source)) return; return 1; }`, so each
 * apparent target that carries it costs one more PP and an ALLY costs nothing.
 *
 * ================= WHAT WAS WRONG ===============================================================
 *
 * `pressureScopeOf` reads `targetClass`, and that tag carries Showdown's STATIC `move.target` string —
 * its own header in medicham2 says so. Expanding Force is `normal` in the dex, so the scope resolved
 * to `aimed` and the list was the single body the click named. The fix asks
 * `terrainWidensToSpread(...)` — THE function the effect road and the damage-span road already ask,
 * never a second table keyed on the move's name.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  MEMBERSHIP  every legal move whose handlers ASSIGN `move.target` is derived off the format and
 *                  PRINTED, so a second member arriving next regulation is visible rather than
 *                  silently mispriced. An empty family is a failure of this file.
 *   2  AUTHORITY   Expanding Force's rewrite and Pressure's `onDeductPP` are re-read off the live
 *                  format every run, and Champions' override of neither is checked by key.
 *   3  FIXTURE     the accusing game is found in the PINNED pool and both pairs build.
 *   4  CONTROL     the protocol streams agree end to end, exactly as the artifact records.
 *   5  TEST        no board leaf parts, and in particular `p1.pp[1].expandingforce` agrees.
 *   6  CONTROL     `MEDSEEN.ppPressureCharged` moved in the same replay — an engine that had stopped
 *                  charging Pressure at all would pass arm 5 on a game with no Pressure body and is a
 *                  different, worse defect.
 *   7  RED         re-run under `MEDI_PP_PRESSURE_STATIC_TARGET=1`; the child MUST fail.
 *   8  SILENT      re-run under `MEDI_WEATHER_FORME_SURVIVES_FAINT=1` — this session's OTHER knob — and
 *                  the child MUST pass.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('PRESSURE AND THE TERRAIN-WIDENED TARGET LIST');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', 'data/team-pool-frozen');
if (process.env.PROBE_RELEASE) process.argv.push('--release', process.env.PROBE_RELEASE);

const G = require(D('engine', 'game_differential.js'));
const MEDI = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const CHILD = process.env.MEDI_PP_PRESSURE_STATIC_TARGET === '1'
           || process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1';
const C0 = { wide: MEDI.MEDSEEN.ppPressureTerrainWidened | 0,
             charged: MEDI.MEDSEEN.ppPressureCharged | 0,
             deducted: MEDI.MEDSEEN.ppDeducted | 0 };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== PRESSURE AND THE TERRAIN-WIDENED TARGET LIST =='
  + (process.env.MEDI_PP_PRESSURE_STATIC_TARGET === '1' ? '   [MEDI_PP_PRESSURE_STATIC_TARGET=1]' : '')
  + (process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1' ? '   [MEDI_WEATHER_FORME_SURVIVES_FAINT=1 — SILENT CONTROL]' : '')
  + (process.env.PROBE_RELEASE ? '   [release ' + process.env.PROBE_RELEASE + ']' : '') + '\n');

/* ---- 1..2. THE MEMBERSHIP AND THE AUTHORITY, BOTH DERIVED ------------------------------------- */
{
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const fam = [];
  for (const m of dex.moves.all()) {
    if (!legal(m)) continue;
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (typeof v !== 'function') continue;
      const src = String(v);
      if (!/move\.target\s*=/.test(src)) continue;
      const to = [...src.matchAll(/move\.target\s*=\s*['"]([a-zA-Z]+)['"]/g)].map(x => x[1]);
      fam.push(m.id + '  ' + k + ' -> ' + (to.join(',') || '(computed)') + '   static target=' + m.target);
    }
  }
  console.log('  every legal move whose handlers ASSIGN `move.target`, DERIVED off ' + CS.FORMAT + ':');
  for (const f of fam.sort()) console.log('    ' + f);
  ok(fam.length > 0, 'the target-rewriting family is non-empty', fam.length + ' member(s)');
  /* THE FAMILY IS PINNED AT TWO, AND THE SECOND MEMBER IS SETTLED — 2026-09-06.
   *
   * `curse` also rewrites its target — but AWAY from the foes: `onModifyMove` sends a non-Ghost user's
   * Curse to `move.nonGhostTarget`, so the authority's `pressureTargets` reaches nobody and charges
   * nothing. THIS FILE USED TO SAY THAT THIS ENGINE THEREFORE OVER-CHARGES 1 PP, and carried it on the
   * hand list as owed work. **IT DOES NOT, AND THAT WAS AN INFERENCE NOBODY HAD MEASURED.** The engine
   * resolves the type split when it BUILDS the action, so the action's target is already the user by
   * the time the PP road reads it and `ppPressureExtra`'s `t === user` clause refuses it — the same
   * answer by a different road. Measured over five staged arms, including two Pressure foes and the
   * Pressure body in the unaimed slot: `ppPressureCharged` moved 0 every time, with a GHOST-user
   * control on the same click moving it 0 -> 1 so the instrument is not merely blind.
   * `tests/probe_curse_pressure_pp.js` is that measurement and it stands as the refutation.
   *
   * PINNED AT TWO so a third member arriving in a later regulation FAILS this file rather than being
   * silently mispriced — which is exactly how Expanding Force got here. */
  ok(fam.length === 2, 'the family is EXACTLY the two known members',
     fam.length === 2 ? 'expandingforce (fixed here) and curse (measured CORRECT by a different road '
                        + '— tests/probe_curse_pressure_pp.js; see the comment above this arm)'
                      : 'it is ' + fam.length + ': ' + fam.join(' | ') + '. A new member is priced off '
                        + 'the STATIC target word by `pressureScopeOf` and needs its own decision.');
  ok(fam.some(f => f.startsWith('expandingforce')),
     'Expanding Force is in it, and its STATIC target is `normal`',
     'so `targetClass` — which carries the static word — resolves it to the `aimed` scope');

  const ef = dex.moves.get('expandingforce');
  const efSrc = String(ef.onModifyMove || '');
  ok(/psychicterrain/.test(efSrc) && /isGrounded/.test(efSrc),
     'the gate is Psychic Terrain AND the USER\'s feet, read off the handler',
     efSrc.replace(/\s+/g, ' ').slice(0, 200));

  const pr = dex.abilities.get('pressure');
  const prSrc = String(pr.onDeductPP || '');
  ok(/isAlly/.test(prSrc) && /return\s+1/.test(prSrc),
     'Pressure charges 1 per apparent target and an ALLY charges nothing',
     prSrc.replace(/\s+/g, ' '));

  /* CHAMPIONS OVERRIDES NEITHER, CHECKED BY KEY rather than recalled — the mod overrides eight files
   * and reading mainline is the standing failure this check exists to refuse. */
  const fs = require('fs');
  const modMoves = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const modAb = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  ok(!/^\s*expandingforce\s*:/m.test(modMoves), 'Champions does not override `expandingforce`');
  ok(!/^\s*pressure\s*:/m.test(modAb), 'Champions does not override `pressure`');
}

/* ---- 3..6. THE ACCUSING GAME ------------------------------------------------------------------ */
const W = { cfg: 'baseline', turn: 6,
  tag: 'gen9championsvgc2026regmbbo3-2661571698 vs gen9championsvgc2026regmbbo3-2661611862',
  leaf: 'p1.pp[1].expandingforce' };

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
    ok(false, 'FIXTURE — the pair is in the PINNED pool',
       'a=' + !!ta + ' b=' + !!tb + ' — a FIXTURE fault, never a claim about the mechanic');
  } else {
    const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
    ok(!!a && !!b, 'FIXTURE — both sides build', a && b ? 'built' : 'buildPair refused');
    if (a && b) {
      let SDLOG = null; const marks = [];
      const r = G.playGame(a, b, W.cfg, W.tag, {
        driverSeed: W.cfg + '|' + W.tag,
        onBoundary: (snap, turnIdx, S, battle) => { SDLOG = battle.log; marks.push({ t: turnIdx, len: battle.log.length }); },
      });
      console.log('\n  ---- ' + W.cfg + '  ' + W.tag);
      console.log('       artifact says: board parts at t' + W.turn + ' on ' + W.leaf + '  (medi 1 spent / sd 2)');
      console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
        + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null)
        + ' void=' + !!r.void + ' err=' + (r.err || '-'));
      if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

      /* BOTH STREAMS FOR THE PARTING TURN. Nothing else in the repository prints these for a game
       * with no protocol split. */
      const bt = (r.stateDiv && r.stateDiv.turn) || W.turn;
      const mi = marks.findIndex(m => m.t === bt);
      const from = mi > 0 ? marks[mi - 1].len : 0, to = mi >= 0 ? marks[mi].len : (SDLOG || []).length;
      console.log('       AUTHORITY t' + bt + ': ' + JSON.stringify((SDLOG || []).slice(from, to)));
      const mt = r.mediTrace || [];
      let s = -1, e = mt.length;
      for (let i = 0; i < mt.length; i++) {
        if (mt[i] === '|turn|' + bt) s = i; else if (mt[i] === '|turn|' + (bt + 1)) { e = i; break; }
      }
      console.log('       MEDICHAM2 t' + bt + ': ' + JSON.stringify(mt.slice(Math.max(0, s), e)));

      ok(!r.div, 'CONTROL — the protocol streams agree end to end',
         r.div ? 'the protocol parted at index ' + r.div.index + ' — this replay is NOT the artifact\'s game'
               : 'no protocol divergence, exactly as the artifact records');
      ok(!r.stateDiv, 'TEST — no board leaf parts at any boundary',
         r.stateDiv ? 'parted at t' + r.stateDiv.turn + ': '
                      + r.stateDiv.diffs.map(d => d.path + ' medi ' + JSON.stringify(d.medicham)
                                                + ' / sd ' + JSON.stringify(d.showdown)).join('; ')
                    : 'boards identical at all ' + marks.length + ' boundaries');
    }
  }
}

/* ---- THE COUNTERS ----------------------------------------------------------------------------- */
{
  const S = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const wide = (S.ppPressureTerrainWidened | 0) - C0.wide;
  const charged = (S.ppPressureCharged | 0) - C0.charged;
  const deducted = (S.ppDeducted | 0) - C0.deducted;
  console.log('\n  COUNTERS across the replay: ppPressureTerrainWidened +' + wide
    + '  ppPressureCharged +' + charged + '  ppDeducted +' + deducted
    + '   ppPressureStaticTargetRestored=' + (F.ppPressureStaticTargetRestored | 0));
  ok(deducted > 0, 'CONTROL — PP is being spent at all in this replay',
     'ppDeducted moved by ' + deducted + '. A zero means the whole PP wire is inert, which passes the '
     + 'board arm on any game whose PP happens to agree');
  ok(charged > 0, 'CONTROL — Pressure still charges its extra PP',
     'ppPressureCharged moved by ' + charged + '. A zero here with the board arm green is an engine '
     + 'that stopped charging Pressure entirely, which is a different and worse defect');
  ok(wide > 0 || process.env.MEDI_PP_PRESSURE_STATIC_TARGET === '1',
     'the terrain-widened pricing is REACHED',
     'ppPressureTerrainWidened moved by ' + wide + ' — a zero means the call is present and dead');
  if (process.env.MEDI_PP_PRESSURE_STATIC_TARGET === '1') {
    ok((F.ppPressureStaticTargetRestored | 0) === 1, 'the restore knob is LIVE in the child');
  } else {
    ok((F.ppPressureStaticTargetRestored | 0) === 0, 'the restore knob is OFF in this process');
  }
}

/* ---- THE RED, AND THE SILENT CONTROL ---------------------------------------------------------- */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const run = (env) => spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env), encoding: 'utf8' });

  console.log('\n  ---- RE-RUNNING UNDER MEDI_PP_PRESSURE_STATIC_TARGET=1 (the child must FAIL)');
  const red = run({ MEDI_PP_PRESSURE_STATIC_TARGET: '1' });
  const redLines = String(red.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(red.status !== 0, 'the restore knob makes this probe RED',
     red.status !== 0 ? 'child exit ' + red.status + ', ' + redLines.length + ' FAIL line(s):\n          '
                        + redLines.join('\n          ')
                      : 'THE CHILD PASSED — this probe cannot tell the static target word from the '
                        + 'rewritten one and asserts nothing about which list Pressure is priced off');

  console.log('\n  ---- RE-RUNNING UNDER MEDI_WEATHER_FORME_SURVIVES_FAINT=1 (the SILENT control must PASS)');
  const quiet = run({ MEDI_WEATHER_FORME_SURVIVES_FAINT: '1' });
  const quietLines = String(quiet.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(quiet.status === 0, 'SILENT CONTROL — this session\'s OTHER knob does not move this probe',
     quiet.status === 0 ? 'child exit 0 — the two fixes are independent'
                        : 'child exit ' + quiet.status + ', ' + quietLines.length + ' FAIL line(s):\n          '
                          + quietLines.join('\n          ')
                          + '\n          A probe that goes red under an unrelated knob is measuring the harness.');
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
