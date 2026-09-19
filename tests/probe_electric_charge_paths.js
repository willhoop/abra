/* probe_electric_charge_paths.js — EVERY ROAD OUT OF THE ELECTRIC BANK, ONE ARM PER ROAD. 2026-09-18.
 *
 *   SHOWDOWN_PATH=... node tests/probe_electric_charge_paths.js
 *   SHOWDOWN_PATH=... node tests/probe_electric_charge_paths.js --only thaw-then-protected
 *   SHOWDOWN_PATH=... node tests/probe_electric_charge_paths.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/game-differential.g1950.json` parted one board on `p1.active[0].vol.charge  medicham 1
 * showdown 0` (config `pair-redirect-priority`, turn 6). The authority's lines before it:
 *
 *     |-status|p1a: Bellibolt|frz
 *     |-start|p1a: Bellibolt|Charge|Blizzard|[from] ability: Electromorphosis
 *     |-curestatus|p1a: Bellibolt|frz|[msg]
 *     |move|p1a: Bellibolt|Thunderbolt|p2a: Sinistcha
 *     |-activate|p2a: Sinistcha|move: Protect
 *     |-end|p1a: Bellibolt|Charge|[silent]          <- missing from medicham2
 *
 * The card says WHERE. It does not say whether the cause is the Protect, the thaw, or the pair. The
 * brief was "an Electric attack blocked by Protect keeps the charge"; this file tests that as a
 * HYPOTHESIS by giving every road its own arm, each differing from its neighbour in ONE thing.
 *
 * ================= THE MECHANISM, READ AT RUN TIME =============================================
 *
 * `charge.condition` (data/moves.ts; the Champions mod does not override it) removes the volatile in
 * exactly two handlers, both gated `move.type === 'Electric' && move.id !== 'charge'`:
 *   onAfterMove     sim/battle-actions.ts:311-312, raised after `useMove` returns, whatever it did —
 *                   hit, miss, Protect, immunity, absorption, failure all reach it;
 *   onMoveAborted   sim/battle-actions.ts:256-257, raised only when `BeforeMove` refuses the move.
 * Nothing else removes it but `clearVolatile` (a switch or a faint).
 *
 * ================= THE ARMS ====================================================================
 *
 *   hit                 Thunderbolt connects.                                          -> 0
 *   protected           Thunderbolt into a Protect.                                     -> 0
 *   missed              Zap Cannon misses (the top arm misses every sub-100 move).      -> 0
 *   immune              Thunderbolt into a Ground type.                                 -> 0
 *   absorbed            Thunderbolt into Volt Absorb.                                   -> 0
 *   nonelectric         Mud Shot connects. The type gate: the bank SURVIVES.            -> 1
 *   status-electric     Thunder Wave connects. A status click spends it too.            -> 0
 *   switch-out          Bellibolt pivots out; read on the BENCH, then again on return.  -> 0
 *   thaw-then-protected THE CARD'S BOARD. Frozen and banked by one Blizzard, thawed at its own
 *                       BeforeMove, Thunderbolt into a Protect.                         -> 0
 *   thaw-then-hit       The same thaw, and the Thunderbolt connects instead — the Protect
 *                       taken back out, so a red on the arm above can be attributed.     -> 0
 *
 * THE AUTHORITY IS THE ANSWER. The `after` column is what the arm is FOR, cross-read against
 * Showdown's own board at run time; a mismatch is a FIXTURE failure and is reported as one.
 *
 * `MEDI_ELECTRIC_CHARGE_KEPT_ON_THAW=1` restores the defect this file found (see
 * `thawSpendsCharge` in medicham2) and must part the thaw arms and nothing else.
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
  REL_ID = ER.cut('tests/probe_electric_charge_paths.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ELECTRIC_CHARGE_KEPT_ON_EARLY_EXIT';
const STAMP = 'electricChargeKeptOnEarlyExitRestored';

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
const row = r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] });
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
/* Damp for the Charge-banked arms: Electromorphosis would re-bank off any hit and confound the
 * arm. Electromorphosis only where the card's own board needs it (the thaw arms). */
