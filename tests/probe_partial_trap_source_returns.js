/* probe_partial_trap_source_returns.js — A PARTIAL TRAP ENDS WHEN ITS SOURCE HAS BEEN ON THE FIELD
 * FOR NO TURNS, NOT ONLY WHEN IT IS OFF IT. THE THIRD CLAUSE OF THE AUTHORITY'S OWN PREDICATE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_partial_trap_source_returns.js
 *   MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=1 SHOWDOWN_PATH=... node tests/probe_partial_trap_source_returns.js
 *
 * ================= THE RULE, READ OFF THE AUTHORITY =============================================
 *
 *     partiallytrapped.onResidual(pokemon) {
 *       const source = this.effectState.source;
 *       ...
 *       if (source && (!source.isActive || source.hp <= 0 || !source.activeTurns) && !gmaxEffect) {
 *         delete pokemon.volatiles['partiallytrapped'];
 *         this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]', '[silent]');
 *         return;
 *       }
 *       this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor);
 *     }
 *                                    — data/conditions.ts:232-244, NOT overridden by Champions
 *                                      (data/mods/champions/conditions.ts holds par/slp/frz only).
 *
 * THREE CLAUSES. This engine had the first two (`sourceOffField`) and the third was a DECLARED
 * REMAINDER at the site since 2026-08-27: *"`!source.activeTurns` — a trapper that entered the field
 * THIS turn — has no counterpart below. It needs its own fixture."* This file is that fixture.
 *
 * `activeTurns` is set to 0 by EVERY switch-in (sim/battle-actions.ts:137) and incremented in
 * `nextTurn` (sim/battle.ts:1762), so a body that was put back on the field DURING a turn reads 0 at
 * that turn's residual. It is standing there, it is `isActive`, and the trap ends anyway.
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * One of the 34 board partings in the 2026-09-19 held-out 12,000-game draw (release `18773c22878f`,
 * 7,178 games, pool `e398641bda45`) — `docs/_reports/2026-09-19-final-remeasure.md` row 24:
 *
 *     pair-protect-bust ...bo3-2662400605  turn 4
 *       p1.party.blastoise.hp              us=18  showdown=37
 *       p1.active[0].vol.trapped_by_move   us=1   showdown=0
 *     showdown   |-end|p1a: Blastoise|Infestation|[partiallytrapped]|[silent]
 *     medicham2  |-damage|p1a: Blastoise|18/154 tox|[from] move: infestation|[partiallytrapped]
 *
 * The Toxapex holding that Infestation switched OUT at the top of the turn and its partner's Parting
 * Shot put it BACK on the field in the other slot, all inside turn 4.
 *
 * ================= THE FIXTURE, AND WHY IT IS BUILT THIS WAY ====================================
 *
 * The trapper has to LEAVE and RETURN inside one turn, which needs two pivots in the same turn:
 *   turn 1  the trapper infests the victim (the victim must NOT shield, or nothing lands);
 *   turn 2  the trapper switches out by script, and its PARTNER'S Parting Shot brings it straight
 *           back into the other slot. Which body a pivot brings in is the ENGINE'S choice and is
 *           mirrored to the authority, so the arm ASSERTS that the returning body is the trapper
 *           rather than assuming it;
 *   turn 3  a quiet turn, so the reading is not taken on the turn the switch happened.
 *
 * ================= THE ARMS ====================================================================
 *
 *   RETURNS   the trapper leaves and comes back the same turn.   UNDER TEST — the trap must END,
 *             with no chip, on turn 2 in BOTH engines.
 *   STAYS     the identical board with the trapper standing still (it clicks its shield instead of
 *             switching, and the partner shields too). FIXTURE CONTROL: the trap must still be
 *             running and still chipping — without it, "the trap ended" would also pass on an engine
 *             that had stopped applying traps at all.
 *
 * RED-FIRST KNOB: `MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=1` takes the third clause out. Under it the
 * RETURNS arm must PART A BOARD and the STAYS arm must not move.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * BOTH. One board parting in the held-out pool draw, and the lab row is the census's
 * `move/partialTrap` family. Said before the run.
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
const KNOB_SET = process.env.MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE === '1';
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
  console.log('  MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the assertions below are');
  console.log('  expected to FAIL and this run MUST exit 1. The control child is skipped.');
}
let fails = 0;
const ok = (cond, label, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? NL + '          ' + detail : ''));
  if (!cond) fails++;
};

/* ---- THE FAMILY, DERIVED, AND PRINTED BEFORE IT IS USED --------------------------------------- */
const FAMILY = Object.keys(TAGS.moves).filter(id => ((TAGS.moves[id] || {}).tags || []).includes('partialTrap'));
console.log(NL + '  === `partialTrap` MOVES IN THIS FORMAT, AS data/tags.json DERIVES THEM ===');
console.log('    ' + (FAMILY.join(', ') || '(none)'));
if (!FAMILY.length) { console.log('NOT RUN — no partialTrap move carries the tag. This is not a pass.'); process.exit(2); }

