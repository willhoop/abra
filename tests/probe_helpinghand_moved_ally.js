/* probe_helpinghand_moved_ally.js — HELPING HAND AT AN ALLY THAT HAS ALREADY MOVED FAILS. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_helpinghand_moved_ally.js
 *   SHOWDOWN_PATH=... node tests/probe_helpinghand_moved_ally.js --only mutual
 *   SHOWDOWN_PATH=... node tests/probe_helpinghand_moved_ally.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/game-differential.g1350.json` (release 482e8f5ca701) carried two games whose first protocol
 * split was `|-fail|p2a: Farigiraf` (authority) against `|-singleturn|p2b: Whimsicott|Helping Hand`
 * (this engine): a Prankster Whimsicott Protects in the +5 bracket, moves first on speed, and the
 * partner's Helping Hand then lands on a body that has already acted.
 *
 * THE AUTHORITY (data/moves.ts:8586-8588; `data/mods/champions/moves.ts` has no helpinghand row):
 *
 *     onTryHit(target) {
 *       if (!target.newlySwitched && !this.queue.willMove(target)) return false;
 *     },
 *
 * reached through `singleEvent('TryHit', moveData, ...)` in the Champions `spreadMoveHit`
 * (data/mods/champions/scripts.ts:333-338), whose `false` writes `-fail` on the USER and
 * `attrLastMove('[still]')`. So the move's own refusal sits BELOW the step-1 TryHit event (Good as
 * Gold, Protect) — this engine's `tryHitRefusal` — and above the mark.
 *
 * The rule is read into `data/tags.json` as `failsIfTargetAlreadyMoved` by engine/tag_dex.js off the
 * handler text; this file reads the tag row and prints it, so a membership change is visible here.
 *
 * ================= THE ARMS ====================================================================
 *
 *   mutual              RED. Both partners click Helping Hand at each other. The faster marks the
 *                       slower (still queued -> succeeds); the slower then aims at a body that has
 *                       already moved (-> the authority fails it).
 *   prankster-first     RED. The card's shape: a Prankster partner Protects in the +5 bracket and
 *                       moves first on speed; the slow partner's Helping Hand follows it.
 *   ally-still-queued   CONTROL. The fast partner helps the slow one, which Protects afterwards at +4.
 *                       The target is still in the queue: both engines mark it. The knob must NOT part it.
 *   ally-newly-switched CONTROL. The slow partner switches out; Helping Hand lands on the ENTRANT, which
 *                       has no move queued — but `newlySwitched` exempts it. Both engines mark it. A fix
 *                       that dropped the exemption would go red here and nowhere else.
 *
 * `MEDI_HELPINGHAND_MOVED_ALLY=1` restores the pre-fix engine (no already-moved refusal) and must part
 * exactly the two red arms. Stamp: `MEDFAILS.helpingHandMovedAllyRestored`.
 *
 * THE COMPARISON HAS NO TYPED EXPECTATION: each arm counts `-singleturn ... Helping Hand` lines and
 * `-fail` lines on the Helping Hand users in BOTH streams and passes when the engines agree. The
 * authority is the answer. The red arms additionally assert the authority DID refuse at least once,
 * so an arm that stopped staging the shape cannot read green.
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
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_helpinghand_moved_ally.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_HELPINGHAND_MOVED_ALLY';
const STAMP = 'helpingHandMovedAllyRestored';

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

/* ---- THE FIXTURE, DERIVED FROM THE FORMAT — no species is typed ------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[dex.moves.get(mv).id]);
};
/* An ability that cannot touch order, a TryHit, a switch-in or a status: read off its handlers. */
const QUIET = ['onStart', 'onSwitchIn', 'onModifyPriority', 'onFractionalPriority', 'onUpdate', 'onTryHit',
  'onAllyTryHitSide', 'onModifySpe', 'onResidual', 'onDamagingHit', 'onSetStatus', 'onAfterSetStatus', 'onTryBoost',
  'onSwitchOut', 'onBeforeMove', 'onAnyTryPrimaryHit', 'onFoeTryMove'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET.every(h => !x[h]); };
