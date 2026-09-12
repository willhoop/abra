/* probe_electric_charge_abort.js — THE ELECTRIC BANK IS SPENT BY A MOVE THE GATE REFUSED, AND THIS
 * ENGINE KEPT IT. 2026-09-12.
 *
 *   SHOWDOWN_PATH=... node tests/probe_electric_charge_abort.js
 *   SHOWDOWN_PATH=... node tests/probe_electric_charge_abort.js --only abort-flinch
 *   SHOWDOWN_PATH=... node tests/probe_electric_charge_abort.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/verification/game-differential-10k-middle.json` played 7,178 games on release 48ac1c228e02
 * and parted 84 boards. `state.families` — the POPULATION, not the capped worked-example list —
 * reads `active[].vol.charge  14 games`, the largest single mechanism in it, and every capped
 * example of it reads the same way round: `medicham 1  showdown 0`. The protocol side carries the
 * same fact from the other direction: thirteen `event missing from medicham2 :: |-end|pXa|charge`
 * causes, and five of the six with context printed show `|cant| ... |flinch` on the line before.
 *
 * ================= THE MECHANISM, READ AT THE LINE =============================================
 *
 *     onMoveAborted(pokemon, target, move) {
 *       if (move.type === 'Electric' && move.id !== 'charge') pokemon.removeVolatile('charge');
 *     }                                                    data/moves.ts, charge.condition
 *     onAfterMove(pokemon, target, move) { ...the identical body... }
 *     onEnd(pokemon) { this.add('-end', pokemon, 'Charge', '[silent]'); }
 *
 * and `MoveAborted` is raised on exactly one condition:
 *
 *     const willTryMove = this.battle.runEvent('BeforeMove', pokemon, target, move);
 *     if (!willTryMove) { this.battle.runEvent('MoveAborted', pokemon, target, move); ... return; }
 *                                                              sim/battle-actions.ts:254-262
 *
 * medicham2 implements the `onAfterMove` half in `spendChargeOnMove` (WIRE 157) and says so at its
 * two call sites — the second of which states the omission outright: *"Showdown's `onMoveAborted`
 * is a separate handler this engine reaches by having already `continue`d."* It does not reach it.
 * So a Bellibolt that banks a charge and is then flinched, slept, frozen, fully paralysed, confused
 * into itself, Disabled, Taunted or Attracted out of its Electric click keeps a bank the real game
 * has already spent — and the doubling is then paid on a LATER turn that never earned it.
 *
 * ================= NO EXPECTATION IS TYPED =====================================================
 *
 * Every arm plays the identical script on both engines under the same pinned dice arm and the BOARD
 * is compared by the driver's own state comparator. Showdown's board is the answer. This file
 * asserts only that the two agree, that the knob parts them again on exactly the red arm, and that
 * the counter says the drop actually happened.
 *
 * `MEDI_ELECTRIC_CHARGE_SURVIVES_ABORT=1` restores the pre-fix engine in a child load and stamps
 * `MEDFAILS.electricChargeSurvivesAbortRestored`, asserted ABSENT on the clean load and PRESENT
 * under the knob.
 *
 * ================= THE FOUR ARMS, AND WHAT EACH ONE REFUSES ====================================
 *
 *   abort-flinch        THE DEFECT. Bellibolt banks with Charge on turn 1, is flinched by a faster
 *                       Iron Head on turn 2, and its Thunder Wave never runs. RED before the fix.
 *   protect-blocked     THE KNOB CLEARED BY ONE CLICK. The identical board and the identical
 *                       Bellibolt click; the foe presses Protect instead of Iron Head. That is a
 *                       TryMove failure, not a BeforeMove refusal — the move RAN, so `onAfterMove`
 *                       fires and BOTH engines must drop the bank. A fix keyed on "the move did not
 *                       connect" rather than on "the gate refused it" is indistinguishable from the
 *                       right one without this arm.
 *   electric-runs       THE LEAF CAN MOVE AT ALL. Thunder Wave lands on the partner, unobstructed.
 *                       Both engines read charge 0 afterwards. Without this arm a run in which the
 *                       bank never existed is byte-identical to a run in which it was spent.
 *   abort-nonelectric   THE OVER-MATCH GUARD. The same flinch, refusing a GROUND move. The
 *                       authority tests `move.type === 'Electric'`, so the bank SURVIVES and both
 *                       engines must read charge 1. A fix that drops on any abort parts here.
 *
 * ================= THE FIXTURE, DERIVED ========================================================
 *
 * The arm is `bottom-tie-first`, whose dice corner fires EVERY secondary — so Iron Head's flinch is
 * a certainty on both engines rather than a coin this file would have to survive. Bellibolt is the
 * carrier because it is the body the 7,178-game run actually parted on, and it is given DAMP rather
 * than Electromorphosis on purpose: Electromorphosis would re-bank the volatile off the very Iron
 * Head that causes the abort, which is the confound that would make a green arm meaningless. Static
 * is refused for the same class of reason — it writes a paralysis into the turn under test.
 *
 * Aerodactyl (base 130) outruns Bellibolt (base 45) so the flinch always lands before the click.
 * Steel into Electric is neutral at minimum damage against 109/91 bulk, so the charger survives and
 * the only board difference available is the one under test. Thunder Wave is the Electric click
 * rather than an attack because it takes NO benefit from the bank and removes it anyway — which is
 * the half of the authority's line that is easiest to drop — and because a status click writes no
 * damage roll that could part a board for a reason this file is not about.
 *
 * Every species, item, ability and move is checked against the format AND the learnset before a game
 * is played, and the file refuses to run on a single illegal cell. `buildPair` returning null is
 * reported as NOT-STAGED and counted as a FAILURE, never swallowed.
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
  REL_ID = ER.cut('tests/probe_electric_charge_abort.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ELECTRIC_CHARGE_SURVIVES_ABORT';

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
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
/* Damp, not Electromorphosis and not Static — see the fixture note in the header. */
const BELLI = ['bellibolt', '', 'Damp', ['Charge', 'Thunder Wave', 'Mud Shot', 'Protect']];
/* Rock Head, not Pressure: Pressure spends the foe's PP and PP is a compared leaf. */
const AERO = ['aerodactyl', '', 'Rock Head', ['Iron Head', 'Protect']];
const CLEF = ['clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Calm Mind', 'Protect']];

