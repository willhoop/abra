/* probe_aftermove_cure.js — A MOVE THAT CURES A STATUS AT `onAfterMove` CURES THE BODIES IT HIT,
 * AND THIS ENGINE WROTE THE RECEIPT AND NEVER PAID.
 *
 *   SHOWDOWN_PATH=... node tests/probe_aftermove_cure.js
 *   MEDI_AFTERMOVE_CURE_OFF=1 SHOWDOWN_PATH=... node tests/probe_aftermove_cure.js   (the red arm)
 *
 * ================= THE RULE, READ OFF THE AUTHORITY =============================================
 *
 *     sparklingaria: { ... secondary: { chance: 100, volatileStatus: 'sparklingaria' },
 *       onAfterMove(source, target, move) {
 *         if (source.fainted || !move.hitTargets || move.hasSheerForce) { ...clear the marks...; return; }
 *         const numberTargets = move.hitTargets.length;
 *         for (const pokemon of move.hitTargets) {
 *           // bypasses Shield Dust when hitting multiple targets
 *           if (pokemon !== source && pokemon.isActive &&
 *               (pokemon.removeVolatile('sparklingaria') || numberTargets > 1) &&
 *               pokemon.status === 'brn') { pokemon.cureStatus(); }
 *         }
 *       } }                          — data/moves.ts:17351-17381, no Champions override for this move.
 *
 * THE SECONDARY IS A RECEIPT, NOT THE MECHANIC. `data/tags.json` carried the volatile
 * (`statusInflict {volatile: 'sparklingaria'}`) and nothing else, because the tag sweep read dex
 * FIELDS and the cure is a HANDLER. So this engine marked every body it hit and cured nobody, for as
 * long as the move has existed here.
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * One of the 34 board partings in the 2026-09-19 held-out 12,000-game draw (release `18773c22878f`,
 * 7,178 games, pool `e398641bda45`) — `docs/_reports/2026-09-19-final-remeasure.md` row 6:
 *
 *     omit-weather ...bo3-2657243554   turn 6
 *       p1.party.kingambit.status   us="brn"   showdown=""
 *     showdown   |-curestatus|p1a: Kingambit|brn|[msg]
 *     medicham2  (nothing further — it had already stopped emitting)
 *
 * The Primarina beside that Kingambit clicked Sparkling Aria, which is `allAdjacent` and therefore
 * hits its own partner. THAT is the fixture below.
 *
 * ================= THE ARMS ====================================================================
 *
 *   CURES     the burned ALLY is hit by the move under test.   UNDER TEST — both engines must write
 *             the cure and end the turn with no burn.
 *   CONTROL   the identical board and the identical burn, with the user clicking its OTHER spread
 *             move instead. The burn must SURVIVE in both engines — without it, "no burn at the end"
 *             would also pass on an engine that had stopped applying burns at all.
 *
 * RED-FIRST KNOB: `MEDI_AFTERMOVE_CURE_OFF=1` takes the handler out and leaves the receipt. Under it
 * the CURES arm must part a board on `status`, and the CONTROL arm must not move.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * BOTH, and thinly: Sparkling Aria is 7 corpus uses (`data/tags.json`), so the pool carries ONE
 * board parting and the lab carries the row. Said before the run.
 *
 * IT WRITES NOTHING. No artifact is touched. It asserts and exits non-zero on a failure.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
require(D('tests', '_live_release.js'));

if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
require(D('data', 'engine-data.js'));
/* THE SEAL. Loading the mon table without the door leaves MC.mons unsealed in this process, so a
 * typo'd key would read `undefined` instead of throwing — the 2026-07-30 shape. One require line is
 * the whole cost; tests/test-mc-key.js checks every file that loads the table carries it. */
