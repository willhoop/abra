/* probe_hazard_sweep_order.js — A HAZARD SWEEP RUNS ITS CLAUSES IN THE AUTHORITY'S ORDER. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_hazard_sweep_order.js
 *   SHOWDOWN_PATH=... MEDI_SWEEP_LEGACY_ORDER=1 node tests/probe_hazard_sweep_order.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * Will asked whether Rapid Spin clearing hazards — and Leech Seed — had ever been tested. The BOARD
 * half had: `tests/test-mechanics.js` carries three `removesHazards` probes and they read the
 * outcome (a body walks into the swept side and pays nothing). NOTHING compared the ORDER of the
 * lines the sweep writes, and the three carriers in this format do not agree about that order.
 *
 * ================= THE AUTHORITY, READ WHOLE AND THEN OBSERVED ==================================
 *
 * `data/moves.ts`, and no Champions override: `node engine/mod_audit.js` reports rapidspin's ONLY
 * difference from mainline as `pp 40 -> 20`, and mortalspin / defog / tidyup as identical.
 *
 *   RAPID SPIN / MORTAL SPIN   `onAfterHit`, statement by statement:
 *       removeVolatile('leechseed') -> the sideConditions loop -> removeVolatile('partiallytrapped')
 *   DEFOG   `onHit`: `removeTarget` (the screens, then the hazards) on the TARGET's side ->
 *       `removeAll` on the SOURCE's side -> `clearTerrain()`
 *   TIDY UP `onHit`: every Substitute on the field -> `[pokemon.side, ...foeSidesWithConditions()]`
 *
 * OBSERVED IN THE OFFICIAL SIMULATOR before a line of this was written — the three streams replayed
 * below:
 *
 *   |-boost|p1a: Excadrill|spe|1
 *   |-end|p1a: Excadrill|Leech Seed|[from] move: Rapid Spin|[of] p1a: Excadrill
 *   |-sideend|p1: A|Stealth Rock|[from] move: Rapid Spin|[of] p1a: Excadrill
 *   |-end|p1a: Excadrill|Infestation|[partiallytrapped]
 *
 *   |-sideend|p2: B|Reflect
 *   |-sideend|p2: B|Stealth Rock|[from] move: Defog|[of] p1a: Corviknight
 *   |-sideend|p1: A|Stealth Rock|[from] move: Defog|[of] p1a: Corviknight
 *
 *   |-end|p1a: Maushold|Substitute
 *   |-sideend|p1: A|Stealth Rock
 *   |-sideend|p2: B|Stealth Rock
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `sweepField` ran hazards -> screens -> terrain -> leechseed -> trap -> substitutes, which is wrong
 * for all three carriers at once: the spin family wrote its `-sideend` ABOVE its Leech Seed `-end`,
 * Defog wrote its own side before the target's and its screen last, and Tidy Up wrote its Substitute
 * `-end` BELOW both side lines. The BOARD is identical either way, which is exactly why three board
 * probes sat green over it.
 *
 * ================= WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ===============================
 *
 * ASSERTED: the ORDER of the `-end` / `-sideend` events a sweeping move writes, as a sequence of
 * (event, subject, effect) triples, equal between the engines.
 *
 * NOT ASSERTED, and PRINTED rather than hidden: the `[from] move: <Move>` attribution on those
 * lines. The authority attributes the spin family's and Defog's and leaves Tidy Up's bare, so no
 * consumer can tell the two apart from anything in `data/tags.json` today — the discriminator has to
 * be DERIVED from the handler source into a new `removesHazards` param, and `engine/tag_dex.js`
 * exhausts the heap, which `docs/ENGINE.md` already carries as a named blocker. Every arm therefore
 * compares the triple and REPORTS the attribution gap as a count. Asserting it would be asserting a
 * defect this file cannot fix; dropping it silently would be worse.
 *
 * Also not asserted: the effect NAMESPACE (`move: stealthrock` against `Stealth Rock`). The
 * differential's own `effect-namespace` equivalence collapses those two, so it is not a divergence
 * by the instrument that decides this project's protocol number.
 *
 *   1  FIXTURE  the `removesHazards` family and its params are DERIVED off data/tags.json and
 *               printed; the file FAILS BY NAME if a carrier has a clause shape no arm stages
 *   2  CONTROL  the same board with a NON-sweeping click writes no `-end`/`-sideend` at all, in
 *               BOTH engines — so every sequence below is attributable to the sweep
 *   3  TEST     one arm per distinct clause shape: spin, Defog, Tidy Up
 *   4  COUNTER  MEDSEEN.sweepInAuthorityOrder is non-zero, MEDFAILS.sweepLegacyOrderRestored is 0
 *
 * `MEDI_SWEEP_LEGACY_ORDER=1` puts the old order back verbatim — it RELOCATES the clauses and skips
 * none, so the board is identical under it and only the order moves. The parent re-runs ITSELF as a
 * child under that knob and FAILS if the child passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('HAZARD SWEEP ORDER');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_SWEEP_LEGACY_ORDER === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== A HAZARD SWEEP\'S CLAUSE ORDER ==' + (CHILD ? '   [MEDI_SWEEP_LEGACY_ORDER=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FAMILY, DERIVED. Nothing here is a typed membership.
 * ============================================================================================= */
