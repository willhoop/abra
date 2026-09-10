/* probe_ohko_type_immunity.js — AN OHKO MOVE WHOSE TYPE GATE THE TARGET CARRIES IS ANNOUNCED AS AN
 * IMMUNITY AND TAKES NO ACCURACY DRAW. THIS ENGINE PRICED IT AT ZERO AND ROLLED A MISS.
 * 2026-09-09, batch X.
 *
 *   SHOWDOWN_PATH=... node tests/probe_ohko_type_immunity.js
 *   SHOWDOWN_PATH=... node tests/probe_ohko_type_immunity.js --release <id> --only sheercold-at-an-ice-body
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `7489a6cc064d`, 961 games on the pinned pool:
 *
 *     unrelated event mismatch :: |-immune|p2a|[ohko] <> |-miss|p1b|p2a
 *
 * and the game itself (`omit-intimidate`, seed …bo3-2657809428, turn 8):
 *
 *     agreed    |move|p1b: Mr. Rime|sheercold|p2a: Meowscarada
 *     showdown  |-immune|p2a: Meowscarada|[ohko]
 *     medicham2 |-miss|p1b: Mr. Rime|p2a: Meowscarada
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * `BattleActions#hitStepAccuracy`, sim/battle-actions.ts:696-709, read WHOLE. Champions overrides
 * neither `hitStepAccuracy` nor `sheercold` — both re-derived on every run below.
 *
 *     if (move.ohko) {                                   // bypasses accuracy modifiers
 *       if (!target.isSemiInvulnerable()) {
 *         accuracy = 30;
 *         if (move.ohko === 'Ice' && this.battle.gen >= 7 && !pokemon.hasType('Ice')) accuracy = 20;
 *         if (!target.volatiles['dynamax'] && pokemon.level >= target.level &&
 *             (move.ohko === true || !target.hasType(move.ohko))) {
 *           accuracy += (pokemon.level - target.level);
 *         } else {
 *           this.battle.add('-immune', target, '[ohko]');
 *           hitResults[i] = false;
 *           continue;                                    // <- NO DRAW IS EVER TAKEN
 *         }
 *       }
 *     }
 *
 * Three clauses reach that `else`. Two cannot occur in this format and are stated rather than
 * modelled: Champions is Level 50 throughout, so `pokemon.level >= target.level` always holds, and
 * Dynamax does not exist here. The third is the live one — `move.ohko` is a TYPE STRING and the
 * target carries it. `sheercold` is the format's only such move (`ohko: 'Ice'`); Fissure, Horn Drill
 * and Guillotine all carry `ohko: true`, for which `move.ohko === true` short-circuits the test and
 * NO body is ever immune. Both facts are derived below and the run stops if either changes.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `hitChance` already knew — `MEDSEEN.ohkoImmune` has counted this exact case since the OHKO tag was
 * wired — and it expressed the immunity as an ACCURACY OF ZERO. Zero is finite, so `accMustRoll`
 * said yes, `_stepAccuracy` spent a draw, the draw came back above zero, and the row left through
 * the MISS door with the miss's line on it.
 *
 * SO THIS IS TWO DEFECTS IN ONE RETURN VALUE, and the second one is not narration:
 *   1. the LINE — `|-miss|<user>|<target>` where the authority writes `|-immune|<target>|[ohko]`;
 *   2. the DRAW — this engine consumed an `acc` address the authority never consumed. Under the
 *      differential's `middle` arm every draw is addressed, so the cost is confined to that address
 *      (`acc | sheercold | <target slot> | nth`) and does not shift the stream; it is nevertheless a
 *      real difference in draw counts, and the identity check tolerates it only because its floor is
 *      0.9. `accDrawsTaken` is asserted here in both directions for that reason.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE
 * EXPECTATION. `MEDI_NO_OHKO_IMMUNE_LINE=1` is the revert knob and restores exactly the
 * pre-2026-09-09 road — price the immunity at zero and let the accuracy step roll it — so a RED arm
 * is one that agrees clean and PARTS under the knob, and a CONTROL is one that agrees under BOTH.
 * The knob is proved to have reached the module the driver played, by a load-time stamp in
 * `MEDFAILS`, before any verdict is read.
 *
 * ================= THE CONTROLS, AND WHY EACH ONE EXISTS ========================================
 *
 * `sheercold-at-a-non-ice-body` is THE KNOB CLEARED EXPLICITLY: the same Mr. Rime, the same Sheer
 * Cold, the same slot — one field changed, the target's TYPE — and the immunity must not fire. It is
 * what separates "the type gate refuses" from "Sheer Cold has stopped working in this engine", and
 * that mistake has been made in this repository more than once.
 *
 * `fissure-at-an-ice-body` is the SHARPEST over-fire control. The target is the identical pure-Ice
 * body and the move is an OHKO move, but its `ohko` is the BOOLEAN `true`, so `move.ohko === true`
 * short-circuits the authority's test and nothing is immune. A fix that read "an OHKO move into a
 * body whose type matches" — or worse, "an OHKO move into an Ice body" — passes the red arm and
 * breaks here.
 *
 * `icebeam-at-an-ice-body` guards the other axis: an ordinary Ice move into the same Ice body must
 * be untouched, so the gate cannot have leaked out of the `move.ohko` branch onto every move that
 * shares a type with its target.
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
  REL_ID = ER.cut('tests/probe_ohko_type_immunity.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_NO_OHKO_IMMUNE_LINE';

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
 * ONE TURN PER ARM, DELIBERATELY. An OHKO move that connects removes the body it was aimed at, and a
 * replacement arriving on turn 2 would put a different species under the same script slot — a
 * fixture that stages a second question instead of the one asked. The partners click a self-boost so
 * that no slot can run out of a legal choice inside the turn. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const CM = { m: 'calmmind' };
const SD = { m: 'swordsdance' };
/* THE TARGET CLICKS CURSE AND NOT PROTECT, and that is the whole fixture rather than a detail:
 * Sheer Cold carries `protect: 1`, so a shield in front of the body would refuse the move three
 * steps above `hitStepAccuracy` and the arm would stage nothing. Curse on a non-Ghost body is a
 * self-boost that touches neither engine's accuracy road. */
