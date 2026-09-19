/* probe_bench_private_counters.js — THE ALLY SWITCH COUNTER RODE THE BENCH. 2026-09-18.
 *
 *   SHOWDOWN_PATH=... node tests/probe_bench_private_counters.js
 *   SHOWDOWN_PATH=... node tests/probe_bench_private_counters.js --only return-by-faint
 *   SHOWDOWN_PATH=... node tests/probe_bench_private_counters.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/game-differential.g1950.json` parted two games on `p1.party.runerigus.vol.allyswitch
 * medicham 1 showdown 0` (families: `party.vol.allyswitch  2 games`), with no protocol line beside
 * it. `Pokemon#clearVolatile()` (sim/pokemon.ts:1514, and the Champions override at
 * data/mods/champions/scripts.ts:124) is `this.volatiles = {}` on the way out, so the authority's
 * benched body holds no `allyswitch`. medicham2 keeps that volatile OUTSIDE `_vol` — as
 * `_aswDur`/`_aswCount` on the body — and `switchOut`'s wholesale `out._vol = {}` cannot reach a field
 * it does not hold, while the per-turn tick that would otherwise expire it walks the ACTIVE bodies
 * only. So the counter sat on the bench, frozen, for as long as the body stayed there.
 *
 * IT IS NOT ONLY A BOARD LEAF. A body that comes back as a FAINT REPLACEMENT arrives after that
 * turn's tick, so its first Ally Switch rolls against a counter the authority threw away: a
 * guaranteed first use becomes a 1-in-3. The `return-by-faint` arm stages exactly that.
 *
 * ================= THE ARMS ====================================================================
 *
 *   bench-leaf        THE DEFECT ON THE BOARD. Alakazam Ally Switches, then switches out. The
 *                     benched body must read `vol.allyswitch 0` on both engines.
 *   standing          THE LEAF CAN MOVE. Alakazam Ally Switches and stays. Both engines read 1 at
 *                     the first boundary and 0 at the second — so a 0 on the bench arm is a clear,
 *                     not a counter that was never set.
 *   second-use        THE COUNTER IS LIVE ON THE FIELD. Two consecutive Ally Switches under the top
 *                     arm: both engines lose the 1-in-3 and the second swap fails. The knob must NOT
 *                     part this arm — the defect is the BENCH, not the counter.
 *   return-by-faint   THE DEFECT IN PLAY. Ally Switch, switch out, the replacement uses Memento,
 *                     Alakazam returns as the faint replacement after the tick, and clicks Ally
 *                     Switch again under the top arm. The authority starts a fresh counter and
 *                     swaps; the engine rolled against the carried one and refused.
 *
 * `MEDI_ALLYSWITCH_SURVIVES_SWITCH=1` restores the pre-fix engine and must part exactly the two red
 * arms. Stamp: `MEDFAILS.allySwitchSurvivesSwitchRestored`.
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
  REL_ID = ER.cut('tests/probe_bench_private_counters.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ALLYSWITCH_SURVIVES_SWITCH';
const STAMP = 'allySwitchSurvivesSwitchRestored';

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

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const row = (sp, ab, moves) => ({ species: sp, item: '', ability: ab, moves });
/* Magic Guard: nothing this file stages chips it, and nothing about it touches a slot. */
const ZAM = row('alakazam', 'Magic Guard', ['Ally Switch', 'Calm Mind', 'Protect']);
const MEOW = row('meowstic', 'Keen Eye', ['Calm Mind', 'Protect']);
/* Infiltrator, not Prankster: a Prankster Memento would move in the priority bracket and change which
 * body acts when. */
const WHIMSI = row('whimsicott', 'Infiltrator', ['Memento', 'Protect']);
const VAPE = row('vaporeon', 'Water Absorb', ['Protect']);
const P1 = [ZAM, MEOW, WHIMSI, VAPE];
const P2 = [row('snorlax', 'Thick Fat', ['Curse', 'Protect']), row('meowstic', 'Keen Eye', ['Calm Mind', 'Protect']),
  row('furfrou', 'Fur Coat', ['Protect']), row('milotic', 'Marvel Scale', ['Protect'])];

const AS = { m: 'allyswitch' }, CM = { m: 'calmmind' }, CURSE = { m: 'curse' };
const FOE = { p2: [CURSE, CM] };