const FAMILY = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('removesHazards') >= 0)
  .map(k => ({ id: k, name: TAGS.moves[k].name, uses: TAGS.moves[k].uses || 0,
               p: TAGS.moves[k].params.removesHazards }))
  .sort((a, b) => b.uses - a.uses);

/* THE SHAPE A CARRIER HAS, off its own params. Three shapes exist in this format; a fourth would be
 * a member this file does not stage, which is a FAILURE rather than a silent skip. */
const shapeOf = (p) => (p.removesOwnLeechSeed && p.removesOwnPartialTrap) ? 'spin'
  : (p.alsoRemoves && p.alsoRemoves.length) ? 'defog'
  : (p.removesSubstitutes) ? 'tidyup' : 'UNSTAGED';

console.log('  THE `removesHazards` FAMILY, off data/tags.json:');
for (const f of FAMILY) {
  const mv = dex.moves.get(f.id);
  console.log('    ' + f.id.padEnd(12) + 'shape=' + shapeOf(f.p).padEnd(7)
    + ' hazardsFrom=' + String(f.p.hazardsFrom).padEnd(6)
    + ' screensFrom=' + String(f.p.screensFrom || '-').padEnd(7)
    + ' seed=' + (f.p.removesOwnLeechSeed ? 'Y' : 'n')
    + ' trap=' + (f.p.removesOwnPartialTrap ? 'Y' : 'n')
    + ' subs=' + (f.p.removesSubstitutes || '-')
    + ' terrain=' + (f.p.clearsTerrain ? 'Y' : 'n')
    + '  uses=' + f.uses
    + (mv.exists && !mv.isNonstandard ? '' : '   NOT LEGAL HERE'));
}
const UNSTAGED = FAMILY.filter(f => shapeOf(f.p) === 'UNSTAGED');
ok(UNSTAGED.length === 0, 'every derived carrier has an arm below',
   UNSTAGED.length ? 'UNSTAGED: ' + UNSTAGED.map(f => f.id).join(', ')
                   : FAMILY.length + ' carriers; shapes staged: '
                     + [...new Set(FAMILY.map(f => shapeOf(f.p)))].sort().join(', '));

/* ================================================================================================
 * THE TWO DRIVERS. Same script, read off each engine's own log.
 * ============================================================================================= */
const set = (n, mv) => ({ name: n, species: n, item: '', ability: dex.species.get(n).abilities[0],
  moves: mv.map(m => dex.moves.get(m).name), nature: 'Serious',
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });

const KEEP = /^\|(-sideend|-end)\|/;
/* THE COMPARISON CURRENCY. `(event, subject, effect)`, with the side label reduced to its player id,
 * the effect namespace stripped and the case flattened — the same three reductions the differential's
 * own canon and its `effect-namespace` equivalence already make. `[from]` and `[of]` are held OUT
 * and counted separately; see the header. */
const trip = (line) => {
  const f = line.split('|');                       /* ['', event, subject, effect, ...] */
  const subj = String(f[2] || '').split(':')[0].trim().toLowerCase();
  const eff = String(f[3] || '').replace(/^(move|ability|item):\s*/i, '')
    .replace(/\s+/g, '').toLowerCase();
  return f[1] + '|' + subj + '|' + eff;
};

function sdRun(p1, p2, script) {
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(p1) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(p2) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  let seen = b.log.length, last = [];
  for (const [c1, c2] of script) {
    const a1 = b.choose('p1', c1), a2 = b.choose('p2', c2);
    if (!a1 || !a2) throw new Error('the authority REFUSED a scripted choice ("' + c1 + '" / "' + c2
      + '") — a broken FIXTURE, never a statement about the mechanic');
    last = b.log.slice(seen).filter(l => KEEP.test(l));
    seen = b.log.length;
  }
  return last;
}