const TRAP_MOVE = 'Infestation', TRAPPER = 'Toxapex';
const PIVOT = 'Parting Shot', PARTNER = 'Incineroar';
const VICTIM = 'Blastoise', VICTIM_IDLE = 'Iron Defense';
const ALLY = 'Excadrill', ALLY_IDLE = 'Swords Dance';
const P2_BENCH = [['Milotic', 'Recover'], ['Torterra', 'Curse']];
const P1_BENCH = [['Pinsir', 'Swords Dance'], ['Goodra', 'Acid Armor']];

console.log(NL + '  === THE CAST, CHECKED AGAINST THE AUTHORITY\'S OWN LEARNSETS ===');
{
  let bad = 0;
  const claims = [[TRAPPER, TRAP_MOVE], [TRAPPER, 'Protect'], [PARTNER, PIVOT], [PARTNER, 'Protect'],
                  [VICTIM, VICTIM_IDLE], [ALLY, ALLY_IDLE], ...P2_BENCH, ...P1_BENCH];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log('  learnset: ' + sp + ' / ' + mv + ' -> ' + (good ? 'LEGAL' : 'NOT LEGAL'));
    if (!good) bad++;
  }
  if (!FAMILY.includes(TRAP_MOVE.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
    console.log('  ' + TRAP_MOVE + ' no longer carries `partialTrap` — the fixture is stale, not the rule.');
    bad++;
  }
  if (bad) { console.log('NOT RUN — the fixture is not legal in this format. This is not a pass.'); process.exit(2); }
}

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) { console.log('NOT RUN — no arm named middle in game_differential.js.'); process.exit(2); }
const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
const TEAM_P1 = [mon(VICTIM, 'Torrent', ['Protect', VICTIM_IDLE]), mon(ALLY, 'Sand Rush', ['Protect', ALLY_IDLE]),
                 ...P1_BENCH.map(([s, m]) => mon(s, '', ['Protect', m]))];
const TEAM_P2 = [mon(TRAPPER, 'Regenerator', [TRAP_MOVE, 'Protect']), mon(PARTNER, 'Blaze', [PIVOT, 'Protect']),
                 ...P2_BENCH.map(([s, m]) => mon(s, '', ['Protect', m]))];

const script = (leaves) => [
  /* The victim must not shield on the trap turn, or the fixture tests a Protect. */
  { p1: [{ m: VICTIM_IDLE }, { m: 'Protect' }], p2: [{ m: TRAP_MOVE, t: 0 }, { m: 'Protect' }] },
  { p1: [{ m: VICTIM_IDLE }, { m: ALLY_IDLE }],
    p2: leaves ? [{ sw: P2_BENCH[0][0] }, { m: PIVOT, t: 0 }] : [{ m: 'Protect' }, { m: 'Protect' }] },
  { p1: [{ m: VICTIM_IDLE }, { m: ALLY_IDLE }], p2: [{ m: 'Protect' }, { m: 'Protect' }] },
];