require(D('engine', 'mc_key.js'));
const TAGS = require(D('data', 'tags.json'));
const KNOB_SET = process.env.MEDI_AFTERMOVE_CURE_OFF === '1';
/* THE QUIET CONTROL ARM CARRIES ITS OWN MARKER, AND THE SPAWN BELOW IS THE ONLY THING THAT SETS IT.
 * Keying the quiet path on the KNOB ITSELF means a knob set from OUTSIDE takes the quiet path too,
 * so the probe exits 0 against a deliberately broken engine — indistinguishable from a knob that is
 * not wired to anything. So:
 *   knob set from outside -> the FULL verdict runs against the broken engine and this exits 1
 *   spawned control child -> the quiet arm, exit 0, its verdict line for the parent to read */
const KNOB = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === '1';
const NL = String.fromCharCode(10);
if (KNOB_SET && !KNOB) {
  console.log('');
  console.log('  MEDI_AFTERMOVE_CURE_OFF=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the assertions below are');
  console.log('  expected to FAIL and this run MUST exit 1. The control child is skipped.');
}
let fails = 0;
const ok = (cond, label, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? NL + '          ' + detail : ''));
  if (!cond) fails++;
};

/* ---- THE FAMILY, DERIVED, PRINTED BEFORE IT IS USED. A new tag over-matches quietly. ----------- */
const FAMILY = Object.keys(TAGS.moves)
  .filter(id => ((TAGS.moves[id] || {}).tags || []).includes('curesTargetStatusAfterMove'));
console.log(NL + '  === `curesTargetStatusAfterMove` IN THIS FORMAT, AS data/tags.json DERIVES IT ===');
for (const id of FAMILY) console.log('    ' + id + '  ' + JSON.stringify(TAGS.moves[id].params.curesTargetStatusAfterMove));
if (!FAMILY.length) {
  console.log('NOT RUN — nothing carries the tag; regenerate data/tags.json with engine/tag_dex.js. '
    + 'This is not a pass.');
  process.exit(2);
}
const MOVE_ID = FAMILY[0];
const P = TAGS.moves[MOVE_ID].params.curesTargetStatusAfterMove;
const MOVE = TAGS.moves[MOVE_ID].name;
const STATUS = P.status;

