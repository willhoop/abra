/* probe_charge_abort.js — A CHARGE REFUSED BY THE BeforeMove GATE IS DROPPED, AND THIS ENGINE KEPT
 * IT. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_charge_abort.js
 *   SHOWDOWN_PATH=... node tests/probe_charge_abort.js --only abort-flinch
 *   SHOWDOWN_PATH=... node tests/probe_charge_abort.js --release <id>
 *
 * ================= THE MECHANISM, READ AT THE LINE =============================================
 *
 *     onMoveAborted(pokemon) { pokemon.removeVolatile('twoturnmove'); }     data/conditions.ts:319
 *     onEnd(target)          { target.removeVolatile(this.effectState.move); }        :316
 *
 * and `MoveAborted` is raised on exactly one condition:
 *
 *     const willTryMove = this.battle.runEvent('BeforeMove', pokemon, target, move);
 *     if (!willTryMove) { this.battle.runEvent('MoveAborted', pokemon, target, move); ... return; }
 *                                                              sim/battle-actions.ts:255-263
 *
 * So a charge stopped by sleep, a flinch, freeze, full paralysis, Disable, Taunt, Throat Chop,
 * Imprison, Attract or Heal Block loses the wrapper AND the sub-volatile — and for Fly, Dig, Dive,
 * Bounce and Phantom Force the user comes down out of the sky with them. Champions carries no
 * override for `twoturnmove` (grepped at run time below, not recalled).
 *
 * medicham2 cleared the wrapper at switch-out, at faint, at the residual, under Gravity and when the
 * chooser abandoned an unaimable charge — and at NONE of the gate's refusal doors.
 *
 * ================= WHY THIS COULD NOT BE PROBED UNTIL TODAY =====================================
 *
 * `docs/_reports/2026-09-05-fix-batch-8.md` §6 filed this as REAL AND UNSTAGEABLE, and the blocker
 * was the instrument: `scripted()` in `engine/game_differential.js` supplied a target for a LOCKED
 * move, whose request entry carries no `target` field, and `Side#chooseMove` refused the whole
 * choice. No directed scenario had ever played a release turn. That is fixed; this file is the
 * first staged abort.
 *
 * ================= NO EXPECTATION IS TYPED =====================================================
 *
 * Both arms play the identical script on both engines under the same pinned arm and the BOARD is
 * compared by the driver's own state comparator. Showdown's board is the answer. This file asserts
 * only that the two agree, that the knob parts them again on exactly one arm, and that the counter
 * says the drop actually happened.
 *
 * `MEDI_CHARGE_WRAP_SURVIVES_ABORT=1` restores the pre-fix engine in a child load and stamps
 * `MEDFAILS.chargeWrapSurvivesAbortRestored`, asserted ABSENT on the clean load and PRESENT under
 * the knob.
 *
 * ================= THE FIXTURE, DERIVED ========================================================
 *
 * The arm is `bottom-tie-first`, whose dice corner fires EVERY secondary — so Iron Head's 20% flinch
 * is a certainty on both engines rather than a coin this file would have to survive. Aerodactyl
 * (base 130 -> 182 in slot 0) is faster than Archaludon (base 85 -> 137), so the flinch always lands
 * before the release. Steel into Steel/Dragon is 0.5x at minimum damage, so the charger survives and
 * the only board difference available is the one under test. Electro Shot is used rather than a
 * semi-invulnerable member because a flinch source cannot HIT a body that has left the field; the
 * semi-invulnerable half of the same defect is therefore stated and NOT claimed here.
 *
 * Turn 1 the flincher clicks Protect, whose FIRST consecutive use cannot fail, so it neither hits nor
 * draws a stall roll that could part the stream for a reason this file is not about.
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
  REL_ID = ER.cut('tests/probe_charge_abort.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_CHARGE_WRAP_SURVIVES_ABORT';

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
/* Stalwart, not Stamina: Stamina raises Defence every time the holder is hit and would write a
 * `-boost` into the very turn under test. */
const ARCH = ['archaludon', '', 'Stalwart', ['Electro Shot', 'Protect']];
/* Rock Head, not Pressure: Pressure spends the foe's PP and PP is a compared leaf. */
const AERO = ['aerodactyl', '', 'Rock Head', ['Iron Head', 'Protect']];
const CLEF = ['clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Calm Mind', 'Protect']];

const P1 = stage([ARCH, CLEF]).concat(BENCH('garchomp', 'toxapex'));
const P2 = stage([AERO, MEOW]).concat(BENCH('snorlax', 'furfrou'));

const CM = { m: 'calmmind' }, PR = { m: 'protect' };
const ES = { m: 'electroshot', t: 0 }, IH = { m: 'ironhead', t: 0 };

