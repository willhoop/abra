/* probe_roster_fixture_legality.js — EVERY SET THE DELIBERATE ROSTER WOULD BUILD, EVERY ARM, PUT TO THE
 * SELECTED REGULATION'S TEAMVALIDATOR, WITHOUT PLAYING A GAME. 2026-09-23.
 *
 * ABRA-HEAP: 6144
 *
 *   SHOWDOWN_PATH=... node tests/probe_roster_fixture_legality.js                       (Reg M-B, all three stages)
 *   ABRA_REGULATION=regmc SHOWDOWN_PATH=<the M-C checkout> node tests/probe_roster_fixture_legality.js
 *   ... --stage items|abilities|moves      one stage
 *   ... --json <file>                      every refused set, with the scenario and arm that built it
 *   ... --strict                           exit 1 on any refused set
 *
 * WHY IT EXISTS BESIDE tests/probe_roster_inert_legality.js. That probe asks the SUBJECT arm only, and counts
 * one class (a control click the species cannot learn). The roster clause in engine/quarantine.js counts EVERY
 * refused set `buildPair` saw while the stage PLAYED — subject, control, the second control and the trap
 * exception arms — and so reads more refusals than any subject-only count can. This asks the same builder for
 * the same arms: `assign` for the stage, `controlOf` for the control arms, `withLegalInert` for the control
 * click, then the first four bodies of each side (engine/game_differential.js PAIR_BODIES, the cap `buildPair`
 * checks under), put to `fixture_legality.checkSet` — the SAME function `buildPair`'s runtime hook calls, so the
 * two cannot disagree about what is legal.
 *
 * WHAT IT CANNOT SEE, SAID: a set a RULE builds inside its own `match()` to prove something about itself (the
 * crit-lands proof fixture) and a set built only after a game has been played. Those are the runtime hook's.
 * So this is a lower bound on what a stage run will report, and the runtime receipt in the stage artifact
 * (`fixture_legality`) stays the gate's evidence.
 *
 * NOTHING HERE IS BASELINED. A refused set is printed whether or not data/fixture-legality-baseline.json names
 * its sentence; the `baselined` column says which, so a refusal can never be counted away by this probe. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const HAS = n => process.argv.includes(n);
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const R = require(D('tests', 'roster.js'));
const FL = require(D('engine', 'fixture_legality.js'));
const CS = require(D('engine', 'champions_sim.js'));
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CAP = 4;   /* engine/game_differential.js PAIR_BODIES — the bodies `buildPair` checks and keeps */

let BASE = new Set();
try {
  const B = JSON.parse(fs.readFileSync(D('data', 'fixture-legality-baseline.json'), 'utf8'));
  BASE = new Set([...(B.verdicts || []), ...(B.pairs || [])].map(x => FL.keyOf(x.problem || '')));
} catch (e) { console.log('  baseline unreadable (' + e.message + ') — every refusal reads NOT baselined'); }

const STAGES = ARG('--stage') ? [ARG('--stage')] : ['items', 'abilities', 'moves'];
const KIND = { items: 'item', abilities: 'ability', moves: 'move' };

console.log('\nROSTER FIXTURE LEGALITY, EVERY ARM — asked of the builder, no game played.');
console.log('  format ' + CS.FORMAT + '   authority ' + process.env.SHOWDOWN_PATH);

/* the arms `runEntry` plays, in the order it plays them */
function armsOf(e) {
  const sc = e.scenario;
  const out = [['subject', sc], ['control', R.controlOf(sc).sc]];
  if (sc.kind === 'ability' && sc.controlAbility2) out.push(['control2', R.controlOf(sc, 1).sc]);
  for (const [i, X] of (e.trapExceptions || []).entries()) if (X && X.scenario) out.push(['trap-exception-' + i, X.scenario]);
  return out;
}

const report = { format: CS.FORMAT, authority: process.env.SHOWDOWN_PATH, generated: new Date().toISOString(),
                 stages: {} };
