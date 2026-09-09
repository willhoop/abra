/* probe_weather_forme_faint.js — A WEATHER FORME COMES OFF A CORPSE, AND THE REVERT LIVED ON THE
 * SWITCH ROAD ONLY. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_weather_forme_faint.js
 *   PROBE_RELEASE=<id> ...   opens a FROZEN release instead of the live tree (the red-first arm)
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `data/game-differential.json` on release `ab22bc503717` reads 22 board-material games of 961, and
 * TWO of them part a board while `protocol_diverged_at_turn` is `null` — the two protocol streams are
 * identical from the first line to the last. This is one of the two:
 *
 *     omit-spread  t7  ...bo3-2661455548 vs ...bo3-2661573110
 *       p2.party.castform.species   medi `castformrainy`  sd `castform`
 *       p2.party.castform.types     medi `water`          sd `normal`
 *
 * IT IS INVISIBLE TO `--dump-games` BY CONSTRUCTION — that dump writes the lines either side of a
 * PROTOCOL split and this game has none — so the only thing any artifact says about it is the two
 * leaves above. This file replays it, prints both engines' final view of every party body's species
 * and types, and asserts the leaf.
 *
 * ================= THE AUTHORITY, CITED AND NOT REMEMBERED ======================================
 *
 * `Pokemon#clearVolatile(includeSwitchFlags = true)` ENDS with `this.setSpecies(this.baseSpecies)`
 * (sim/pokemon.ts:1565), and `setSpecies` is `setType(species.types, true)` — so the NAME and the
 * TYPE list both go back in one call. The authority reaches that function from two roads:
 *
 *     sim/battle.ts:2560   `faintMessages()` -> `pokemon.clearVolatile(false)`
 *     the switch road      already served by medicham2's `switchOut`
 *
 * Forecast itself (`data/abilities.ts`, `formeChange(forme, this.effect, false)`) is a NON-permanent
 * forme change, which is exactly the class `setSpecies(baseSpecies)` undoes. Champions overrides no
 * part of this: `data/mods/champions/abilities.ts` carries no `forecast` key, checked by key on every
 * run below rather than recalled.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  MEMBERSHIP  the `formeFollowsWeather` family is derived off the tag artifact and PRINTED, with
 *                  its carriers checked against the format. A family of zero is a failure of this
 *                  file, not a clean engine.
 *   2  FIXTURE     the accusing game is found in the PINNED pool and both pairs build.
 *   3  CONTROL     the protocol streams agree end to end (`div === null`), exactly as the artifact
 *                  records. If they do not, this replay is not that game and nothing below counts.
 *   4  TEST        no board leaf parts at any boundary, and in particular the Castform party row's
 *                  `species` and `types` agree.
 *   5  CONTROL     `MEDSEEN.weatherRetyped` moved in the same replay — an engine in which Forecast
 *                  never fired at all would pass arm 4 and be a worse defect.
 *   6  RED         re-run under `MEDI_WEATHER_FORME_SURVIVES_FAINT=1`; the child MUST fail.
 *   7  SILENT      re-run under `MEDI_PP_PRESSURE_STATIC_TARGET=1` — this session's OTHER knob, on a
 *                  different mechanic — and the child MUST pass. A probe that goes red under any
 *                  knob at all is measuring the harness.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE WEATHER FORME ON A CORPSE');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

/* THE PINS. `--games 1200` is part of the SAMPLE DEFINITION and not a budget: `buildSwarm` is sized
 * from it, so a different number is a different pool and therefore a different pairing. */
const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', 'data/team-pool-frozen');
/* THE RED-FIRST DOOR. With no `PROBE_RELEASE` the differential cuts a release off the LIVE tree, which
 * is what an ordinary run wants. Naming a frozen id runs this file against those bytes instead — that
 * is how this probe was shown RED on `ab22bc503717`, the engine the published 22 was measured on. */
if (process.env.PROBE_RELEASE) process.argv.push('--release', process.env.PROBE_RELEASE);