const CASES = [
  { id: 'abort-flinch', kind: 'red', arm: 'bottom-tie-first', drops: 1,
    A: P1, B: P2,
    script: [{ p1: [ES, CM], p2: [PR, CM] },
      { p1: [ES, CM], p2: [IH, CM] }],
    what: 'THE DEFECT. Archaludon commits Electro Shot on turn 1 and is FLINCHED on the release turn '
        + 'by a faster Iron Head. The authority raises MoveAborted and `twoturnmove.onMoveAborted` '
        + 'removes the wrapper; this engine kept it, and the board parts on exactly one leaf — '
        + '`p1.active[0].vol.charging  medicham 1  showdown 0`.' },

  { id: 'no-flinch', kind: 'control', arm: 'bottom-tie-first', drops: 0,
    A: P1, B: P2,
    script: [{ p1: [ES, CM], p2: [PR, CM] },
      { p1: [ES, CM], p2: [PR, CM] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and the identical clicks with Protect in '
        + 'place of the Iron Head. The release RUNS and is stopped by the shield, which is a TryMove '
        + 'failure and not a BeforeMove refusal, so the authority keeps the clock through it. A fix '
        + 'that dropped the wrapper on "the move did not connect" rather than on "the gate refused '
        + 'it" breaks here, and it must be green under the knob as well.' },
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
for (const c of CASES) for (const row of c.A.concat(c.B)) {
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
const TTM = dex.conditions.get('twoturnmove') || {};
const ABORTS = /removeVolatile/.test(String(TTM.onMoveAborted || ''));
const IH_SEC = dex.moves.get('ironhead').secondary || {};
const ARCH_SPE = dex.species.get('archaludon').baseStats.spe;
const AERO_SPE = dex.species.get('aerodactyl').baseStats.spe;
console.log(NL + '  READ AT RUN TIME, NOT RECALLED:');
console.log('    twoturnmove.onMoveAborted removes a volatile : ' + ABORTS);
console.log('    Iron Head secondary                          : '
  + IH_SEC.volatileStatus + ' at ' + IH_SEC.chance + '%  (the arm fires every secondary)');
console.log('    base speeds  aerodactyl ' + AERO_SPE + '  >  archaludon ' + ARCH_SPE
  + '   : ' + (AERO_SPE > ARCH_SPE));
console.log('    electroshot is a two-turn move               : '
  + /twoturnmove/.test(String(dex.moves.get('electroshot').onTryMove || '')));
if (!ABORTS || IH_SEC.volatileStatus !== 'flinch' || !(AERO_SPE > ARCH_SPE)) {
  console.log(NL + 'NOT RUN — the format no longer supports this fixture. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  const r = G.playGame(a, b, 'directed', 'probe_charge_abort :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    cant: (r.mediTrace || []).filter(l => /^\|cant\|/.test(String(l))).map(String),
    restored: (globalThis.MEDFAILS || {}).chargeWrapSurvivesAbortRestored || 0 };
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

  console.log('    medicham |cant| lines      ' + JSON.stringify(clean.cant));
  console.log('    wrapper applied / aborted  ' + (clean.delta.chargeWrapApplied || 0) + ' / '
    + (clean.delta.chargeWrapAbortedAtGate || 0) + '   (expected aborts ' + c.drops + ')');
  console.log('    locked clicks with NO target  ' + clean.sc.lockedNoTarget);
  console.log('    board divergence clean  ' + shortDiv(clean.r.stateDiv));
  console.log('    board divergence knob   ' + shortDiv(brk.r.stateDiv));
  console.log('    MEDFAILS stamp   clean ' + clean.restored + '   knob ' + brk.restored);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue;
  }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/'
      + brk.r.turns + ' of ' + c.script.length + ').'); bad++; continue;
  }
  /* THE CHARGE MUST HAVE COMMITTED AND THE RELEASE TURN MUST HAVE BEEN REACHED. A run where the
   * request never offered a locked move never reached the mechanic at all. */
  if ((clean.delta.chargeWrapApplied || 0) !== 1 || clean.sc.lockedNoTarget !== 1) {
    console.log('    >> FIXTURE FAILED — ' + (clean.delta.chargeWrapApplied || 0) + ' charge(s) committed and '
      + clean.sc.lockedNoTarget + ' locked click(s) encoded; both must be 1.'); bad++; continue;
  }
  /* THE REFUSAL MUST HAVE HAPPENED ON THE ARM THAT CLAIMS ONE. */
  const flinched = clean.cant.some(l => /\|flinch$/.test(l));
  if ((c.drops > 0) !== flinched) {
    console.log('    >> FIXTURE FAILED — the flinch ' + (flinched ? 'FIRED' : 'did not fire')
      + ' on an arm that claims ' + (c.drops > 0 ? 'it must' : 'it must not') + '.'); bad++; continue;
  }
  if ((clean.delta.chargeWrapAbortedAtGate || 0) !== c.drops) {
    console.log('    >> COUNTER — the gate dropped ' + (clean.delta.chargeWrapAbortedAtGate || 0)
      + ' wrapper(s), expected ' + c.drops + '.'); bad++; continue;
  }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED — and it only arms on a body that is
   * actually holding a charge, so absence on an arm with no charge would be the finding rather than
   * a broken knob. Both arms here commit one. */
  if (!(clean.restored === 0 && brk.restored === 1)) {
    console.log('    >> KNOB DID NOT BIND — stamp clean ' + clean.restored + ' knob ' + brk.restored
      + ', expected 0/1.'); bad++; continue;
  }
  if (clean.r.stateDiv) {
    console.log('    >> FAIL — the boards part: ' + shortDiv(clean.r.stateDiv)); bad++; continue;
  }
  if (c.kind === 'red' && !brk.r.stateDiv) {
    console.log('    >> KNOB SAW NOTHING — the restored engine agrees too, so this arm cannot tell '
      + 'the two readings apart and is not a red arm.'); bad++; continue;
  }
  if (c.kind === 'control' && brk.r.stateDiv) {
    console.log('    >> CONTROL MOVED — the restored engine parts here: ' + shortDiv(brk.r.stateDiv)
      + '. This arm agreed before the fix and must still.'); bad++; continue;
  }
  console.log('    PASS  boards identical'
    + (c.kind === 'red' ? '   [the knob parts them, so the arm can see the defect]' : ''));
}

console.log(NL + '================================================================');
console.log('  ' + ran + ' arm(s) ran, ' + bad + ' failed.');
if (bad) { console.log('  RED — an aborted charge does not match the authority.'); process.exit(1); }
console.log('  GREEN — the gate drops the wrapper exactly where the authority does, the shielded '
  + 'release keeps it, and the knob moved exactly the arm it should.');