let grandRefused = 0, grandNB = 0;
for (const stage of STAGES) {
  const kind = KIND[stage];
  if (!kind) { console.log('  no such stage: ' + stage); process.exit(2); }
  const { entries } = R.assign(kind);
  const seen = new Map();
  const refused = [];
  let arms = 0, staged = 0;
  for (const e of entries) {
    if (!e.scenario) continue;
    staged++;
    for (const [arm, sc0] of armsOf(e)) {
      arms++;
      let sc;
      try { sc = R.withLegalInert(sc0).sc; }
      catch (err) { refused.push({ entity: e.id, rule: e.rule, arm, species: null, problems: ['BUILD THREW: ' + err.message], baselined: false }); continue; }
      for (const side of ['A', 'B']) for (const m of (sc[side] || []).filter(x => x && x.species).slice(0, CAP)) {
        const s = { species: String(m.species), item: String(m.item || ''), ability: String(m.ability || ''),
                    moves: (m.moves || []).map(String), gender: m.gender === 'M' || m.gender === 'F' ? m.gender : '' };
        const k = [id(s.species), id(s.item), id(s.ability), s.moves.map(id).sort().join('+'), s.gender].join('|');
        let v = seen.get(k);
        if (!v) {
          try { v = FL.checkSet(s); }
          catch (err) { v = { legal: false, problems: ['VALIDATOR THREW: ' + String((err && err.message) || err).split('\n')[0]] }; }
          seen.set(k, v);
          if (!v.legal) {
            const baselined = v.problems.every(p => BASE.has(FL.keyOf(p)));
            refused.push({ entity: e.id, rule: e.rule, arm, side, set: s, problems: v.problems, baselined,
                           inert: R.inertChoice(sc0).why,
                           restaged: e.restaged ? { held: e.restaged.held || null, unresolved: e.restaged.unresolved,
                                                    swaps: e.restaged.swaps.length } : null });
          }
        }
      }
    }
  }
  const nb = refused.filter(r => !r.baselined).length;
  console.log('\n  ' + stage.toUpperCase() + '  ' + staged + ' staged row(s), ' + arms + ' arm(s), ' + seen.size
    + ' distinct set(s), ' + refused.length + ' REFUSED (' + nb + ' not baselined)');
  for (const r of refused) console.log('    ' + (r.baselined ? '[baselined] ' : '') + r.entity + '  ' + r.arm + ' '
    + (r.side || '') + '  ' + (r.set ? r.set.species + ' @' + (r.set.item || '-') + ' [' + r.set.ability + '] '
    + r.set.moves.join(',') : '') + '\n        ' + r.problems.join(' | '));
  report.stages[stage] = { staged, arms, distinct_sets: seen.size, refused: refused.length, not_baselined: nb, rows: refused,
    staged_ids: entries.filter(e => e.scenario).map(e => e.id) };
  grandRefused += refused.length; grandNB += nb;
}
/* AND WHAT THE RUNTIME HOOK SAW WHILE THE RULES BUILT THEIR OWN PROOF FIXTURES. A rule that calls `buildPair`
 * inside `match()` goes through engine/game_differential.js's fixture check during `assign`, not through the arms
 * above, so its refusals are read off the hook's process-global store and counted with the rest. */
const FX = globalThis.__abraFixtureCheck;
const hook = FX ? FX.illegal.map(x => ({ site: x.site, set: x.set, problems: x.problems, baselined: x.baselined })) : null;
if (!FX) console.log('\n  RULE-BUILT SETS: the runtime fixture hook never loaded, so none were judged — NOT a zero');
else {
  console.log('\n  RULE-BUILT SETS (engine/game_differential.js fixture hook, during assign): ' + FX.checked
    + ' distinct set(s), ' + hook.length + ' REFUSED');
  for (const r of hook) console.log('    ' + r.site + '  ' + r.set.species + ' [' + r.set.ability + '] ' + r.set.moves.join(',')
    + '\n        ' + r.problems.join(' | '));
  grandRefused += hook.length; grandNB += hook.filter(r => !r.baselined).length;
}
report.rule_built = hook;
/* SAID, NOT HIDDEN: `assign` is not free of games. A few rules PROVE their own control before they use it (the
 * Skill Swap proof, the crit-lands proof) and those play. No roster ARM is played here; the count is printed. */
report.proof_games_played_by_rules = R.playCalls();
console.log('\n  PROOF GAMES the rules played inside assign (their own control proofs; no roster arm): ' + R.playCalls());
console.log('\n  TOTAL  ' + grandRefused + ' refused set(s), ' + grandNB + ' not baselined');
if (ARG('--json')) fs.writeFileSync(ARG('--json'), JSON.stringify(report, null, 1));
if (HAS('--strict') && grandRefused) { console.log('  FAIL — a roster fixture set is refused by the format\'s own validator.'); process.exit(1); }
process.exit(0);