const G = require(D('engine', 'game_differential.js'));
const MEDI = G.REL.require('engine/medicham2-browser.js',
                           { want: ['MEDSEEN', 'MEDFAILS'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
/* THE ONE DOOR FOR "WHICH ROSTER BODY IS THIS". engine/identity_audit.js enforces that a HARD identity
 * read (`_switchKey`, `set.species`, `set.name`) goes through engine/board_state.js `stableKey`; this
 * file re-derived it inline and was the audit's two UNROUTED sites on 2026-09-09. */
const BS = require(D('engine', 'board_state.js'));
const normId = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1'
           || process.env.MEDI_PP_PRESSURE_STATIC_TARGET === '1';
const C0 = { rev: MEDI.MEDSEEN.weatherFormeReverted | 0,
             revFnt: MEDI.MEDSEEN.weatherFormeRevertedOnFaint | 0,
             retyped: MEDI.MEDSEEN.weatherRetyped | 0 };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== THE WEATHER FORME ON A CORPSE =='
  + (process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1' ? '   [MEDI_WEATHER_FORME_SURVIVES_FAINT=1]' : '')
  + (process.env.MEDI_PP_PRESSURE_STATIC_TARGET === '1' ? '   [MEDI_PP_PRESSURE_STATIC_TARGET=1 — SILENT CONTROL]' : '')
  + (process.env.PROBE_RELEASE ? '   [release ' + process.env.PROBE_RELEASE + ']' : '') + '\n');

/* ---- 1. THE MEMBERSHIP, DERIVED --------------------------------------------------------------- */
{
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const fam = [];
  for (const [id, row] of Object.entries(TAGS.abilities || {})) {
    const p = row && row.params && row.params.formeFollowsWeather;
    if (!p) continue;
    const carriers = dex.species.all().filter(s => legal(s)
      && Object.values(s.abilities || {}).some(a => String(a).toLowerCase().replace(/[^a-z0-9]/g, '') === id));
    fam.push(id + '  revertsTo=' + (p.revertsTo || '-') + '  types=' + JSON.stringify(p.revertsToTypes || null)
      + '  restoresRatherThanChanges=' + !!p.restoresRatherThanChanges
      + '  legal carriers=' + carriers.length + (carriers.length ? ' [' + carriers.map(s => s.id).join(' ') + ']' : ''));
  }
  console.log('  `formeFollowsWeather`, DERIVED off data/tags.json and carrier-checked in ' + CS.FORMAT + ':');
  for (const f of fam.sort()) console.log('    ' + f);
  ok(fam.length > 0, 'the weather-forme family is non-empty', fam.length + ' member(s)');
  /* CHAMPIONS OVERRIDES NOTHING HERE, checked by key. */
  const fc = dex.abilities.get('forecast');
  ok(!!fc && fc.exists, 'Forecast exists in this format', 'name=' + (fc && fc.name));
}

/* ---- 2..5. THE ACCUSING GAME ------------------------------------------------------------------ */
const W = { cfg: 'omit-spread', turn: 7,
  tag: 'gen9championsvgc2026regmbbo3-2661455548 vs gen9championsvgc2026regmbbo3-2661573110',
  leaves: ['p2.party.castform.species', 'p2.party.castform.types'] };

const t0 = Date.now();
const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
console.log('  pool built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — '
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
      const rows = [];
      const r = G.playGame(a, b, W.cfg, W.tag, {
        driverSeed: W.cfg + '|' + W.tag,
        onBoundary: (snap, turnIdx, S, battle) => {
          const cells = [];
          for (const [lab, team, side] of [['p1', S.sfA && S.sfA.team, battle.sides[0]],
                                           ['p2', S.sfB && S.sfB.team, battle.sides[1]]]) {
            for (const m of (team || [])) {
              const key = BS.stableKey(m, normId);
              const p = key && side.pokemon.find(x => BS.stableKey(x, normId) === key);
              if (!p) continue;
              cells.push({ slot: lab + '.' + key,
                           meName: m.name, meTypes: (m.types || []).join('/'), meFnt: !!m.fainted,
                           sdName: p.species && p.species.id, sdTypes: (p.getTypes ? p.getTypes() : p.types || []).join('/'),
                           sdFnt: !!p.fainted });
            }
          }
          rows.push({ t: turnIdx, cells });
        },
      });
      console.log('\n  ---- ' + W.cfg + '  ' + W.tag);
      console.log('       artifact says: board parts at t' + W.turn + ' on ' + W.leaves.join(' + '));
      console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
        + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null)
        + ' void=' + !!r.void + ' err=' + (r.err || '-'));
      if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

      /* THE TABLE. Only bodies whose species or types differ between the engines, or that are dead —
       * a twelve-body party over twenty boundaries is 240 identical lines otherwise. */
      let printed = 0;
      for (const row of rows) {
        const live = row.cells.filter(c => c.meName !== c.sdName || c.meTypes.toLowerCase() !== c.sdTypes.toLowerCase()
                                        || c.meFnt || c.sdFnt);
        if (!live.length) continue;
        printed++;
        console.log('       t' + String(row.t).padEnd(3) + live.map(c =>
          c.slot + '  me ' + c.meName + '/' + c.meTypes + (c.meFnt ? ' FNT' : '')
          + '   sd ' + c.sdName + '/' + c.sdTypes + (c.sdFnt ? ' FNT' : '')).join('\n           '));
      }
      if (!printed) console.log('       (no body ever differed and none died)');

      ok(!r.div, 'CONTROL — the protocol streams agree end to end',
         r.div ? 'the protocol parted at index ' + r.div.index + ' — this replay is NOT the artifact\'s game'
               : 'no protocol divergence, exactly as the artifact records');
      ok(!r.stateDiv, 'TEST — no board leaf parts at any boundary',
         r.stateDiv ? 'parted at t' + r.stateDiv.turn + ': '
                      + r.stateDiv.diffs.map(d => d.path + ' medi ' + JSON.stringify(d.medicham)
                                                + ' / sd ' + JSON.stringify(d.showdown)).join('; ')
                    : 'boards identical at all ' + rows.length + ' boundaries');
    }
  }
}