/* After turn 1 Alakazam stands in slot 1, so every later click for it is the SECOND entry. */
const CASES = [
  { id: 'bench-leaf', kind: 'red', arm: 'bottom-tie-first',
    script: [{ p1: [AS, CM], ...FOE }, { p1: [CM, { sw: 'whimsicott' }], ...FOE }] },
  { id: 'standing', kind: 'control', arm: 'bottom-tie-first', wantNonZero: true,
    script: [{ p1: [AS, CM], ...FOE }, { p1: [CM, CM], ...FOE }] },
  { id: 'second-use', kind: 'control', arm: 'top-tie-first',
    script: [{ p1: [AS, CM], ...FOE }, { p1: [CM, AS], ...FOE }] },
  { id: 'return-by-faint', kind: 'red', arm: 'top-tie-first', returns: true,
    script: [{ p1: [AS, CM], ...FOE }, { p1: [CM, { sw: 'whimsicott' }], ...FOE },
      { p1: [CM, { m: 'memento', t: 0 }], ...FOE }, { p1: [CM, AS], ...FOE }] },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* THE SPECIES' OWN ROW, NOT A PREVO WALK. The first draft walked `prevo` and passed Clefable with
 * Ally Switch off Clefairy's row; the format's validator (the driver's fixture check) refused it:
 * "Clefable can't learn Ally Switch." The validator is the authority, so this reads what it reads. */
const learns = (sp, mv) => {
  const s = dex.species.get(sp), mid = dex.moves.get(mv).id;
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[mid]);
};
let illegal = 0;
for (const r of P1.concat(P2)) {
  const sp = dex.species.get(r.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + r.species); illegal++; continue; }
  if (r.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(r.ability).id)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' / ' + r.ability); illegal++; }
  for (const mv of r.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv); illegal++; continue; }
    if (!learns(r.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE MECHANISM, READ AT RUN TIME ----------------------------------------------------------- */
const COND = dex.moves.get('allyswitch').condition || {};
const clearSrc = String((CS.sim().Pokemon || {}).prototype && CS.sim().Pokemon.prototype.clearVolatile || '');
console.log(NL + '  READ AT RUN TIME, NOT RECALLED:');
console.log('    allyswitch.condition.duration            : ' + COND.duration);
console.log('    allyswitch.condition.onRestart rolls      : ' + /randomChance/.test(String(COND.onRestart || '')));
console.log('    Pokemon#clearVolatile empties the table   : '
  + (clearSrc ? /this\.volatiles\s*=\s*\{\}/.test(clearSrc) : 'source not reachable from here — read at sim/pokemon.ts:1514'));
if (!(COND.duration > 0) || !/randomChance/.test(String(COND.onRestart || ''))) {
  console.log(NL + 'NOT RUN — the format no longer supports this fixture. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function play(G, c) {
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(P1), b = G.buildPair(P2);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  const reads = [];
  const r = G.playGame(a, b, 'directed', 'probe_bench_private_counters :: ' + c.id, { script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => {
      const all = [...(S.actA || []), ...(S.benchA || [])].filter(Boolean);
      const m = all.find(x => norm(x.name) === 'alakazam');
      const p = battle.p1.pokemon.find(x => norm(x.species.id) === 'alakazam');
      const slotMed = (S.actA || []).indexOf(m);
      const slotSd = battle.p1.active.indexOf(p);
      reads.push({ t: turnIdx, med: m ? (m._aswDur | 0) : '?', sd: p && p.volatiles.allyswitch ? (p.volatiles.allyswitch.duration | 0) : 0,
        slotMed, slotSd });
    } });
  return { r, reads, sc: G.scriptCounters(), restored: (globalThis.MEDFAILS || {})[STAMP] || 0 };
}
const shortDiv = d => (!d ? 'none' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 400)));

let bad = 0, ran = 0;
const knobParted = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   arm ' + c.arm);
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED / THREW under the knob ' + (brk.r && brk.r.err)); bad++; continue; }
  harness(false);
  ran++;
  const fmt = rs => rs.map(x => x.t + ':' + x.med + '/' + x.sd + ' slot ' + x.slotMed + '/' + x.slotSd).join('   ');
  console.log('    alakazam [t: _aswDur / sd duration, slot med/sd]   ' + fmt(clean.reads));
  console.log('    under the knob                                   ' + fmt(brk.reads));
  console.log('    board divergence clean   ' + shortDiv(clean.r.stateDiv));
  console.log('    board divergence knob    ' + shortDiv(brk.r.stateDiv));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '   knob ' + brk.restored);
  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.r.turns < c.script.length) { console.log('    >> FIXTURE FAILED — the game ended at turn ' + clean.r.turns); bad++; continue; }
  if (c.wantNonZero && !clean.reads.some(x => x.sd > 0 && x.med > 0)) {
    console.log('    >> FIXTURE FAILED — neither engine ever held the counter, so a 0 elsewhere proves nothing.'); bad++; continue;
  }
  if (c.returns) {
    const back = clean.reads[clean.reads.length - 2];
    if (!back || back.slotSd < 0) { console.log('    >> FIXTURE FAILED — Alakazam did not come back as the faint replacement.'); bad++; continue; }
  }
  if (clean.r.stateDiv) { console.log('    >> RED — the boards part with the fix in: ' + shortDiv(clean.r.stateDiv)); bad++; continue; }
  if (brk.r.stateDiv) knobParted.push(c.id);
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