const P1 = stage([BELLI, CLEF]).concat(BENCH('garchomp', 'toxapex'));
const P2 = stage([AERO, MEOW]).concat(BENCH('snorlax', 'furfrou'));

const CM = { m: 'calmmind' }, PR = { m: 'protect' };
const CHG = { m: 'charge' };
const TW0 = { m: 'thunderwave', t: 0 }, TW1 = { m: 'thunderwave', t: 1 };
const MS0 = { m: 'mudshot', t: 0 };
const IH0 = { m: 'ironhead', t: 0 };

/* `charge_after` is what BOTH engines must read on `p1.active[0].vol.charge` at the last boundary.
 * It is not an expectation typed at medicham2 — the arms are asserted against Showdown's board by
 * the driver's comparator, and this field only says which of the two outcomes the arm is FOR, so a
 * reader can see that the four arms do not all ask the same question. It is printed and cross-read
 * against the authority's own board below; a mismatch is a FIXTURE failure, not an engine one. */
const CASES = [
  { id: 'abort-flinch', kind: 'red', arm: 'bottom-tie-first', drops: 1, charge_after: 0,
    script: [{ p1: [CHG, CM], p2: [PR, CM] },
      { p1: [TW0, CM], p2: [IH0, CM] }],
    what: 'THE DEFECT. Bellibolt banks a Charge on turn 1 and is FLINCHED on the spend turn by a '
        + 'faster Iron Head. The authority raises MoveAborted and `charge.condition.onMoveAborted` '
        + 'removes the bank; this engine kept it, and the board parts on exactly one leaf — '
        + '`p1.active[0].vol.charge  medicham 1  showdown 0`.' },

  { id: 'protect-blocked', kind: 'control', arm: 'bottom-tie-first', drops: 0, charge_after: 0,
    script: [{ p1: [CHG, CM], p2: [PR, CM] },
      { p1: [TW0, CM], p2: [PR, CM] }],
    what: 'THE KNOB CLEARED BY ONE CLICK — the identical board and the identical Bellibolt click, '
        + 'with Protect in place of the Iron Head. The click RUNS and is stopped by the shield, '
        + 'which is a TryMove failure and not a BeforeMove refusal, so `onAfterMove` fires and both '
        + 'engines drop the bank. A fix keyed on "the move did not connect" breaks here, and it '
        + 'must be green under the knob as well — the knob only restores the ABORT road.' },

  { id: 'electric-runs', kind: 'control', arm: 'bottom-tie-first', drops: 0, charge_after: 0,
    script: [{ p1: [CHG, CM], p2: [PR, CM] },
      { p1: [TW1, CM], p2: [PR, CM] }],
    what: 'THE LEAF CAN MOVE AT ALL. The Thunder Wave lands on the partner with nothing in its way, '
        + 'so both engines spend the bank down the ordinary road. Without this arm a fixture that '
        + 'never banked anything would read exactly like one that spent it.' },

  { id: 'abort-nonelectric', kind: 'control', arm: 'bottom-tie-first', drops: 0, charge_after: 1,
    script: [{ p1: [CHG, CM], p2: [PR, CM] },
      { p1: [MS0, CM], p2: [IH0, CM] }],
    what: 'THE OVER-MATCH GUARD. The same flinch on the same turn, refusing a GROUND move. The '
        + 'authority tests `move.type === "Electric"`, so the bank SURVIVES on both sides and the '
        + 'leaf reads 1. A fix that drops the bank on any aborted move parts this board.' },
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
const seenRow = new Set();
for (const row of P1.concat(P2)) {
  const key = row.species + '|' + row.item + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE MECHANISM, READ OUT OF THE FORMAT RATHER THAN QUOTED ---------------------------------- */
const CHARGE_COND = String((dex.moves.get('charge').condition || {}).onMoveAborted || '');
const CHARGE_AFTER = String((dex.moves.get('charge').condition || {}).onAfterMove || '');
/* THE QUOTE STYLE IS THE COMPILER'S, NOT THE SOURCE'S. `dist/` is emitted with double quotes, so a
 * pattern written against `data/moves.ts` reads `false` here and the file refuses to run against a
 * mechanism that is present — the fixture calling itself unsupported. Matched on either quote. */
const ABORTS = /removeVolatile\(['"]charge['"]\)/.test(CHARGE_COND);
const TYPE_GATED = /Electric/.test(CHARGE_COND);
const IH_SEC = dex.moves.get('ironhead').secondary || {};
const BELLI_SPE = dex.species.get('bellibolt').baseStats.spe;
const AERO_SPE = dex.species.get('aerodactyl').baseStats.spe;
const TW_TYPE = dex.moves.get('thunderwave').type;
const MS_TYPE = dex.moves.get('mudshot').type;
console.log(NL + '  READ AT RUN TIME, NOT RECALLED:');
console.log('    charge.onMoveAborted removes the volatile     : ' + ABORTS);
console.log('    ...and it is gated on the move TYPE           : ' + TYPE_GATED);
/* THE BODY, WITHOUT THE HANDLER NAME IN FRONT OF IT — the two differ only in what they are called,
 * and comparing the whole string reported `false` for two identical rules. */
const bodyOf = s => s.replace(/^[^{]*/, '').replace(/\s+/g, ' ').trim();
console.log('    charge.onAfterMove is the same body           : '
  + (bodyOf(CHARGE_AFTER) === bodyOf(CHARGE_COND) && bodyOf(CHARGE_COND) !== ''));
console.log('    Iron Head secondary                           : '
  + IH_SEC.volatileStatus + ' at ' + IH_SEC.chance + '%  (the arm fires every secondary)');
console.log('    base speeds  aerodactyl ' + AERO_SPE + '  >  bellibolt ' + BELLI_SPE
  + '   : ' + (AERO_SPE > BELLI_SPE));
console.log('    thunderwave type ' + TW_TYPE + ' / mudshot type ' + MS_TYPE
  + '   : ' + (TW_TYPE === 'Electric' && MS_TYPE !== 'Electric'));
if (!ABORTS || !TYPE_GATED || IH_SEC.volatileStatus !== 'flinch' || !(AERO_SPE > BELLI_SPE)
    || TW_TYPE !== 'Electric' || MS_TYPE === 'Electric') {
  console.log(NL + 'NOT RUN — the format no longer supports this fixture. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(P1), b = G.buildPair(P2);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  /* THE AUTHORITY'S OWN ANSWER FOR THE LEAF, READ OFF ITS LAST BOARD. `charge_after` in the case
   * table is cross-read against this and never trusted on its own — a typed expectation that agrees
   * with a typed engine is two guesses shaking hands. */
  let sdCharge = null, mediCharge = null;
  const r = G.playGame(a, b, 'directed', 'probe_electric_charge_abort :: ' + c.id, { script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => {
      const me = (S.actA || [])[0];
      mediCharge = me && me._vol && me._vol.charge ? 1 : 0;
      const p = battle.sides[0].active[0];
      sdCharge = p && p.volatiles && p.volatiles.charge ? 1 : 0;
    } });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(), sdCharge, mediCharge,
    cant: (r.mediTrace || []).filter(l => /^\|cant\|/.test(String(l))).map(String),
    restored: (globalThis.MEDFAILS || {}).electricChargeSurvivesAbortRestored || 0 };
}
const shortDiv = d => (!d ? 'none' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)));

let bad = 0, ran = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   arm ' + c.arm);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged) { console.log('  NOT-STAGED under the knob — side ' + brk.which); bad++; continue; }
  if (brk.r.err) { console.log('  THREW under the knob — ' + brk.r.err); bad++; continue; }
  harness(false);
  ran++;

  console.log('    medicham |cant| lines         ' + JSON.stringify(clean.cant));
  console.log('    banked / spent / aborted      ' + (clean.delta.chargeBanked || 0) + ' / '
    + (clean.delta.chargeCleared || 0) + ' / ' + (clean.delta.electricChargeAbortedAtGate || 0)
    + '   (expected aborts ' + c.drops + ')');
  console.log('    vol.charge at the last board  medicham ' + clean.mediCharge
    + '   showdown ' + clean.sdCharge + '   (this arm is for ' + c.charge_after + ')');
  console.log('    board divergence clean        ' + shortDiv(clean.r.stateDiv));
  console.log('    board divergence knob         ' + shortDiv(brk.r.stateDiv));
  console.log('    MEDFAILS stamp   clean ' + clean.restored + '   knob ' + brk.restored);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue;
  }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the game ended before the script did ('
      + clean.r.turns + ' / ' + brk.r.turns + ' of ' + c.script.length + ' turns).'); bad++; continue;
  }
  /* THE AUTHORITY IS THE ANSWER, AND THE CASE TABLE IS CHECKED AGAINST IT RATHER THAN THE OTHER WAY
   * ROUND. A mismatch here means the fixture no longer stages what its row claims — a NOT RUN, not
   * a defect, and it is called out as the fixture's. */
  if (clean.sdCharge !== c.charge_after) {
    console.log('    >> FIXTURE FAILED — the authority reads charge ' + clean.sdCharge
      + ' and this arm was written for ' + c.charge_after + '. The fixture no longer stages its own '
      + 'question; that is a claim about this file, not about medicham2.'); bad++; continue;
  }
  if (c.kind === 'red') {
    const cantFlinch = clean.cant.some(l => /flinch/.test(l));
    if (!cantFlinch) {
      console.log('    >> FIXTURE FAILED — no |cant|...|flinch| line, so nothing was aborted.'); bad++; continue;
    }
  }
  if (clean.r.stateDiv) {
    console.log('    >> RED — the boards part with the fix in: ' + shortDiv(clean.r.stateDiv)); bad++; continue;
  }
  if (c.kind === 'red') {
    if (!brk.r.stateDiv) {
      console.log('    >> THE KNOB DID NOT PART THE BOARDS. Either it is unwired or this arm was never '
        + 'measuring the mechanic — identical output across a varied knob is the finding.'); bad++; continue;
    }
    if (!/vol\.charge/.test(JSON.stringify(brk.r.stateDiv))) {
      console.log('    >> THE KNOB PARTED THE BOARDS ON THE WRONG LEAF.'); bad++; continue;
    }
    if ((clean.delta.electricChargeAbortedAtGate || 0) !== c.drops) {
      console.log('    >> THE COUNTER DISAGREES — ' + (clean.delta.electricChargeAbortedAtGate || 0)
        + ' aborts counted, ' + c.drops + ' expected.'); bad++; continue;
    }
    if (clean.restored !== 0 || brk.restored !== 1) {
      console.log('    >> THE KNOB DOES NOT STAMP — clean ' + clean.restored + ', knob ' + brk.restored
        + '. A knob that leaves no mark cannot be shown to have been applied.'); bad++; continue;
    }
  } else {
    if (brk.r.stateDiv) {
      console.log('    >> THE KNOB PARTED A CONTROL. The restored road is wider than the defect: '
        + shortDiv(brk.r.stateDiv)); bad++; continue;
    }
  }
  console.log('    OK');
}

console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log(bad ? 'FAIL — ' + bad + ' of ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
