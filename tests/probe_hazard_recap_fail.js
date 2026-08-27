/* probe_hazard_recap_fail.js — A HAZARD AT ITS CAP FAILS, AND THE FAILURE IS ANNOUNCED.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_hazard_recap_fail.js
 *   SHOWDOWN_PATH=... node tests/probe_hazard_recap_fail.js --release <id>
 *
 * ================= WHERE THIS CAME FROM, AND WHAT THE HANDED DIAGNOSIS GOT WRONG ==================
 *
 * `data/divergence-turns.json` on release 6272fa445b73, config `baseline`, turn 7 — an Ariados
 * clicking Sticky Web onto a side that already has one:
 *
 *     SHOWDOWN   |move|p1b: Ariados|stickyweb|p1b: Ariados
 *                |-fail|p1b: Ariados
 *     MEDICHAM   |move|p1b: Ariados|stickyweb|p1b: Ariados
 *                (nothing)
 *
 * THIS CARD WAS HANDED OVER AS *"a move with no legal target never prints its `-fail`"* — the
 * `useMoveInner` early return at sim/battle-actions.ts:509-511. IT IS NOT THAT. Sticky Web's target
 * is `foeSide`, which takes the OTHER branch of the same `if` and never reaches the no-target return
 * at all. Staged both shapes side by side before a byte moved:
 *
 *     a hazard re-laid at its cap        PARTS — showdown `|-fail|`, medicham silent
 *     a move whose ally target is absent AGREES — both engines already handle it
 *
 * The real site is `moveHit`, sim/battle-actions.ts:1240-1241 and 1303-1308:
 *
 *     hitResult = target.side.addSideCondition(moveData.sideCondition, source, move);
 *     ...
 *     if (!didAnything && didAnything !== 0 && ...) if (didAnything === false) {
 *       this.battle.add('-fail', source); this.battle.attrLastMove('[still]'); }
 *
 * and `Side#addSideCondition` returns false for a condition already present whose condition declares
 * no `onSideRestart`. THE SAME RULE WAS ALREADY WIRED FOR THE SCREENS — ROADMAP #81 WIRE 8 calls
 * `mvFail` when a screen is already up — and the hazard branch is the half that was never done:
 * `layHazard` returns whether a layer went down and its caller in the `hazard` branch throws the
 * answer away.
 *
 * ================= WHAT THIS IS ==================================================================
 *
 * A PROBE, not a gate. Narration: it moves the whole-game clause and must NOT move board-material —
 * the layer count is identical either way, only the line is missing. Every arm is judged by two
 * protocol streams with no typed expectation.
 *
 * `MEDI_HAZARD_RECAP_SILENT=1` restores the pre-fix silence. The probe re-runs ITSELF as a child
 * under that knob and FAILS if the child passes.
 *
 * FIVE ARMS, and the two controls exist because a `-fail` is easy to over-fire.
 *
 *   A  TEST      a cap-1 hazard clicked twice                                  -> AGREES (knob: PARTS)
 *   B  CONTROL   the same hazard clicked ONCE                                  -> AGREES in BOTH
 *   C  CONTROL   a MULTI-LAYER hazard clicked twice, still BELOW its cap — a
 *                `-fail` here would be an over-fire, and the layer really goes
 *                down                                                          -> AGREES in BOTH
 *   D  CONTROL   the multi-layer hazard clicked until it IS at its cap, then
 *                once more: the same refusal at a different number             -> AGREES (knob: PARTS)
 *   E  POSITIVE  a SCREEN clicked twice. Same authority rule, already wired
 *                (WIRE 8), so it must agree in BOTH arms — which is what proves
 *                this probe can SEE the `-fail` shape at all rather than being
 *                red about everything                                          -> AGREES in BOTH
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PRELOADED = Object.keys(require.cache).some(k => k.endsWith('_live_release.js'));
if (!arg('--release', null) && !PRELOADED) {
  console.log('REFUSED — pass --release <id>, or preload -r ./tests/_live_release.js to play the LIVE');
  console.log('tree. Requiring engine/game_differential.js with neither CUTS A RELEASE into the real store.');
  process.exit(2);
}
const DUMP = arg('--dump', null);
const KNOB = process.env.MEDI_HAZARD_RECAP_SILENT === '1';
const IS_CHILD = process.env.PROBE_HAZARD_RECAP_CHILD === '1';

const GD = require(D('engine', 'game_differential.js'));
const { buildPair, playGame, REL } = GD;
const M = REL.require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const TAGS = require(D('data', 'tags.json'));
const buildable = sp => sp && sp.exists && legal(sp) && !sp.battleOnly && !sp.requiredItem
  && !sp.isMega && !sp.forme;
/* A LEARNSET WALK THAT THREW IS NOT A MOVE NOBODY LEARNS — see the note in
 * tests/probe_sound_lock_restart.js. It speaks rather than answering `[]` in silence. */