const CURSE = { m: 'curse' };

const RIME = ['mrrime', '', 'Ice Body', ['Sheer Cold', 'Ice Beam', 'Protect']];
const MAMO = ['mamoswine', '', 'Thick Fat', ['Fissure', 'Protect']];
const A_TAIL = [['clefable', '', 'Unaware', ['Calm Mind', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Rest']],
                ['corviknight', '', 'Pressure', ['Protect']]];
const B_TAIL = [['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];
const ICE_BODY = ['glaceon', '', 'Ice Body', ['Curse', 'Protect']];
const NON_ICE_BODY = ['snorlax', '', 'Thick Fat', ['Curse', 'Protect']];

const oneTurn = mv => [{ p1: [{ m: mv, t: 0 }, CM], p2: [CURSE, SD] }];

const CASES = [
  { id: 'sheercold-at-an-ice-body', kind: 'red',
    a: [RIME].concat(A_TAIL), b: [ICE_BODY].concat(B_TAIL), script: oneTurn('sheercold'),
    immClean: 1, immKnob: 0, drawClean: 0, drawKnob: 1,
    what: 'THE CARD, REBUILT. Mr. Rime aims Sheer Cold (`ohko: "Ice"`) at a pure-Ice Glaceon. The '
        + 'authority reaches the `else` of the OHKO branch, writes `|-immune|…|[ohko]` and never '
        + 'touches the accuracy die; this engine priced the immunity as an accuracy of zero, rolled '
        + 'it, and wrote the miss line.' },

  { id: 'sheercold-at-a-non-ice-body', kind: 'control',
    a: [RIME].concat(A_TAIL), b: [NON_ICE_BODY].concat(B_TAIL), script: oneTurn('sheercold'),
    immClean: 0, immKnob: 0, drawClean: 1, drawKnob: 1,
    what: 'THE KNOB CLEARED EXPLICITLY — the same user, the same move, the same slot, and ONE field '
        + 'moved: the target is a Normal-type Snorlax. `target.hasType("Ice")` is false, so the '
        + 'authority takes its 30 and rolls. The immunity must not fire and the draw must be spent.' },

  { id: 'fissure-at-an-ice-body', kind: 'control',
    a: [MAMO].concat(A_TAIL), b: [ICE_BODY].concat(B_TAIL), script: oneTurn('fissure'),
    immClean: 0, immKnob: 0, drawClean: 1, drawKnob: 1,
    what: 'THE SHARPEST OVER-FIRE CONTROL. The identical pure-Ice body, and an OHKO move — but '
        + 'Fissure carries the BOOLEAN `ohko: true`, and `move.ohko === true` short-circuits the '
        + 'authority\'s type test, so nothing is ever immune to it. A fix reading "OHKO into a body '
        + 'of the matching type" passes the red arm and breaks this one.' },

  { id: 'icebeam-at-an-ice-body', kind: 'control',
    a: [RIME].concat(A_TAIL), b: [ICE_BODY].concat(B_TAIL), script: oneTurn('icebeam'),
    immClean: 0, immKnob: 0, drawClean: 1, drawKnob: 1,
    what: 'THE OTHER AXIS. An ordinary Ice move into the same Ice body: the gate lives inside '
        + '`if (move.ohko)` and must not have leaked onto every move that shares a type with its '
        + 'target. Ice Beam is a printed 100 and STILL DRAWS — `accMustRoll` is `isFinite(acc)`, not '
        + '`acc < 100`, because a printed 100 into an evasion body is a real roll in the authority '
        + 'too. Declared 0 in the first draft of this file and MEASURED at 1; the probe was wrong '
        + 'before the engine was, which is the failure this repository keeps paying for.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);
let illegal = 0;
const seen = new Set();
for (const c of CASES) for (const row of c.a.concat(c.b)) {
  const key = row[0] + '|' + row[3].join(',');
  if (seen.has(key)) continue; seen.add(key);
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
  const champMoves = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const champScripts = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const bad = [];
  const ohkoOf = id => dex.moves.get(id).ohko;
  const typed = dex.moves.all().filter(legal).filter(m => m.ohko);
  console.log('OHKO MOVES IN ' + CS.FORMAT + ': '
    + typed.map(m => m.name + ' ohko=' + JSON.stringify(m.ohko)).join(' | '));
  console.log('DOES CHAMPIONS REWRITE sheercold / fissure / icebeam? '
    + ['sheercold', 'fissure', 'icebeam'].map(id =>
      id + '=' + (new RegExp('^\\t' + id + ': \\{', 'm').test(champMoves) ? 'YES' : 'no')).join('  '));
  console.log('DOES CHAMPIONS REWRITE hitStepAccuracy? '
    + (/hitStepAccuracy\s*\(/.test(champScripts) ? 'YES' : 'no'));
  console.log('target types: glaceon ' + JSON.stringify(dex.species.get('glaceon').types)
    + '   snorlax ' + JSON.stringify(dex.species.get('snorlax').types));
  console.log('attacker types: mrrime ' + JSON.stringify(dex.species.get('mrrime').types)
    + '   mamoswine ' + JSON.stringify(dex.species.get('mamoswine').types));
  if (new RegExp('^\\tsheercold: \\{', 'm').test(champMoves)) bad.push('Champions now overrides Sheer Cold');
  if (new RegExp('^\\tfissure: \\{', 'm').test(champMoves)) bad.push('Champions now overrides Fissure');
  if (/hitStepAccuracy\s*\(/.test(champScripts)) bad.push('Champions now overrides hitStepAccuracy, so the block quoted above is stale');
  if (ohkoOf('sheercold') !== 'Ice') bad.push('sheercold.ohko is ' + JSON.stringify(ohkoOf('sheercold')) + ', not "Ice"');
  if (ohkoOf('fissure') !== true) bad.push('fissure.ohko is ' + JSON.stringify(ohkoOf('fissure')) + ', not true');
  if (!dex.species.get('glaceon').types.includes('Ice')) bad.push('the red arm\'s target is no longer Ice');
  if (dex.species.get('snorlax').types.includes('Ice')) bad.push('the cleared-knob control\'s target is now Ice');
  if (!dex.species.get('mrrime').types.includes('Ice')) bad.push('Mr. Rime is no longer Ice, so the '
    + 'red arm would be rolling the 20 rather than the 30 and the premise printed here is wrong');
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.a)), b = G.buildPair(stage(c.b));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_ohko_type_immunity :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).ohkoImmuneLineSuppressed || 0 };
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
    imm: clean.delta.ohkoImmuneAnnounced || 0, immK: brk.delta.ohkoImmuneAnnounced || 0,
    draw: clean.delta.accDrawsTaken || 0, drawK: brk.delta.accDrawsTaken || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (R.imm !== c.immClean) fails.push('ohkoImmuneAnnounced clean is ' + R.imm + ', declared ' + c.immClean);
  if (R.immK !== c.immKnob) fails.push('ohkoImmuneAnnounced knob is ' + R.immK + ', declared ' + c.immKnob);
  /* THE DRAW IS THE SECOND HALF OF THE DEFECT AND IS ASSERTED IN BOTH DIRECTIONS. */
  if (R.draw !== c.drawClean) fails.push('accDrawsTaken clean is ' + R.draw + ', declared ' + c.drawClean);
  if (R.drawK !== c.drawKnob) fails.push('accDrawsTaken knob is ' + R.drawK + ', declared ' + c.drawKnob);
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
  console.log('    counters       ohkoImmuneAnnounced ' + R.imm + '/' + c.immClean + ' clean, '
    + R.immK + '/' + c.immKnob + ' knob   |   accDrawsTaken ' + R.draw + '/' + c.drawClean
    + ' clean, ' + R.drawK + '/' + c.drawKnob + ' knob');
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
  : 'PASS — an OHKO move whose type gate the target carries is announced as an immunity and spends '
  + 'no accuracy draw, the knob puts the red arm apart again, and neither a non-matching body, a '
  + 'boolean-OHKO move at the matching body, nor an ordinary move of the same type moves at all');
process.exit(bad ? 1 : 0);