const TRAPPED_LEAF = 'p1.active[0].vol.trapped_by_move';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function run(tag, leaves) {
  const a = G.buildPair(TEAM_P1, { hpBoost: 8 }), b = G.buildPair(TEAM_P2, { hpBoost: 8 });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const parted = [], leaf = [];
  const r = G.playGame(a, b, 'partial-trap-return', tag, {
    script: script(leaves), arm: ARM,
    onBoundary: (snap, turnIdx) => {
      if (!snap.identical) parted.push('t' + turnIdx + ' ' + (snap.diffs || []).slice(0, 6).map(d => JSON.stringify(d)).join(' '));
      for (const d of (snap.diffs || [])) if (d.path === TRAPPED_LEAF) leaf.push('t' + turnIdx + ' us=' + d.medicham + ' sd=' + d.showdown);
      /* THE GAME MUST KEEP PLAYING PAST A PARTING, or the arm reads one turn and stops. The partings
       * are recorded ABOVE this line; suppressing them here only keeps the loop alive. */
      snap.identical = true; snap.diffs = [];
    },
  });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const sc = G.scriptCounters();
  if (sc.moveNotOnRequest) return { staged: false, why: sc.moveNotOnRequest + ' scripted click(s) not on the request: ' + sc.firstMissing };
  /* `|split|SIDE` IS FOLLOWED BY TWO VERSIONS OF ONE EVENT and counting both reads every authority
   * line twice — which is exactly how this file first accused the engine of missing a chip
   * (`sd 2 / me 1` on a board that did not part). `game_differential.js:2078-2085` keeps the
   * OMNISCIENT line and discards the spectator one; this does the same. */
  const foldSplit = (arr) => { const out = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === '|split|p1' || arr[i] === '|split|p2') { if (arr[i + 1] != null) out.push(arr[i + 1]); i += 2; continue; }
      out.push(arr[i]); }
    return out; };
  const sd = foldSplit((G.lastSdLog() || []).map(String)), me = (r.mediTrace || []).map(String);
  const chips = s => s.filter(l => /\|-damage\|p1a[:|]/.test(l) && /partiallytrapped/.test(l)).length;
  const ends = s => s.filter(l => /\|-end\|p1a[:|]/.test(l) && /partiallytrapped/.test(l)).length;
  const started = s => s.filter(l => /\|-activate\|p1a[:|]/.test(l) && new RegExp(norm(TRAP_MOVE)).test(norm(l))).length;
  /* WHICH BODY THE PIVOT BROUGHT BACK — asserted, never assumed: the engine chooses it. */
  const back = s => {
    const l = s.filter(x => /^\|switch\|p2[ab][:|]/.test(x) && /partingshot/i.test(x.replace(/\s/g, '')));
    return l.length ? norm((l[l.length - 1].split('|')[3] || '').split(',')[0]) : null;
  };
  return { staged: true, turns: r.turns,
           sdChips: chips(sd), meChips: chips(me), sdEnds: ends(sd), meEnds: ends(me),
           sdStart: started(sd), meStart: started(me), backSd: back(sd), backMe: back(me),
           parted, leaf, sd, me };
}

console.log(NL + 'A PARTIAL TRAP ENDS WHEN ITS SOURCE HAS STOOD THERE FOR NO TURNS — data/conditions.ts:236' + NL);
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm middle');
console.log('  MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=' + (KNOB_SET ? '1  (PRE-FIX ENGINE: the trap outlives the return)' : '0'));

const R = { RETURNS: run('returns', true), STAYS: run('stays', false) };
for (const [k, x] of Object.entries(R)) {
  console.log(NL + '='.repeat(98) + NL + '  ' + k);
  if (!x.staged) { console.log('  NOT STAGED — ' + x.why); fails++; continue; }
  console.log('    turns ' + x.turns + '   trap STARTED  sd ' + x.sdStart + ' / me ' + x.meStart
    + '   CHIPS  sd ' + x.sdChips + ' / me ' + x.meChips + '   `-end` lines  sd ' + x.sdEnds + ' / me ' + x.meEnds);
  console.log('    the body the pivot brought back:  sd ' + x.backSd + '   me ' + x.backMe);
  console.log('    board partings: ' + (x.parted.length ? x.parted.join(' | ') : 'none'));
}
if (Object.values(R).some(x => !x.staged)) { console.log(NL + 'RED — an arm did not stage.'); process.exit(1); }