let CARRIER_THREW = 0;
const carriersOf = mv => {
  try { return CS.moveCarriers(mv) || []; }
  catch (e) { CARRIER_THREW++;
    console.log('  moveCarriers THREW for ' + mv + ' — treated as NO CARRIER and COUNTED: '
      + String((e && e.message) || e).split(String.fromCharCode(10))[0]);
    return []; }
};

/* ---- THE FIXTURE, DERIVED --------------------------------------------------------------------- */
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
const hazards = Object.keys(TAGS.moves || {})
  .map(m => ({ id: m, p: (TAGS.moves[m].params || {}).hazard }))
  .filter(x => x.p && x.p.hazard);
for (const h of hazards) console.log('    ' + h.id + '  ' + JSON.stringify(h.p));
const CAP1 = hazards.filter(h => +h.p.maxLayers === 1);
const CAPN = hazards.filter(h => +h.p.maxLayers > 1).sort((a, b) => a.p.maxLayers - b.p.maxLayers);
if (!CAP1.length || !CAPN.length) {
  console.log('  COULD-NOT-STAGE — this regulation has no cap-1 hazard or no multi-layer hazard.');
  console.log('  A claim about the FORMAT, stated rather than passed over.');
  process.exit(0);
}
/* The layer's own screen counterpart for arm E, derived off the tag the screens branch reads. */
const screens = Object.keys(TAGS.moves || {}).filter(m => (TAGS.moves[m].tags || []).includes('halvesDamage')
  && !(TAGS.moves[m].tags || []).includes('failsWithoutWeather'));

function pickLayer(list) {
  for (const h of list) {
    for (const n of carriersOf(h.id)) {
      const sp = DEX.species.get(n);
      if (!buildable(sp) || !CS.canLearn(sp.name, 'Protect')) continue;
      return { move: h.id, cap: +h.p.maxLayers, body: sp.id, ability: Object.values(sp.abilities)[0] };
    }
  }
  return null;
}
const H1 = pickLayer(CAP1), HN = pickLayer(CAPN);
let SCR = null;
for (const s of screens) { const c = pickLayer([{ id: s, p: { hazard: s, maxLayers: 1 } }]); if (c) { SCR = c; break; } }
console.log('  cap-1 hazard  : ' + (H1 ? H1.move + '  by ' + H1.body : 'NONE'));
console.log('  multi hazard  : ' + (HN ? HN.move + ' (cap ' + HN.cap + ')  by ' + HN.body : 'NONE'));
console.log('  screen (E)    : ' + (SCR ? SCR.move + '  by ' + SCR.body : 'NONE'));
if (!H1 || !HN) { console.log('  COULD-NOT-STAGE — no legal carrier for one of the two hazards.'); process.exit(0); }

const mon = (species, item, ability, moves) => ({ species, item, ability, moves });
const FILLERS = ['clefable', 'milotic', 'garchomp', 'corviknight', 'toxapex', 'snorlax', 'umbreon'];
const pool = FILLERS.filter(f => buildable(DEX.species.get(f)));
const fillersNot = (...used) => pool.filter(f => !used.includes(f));

