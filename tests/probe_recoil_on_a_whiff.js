/* probe_recoil_on_a_whiff.js — A MAX-HP RECOIL IS PAID FOR DAMAGE DEALT, NOT FOR CLICKING THE MOVE,
 * AND THE ONE MEMBER THAT IS CHARGED ANYWAY IS CHARGED BY ITS OWN `onMoveFail` HANDLER.
 *
 *   SHOWDOWN_PATH=... node tests/probe_recoil_on_a_whiff.js
 *   MEDI_RECOIL_ON_A_WHIFF=1 SHOWDOWN_PATH=... node tests/probe_recoil_on_a_whiff.js   (the red arm)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * The held-out 12,000-game draw of 2026-09-19 on release `18773c22878f` (7,178 games, pool
 * `e398641bda45`, census `0c1d71e2a1bb`, `--arm middle --steering empirical`) parts 34 boards where
 * the gate's three lattices part none. TWO OF THE 34 ARE THIS, and both are a KO that happened only
 * here — `docs/_reports/2026-09-19-final-remeasure.md` rows 2 and 25:
 *
 *     ...bo3-2663420926   turn 19   p1.party.garchomp.hp      us=45  showdown=91
 *     ...bo3-2634939984   turn 14   p1.party.kangaskhan.hp    us=0   showdown=33   (fainted here only)
 *
 * Both games are the same three lines: the user is out of PP, Struggles, the target has just gone
 * semi-invulnerable, and this engine charges the quarter anyway.
 *
 *     medicham2   |move|p1a|struggle|p2b   |-miss|p1a|p2b   |-damage|p1a|H/H|[from] recoil
 *     showdown    |move|p1a|struggle|p2b|[miss]   |-miss|p1a|p2b            (and nothing else)
 *
 * ================= THE RULE, READ OFF THE AUTHORITY =============================================
 *
 *   1. THE PAYMENT SITE IS GATED ON DAMAGE. The Champions mod keeps its own copy of the loop:
 *          if (move.totalDamage) this.applyRecoilDamage(move.totalDamage, move, pokemon);
 *      — data/mods/champions/scripts.ts:553-555. `applyRecoilDamage` is where BOTH `struggleRecoil`
 *      (sim/battle-actions.ts:1381) and `mindBlownRecoil` (:1382) are sized, so a move that dealt
 *      nothing reaches neither.
 *
 *   2. THERE IS A SECOND SITE AND ONLY ONE MEMBER DECLARES A HANDLER FOR IT.
 *          if (!moveResult) { ... this.battle.singleEvent('MoveFail', move, null, target, pokemon, move); }
 *      — sim/battle-actions.ts:524-527. Steel Beam's own `onMoveFail` charges half its user's maximum
 *      there (data/moves.ts:17880-17883). Struggle declares none (data/moves.ts:18218-18228).
 *
 * So the two members of `recoil {of:'maxhp'}` behave DIFFERENTLY on a whiff, and the tag could not
 * say so. `engine/tag_dex.js` now derives `paidOnFail` from the presence of a damaging `onMoveFail`
 * handler, and the engine gates on the tag rather than on a name.
 *
 * ================= THE ARMS ====================================================================
 *
 *   WHIFF-NOFAIL   the `paidOnFail: false` member clicked into two semi-invulnerable foes.
 *                  UNDER TEST. NEITHER engine may write a recoil line.
 *   LANDS          the identical board with the foes standing still, so the same click connects.
 *                  FIXTURE CONTROL: BOTH engines must write one — without it "no recoil line"
 *                  would also pass on an engine that had stopped paying recoil at all.
 *   WHIFF-ONFAIL   the `paidOnFail: true` member into the same two semi-invulnerable foes.
 *                  SPECIFICITY CONTROL: BOTH engines must write one, here and under the knob. A fix
 *                  that gated the whole family on damage would go red on this arm.
 *
 * RED-FIRST KNOB: `MEDI_RECOIL_ON_A_WHIFF=1` takes the `move.totalDamage` gate back out. Under it
 * WHIFF-NOFAIL must part and the other two arms must not move — an identical result across a varied
 * knob means the knob is unwired, so the child's numbers are compared field by field.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * BOTH, and the pool is the one that matters: two board partings in a 7,178-game held-out draw, one
 * of them a fainted body. The census carries the lab row. Said before the run.
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
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const KNOB_SET = process.env.MEDI_RECOIL_ON_A_WHIFF === '1';
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
  console.log('  MEDI_RECOIL_ON_A_WHIFF=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the assertions below are');
  console.log('  expected to FAIL and this run MUST exit 1. The control child is skipped.');
}
let fails = 0;
const ok = (cond, label, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? NL + '          ' + detail : ''));
  if (!cond) fails++;
};

/* ---- THE FAMILY, DERIVED FROM OUR OWN ARTIFACT AND PRINTED BEFORE IT IS USED -------------------
 * A new derived param over-matches quietly; this prints every row it caught. */