if (KNOB) {
  console.log(NL + '  CONTROL ARM (MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    retMeChips: R.RETURNS.meChips, retSdChips: R.RETURNS.sdChips, retParted: R.RETURNS.parted.length,
    retLeaf: R.RETURNS.leaf.length, stayMeChips: R.STAYS.meChips, stayParted: R.STAYS.parted.length }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

console.log(NL + '  === THE VERDICT ===');
/* THE FIXTURE, ON THE AUTHORITY'S OWN STREAM. */
ok(R.RETURNS.sdStart === 1 && R.RETURNS.meStart === 1, 'the fixture: the trap LANDED in both engines',
   'sd ' + R.RETURNS.sdStart + ' / me ' + R.RETURNS.meStart);
ok(R.RETURNS.backSd === norm(TRAPPER) && R.RETURNS.backMe === norm(TRAPPER),
   'the fixture: the pivot brought the TRAPPER back, in both engines',
   'sd ' + R.RETURNS.backSd + ' / me ' + R.RETURNS.backMe);
ok(R.STAYS.sdChips >= 2, 'the fixture: a trap whose source stands still KEEPS CHIPPING on the authority',
   String(R.STAYS.sdChips) + ' chip line(s)');
/* THE RULE. */
ok(R.RETURNS.sdEnds === 1, 'AUTHORITY: the trap ENDS on the turn its source comes back',
   String(R.RETURNS.sdEnds) + ' `-end` line(s)');
ok(R.RETURNS.meEnds === 1, 'medicham2: it ends there too', String(R.RETURNS.meEnds) + ' `-end` line(s)');
ok(R.RETURNS.meChips === R.RETURNS.sdChips, 'and the chip counts agree',
   'sd ' + R.RETURNS.sdChips + ' / me ' + R.RETURNS.meChips);
ok(R.RETURNS.parted.length === 0, 'RETURNS: no board parted', R.RETURNS.parted.join(' | '));
ok(R.STAYS.parted.length === 0, 'STAYS: no board parted either', R.STAYS.parted.join(' | '));
/* THE ARMS MUST DISAGREE. */
ok(R.STAYS.sdChips > R.RETURNS.sdChips,
   'THE ARMS DISAGREE ON THE AUTHORITY, so the ending is the RETURN and not the board',
   'stays ' + R.STAYS.sdChips + ' chips vs returns ' + R.RETURNS.sdChips);

if (KNOB_SET) {
  console.log(NL + '  --- the control child is SKIPPED: the knob is already set in this process, so a');
  console.log('      child of it would compare a control against a control and report that the');
  console.log('      knob changed nothing — true, and about the wrong thing ---');
} else {
  const { spawnSync } = require('child_process');
  console.log(NL + '  --- re-running under MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE: '1', ABRA_PROBE_CONTROL_ARM: '1' },
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(c.stdout || '');
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (!mark) {
    process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
    console.log(NL + '  RED — the control child printed no verdict line (exit ' + c.status + ').'); fails++;
  } else {
    const ctl = JSON.parse(mark[1]);
    console.log('  ' + JSON.stringify(ctl));
    ok(ctl.retMeChips > R.RETURNS.meChips, 'the knob PUTS THE CHIPS BACK on the returned source',
       'fixed ' + R.RETURNS.meChips + ' vs control ' + ctl.retMeChips
       + (ctl.retMeChips === R.RETURNS.meChips ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    ok(ctl.retParted > 0, 'and the RETURNS arm PARTS A BOARD under it, so the knob reached the RULE',
       String(ctl.retParted) + ' parting(s)');
    ok(ctl.retLeaf > 0, 'the parting is on the trap leaf itself (' + TRAPPED_LEAF + ')', String(ctl.retLeaf));
    ok(ctl.retSdChips === R.RETURNS.sdChips, 'the AUTHORITY is unmoved by our knob',
       'sd ' + R.RETURNS.sdChips + ' -> ' + ctl.retSdChips);
    ok(ctl.stayMeChips === R.STAYS.meChips && ctl.stayParted === 0,
       'STAYS does not move under the knob, so the clause is specific to the RETURN',
       'chips ' + ctl.stayMeChips + ', partings ' + ctl.stayParted);
  }
}

console.log(NL + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(fails ? 1 : 0);