const COUNTERS = ['hazardRecapRefused'];
function play(name, p1, p2, script) {
  const a = buildPair(p1, { hpBoost: 6 }), b = buildPair(p2, { hpBoost: 6 });
  if (!a || !b) return { name, staged: false };
  const before = {}; for (const k of COUNTERS) before[k] = M.seen[k] || 0;
  const r = playGame(a, b, 'directed', 'hazard-recap/' + name, { script });
  const d = {}; for (const k of COUNTERS) d[k] = (M.seen[k] || 0) - before[k];
  const lines = r.mediTrace || [];
  if (DUMP === name || DUMP === 'all') {
    console.log('  --- DUMP ' + name + ' ---');
    for (const l of lines) console.log('      me ' + l);
    if (r.div) { for (const l of (r.div.sdBeforeRaw || [])) console.log('      sd  ' + l);
      console.log('      sd >' + r.div.sdRaw); console.log('      me >' + r.div.meRaw);
      for (const l of (r.div.sdAfterRaw || [])) console.log('      sd  ' + l); }
  }
  return { name, staged: true, err: r.err || null, turns: r.turns,
           diverged: !!r.div, at: r.div ? r.div.index : null,
           sd: r.div ? r.div.sdRaw : null, me: r.div ? r.div.meRaw : null,
           starts: lines.filter(l => l.startsWith('|-sidestart|')).length,
           fails: lines.filter(l => l.startsWith('|-fail|')).length, d };
}

const prot = { m: 'protect' };
/* The LAYER is clicked by p1a; everything else Protects, so nothing else in the fixture moves. A
 * body may not click Protect on two consecutive turns (the stall counter refuses the second), so the
 * three inert slots alternate Protect with nothing — they are simply given Protect and the failures
 * they collect are identical in both engines and identical across every arm. */
function sidesFor(layer) {
  const f = fillersNot(layer.body);
  const p1 = [ mon(layer.body, '', layer.ability, [DEX.moves.get(layer.move).name, 'Protect']),
               mon(f[0], '', '', ['Protect']), mon(f[1], '', '', ['Protect']), mon(f[2], '', '', ['Protect']) ];
  const p2 = [ mon(f[3], '', '', ['Protect']), mon(f[4], '', '', ['Protect']),
               mon(f[5], '', '', ['Protect']), mon(f[0], '', '', ['Protect']) ];
  return { p1, p2 };
}
const lay = m => ({ m });
function turnsOf(move, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ p1: [lay(move), prot], p2: [prot, prot] });
  return out;
}

const S1 = sidesFor(H1), SN = sidesFor(HN);
const results = {};
results.A = play('A', S1.p1, S1.p2, turnsOf(H1.move, 2));
results.B = play('B', S1.p1, S1.p2, turnsOf(H1.move, 1));
results.C = play('C', SN.p1, SN.p2, turnsOf(HN.move, 2));           /* cap >= 2, so both land */
results.D = play('D', SN.p1, SN.p2, turnsOf(HN.move, HN.cap + 1));  /* one click past the cap */
let E = null;
if (SCR) { const SS = sidesFor(SCR); E = play('E', SS.p1, SS.p2, turnsOf(SCR.move, 2)); }

console.log('\n  === ARMS (' + (KNOB ? 'MEDI_HAZARD_RECAP_SILENT=1 — the PRE-FIX silence' : 'shipped default') + ') ===');
const row = r => { if (!r) return;
  if (!r.staged) { console.log('  ' + r.name + '  COULD-NOT-STAGE'); return; }
  console.log('  ' + r.name + '  ' + (r.diverged ? 'PARTS at line ' + r.at : 'AGREES') + '  turns=' + r.turns
    + '  sidestarts=' + r.starts + ' fails=' + r.fails + '  ' + JSON.stringify(r.d) + (r.err ? '  err=' + r.err : ''));
  if (r.diverged) { console.log('        showdown  ' + r.sd); console.log('        medicham  ' + r.me); } };
for (const k of Object.keys(results)) row(results[k]);
row(E);