/* `script` here is per turn: [[p1a, p1b], [p2a, p2b]] where an entry is null (pass) or
 * {m:'moveid', t:<body or null>} resolved by the caller against the built bodies. */
function mediRun(p1sets, p2sets, build) {
  const mk = (s) => {
    const key = s.species.toLowerCase().replace(/[^a-z0-9]/g, '');
    const m = MEDI.buildMon(key, {});
    if (!m) throw new Error('buildMon has no row for ' + s.species
      + ' — a FIXTURE fault, never a claim about the mechanic');
    m.item = ''; m.ability = 'none';
    m.moves = s.moves.map(x => dex.moves.get(x).id);
    return m;
  };
  const A = p1sets.map(mk), B = p2sets.map(mk);
  const trace = [];
  const S = MEDI.battleInit(A, B, { seeded: true, trace });
  const rng = () => 0.5;
  let last = [];
  for (const turn of build(A, B, S)) {
    trace.length = 0;
    const side = (bodies, spec) => new Map(spec.map((s, i) => [bodies[i],
      s ? MEDI.playerAction(bodies[i], dex.moves.get(s.m).id, s.t || null, S.field)
        : { kind: 'pass' }]));
    MEDI.battleTurn(S, rng, side(A, turn[0]), side(B, turn[1]));
    last = trace.map(MEDI.traceCanon).filter(l => KEEP.test(l));
  }
  return { lines: last, A, B, S };
}

const before = { order: MEDI.MEDSEEN.sweepInAuthorityOrder, sweeps: MEDI.MEDSEEN.hazardSwept };
let attribGap = 0, attribSeen = 0;

function arm(label, p1sets, p2sets, sdScript, mediBuild) {
  const sd = sdRun(p1sets, p2sets, sdScript);
  const me = mediRun(p1sets, p2sets, mediBuild).lines;
  const S = sd.map(trip), M = me.map(trip);
  for (const l of sd) { attribSeen++; if (/\[from\]/.test(l)) { if (!me.some(x => /\[from\]/.test(x))) attribGap++; } }
  console.log('\n  ---- ' + label);
  console.log('    AUTHORITY  ' + JSON.stringify(sd));
  console.log('    MEDICHAM2  ' + JSON.stringify(me));
  ok(S.length > 0, label + ': the authority actually swept something',
     'a zero-length sequence is a FIXTURE failure, not a green arm');
  ok(JSON.stringify(S) === JSON.stringify(M), label + ': the sequence agrees',
     'authority ' + JSON.stringify(S) + '\n          medicham2 ' + JSON.stringify(M));
  return { sd, me };
}

/* ================================================================================================
 * 2 — CONTROL. The SAME spin board with a non-sweeping click of the same body. Both engines must
 * write no `-end`/`-sideend` at all, or the arms below are reading something else.
 * ============================================================================================= */
const SPIN_P1 = [set('Excadrill', ['Rapid Spin', 'Iron Head', 'Swords Dance']),
                 set('Corviknight', ['Bulk Up', 'Roost'])];
const SPIN_P2 = [set('Toxapex', ['Stealth Rock', 'Infestation']),
                 set('Whimsicott', ['Leech Seed', 'Moonblast'])];
const spinScript = (mv) => [
  ['move swordsdance, move bulkup', 'move stealthrock, move leechseed 1'],
  ['move swordsdance, move bulkup', 'move infestation 1, move moonblast 1'],
  ['move ' + mv + ' 1, move bulkup', 'move stealthrock, move moonblast 1'],
];
const spinBuild = (mv) => (A, B) => [
  [[{ m: 'swordsdance' }, { m: 'bulkup' }], [{ m: 'stealthrock' }, { m: 'leechseed', t: A[0] }]],
  [[{ m: 'swordsdance' }, { m: 'bulkup' }], [{ m: 'infestation', t: A[0] }, { m: 'moonblast', t: A[0] }]],
  [[{ m: mv, t: B[0] }, { m: 'bulkup' }], [{ m: 'stealthrock' }, { m: 'moonblast', t: A[0] }]],
];
{
  const sd = sdRun(SPIN_P1, SPIN_P2, spinScript('ironhead'));
  const me = mediRun(SPIN_P1, SPIN_P2, spinBuild('ironhead')).lines;
  ok(sd.length === 0 && me.length === 0,
     'CONTROL: the same Excadrill clicking a non-sweeping move writes no -end/-sideend',
     'authority ' + JSON.stringify(sd) + '   medicham2 ' + JSON.stringify(me));
}

/* ================================================================================================
 * 3 — THE THREE SHAPES.
 * ============================================================================================= */