const MAXHP = Object.keys(TAGS.moves)
  .map(id => ({ id, p: (TAGS.moves[id].params || {}).recoil }))
  .filter(x => x.p && x.p.of === 'maxhp');
console.log(NL + '  === `recoil {of:"maxhp"}` IN THIS FORMAT, AS data/tags.json DERIVES IT ===');
for (const x of MAXHP) console.log('    ' + x.id.padEnd(12) + JSON.stringify(x.p));
const NOFAIL = MAXHP.filter(x => x.p.paidOnFail === false).map(x => x.id);
const ONFAIL = MAXHP.filter(x => x.p.paidOnFail === true).map(x => x.id);
console.log('    paidOnFail false : ' + (NOFAIL.join(', ') || '(none)'));
console.log('    paidOnFail true  : ' + (ONFAIL.join(', ') || '(none)'));
if (!NOFAIL.length || !ONFAIL.length) {
  console.log('NOT RUN — the tag artifact does not carry both halves of the split; regenerate '
    + 'data/tags.json with engine/tag_dex.js. This is not a pass.');
  process.exit(2);
}
/* The `paidOnFail: false` member in this format is reached by EMPTYING A PP BAR, not by clicking it,
 * so the arm drains one instead of naming it. The `paidOnFail: true` member is an ordinary click. */
const DRAINED_MEMBER = 'struggle';
if (!NOFAIL.includes(DRAINED_MEMBER)) {
  console.log('NOT RUN — this arm empties a PP bar to reach `' + DRAINED_MEMBER + '`, and that is no '
    + 'longer the `paidOnFail: false` member (' + NOFAIL.join(', ') + '). The fixture, not the rule, '
    + 'is what has gone stale. This is not a pass.');
  process.exit(2);
}
const CLICK_MEMBER = ONFAIL[0];

/* ---- THE SEMI-INVULNERABLE MOVES, DERIVED FROM THE AUTHORITY'S OWN CONDITION ------------------- */
const INVULN = DEX.moves.all()
  .filter(m => m.exists && !m.isNonstandard && m.condition && m.condition.onInvulnerability)
  .map(m => m.name);
console.log('  moves whose condition declares `onInvulnerability` : ' + (INVULN.join(', ') || '(none)'));
if (INVULN.length < 2) { console.log('NOT RUN — fewer than two semi-invulnerable moves to stand the two foes behind.'); process.exit(2); }