/* ---- THE CAST. Named, then CHECKED against the format. ---------------------------------------- */
const USER = 'Primarina';                 // carries the move under test AND a second spread move
const OTHER_SPREAD = 'Hyper Voice';       // the control click: same shape, no cure clause
const ALLY = 'Kingambit';                 // the burned body — not Fire, so it can hold the status
const BURNER = 'Incineroar', BURN_MOVE = 'Will-O-Wisp';
const FOE2 = 'Corviknight', FOE_IDLE = 'Iron Defense';
const BENCH_P1 = [['Milotic', 'Recover'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Torterra', 'Curse'], ['Goodra', 'Acid Armor']];
const HP_BOOST = 8;                       // nothing may faint: a KO would end the arm early

console.log(NL + '  === THE CAST, CHECKED AGAINST THE AUTHORITY\'S OWN LEARNSETS ===');
{
  let bad = 0;
  const claims = [[USER, MOVE], [USER, OTHER_SPREAD], [ALLY, 'Protect'], [BURNER, BURN_MOVE],
                  [BURNER, 'Protect'], [FOE2, FOE_IDLE], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log('  learnset: ' + sp + ' / ' + mv + ' -> ' + (good ? 'LEGAL' : 'NOT LEGAL'));
    if (!good) bad++;
  }
  if (bad) { console.log('NOT RUN — the fixture is not legal in this format. This is not a pass.'); process.exit(2); }
}

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) { console.log('NOT RUN — no arm named middle in game_differential.js.'); process.exit(2); }
const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
/* The ally's ability is named so nothing can cure the burn behind the probe's back. */
const TEAM_P1 = [mon(ALLY, 'Defiant', ['Protect', 'Swords Dance']), mon(USER, 'Torrent', [MOVE, OTHER_SPREAD]),
                 ...BENCH_P1.map(([s, m]) => mon(s, '', ['Protect', m]))];
const TEAM_P2 = [mon(BURNER, 'Blaze', [BURN_MOVE, 'Protect']), mon(FOE2, 'Pressure', ['Protect', FOE_IDLE]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', ['Protect', m]))];

/* turn 1 the ally is burned; turn 2 the user clicks the move under test (or the control move) and
 * the ally is one of the bodies it hits, because the move is `allAdjacent`. */
const script = (click) => [
  { p1: [{ m: 'Swords Dance' }, { m: OTHER_SPREAD, t: 0 }], p2: [{ m: BURN_MOVE, t: 0 }, { m: 'Protect' }] },
  { p1: [{ m: 'Swords Dance' }, { m: click, t: 0 }], p2: [{ m: 'Protect' }, { m: 'Protect' }] },
  { p1: [{ m: 'Swords Dance' }, { m: OTHER_SPREAD, t: 0 }], p2: [{ m: 'Protect' }, { m: 'Protect' }] },
];

const foldSplit = (arr) => { const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === '|split|p1' || arr[i] === '|split|p2') { if (arr[i + 1] != null) out.push(arr[i + 1]); i += 2; continue; }
    out.push(arr[i]); }
  return out; };

function run(tag, click) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const parted = [], statusLeaf = [];
  const r = G.playGame(a, b, 'aftermove-cure', tag, {
    script: script(click), arm: ARM,
    onBoundary: (snap, turnIdx) => {
      if (!snap.identical) parted.push('t' + turnIdx + ' ' + (snap.diffs || []).slice(0, 6).map(d => JSON.stringify(d)).join(' '));
      for (const d of (snap.diffs || [])) if (/\.status$/.test(d.path)) statusLeaf.push('t' + turnIdx + ' ' + d.path + ' us=' + JSON.stringify(d.medicham) + ' sd=' + JSON.stringify(d.showdown));
      snap.identical = true; snap.diffs = [];     /* keep playing past a parting; recorded above */
    },
  });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const sc = G.scriptCounters();
  if (sc.moveNotOnRequest) return { staged: false, why: sc.moveNotOnRequest + ' scripted click(s) not on the request: ' + sc.firstMissing };
  const sd = foldSplit((G.lastSdLog() || []).map(String)), me = (r.mediTrace || []).map(String);
  const burns = s => s.filter(l => new RegExp('^\\|-status\\|p1a[:|].*' + STATUS).test(l)).length;
  const cures = s => s.filter(l => new RegExp('^\\|-curestatus\\|p1a[:|].*' + STATUS).test(l)).length;
  const hitAlly = s => s.filter(l => /^\|-damage\|p1a[:|]/.test(l)).length;
  return { staged: true, turns: r.turns, sdBurn: burns(sd), meBurn: burns(me),
           sdCure: cures(sd), meCure: cures(me), sdHit: hitAlly(sd), meHit: hitAlly(me),
           parted, statusLeaf, sd, me };
}

console.log(NL + 'A MOVE CURES ITS TARGETS AT `onAfterMove` — data/moves.ts:17364' + NL);
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm middle');
console.log('  MEDI_AFTERMOVE_CURE_OFF=' + (KNOB_SET ? '1  (PRE-FIX ENGINE: the mark is written, nobody is cured)' : '0'));
console.log('  under test: ' + MOVE + ' curing `' + STATUS + '` on the bodies it hits');

const R = { CURES: run('cures', MOVE), CONTROL: run('control', OTHER_SPREAD) };
for (const [k, x] of Object.entries(R)) {
  console.log(NL + '='.repeat(98) + NL + '  ' + k);
  if (!x.staged) { console.log('  NOT STAGED — ' + x.why); fails++; continue; }
  console.log('    the ally was BURNED   sd ' + x.sdBurn + ' / me ' + x.meBurn
    + '    HIT by its partner  sd ' + x.sdHit + ' / me ' + x.meHit
    + '    CURE lines  sd ' + x.sdCure + ' / me ' + x.meCure);
  console.log('    board partings: ' + (x.parted.length ? x.parted.join(' | ') : 'none'));
}
if (Object.values(R).some(x => !x.staged)) { console.log(NL + 'RED — an arm did not stage.'); process.exit(1); }