const BELLI_DAMP = ['bellibolt', '', 'Damp', ['Charge', 'Thunderbolt', 'Mud Shot', 'Thunder Wave']];
const BELLI_ZAP = ['bellibolt', '', 'Damp', ['Charge', 'Zap Cannon', 'Mud Shot', 'Protect']];
const BELLI_EM = ['bellibolt', '', 'Electromorphosis', ['Thunderbolt', 'Charge', 'Mud Shot', 'Protect']];
const BELLI_ROADS = ['bellibolt', '', 'Damp', ['Charge', 'Supercell Slam', 'Discharge', 'Volt Switch']];
const CLEF = ['clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Calm Mind', 'Protect']];
/* Thick Fat, not Immunity: Immunity would refuse the Thunderbolt's paralysis secondary on one arm
 * and not another, which is a board difference this file is not about. Snorlax is slower than
 * Bellibolt and bulky enough to take a charged minimum-roll crit. */
const LAX = ['snorlax', '', 'Thick Fat', ['Curse', 'Protect']];
const CHOMP = ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']];
const JOLT = ['jolteon', '', 'Volt Absorb', ['Calm Mind', 'Protect']];
/* Inner Focus, not Scrappy or Early Bird: nothing about it touches this turn. SpA 40, so the
 * Blizzard that freezes Bellibolt leaves it standing. */
const KANGA = ['kangaskhan', '', 'Inner Focus', ['Blizzard', 'Protect']];

const P1 = (b) => [row(b), row(CLEF)].concat(BENCH('toxapex', 'vaporeon'));
const P2 = (f0, f1) => [row(f0), row(f1 || MEOW)].concat(BENCH('furfrou', 'milotic'));

const CM = { m: 'calmmind' }, PR = { m: 'protect' }, CHG = { m: 'charge' };
const CURSE = { m: 'curse' }, SD = { m: 'swordsdance' };
const TB0 = { m: 'thunderbolt', t: 0 }, ZC0 = { m: 'zapcannon', t: 0 };
const SS0 = { m: 'supercellslam', t: 0 }, DIS = { m: 'discharge' }, VS0 = { m: 'voltswitch', t: 0 };
const MS0 = { m: 'mudshot', t: 0 }, TW0 = { m: 'thunderwave', t: 0 };
const BZ0 = { m: 'blizzard', t: 0 };

/* `after` is what BOTH engines must read on Bellibolt's `vol.charge` at the LAST boundary. `bench`
 * says the last-but-one boundary is read on the bench (switch-out arm). */