/* ---- THE CAST. Named here, CHECKED against the format below, never assumed. -------------------- */
const CLICKER = 'Lucario';                 // learns the paidOnFail:true member AND can be drained
const DRAIN = 'closecombat';
const DRAIN_PP = DEX.moves.get(DRAIN).pp;
const MAX_PP = Math.floor(DRAIN_PP * 8 / 5);
const TEST_TURN = MAX_PP + 1;
const ALLY = 'Alakazam', ALLY_IDLE = 'Calm Mind';
const F1 = 'Dragapult', F2 = 'Talonflame', FOE_IDLE = 'Agility';
const F1_INV = INVULN.find(n => CS.canLearn(F1, n));
const F2_INV = INVULN.find(n => CS.canLearn(F2, n) && n !== F1_INV) || INVULN.find(n => CS.canLearn(F2, n));
const BENCH_P1 = [['Milotic', 'Recover'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Torterra', 'Curse'], ['Goodra', 'Acid Armor']];
/* Nothing may faint: the drain lands MAX_PP times and the tolls are a quarter and a half of an 8x
 * bar. Asserted at the end rather than hoped for. */
const HP_BOOST = 8;

console.log(NL + '  === THE CAST, CHECKED AGAINST THE AUTHORITY\'S OWN LEARNSETS ===');
{
  let bad = 0;
  const claims = [[CLICKER, DRAIN], [CLICKER, CLICK_MEMBER], [ALLY, ALLY_IDLE],
                  [F1, FOE_IDLE], [F2, FOE_IDLE], [F1, F1_INV || '(none)'], [F2, F2_INV || '(none)'],
                  ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = !!mv && mv !== '(none)' && CS.canLearn(sp, mv);
    console.log('  learnset: ' + sp + ' / ' + mv + ' -> ' + (good ? 'LEGAL' : 'NOT LEGAL'));
    if (!good) bad++;
  }
  const sp1 = DEX.species.get(CLICKER).baseStats.spe;
  const fast = [F1, F2].every(f => DEX.species.get(f).baseStats.spe > sp1);
  console.log('  speed: both foes must move FIRST so the whiff is a whiff -> '
    + F1 + ' ' + DEX.species.get(F1).baseStats.spe + ', ' + F2 + ' ' + DEX.species.get(F2).baseStats.spe
    + ' vs ' + CLICKER + ' ' + sp1 + (fast ? '  OK' : '  NOT STAGED'));
  if (!fast) bad++;
  if (bad) { console.log('NOT RUN — the fixture is not legal in this format. This is not a pass.'); process.exit(2); }
}

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) { console.log('NOT RUN — no arm named middle in game_differential.js.'); process.exit(2); }
const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
/* THE DRAINED ARMS CARRY ONE MOVE AND NOTHING ELSE. A second slot with PP left means the request
 * never offers the drained member at all and the scripted click becomes a `pass` — which is how this
 * file first failed, loudly, rather than silently measuring some other turn. */
const TEAM_P1 = clickMember => [mon(CLICKER, 'Steadfast', clickMember ? [DRAIN, clickMember] : [DRAIN]),
                                mon(ALLY, 'Synchronize', [ALLY_IDLE]),
                                ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(F1, 'Clear Body', [FOE_IDLE, F1_INV]), mon(F2, 'Flame Body', [FOE_IDLE, F2_INV]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* p1 slot 0 spends its bar into p2 slot 0, then on TEST_TURN clicks the member under test. The foes
 * either idle (LANDS) or both go semi-invulnerable (the two whiff arms) — BOTH, because the drained
 * member is `target: randomNormal` and may aim at either. */
const script = (last, hide) => {
  const out = [];
  for (let t = 1; t <= TEST_TURN; t++) {
    const isLast = t === TEST_TURN;
    out.push({ p1: [isLast ? last : { m: DRAIN, t: 0 }, { m: ALLY_IDLE }],
               p2: (isLast && hide) ? [{ m: F1_INV, t: 0 }, { m: F2_INV, t: 0 }]
                                    : [{ m: FOE_IDLE }, { m: FOE_IDLE }] });
  }
  return out;
};

const turnSlice = (lines, n) => {
  const s = (lines || []).map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  let j = s.findIndex((l, k) => k > i && l.startsWith('|turn|'));
  if (j < 0) j = s.length;
  const raw = s.slice(i + 1, j), out = [];
  for (let k = 0; k < raw.length; k++) {
    if (raw[k] === '|split|p1' || raw[k] === '|split|p2') { if (raw[k + 1] != null) out.push(raw[k + 1]); k += 2; continue; }
    out.push(raw[k]);
  }
  return out;
};
/* THE CLAIM IS A RECOIL LINE PAID BY THE CLICKER, whatever the emitter names it: `[from] recoil` for
 * the direct-damage member, `[from] <moveid>` for the other (battle.ts:2244 and :2153). Matched on
 * the shape — a `-damage` on the clicker attributed to something — so a renamed condition shows up
 * as a wrong attribution elsewhere rather than silently reading as "no toll". */
const tollLines = lines => lines.map(String)
  .filter(l => /^\|-damage\|p1a[:|]/.test(l) && /\[from\]/.test(l));

function run(tag, last, hide, clickMember) {
  const a = G.buildPair(TEAM_P1(clickMember), { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const parted = [];
  const r = G.playGame(a, b, 'recoil-whiff', tag, {
    script: script(last, hide), arm: ARM,
    onBoundary: (snap, turnIdx) => {
      if (!snap.identical) parted.push('t' + turnIdx + ' ' + (snap.diffs || []).slice(0, 4).map(d => JSON.stringify(d)).join(' '));
    },
  });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const sc = G.scriptCounters();
  if (sc.moveNotOnRequest) return { staged: false, why: sc.moveNotOnRequest + ' scripted click(s) not on the request: ' + sc.firstMissing };
  const sd = turnSlice(G.lastSdLog(), TEST_TURN), me = turnSlice(r.mediTrace || [], TEST_TURN);
  return { staged: true, sd, me, sdToll: tollLines(sd), meToll: tollLines(me),
           moved: sd.some(l => /^\|move\|p1a/.test(l)) && me.some(l => /^\|move\|p1a/.test(l)),
           parted, div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

console.log(NL + 'A MAX-HP RECOIL IS PAID FOR DAMAGE DEALT — `if (move.totalDamage)`, champions/scripts.ts:553' + NL);
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm middle');
console.log('  MEDI_RECOIL_ON_A_WHIFF=' + (KNOB_SET ? '1  (PRE-FIX ENGINE: the toll is paid for clicking)' : '0'));
console.log('  ' + DRAIN + ' base pp ' + DRAIN_PP + ' -> bar ' + MAX_PP + ', so the test turn is ' + TEST_TURN);

const R = {
  'WHIFF-NOFAIL': run('whiff-nofail', { m: DRAINED_MEMBER }, true),
  LANDS: run('lands', { m: DRAINED_MEMBER }, false),
  'WHIFF-ONFAIL': run('whiff-onfail', { m: CLICK_MEMBER, t: 1 }, true, CLICK_MEMBER),
};
for (const [k, x] of Object.entries(R)) {
  console.log(NL + '='.repeat(98) + NL + '  ' + k);
  if (!x.staged) { console.log('  NOT STAGED — ' + x.why); fails++; continue; }
  console.log('    showdown  turn ' + TEST_TURN + ':  ' + x.sd.filter(l => l.trim() && !/^\|t:/.test(l)).join('   '));
  console.log('    medicham  turn ' + TEST_TURN + ':  ' + x.me.filter(l => l.trim()).join('   '));
  console.log('    toll lines on the clicker:  showdown ' + x.sdToll.length + '   medicham2 ' + x.meToll.length);
  console.log('    board partings: ' + (x.parted.length ? x.parted.join(' | ') : 'none'));
}
if (Object.values(R).some(x => !x.staged)) { console.log(NL + 'RED — an arm did not stage.'); process.exit(1); }

if (KNOB) {
  console.log(NL + '  CONTROL ARM (MEDI_RECOIL_ON_A_WHIFF=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    whiffNofailMe: R['WHIFF-NOFAIL'].meToll.length, whiffNofailSd: R['WHIFF-NOFAIL'].sdToll.length,
    landsMe: R.LANDS.meToll.length, landsSd: R.LANDS.sdToll.length,
    whiffOnfailMe: R['WHIFF-ONFAIL'].meToll.length, whiffOnfailSd: R['WHIFF-ONFAIL'].sdToll.length,
    whiffNofailParted: R['WHIFF-NOFAIL'].parted.length, landsParted: R.LANDS.parted.length,
    whiffOnfailParted: R['WHIFF-ONFAIL'].parted.length }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

console.log(NL + '  === THE VERDICT ===');
/* THE FIXTURE FIRST, ON THE AUTHORITY'S OWN STREAM. */
ok(R['WHIFF-NOFAIL'].moved, 'the fixture: both engines resolved the drained member on turn ' + TEST_TURN);
ok(R.LANDS.sdToll.length === 1, 'the fixture: the authority DOES pay this toll when the click connects',
   R.LANDS.sdToll.join(' '));
ok(R['WHIFF-ONFAIL'].sdToll.length === 1, 'the fixture: and pays the `paidOnFail: true` member even on a whiff, '
   + 'through its own onMoveFail', R['WHIFF-ONFAIL'].sdToll.join(' '));
/* THE RULE. */
ok(R['WHIFF-NOFAIL'].sdToll.length === 0, 'AUTHORITY: no toll for the `paidOnFail: false` member that dealt nothing',
   R['WHIFF-NOFAIL'].sdToll.join(' ') || '(no line)');
ok(R['WHIFF-NOFAIL'].meToll.length === 0, 'medicham2: none either',
   R['WHIFF-NOFAIL'].meToll.join(' ') || '(no line)');
ok(R.LANDS.meToll.length === 1, 'medicham2 still pays when the click connects', R.LANDS.meToll.join(' '));
ok(R['WHIFF-ONFAIL'].meToll.length === 1, 'medicham2 still pays the `paidOnFail: true` member on a whiff',
   R['WHIFF-ONFAIL'].meToll.join(' '));
/* THE TWO ARMS MUST DISAGREE, or the fixture is measuring the board and not the rule. */
ok(R.LANDS.sdToll.length !== R['WHIFF-NOFAIL'].sdToll.length,
   'THE ARMS DISAGREE ON THE AUTHORITY, so the line is the damage and not the click',
   'lands ' + R.LANDS.sdToll.length + ' vs whiff ' + R['WHIFF-NOFAIL'].sdToll.length);
for (const k of Object.keys(R)) ok(R[k].parted.length === 0, k + ': no board parted', R[k].parted.join(' | '));

if (KNOB_SET) {
  console.log(NL + '  --- the control child is SKIPPED: the knob is already set in this process, so a');
  console.log('      child of it would compare a control against a control and report that the');
  console.log('      knob changed nothing — true, and about the wrong thing ---');
} else {
  const { spawnSync } = require('child_process');
  console.log(NL + '  --- re-running under MEDI_RECOIL_ON_A_WHIFF=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_RECOIL_ON_A_WHIFF: '1', ABRA_PROBE_CONTROL_ARM: '1' },
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(c.stdout || '');
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (!mark) {
    process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
    console.log(NL + '  RED — the control child printed no verdict line (exit ' + c.status + ').'); fails++;
  } else {
    const ctl = JSON.parse(mark[1]);
    console.log('  ' + JSON.stringify(ctl));
    ok(ctl.whiffNofailMe === 1, 'the knob PUTS THE TOLL BACK on the whiffed `paidOnFail: false` member',
       'fixed ' + R['WHIFF-NOFAIL'].meToll.length + ' vs control ' + ctl.whiffNofailMe
       + (ctl.whiffNofailMe === R['WHIFF-NOFAIL'].meToll.length
          ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    ok(ctl.whiffNofailParted > 0, 'and that arm PARTS A BOARD under the knob, so the knob reached the RULE',
       String(ctl.whiffNofailParted) + ' parting(s)');
    ok(ctl.whiffNofailSd === 0, 'the AUTHORITY is unmoved by our knob', String(ctl.whiffNofailSd));
    ok(ctl.landsMe === R.LANDS.meToll.length && ctl.landsParted === 0,
       'LANDS does not move under the knob', 'toll ' + ctl.landsMe + ', partings ' + ctl.landsParted);
    ok(ctl.whiffOnfailMe === R['WHIFF-ONFAIL'].meToll.length && ctl.whiffOnfailParted === 0,
       'WHIFF-ONFAIL does not move under the knob either, so the gate is specific to the member',
       'toll ' + ctl.whiffOnfailMe + ', partings ' + ctl.whiffOnfailParted);
  }
}

console.log(NL + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(fails ? 1 : 0);