const bad = [];
if (CARRIER_THREW) bad.push('the learnset walk THREW ' + CARRIER_THREW + ' time(s) — every fixture '
  + 'choice below rests on it, so a COULD-NOT-STAGE or a control here would be a claim about the '
  + 'FORMAT taken off a broken instrument');

const expectAgree = (r, why) => { if (!r || !r.staged) { bad.push((r ? r.name : '?') + ' NOT STAGED'); return; }
  if (r.diverged) bad.push(r.name + ' PARTS and must not (' + why + ')'); };
expectAgree(results.A, 'a cap-1 hazard re-laid must announce its failure');
expectAgree(results.B, 'one click, nothing to refuse');
expectAgree(results.C, 'below the cap, the layer really goes down');
expectAgree(results.D, 'the same refusal at a cap of ' + HN.cap);
if (E) expectAgree(E, 'the screen half was already wired (WIRE 8) and must be untouched');

/* THE ARMS MUST HAVE STAGED WHAT THEY CLAIM. */
if (results.A.staged && results.A.starts !== 1)
  bad.push('A wrote ' + results.A.starts + ' -sidestart lines, expected 1 — the cap did not bite');
if (results.C.staged && results.C.starts !== 2)
  bad.push('C wrote ' + results.C.starts + ' -sidestart lines, expected 2 — the second layer did not go down');
if (results.D.staged && results.D.starts !== HN.cap)
  bad.push('D wrote ' + results.D.starts + ' -sidestart lines, expected ' + HN.cap);
if (!KNOB) {
  if (results.A.staged && results.A.d.hazardRecapRefused !== 1)
    bad.push('A refused ' + results.A.d.hazardRecapRefused + ' re-laid hazards, expected 1 — the path was not REACHED');
  if (results.C.staged && results.C.d.hazardRecapRefused !== 0)
    bad.push('C refused a layer that was BELOW the cap — the guard is over-firing');
  if (results.D.staged && results.D.d.hazardRecapRefused !== 1)
    bad.push('D refused ' + results.D.d.hazardRecapRefused + ' at the cap, expected 1');
}

console.log('');
if (bad.length) for (const b of bad) console.log('  FAIL — ' + b);
else console.log('  OK — every arm behaved as declared.');

if (!IS_CHILD && !KNOB) {
  const { spawnSync } = require('child_process');
  console.log('\n  === CHILD: MEDI_HAZARD_RECAP_SILENT=1 (arms A and D MUST part) ===');
  const childArgv = (PRELOADED ? ['-r', require.resolve('./_live_release.js')] : []).concat(process.argv.slice(1));
  const r = spawnSync(process.execPath, childArgv, {
    env: Object.assign({}, process.env, { MEDI_HAZARD_RECAP_SILENT: '1', PROBE_HAZARD_RECAP_CHILD: '1' }),
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  if (!/^  [A-E]  /m.test(out)) { console.log('   | THE CHILD PRINTED NO ARM ROWS. Its whole output:');
    for (const l of out.split(String.fromCharCode(10))) console.log('   | ' + l); }
  for (const l of out.split(String.fromCharCode(10))) if (/^  [A-E]  /.test(l) || /FAIL|OK —|COULD-NOT/.test(l)) console.log('   | ' + l.trim());
  if (!/^  A  PARTS/m.test(out)) bad.push('the CHILD did not part on arm A — the knob is not wired to the fix');
  else console.log('   | the knob moved arm A, so the parent\'s green is attributable to this fix.');
  if (!/^  D  PARTS/m.test(out)) bad.push('the CHILD did not part on arm D — the fix is keyed on the cap-1 case only');
  if (!(/^  B  AGREES/m.test(out) && /^  C  AGREES/m.test(out) && (!E || /^  E  AGREES/m.test(out))))
    bad.push('the CHILD parted on a CONTROL arm (B/C/E) — the knob is wider than the fix');
}

if (bad.length) { console.log('\n  RED — ' + bad.length + ' failure(s):'); for (const b of bad) console.log('    ' + b); process.exit(1); }
console.log('\n  GREEN');