const CASES = [
  { id: 'hit', arm: 'bottom-tie-first', p1: P1(BELLI_DAMP), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [TB0, CM], p2: [CURSE, CM] }] },
  { id: 'protected', arm: 'bottom-tie-first', early: true, p1: P1(BELLI_DAMP), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [TB0, CM], p2: [PR, CM] }] },
  { id: 'missed', arm: 'top-tie-first', p1: P1(BELLI_ZAP), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [ZC0, CM], p2: [CURSE, CM] }] },
  { id: 'immune', arm: 'bottom-tie-first', p1: P1(BELLI_DAMP), p2: P2(CHOMP), after: 0,
    script: [{ p1: [CHG, CM], p2: [SD, CM] }, { p1: [TB0, CM], p2: [SD, CM] }] },
  { id: 'absorbed', arm: 'bottom-tie-first', p1: P1(BELLI_DAMP), p2: P2(JOLT), after: 0,
    script: [{ p1: [CHG, CM], p2: [CM, CM] }, { p1: [TB0, CM], p2: [CM, CM] }] },
  { id: 'nonelectric', arm: 'bottom-tie-first', p1: P1(BELLI_DAMP), p2: P2(LAX), after: 1,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [MS0, CM], p2: [CURSE, CM] }] },
  { id: 'status-electric', arm: 'bottom-tie-first', p1: P1(BELLI_DAMP), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [TW0, CM], p2: [CURSE, CM] }] },
  { id: 'switch-out', arm: 'bottom-tie-first', p1: P1(BELLI_DAMP), p2: P2(LAX), after: 0, bench: true,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [{ sw: 'toxapex' }, CM], p2: [CURSE, CM] },
      { p1: [{ sw: 'bellibolt' }, CM], p2: [CURSE, CM] }] },
  { id: 'crash-into-protect', arm: 'bottom-tie-first', early: true, p1: P1(BELLI_ROADS), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [SS0, CM], p2: [PR, CM] }] },
  { id: 'spread-half-protected', arm: 'bottom-tie-first', p1: P1(BELLI_ROADS), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [DIS, PR], p2: [PR, CM] }] },
  { id: 'spread-all-protected', arm: 'bottom-tie-first', early: true, p1: P1(BELLI_ROADS), p2: P2(LAX), after: 0,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [DIS, PR], p2: [PR, PR] }] },
  { id: 'volt-switch', arm: 'bottom-tie-first', p1: P1(BELLI_ROADS), p2: P2(LAX), after: 0, bench: true,
    script: [{ p1: [CHG, CM], p2: [CURSE, CM] }, { p1: [VS0, CM], p2: [CURSE, CM] }] },
  { id: 'thaw-then-protected', arm: 'bottom-tie-first', thaw: true, early: true,
    p1: P1(BELLI_EM), p2: P2(LAX, KANGA), after: 0,
    script: [{ p1: [TB0, CM], p2: [PR, BZ0] }] },
  { id: 'thaw-then-hit', arm: 'bottom-tie-first', thaw: true,
    p1: P1(BELLI_EM), p2: P2(LAX, KANGA), after: 0,
    script: [{ p1: [TB0, CM], p2: [CURSE, BZ0] }] },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const mid = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[mid]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
