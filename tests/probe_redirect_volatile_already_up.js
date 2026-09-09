/* probe_redirect_volatile_already_up.js — A MOVE WHOSE ONLY EFFECT IS A VOLATILE THE BODY ALREADY
 * CARRIES FAILS. THIS ENGINE RE-ANNOUNCED IT. 2026-09-09, batch X.
 *
 *   SHOWDOWN_PATH=... node tests/probe_redirect_volatile_already_up.js
 *   SHOWDOWN_PATH=... node tests/probe_redirect_volatile_already_up.js --release <id> --only <arm>
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `7489a6cc064d`, 961 games on the pinned pool:
 *
 *     unrelated event mismatch :: |-fail|p2a <> |-singleturn|p2a|ragepowder
 *
 * and the game itself (`pair-redirect-priority`, seed …bo3-2660157568, turn 11):
 *
 *     agreed    |move|p2a: Sinistcha|ragepowder
 *     agreed    |-singleturn|p2a: Sinistcha|move: ragepowder      <- the FIRST one, on both engines
 *     agreed    |move|p1a: Oranguru|instruct  …  |-singleturn|p2a: Sinistcha|instruct
 *     agreed    |move|p2a: Sinistcha|ragepowder                   <- the REPEAT
 *     showdown  |-fail|p2a: Sinistcha
 *     medicham2 |-singleturn|p2a: Sinistcha|move: ragepowder      <- announced a second time
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * Rage Powder is `volatileStatus: 'ragepowder'` with a `condition` of `duration: 1` and NO
 * `onRestart` (data/moves.ts; Champions overrides neither the move nor the condition — re-derived on
 * every run below, along with the absent `onRestart`). Three lines decide the card:
 *
 *     Pokemon#addVolatile      if (this.volatiles[status.id]) {
 *                                if (!status.onRestart) return false;      sim/pokemon.ts
 *     BattleActions#moveHit    if (moveData.volatileStatus) {
 *                                hitResult = target.addVolatile(...);
 *                                didSomething = this.combineResults(didSomething, hitResult);
 *                                                                sim/battle-actions.ts:1236-1238
 *     BattleActions#moveHit    if (didAnything === false) {
 *                                this.battle.add('-fail', source);
 *                                this.battle.attrLastMove('[still]');   sim/battle-actions.ts:1305-6
 *
 * So a body that already carries the volatile gets `false` back, the move does nothing, and the
 * authority writes `|-fail|<the USER>` and blanks the target field of the `|move|` line it already
 * emitted. The `-singleturn` is written by the condition's `onStart`, which never runs.
 *
 * THE `[still]` IS NOT DECORATION AND IS EMITTED HERE FOR THAT REASON. `attrLastMove('[still]')`
 * BLANKS field 4 of the move line (sim/battle.ts:3120, and `TRACE.attrStill` reproduces it). The
 * differ strips the `[still]` FLAG under its display-flags rule and does NOT put the blanked target
 * back, so a fix that wrote the `-fail` and skipped the attribute would have replaced one divergence
 * with a different one on the line above.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `if (a.kind === 'redirect') { m._redirect = a.mv; m._lastMove = a.mv; TR.st1(...); continue; }` —
 * an unconditional write and an unconditional line. `_redirect` is cleared once per turn with
 * `protect` and the rest of the per-turn clock, so the mark was already correct; nothing ever asked
 * whether it was ALREADY SET before writing it again.
 *
 * A BODY CAN ONLY REACH THIS TWICE IN ONE TURN THROUGH INSTRUCT, which is why the card is an
 * Instruct card and why the fixture below is one too.
 *
 * ================= WHAT IS NOT FIXED HERE, DECLARED RATHER THAN LEFT TO BE FOUND ===============
 *
 * `_redirect` holds ONE id, so a body Instructed into a DIFFERENT redirect move than the one it
 * clicked (Follow Me then Rage Powder) overwrites the first mark where the authority would carry
 * both volatiles at once. Nothing in this format can reach that — no legal species learns both — but
 * it is a real narrowing of the model and it is stated here rather than discovered later.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE
 * EXPECTATION. `MEDI_REDIRECT_REAPPLIES_SILENTLY=1` is the revert knob and restores exactly the
 * pre-2026-09-09 branch, so a RED arm is one that agrees clean and PARTS under the knob, and a
 * CONTROL is one that agrees under BOTH.
 *
 * ================= THE CONTROLS, AND WHY EACH ONE EXISTS ========================================
 *
 * `ragepowder-clicked-again-on-the-next-turn` is THE KNOB CLEARED EXPLICITLY. The same body clicks
 * the same move twice, and the only thing that moved is WHETHER THE VOLATILE IS STILL UP: it is
 * `duration: 1`, so the second click lands on a clean body and BOTH must be announced. A fix that
 * marked the body permanently — or that forgot the per-turn clear — passes the red arm and kills
 * Rage Powder from turn 2 onwards, which is the failure mode with the largest blast radius here.
 *
 * `calmmind-instructed-inside-its-own-turn` is the over-fire control on the other axis. The identical
 * Instruct, the identical body, the identical turn — and a move with no volatile at all, whose repeat
 * the authority grants (a second +1/+1). A fix reading "an Instructed repeat in the same turn fails"
 * passes the red arm and breaks this one.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_redirect_volatile_already_up.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_REDIRECT_REAPPLIES_SILENTLY';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FIXTURE ------------------------------------------------------------------------------
 * THE PRIORITIES DO THE WORK AND NO SPEED TIE IS INVOLVED. Rage Powder is priority +2, so the
 * target's own click always resolves above Oranguru's Instruct whatever the Speed reads; Calm Mind
 * is priority 0, and Sinistcha is base 70 against Oranguru's 60, so the control's own click still
 * lands first. Both are asserted below rather than assumed. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const CM = { m: 'calmmind' };
const SD = { m: 'swordsdance' };
const RP = { m: 'ragepowder' };
const INS = { m: 'instruct', t: 0 };

const SIDE_A = [['oranguru', '', 'Inner Focus', ['Instruct', 'Calm Mind']],
                ['clefable', '', 'Unaware', ['Calm Mind', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Rest']],
                ['corviknight', '', 'Pressure', ['Protect']]];
const SIDE_B = [['sinistcha', '', 'Heatproof', ['Rage Powder', 'Calm Mind', 'Protect']],
                ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];

const CASES = [
  { id: 'ragepowder-instructed-inside-its-own-turn', kind: 'red',
    script: [{ p1: [INS, CM], p2: [RP, SD] }],
    refClean: 1, refKnob: 0,
    what: 'THE CARD, REBUILT. Sinistcha clicks Rage Powder at priority +2 and the volatile goes up; '
        + 'Oranguru then Instructs it into the same move on the same turn. The authority\'s '
        + '`addVolatile` returns false, the move does nothing, and it writes `|-fail|` on the user '
        + 'with `[still]` on the move line; this engine wrote a second `|-singleturn|`.' },

  { id: 'ragepowder-clicked-again-on-the-next-turn', kind: 'control',
    script: [{ p1: [CM, CM], p2: [RP, SD] }, { p1: [CM, CM], p2: [RP, SD] }],
    refClean: 0, refKnob: 0,
    what: 'THE KNOB CLEARED EXPLICITLY — the same body clicking the same move twice, with ONE thing '
        + 'moved: the volatile is `duration: 1` and has expired between the two clicks, so BOTH are '
        + 'announced. This is what separates "the volatile is already up" from "Rage Powder has '
        + 'stopped working in this engine", and it is the arm a forgotten per-turn clear breaks.' },

  { id: 'calmmind-instructed-inside-its-own-turn', kind: 'control',
    script: [{ p1: [INS, CM], p2: [CM, SD] }],
    refClean: 0, refKnob: 0,
    what: 'THE OVER-FIRE CONTROL ON THE OTHER AXIS. The identical Instruct into the identical body '
        + 'on the identical turn, and a move carrying no volatile at all: the authority grants the '
        + 'repeat and Sinistcha ends the turn at +2/+2. A fix reading "an Instructed repeat inside '
        + 'the same turn fails" passes the red arm and breaks here.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const row of SIDE_A.concat(SIDE_B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE PREMISES, DERIVED ON EVERY RUN -------------------------------------------------------- */
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const champ = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const rp = dex.moves.get('ragepowder'), ins = dex.moves.get('instruct');
  const cond = dex.conditions.get('ragepowder');
  const users = dex.species.all().filter(legal).filter(s => learns(s.name, 'ragepowder')).map(s => s.name);
  const instructors = dex.species.all().filter(legal).filter(s => learns(s.name, 'instruct')).map(s => s.name);
  console.log('DOES CHAMPIONS REWRITE ragepowder / instruct / calmmind? '
    + ['ragepowder', 'instruct', 'calmmind'].map(id =>
      id + '=' + (new RegExp('^\\t' + id + ': \\{', 'm').test(champ) ? 'YES' : 'no')).join('  '));
  console.log('ragepowder: volatileStatus=' + JSON.stringify(rp.volatileStatus)
    + '  priority=' + rp.priority + '  condition.duration=' + cond.duration
    + '  condition.onRestart=' + (typeof cond.onRestart));
  console.log('LEGAL RAGE POWDER USERS: ' + (users.join(', ') || '(NONE)'));
  console.log('LEGAL INSTRUCT USERS: ' + (instructors.join(', ') || '(NONE)'));
  console.log('base speeds: sinistcha ' + dex.species.get('sinistcha').baseStats.spe
    + '  oranguru ' + dex.species.get('oranguru').baseStats.spe
    + '   (the target must be FASTER, so its own Calm Mind lands above the Instruct in the control)');
  console.log('instruct.flags = ' + JSON.stringify(ins.flags));
  const bad = [];
  if (new RegExp('^\\tragepowder: \\{', 'm').test(champ)) bad.push('Champions now overrides Rage Powder');
  if (new RegExp('^\\tinstruct: \\{', 'm').test(champ)) bad.push('Champions now overrides Instruct');
  if (rp.volatileStatus !== 'ragepowder') bad.push('Rage Powder no longer applies its own volatile');
  if (typeof cond.onRestart === 'function') bad.push('the ragepowder condition now has an onRestart, '
    + 'so addVolatile no longer returns false and this whole file is about a case that cannot occur');
  if (cond.duration !== 1) bad.push('the ragepowder condition is duration ' + cond.duration
    + ', not 1, so the second control\'s premise (it has expired by the next turn) is wrong');
  if (rp.priority <= 0) bad.push('Rage Powder is no longer a priority move, so the red arm can no '
    + 'longer guarantee the first click lands above the Instruct');
  if (!instructors.length) bad.push('nothing in this format learns Instruct');
  if (dex.species.get('sinistcha').baseStats.spe <= dex.species.get('oranguru').baseStats.spe) {
    bad.push('the target is no longer faster than the instructor');
  }
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(SIDE_A)), b = G.buildPair(stage(SIDE_B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_redirect_volatile_already_up :: ' + c.id,
    { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).redirectReappliesSilentlyRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const R = { c, clean, brk, short, refused,
    ref: clean.delta.redirectRefusedVolatileUp || 0, refK: brk.delta.redirectRefusedVolatileUp || 0,
    mark: clean.delta.redirectMarkSet || 0, markK: brk.delta.redirectMarkSet || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (R.ref !== c.refClean) fails.push('redirectRefusedVolatileUp clean is ' + R.ref + ', declared ' + c.refClean);
  if (R.refK !== c.refKnob) fails.push('redirectRefusedVolatileUp knob is ' + R.refK + ', declared ' + c.refKnob);
  /* AND THE MARK MUST STILL BE SET SOMEWHERE. An arm whose Rage Powder was refused OUTRIGHT — no
     first click, no volatile, no redirect — would agree with an authority doing the same thing for
     the wrong reason. `redirectMarkSet` is the receipt that the mechanic still runs. */
  if (c.id !== 'calmmind-instructed-inside-its-own-turn' && R.mark < 1) {
    fails.push('redirectMarkSet is ' + R.mark + ' — no Rage Powder volatile went up at all, so this '
      + 'arm staged nothing');
  }
  if (clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk } = R;
  const verdict = R.short ? 'SHORT        ' : R.refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
      : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       redirectRefusedVolatileUp ' + R.ref + '/' + c.refClean + ' clean, '
    + R.refK + '/' + c.refKnob + ' knob   |   redirectMarkSet ' + R.mark + ' clean, ' + R.markK + ' knob');
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || brk.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : 'PASS — a redirect move whose volatile is already up fails with `|-fail|` and `[still]`, the knob '
  + 'puts the red arm apart again, the same move clicked on the NEXT turn still goes up, and an '
  + 'Instructed repeat of a move with no volatile is still granted');
process.exit(bad ? 1 : 0);