arm('SPIN (seed, own hazards, trap)', SPIN_P1, SPIN_P2, spinScript('rapidspin'), spinBuild('rapidspin'));

const DEFOG_P1 = [set('Corviknight', ['Defog', 'Roost']), set('Archaludon', ['Stealth Rock', 'Reflect'])];
const DEFOG_P2 = [set('Toxapex', ['Stealth Rock', 'Recover']), set('Milotic', ['Reflect', 'Recover'])];
arm('DEFOG (target screens, target hazards, own hazards)', DEFOG_P1, DEFOG_P2, [
  ['move roost, move stealthrock', 'move stealthrock, move recover'],
  ['move roost, move reflect', 'move recover, move reflect'],
  ['move defog 1, move stealthrock', 'move recover, move recover'],
], (A, B) => [
  [[{ m: 'roost' }, { m: 'stealthrock' }], [{ m: 'stealthrock' }, { m: 'recover' }]],
  [[{ m: 'roost' }, { m: 'reflect' }], [{ m: 'recover' }, { m: 'reflect' }]],
  [[{ m: 'defog', t: B[0] }, { m: 'stealthrock' }], [{ m: 'recover' }, { m: 'recover' }]],
]);

const TIDY_P1 = [set('Maushold', ['Tidy Up', 'Substitute']), set('Archaludon', ['Stealth Rock', 'Body Press'])];
const TIDY_P2 = [set('Toxapex', ['Stealth Rock', 'Substitute']), set('Milotic', ['Recover', 'Scald'])];
arm('TIDY UP (every doll, own hazards, foe hazards)', TIDY_P1, TIDY_P2, [
  ['move substitute, move stealthrock', 'move stealthrock, move recover'],
  ['move tidyup, move bodypress 1', 'move substitute, move recover'],
], (A, B) => [
  [[{ m: 'substitute' }, { m: 'stealthrock' }], [{ m: 'stealthrock' }, { m: 'recover' }]],
  [[{ m: 'tidyup' }, { m: 'bodypress', t: B[0] }], [{ m: 'substitute' }, { m: 'recover' }]],
]);

/* ================================================================================================
 * 4 — THE COUNTERS. A sequence can agree because nothing reached the handler.
 * ============================================================================================= */
const moved = MEDI.MEDSEEN.sweepInAuthorityOrder - before.order;
const swept = MEDI.MEDSEEN.hazardSwept - before.sweeps;
ok(swept > 0, 'the sweep actually ran', 'hazardSwept moved by ' + swept + ' across the arms');
if (CHILD) {
  ok(MEDI.MEDFAILS.sweepLegacyOrderRestored === 1 && moved === 0,
     'the restore knob is live in the child',
     'sweepLegacyOrderRestored=' + MEDI.MEDFAILS.sweepLegacyOrderRestored
     + ' sweepInAuthorityOrder delta=' + moved);
} else {
  ok(moved > 0 && MEDI.MEDFAILS.sweepLegacyOrderRestored === 0,
     'the authority-order path ran and the legacy restore is off',
     'sweepInAuthorityOrder delta=' + moved
     + ' sweepLegacyOrderRestored=' + MEDI.MEDFAILS.sweepLegacyOrderRestored);
}

/* THE ATTRIBUTION, REPORTED AND NOT ASSERTED — see the header. */
console.log('\n  REPORTED, NOT ASSERTED — `[from] move: <Move>` on a swept line:');
console.log('    authority lines seen ' + attribSeen + ', arms where the authority attributed and this'
  + ' engine did not: ' + attribGap
  + '\n    Blocked on `engine/tag_dex.js` exhausting the heap: the attributed/bare split is a HANDLER'
  + '\n    fact (spin + Defog attribute, Tidy Up does not) and needs a derived `removesHazards` param.');

/* ================================================================================================
 * 5 — THE RED. The parent re-runs itself under the restore knob and must see it FAIL.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  ---- RE-RUNNING UNDER MEDI_SWEEP_LEGACY_ORDER=1 (the child must FAIL)');
  const r = spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, { MEDI_SWEEP_LEGACY_ORDER: '1' }), encoding: 'utf8' });
  const childFailed = r.status !== 0;
  const childLines = String(r.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(childFailed, 'the restore knob makes this probe RED',
     childFailed ? 'child exit ' + r.status + ', ' + childLines.length + ' FAIL line(s):\n          '
                   + childLines.join('\n          ')
                 : 'THE CHILD PASSED — this probe cannot tell the two orders apart and asserts nothing');
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