const seen = new Set();
for (const c of CASES) for (const r of c.p1.concat(c.p2)) {
  const key = r.species + '|' + r.ability + '|' + r.moves.join(',');
  if (seen.has(key)) continue; seen.add(key);
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

const COND = dex.moves.get('charge').condition || {};
const TYPE_GATED = h => /Electric/.test(String(COND[h] || '')) && /removeVolatile\(['"]charge['"]\)/.test(String(COND[h] || ''));
console.log(NL + '  READ AT RUN TIME, NOT RECALLED:');
console.log('    charge.onAfterMove removes, type-gated   : ' + TYPE_GATED('onAfterMove'));
console.log('    charge.onMoveAborted removes, type-gated : ' + TYPE_GATED('onMoveAborted'));
console.log('    zap cannon accuracy ' + dex.moves.get('zapcannon').accuracy + ' (top arm misses sub-100)');
console.log('    speeds  kangaskhan ' + dex.species.get('kangaskhan').baseStats.spe + '  bellibolt '
  + dex.species.get('bellibolt').baseStats.spe + '  snorlax ' + dex.species.get('snorlax').baseStats.spe);
if (!TYPE_GATED('onAfterMove') || !TYPE_GATED('onMoveAborted') || !(dex.moves.get('zapcannon').accuracy < 100)
    || !(dex.species.get('kangaskhan').baseStats.spe > dex.species.get('bellibolt').baseStats.spe)) {
  console.log(NL + 'NOT RUN — the format no longer supports this fixture. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  const reads = [];
  const r = G.playGame(a, b, 'directed', 'probe_electric_charge_paths :: ' + c.id, { script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => {
      const all = [...(S.actA || []), ...(S.benchA || [])].filter(Boolean);
      const m = all.find(x => norm(x.name) === 'bellibolt');
      const p = battle.p1.pokemon.find(x => norm(x.species.id) === 'bellibolt');
      reads.push({ t: turnIdx, onField: !!(m && (S.actA || []).includes(m)),
        med: m && m._vol && m._vol.charge ? 1 : 0, sd: p && p.volatiles && p.volatiles.charge ? 1 : 0,
        medStatus: m ? String(m.status || '') : '?', sdStatus: p ? String(p.status || '') : '?' });
    } });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const trace = (r.mediTrace || []).map(String);
  return { r, reads, delta, sc: G.scriptCounters(), trace,
    restored: (globalThis.MEDFAILS || {})[STAMP] || 0 };
}
const shortDiv = d => (!d ? 'none' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)));

let bad = 0, ran = 0;
const knobParted = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   arm ' + c.arm + '   (both engines must read charge ' + c.after + ')');
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED / THREW under the knob'); bad++; continue; }
  harness(false);
  ran++;
  const last = clean.reads[clean.reads.length - 1] || {};
  console.log('    reads (t: med/sd, onField, status med/sd)  '
    + clean.reads.map(x => x.t + ':' + x.med + '/' + x.sd + (x.onField ? '' : ' BENCH') + ' ' + x.medStatus + '/' + x.sdStatus).join('  '));
  console.log('    banked/spent/abortSpent/earlyExitSpent  ' + [(clean.delta.chargeBanked || 0), (clean.delta.chargeCleared || 0),
    (clean.delta.electricChargeAbortedAtGate || 0), (clean.delta.electricChargeSpentOnEarlyExit || 0)].join(' / '));
  console.log('    board divergence clean   ' + shortDiv(clean.r.stateDiv));
  console.log('    board divergence knob    ' + shortDiv(brk.r.stateDiv));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '   knob ' + brk.restored);
  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.r.turns < c.script.length) { console.log('    >> FIXTURE FAILED — game ended at turn ' + clean.r.turns); bad++; continue; }
  /* the leaf must have been NON-ZERO at some boundary, or a spent bank reads like a never-banked one */
  const everBanked = clean.reads.some(x => x.sd === 1) || c.thaw;
  if (!everBanked) { console.log('    >> FIXTURE FAILED — the authority never held the bank, so a 0 proves nothing.'); bad++; continue; }
  if (c.thaw) {
    const froze = clean.trace.some(l => /\|-status\|p1a: Bellibolt\|frz/.test(l));
    const thawed = clean.trace.some(l => /\|-curestatus\|p1a: Bellibolt\|frz/.test(l));
    const banked = clean.trace.some(l => /\|-start\|p1a: Bellibolt\|Charge/.test(l));
    console.log('    medicham trace: froze ' + froze + '  banked ' + banked + '  thawed ' + thawed);
    if (!froze || !thawed || !banked) { console.log('    >> FIXTURE FAILED — the card\'s sequence was not staged.'); bad++; continue; }
  }
  if (c.bench) {
    const benchRead = clean.reads.find(x => !x.onField);
    if (!benchRead) { console.log('    >> FIXTURE FAILED — Bellibolt never sat on the bench.'); bad++; continue; }
    if (benchRead.med !== benchRead.sd) { console.log('    >> RED on the BENCH — medicham ' + benchRead.med + ' showdown ' + benchRead.sd); bad++; continue; }
  }
  if (last.sd !== c.after) {
    console.log('    >> FIXTURE FAILED — the authority reads ' + last.sd + '; this arm was written for ' + c.after); bad++; continue;
  }
  if (last.med !== last.sd || clean.r.stateDiv) {
    console.log('    >> RED — medicham ' + last.med + ' showdown ' + last.sd + '  ' + shortDiv(clean.r.stateDiv)); bad++; continue;
  }
  if (brk.r.stateDiv) knobParted.push(c.id);
  console.log('    OK');
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
/* THE KNOB MUST PART EXACTLY THE EARLY-EXIT ARMS. Identical output across a varied knob means it is unwired;
 * a knob that parts a non-thaw arm restores more than the defect. Only asserted on a full run. */
if (!ONLY) {
  const want = CASES.filter(c => c.early).map(c => c.id).sort().join(',');
  const got = knobParted.slice().sort().join(',');
  console.log('knob parted: [' + got + ']   expected: [' + want + ']');
  if (got !== want) { console.log('>> THE KNOB DOES NOT ISOLATE THE DEFECT.'); bad++; }
}
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