const SPECIES = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
const quietAb = s => Object.values(s.abilities).find(quiet);
const HELPERS = SPECIES.filter(s => learns(s, 'helpinghand') && learns(s, 'protect') && quietAb(s))
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe || a.name.localeCompare(b.name));
const PRANKSTERS = SPECIES.filter(s => learns(s, 'protect') && Object.values(s.abilities).includes(dex.abilities.get('prankster').name))
  .sort((a, b) => b.baseStats.spe - a.baseStats.spe || a.name.localeCompare(b.name));
const FILL = SPECIES.filter(s => learns(s, 'protect') && Object.values(s.abilities).every(quiet));
const SLOW = HELPERS[0], FAST = HELPERS[HELPERS.length - 1], PRANK = PRANKSTERS[0];
if (!SLOW || !FAST || !PRANK || FILL.length < 4 || !(PRANK.baseStats.spe > SLOW.baseStats.spe)) {
  console.log('NOT RUN — the format no longer supplies this fixture. That is a finding, not a pass.');
  process.exit(2);
}
const used = new Set([SLOW.id, FAST.id, PRANK.id]);
const fills = FILL.filter(s => !used.has(s.id));
const BENCH = HELPERS.find(s => !used.has(s.id) && s.id !== fills[0].id && s.id !== fills[1].id) || fills[2];
const row = (s, moves, ab) => ({ species: s.name, item: '', ability: ab || quietAb(s) || Object.values(s.abilities)[0], moves });
const HH = ['Helping Hand', 'Protect'];
const TEAMS = {
  helpers: [row(FAST, HH), row(SLOW, HH), row(BENCH, HH), row(fills[3], ['Protect'])],
  prank: [row(PRANK, ['Protect'], dex.abilities.get('prankster').name), row(SLOW, HH), row(BENCH, HH), row(fills[3], ['Protect'])],
  foes: [row(fills[0], ['Protect']), row(fills[1], ['Protect']), row(fills[4] || fills[2], ['Protect']), row(fills[5] || fills[2], ['Protect'])],
};
console.log(NL + '  DERIVED FROM THE FORMAT, NOT TYPED:');
console.log('    fast helper   ' + FAST.name + ' (base spe ' + FAST.baseStats.spe + ', ' + quietAb(FAST) + ')');
console.log('    slow helper   ' + SLOW.name + ' (base spe ' + SLOW.baseStats.spe + ', ' + quietAb(SLOW) + ')');
console.log('    prankster     ' + PRANK.name + ' (base spe ' + PRANK.baseStats.spe + ')');
console.log('    bench entrant ' + BENCH.name + '    foes ' + TEAMS.foes.map(r => r.species).join(', '));
const HHM = dex.moves.get('helpinghand');
console.log('    helpinghand.onTryHit reads willMove AND newlySwitched : '
  + (/willMove\(target\)/.test(String(HHM.onTryHit)) && /newlySwitched/.test(String(HHM.onTryHit))));
const TAGS = require(D('engine', 'tags.js'));
console.log('    tag failsIfTargetAlreadyMoved on helpinghand          : '
  + JSON.stringify(TAGS.param('move', 'helpinghand', 'failsIfTargetAlreadyMoved')));

const HHC = { m: 'helpinghand' }, PR = { m: 'protect' };
const FOE = { p2: [PR, PR] };
const CASES = [
  { id: 'mutual', kind: 'red', team: 'helpers', script: [{ p1: [HHC, HHC], ...FOE }] },
  { id: 'prankster-first', kind: 'red', team: 'prank', script: [{ p1: [PR, HHC], ...FOE }] },
  { id: 'ally-still-queued', kind: 'control', team: 'helpers', script: [{ p1: [HHC, PR], ...FOE }] },
  { id: 'ally-newly-switched', kind: 'control', team: 'helpers', script: [{ p1: [HHC, { sw: BENCH.name }], ...FOE }] },
];