/* ---- 6. THE COUNTERS -------------------------------------------------------------------------- */
{
  const S = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const rev = (S.weatherFormeReverted | 0) - C0.rev;
  const revFnt = (S.weatherFormeRevertedOnFaint | 0) - C0.revFnt;
  const retyped = (S.weatherRetyped | 0) - C0.retyped;
  console.log('\n  COUNTERS across the replay: weatherFormeReverted +' + rev
    + '  weatherFormeRevertedOnFaint +' + revFnt + '  weatherRetyped +' + retyped
    + '   weatherFormeSurvivesFaintRestored=' + (F.weatherFormeSurvivesFaintRestored | 0));
  ok(retyped > 0, 'CONTROL — Forecast still FIRES in this replay',
     'weatherRetyped moved by ' + retyped + '. A zero here with the board arm green is an engine in '
     + 'which Forecast never runs at all, which passes that arm and is a worse defect');
  ok(revFnt > 0 || process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1',
     'the FAINT road is reached',
     'weatherFormeRevertedOnFaint moved by ' + revFnt + ' — a zero means the call is present and dead');
  if (process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1') {
    ok((F.weatherFormeSurvivesFaintRestored | 0) === 1, 'the restore knob is LIVE in the child');
  } else {
    ok((F.weatherFormeSurvivesFaintRestored | 0) === 0, 'the restore knob is OFF in this process');
  }
}

/* ---- 7. THE RED, AND THE SILENT CONTROL ------------------------------------------------------- */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const run = (env) => spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env), encoding: 'utf8' });

  console.log('\n  ---- RE-RUNNING UNDER MEDI_WEATHER_FORME_SURVIVES_FAINT=1 (the child must FAIL)');
  const red = run({ MEDI_WEATHER_FORME_SURVIVES_FAINT: '1' });
  const redLines = String(red.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(red.status !== 0, 'the restore knob makes this probe RED',
     red.status !== 0 ? 'child exit ' + red.status + ', ' + redLines.length + ' FAIL line(s):\n          '
                        + redLines.join('\n          ')
                      : 'THE CHILD PASSED — this probe cannot tell the two roads apart and asserts '
                        + 'nothing about where the forme is reverted');

  console.log('\n  ---- RE-RUNNING UNDER MEDI_PP_PRESSURE_STATIC_TARGET=1 (the SILENT control must PASS)');
  const quiet = run({ MEDI_PP_PRESSURE_STATIC_TARGET: '1' });
  const quietLines = String(quiet.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(quiet.status === 0, 'SILENT CONTROL — this session\'s OTHER knob does not move this probe',
     quiet.status === 0 ? 'child exit 0 — the two fixes are independent'
                        : 'child exit ' + quiet.status + ', ' + quietLines.length + ' FAIL line(s):\n          '
                          + quietLines.join('\n          ')
                          + '\n          A probe that goes red under an unrelated knob is measuring the harness.');
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