if (KNOB) {
  console.log(NL + '  CONTROL ARM (MEDI_AFTERMOVE_CURE_OFF=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    cureMe: R.CURES.meCure, cureSd: R.CURES.sdCure, cureParted: R.CURES.parted.length,
    cureStatusLeaf: R.CURES.statusLeaf.length,
    ctlMe: R.CONTROL.meCure, ctlParted: R.CONTROL.parted.length }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

console.log(NL + '  === THE VERDICT ===');
/* THE FIXTURE FIRST, ON THE AUTHORITY'S OWN STREAM. */
ok(R.CURES.sdBurn === 1 && R.CURES.meBurn === 1, 'the fixture: the ally was burned in both engines',
   'sd ' + R.CURES.sdBurn + ' / me ' + R.CURES.meBurn);
ok(R.CURES.sdHit >= 2 && R.CURES.meHit >= 2, 'the fixture: and its own partner hit it, both turns',
   'sd ' + R.CURES.sdHit + ' / me ' + R.CURES.meHit);
ok(R.CONTROL.sdCure === 0, 'the fixture: the CONTROL click cures nobody on the authority',
   String(R.CONTROL.sdCure));
/* THE RULE. */
ok(R.CURES.sdCure === 1, 'AUTHORITY: the move under test writes the cure', String(R.CURES.sdCure));
ok(R.CURES.meCure === 1, 'medicham2: it writes it too', String(R.CURES.meCure));
ok(R.CONTROL.meCure === 0, 'medicham2 does NOT cure on the control click', String(R.CONTROL.meCure));
ok(R.CURES.parted.length === 0, 'CURES: no board parted', R.CURES.parted.join(' | '));
ok(R.CONTROL.parted.length === 0, 'CONTROL: no board parted either', R.CONTROL.parted.join(' | '));
ok(R.CURES.sdCure !== R.CONTROL.sdCure,
   'THE ARMS DISAGREE ON THE AUTHORITY, so the cure is the MOVE and not the board',
   'cures ' + R.CURES.sdCure + ' vs control ' + R.CONTROL.sdCure);

if (KNOB_SET) {
  console.log(NL + '  --- the control child is SKIPPED: the knob is already set in this process, so a');
  console.log('      child of it would compare a control against a control and report that the');
  console.log('      knob changed nothing — true, and about the wrong thing ---');
} else {
  const { spawnSync } = require('child_process');
  console.log(NL + '  --- re-running under MEDI_AFTERMOVE_CURE_OFF=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_AFTERMOVE_CURE_OFF: '1', ABRA_PROBE_CONTROL_ARM: '1' },
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(c.stdout || '');
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (!mark) {
    process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
    console.log(NL + '  RED — the control child printed no verdict line (exit ' + c.status + ').'); fails++;
  } else {
    const ctl = JSON.parse(mark[1]);
    console.log('  ' + JSON.stringify(ctl));
    ok(ctl.cureMe === 0, 'the knob TAKES THE CURE BACK OUT',
       'fixed ' + R.CURES.meCure + ' vs control ' + ctl.cureMe
       + (ctl.cureMe === R.CURES.meCure ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    ok(ctl.cureParted > 0, 'and the CURES arm PARTS A BOARD under it, so the knob reached the RULE',
       String(ctl.cureParted) + ' parting(s)');
    ok(ctl.cureStatusLeaf > 0, 'the parting is on a `status` leaf', String(ctl.cureStatusLeaf));
    ok(ctl.cureSd === R.CURES.sdCure, 'the AUTHORITY is unmoved by our knob', String(ctl.cureSd));
    ok(ctl.ctlMe === R.CONTROL.meCure && ctl.ctlParted === 0, 'the CONTROL arm does not move under the knob',
       'cures ' + ctl.ctlMe + ', partings ' + ctl.ctlParted);
  }
}

console.log(NL + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(fails ? 1 : 0);