/* ---- READING BOTH STREAMS -------------------------------------------------------------------- */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const flat = xs => (xs || []).map(l => Array.isArray(l) ? '|' + l.join('|') : String(l));
function readout(lines) {
  let marks = 0, fails = 0, lastMoveWasHH = false;
  for (const l of flat(lines)) {
    const p = l.split('|');
    if (p[1] === 'move') lastMoveWasHH = norm(p[3]) === 'helpinghand';
    if (p[1] === '-singleturn' && /helping ?hand/i.test(l)) marks++;
    if (p[1] === '-fail' && lastMoveWasHH) fails++;
  }
  return { marks, fails };
}
function play(G, c) {
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  const a = G.buildPair(TEAMS[c.team]), b = G.buildPair(TEAMS.foes);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  let sdLog = null;
  const S0 = globalThis.MEDSEEN || {};
  const seen0 = { refused: S0.alreadyMovedTargetRefused || 0, exempt: S0.alreadyMovedExemptNewlySwitched || 0 };
  const r = G.playGame(a, b, 'directed', 'probe_helpinghand_moved_ally :: ' + c.id, { script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => { sdLog = battle.log.slice(); } });
  const SEEN = globalThis.MEDSEEN || {};
  return { r, sd: readout(sdLog), med: readout(r.mediTrace), sc: G.scriptCounters(),
           restored: (globalThis.MEDFAILS || {})[STAMP] || 0,
           refused: (SEEN.alreadyMovedTargetRefused || 0) - seen0.refused,
           exempt: (SEEN.alreadyMovedExemptNewlySwitched || 0) - seen0.exempt };
}

let bad = 0, ran = 0;
const knobParted = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED / THREW under the knob ' + (brk.r && brk.r.err)); bad++; continue; }
  harness(false);
  ran++;
  const f = x => 'marks ' + x.marks + ' fails ' + x.fails;
  console.log('    authority         ' + f(clean.sd));
  console.log('    medicham clean    ' + f(clean.med));
  console.log('    medicham knob     ' + f(brk.med) + '   (authority ' + f(brk.sd) + ')');
  console.log('    first protocol divergence clean  ' + JSON.stringify(clean.r.div || null).slice(0, 240));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '   knob ' + brk.restored
    + '   engine refused ' + clean.refused + ' / exempted as newly switched ' + clean.exempt);
  /* THE EXEMPTION CONTROL MUST REACH THE EXEMPTION, or it is a second copy of the queued control. */
  if (c.id === 'ally-newly-switched' && clean.exempt < 1) {
    console.log('    >> FIXTURE FAILED — the entrant never reached the newlySwitched exemption.'); bad++; continue; }
  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.sd.marks + clean.sd.fails === 0) { console.log('    >> FIXTURE FAILED — no Helping Hand resolved on the authority.'); bad++; continue; }
  if (c.kind === 'red' && clean.sd.fails === 0) { console.log('    >> FIXTURE FAILED — the authority never refused; the arm does not stage the shape.'); bad++; continue; }
  if (c.kind === 'control' && clean.sd.fails !== 0) { console.log('    >> FIXTURE FAILED — the control was refused by the authority.'); bad++; continue; }
  if (clean.sd.marks !== clean.med.marks || clean.sd.fails !== clean.med.fails) {
    console.log('    >> RED — the engines disagree with the fix in.'); bad++; continue; }
  if (clean.r.stateDiv) { console.log('    >> RED — the boards part: ' + JSON.stringify(clean.r.stateDiv).slice(0, 300)); bad++; continue; }
  if (brk.sd.marks !== brk.med.marks || brk.sd.fails !== brk.med.fails) knobParted.push(c.id);
  console.log('    OK');
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
if (!ONLY) {
  const want = CASES.filter(c => c.kind === 'red').map(c => c.id).sort().join(',');
  const got = knobParted.slice().sort().join(',');
  console.log('knob parted: [' + got + ']   expected: [' + want + ']');
  if (got !== want) { console.log('>> THE KNOB DOES NOT ISOLATE THE DEFECT.'); bad++; }
}
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
