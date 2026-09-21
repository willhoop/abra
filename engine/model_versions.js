/* model_versions.js — THE VERSION OF ONE MODEL ON ONE REGULATION, DERIVED AND NEVER TYPED.
 *
 *   node engine/model_versions.js            the table
 *   node engine/model_versions.js --json     the same thing for a caller
 *   node engine/model_versions.js --all      every ledger entry, including the ones with no artifact
 *
 * WILL, 2026-09-20: *"i dont want high abra numbers we have just been working on medicham"*, and
 * *"much better and lets do it per model inside of abra if that makes sense"*, against the standing
 * brief *"i just want low numbers for when projects are actually done and usable"*.
 *
 * SO THE KEY IS A PAIR AND THE ANSWER IS A STATE, NOT A COUNTER.
 *
 *   0.0.0   nothing exists for this pair — no gate, no artifact, no work
 *   0.x     it exists and it is NOT USABLE YET (SemVer 2.0.0 clause 4)
 *   1.0.0   a gate certifies it on this regulation AND nothing it publishes is withheld
 *
 * A counter is what produced `7.0.0`: 266 releases in 27 days, climbing whether or not anything
 * became usable, so a reader could not tell 7.0.0 from 3.0.0 without reading both. A state cannot do
 * that. Nothing here increments on activity.
 *
 * THE PROPERTY THAT MATTERS MOST: A MODEL MEASURED UNDER A SUPERSEDED ENGINE CANNOT READ 1.0.0.
 * That is the whole reason this exists. One shared version is exactly why a page of stale MAG figures
 * sat in `docs/MODELS.md` beside fresh MEDICHAM ones and read as equally authoritative — one of them
 * disagreeing with `data/policy-weights.json` on disk as well as with the engine — and they had to be
 * deleted by hand at 7.0.0. The check is not a judgement here: clause D asks
 * `engine/quarantine.js`'s withholder, which derives what is downstream of the simulator by walking
 * the require graph. A withheld artifact caps its model at 0.x, automatically, forever, until it is
 * re-run on an engine that passes.
 *
 * NOTHING IN THIS FILE IS A LIST.
 *   the models        `## NAME` headings in docs/MODELS.md — CLAUDE.md's per-model living ledger IS
 *                     the registry, so a model added there is picked up the day it is added
 *   the artifacts     the `data/*.json` files each model's own section cites
 *   the regulations   the version lines engine/docs_scan.js derives from the changelogs present,
 *                     each declaring its format id in its own masthead
 *   the gate          engine/quarantine.js. Its model is read off its own SIMULATOR constant, so the
 *                     binding cannot drift from the file the gate actually measures
 *   simulated or not  a regulation is SIMULATED iff the simulator's source names its format id
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It invents no bar. A model with no gate stays at 0.x and the
 * output says "no gate" rather than substituting something easier to pass — "say what the bar is, or
 * say plainly that it has none". And a gate that CANNOT ANSWER is never a pass: this prints
 * CANNOT-ANSWER and the pair stays 0.x, for the same reason a missing lattice is not a zero.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const DS = require('./docs_scan.js');

const LEDGER = 'docs/MODELS.md';
const GATE_FILE = 'engine/quarantine.js';

/* ---- 1. THE MODELS, FROM THE LEDGER THAT IS THE REGISTRY ------------------------------------- */

/* A MODEL IS A `## NAME` HEADING WHOSE NAME IS SHOUTED. CLAUDE.md names docs/MODELS.md "the
 * per-model living ledger", so the ledger is the registry and a name typed here would be a second
 * one that could disagree with it. The shout is what separates an entry (`## MEDICHAM — ...`) from a
 * section about the family (`## The learning core`). */
function models({ read = DS.readDoc } = {}) {
  let text;
  try { text = read(LEDGER); } catch (e) { return { error: String((e && e.message) || e), rows: [] }; }
  const lines = text.split('\n');
  const heads = [];
  /* THE NAME IS THE SHOUTED RUN THAT OPENS THE HEADING, AND A RUN OF MORE THAN TWO WORDS IS A
   * SECTION RATHER THAN A MODEL. A first draft took the first two shouted words and read
   * `## THE PER-TURN PIPELINE — WHO DOES WHAT` as a model called "THE PER". The ledger's model
   * entries are `## MEDICHAM — ...`, `## MOVE PRIORS — ...`, `## MEGA DEX — ...`; its prose sections
   * shout whole sentences. Counting the WHOLE run and refusing a long one separates them without a
   * list of section titles that would go stale the day somebody adds one. */
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+((?:[A-Z][A-Z0-9-]*\d*)(?:\s+[A-Z][A-Z0-9-]*)*)/);
    if (!m) continue;
    const run = m[1].trim();
    if (run.split(/\s+/).length > 2) continue;              // a shouted sentence is a section
    if (run.length < 3) continue;                           // an initial is not a model name
    heads.push({ name: run, at: i });
  }
  const rows = [];
  for (let k = 0; k < heads.length; k++) {
    const from = heads[k].at, to = k + 1 < heads.length ? heads[k + 1].at : lines.length;
    const body = lines.slice(from, to);
    /* THE ARTIFACTS A MODEL PUBLISHES ARE THE ONES ITS OWN SECTION CITES. Read through docs_scan's
     * citation reader rather than a second regex, for the reason this repository states about
     * `buildMon("Scizor")`: a hand-rolled copy of something that exists is how the two diverge. */
    const cites = [...new Set(DS.citationsIn(body).filter(DS.isArtifactRel))].sort();
    rows.push({ name: heads[k].name, line: from + 1, artifacts: cites });
  }
  /* The same shout can head two sections (a model and a later note about it). One row per model, and
   * its artifacts are the union, because a figure published under either heading is still its. */
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.name)) byName.set(r.name, { ...r, artifacts: [...r.artifacts] });
    else {
      const e = byName.get(r.name);
      for (const a of r.artifacts) if (!e.artifacts.includes(a)) e.artifacts.push(a);
    }
  }
  return { error: null, rows: [...byName.values()].map(r => ({ ...r, artifacts: r.artifacts.sort() })) };
}

/* ---- 2. THE REGULATIONS, AND WHICH OF THEM IS SIMULATED -------------------------------------- */

/* A REGULATION IS A VERSION LINE THAT DECLARES A FORMAT. `engine/docs_scan.js` derives the lines from
 * the changelogs present; each masthead carries `format=<id>`. A line with no format is a version
 * series that is not about a regulation, and it is skipped rather than guessed at. */
function regulations() {
  const out = [];
  for (const id of DS.lineIds()) {
    const l = DS.lineOf(id);
    if (!l || !l.format) continue;
    out.push({ line: id, format: l.format, label: l.label, closed: l.closed || null,
               top: DS.changelogTop(id), simulated: simulatorNames(l.format) });
  }
  return out;
}

/* SIMULATED MEANS THE SIMULATOR NAMES THE FORMAT. Not "we have a checkout", not "we have a store" —
 * the file the gate measures either plays that format or it does not. Reg M-C has a checkout, a
 * store of real games and a derived delta, and NOTHING is simulated; conflating those is how a pair
 * would read as started when no engine exists for it. */
let simSource = null, simReadError = null;
function simulatorNames(format) {
  if (simSource === null) {
    const f = gateSimulator();
    /* AN UNREADABLE SIMULATOR IS NOT "SIMULATES NOTHING", AND THE DIFFERENCE IS PRINTED. Swallowing
     * the read would answer `false` for every format — which is fail-closed and also indistinguishable
     * from a true reading, so a broken path would read as "no regulation is simulated" and look like
     * a fact. The error is kept and `simulatorReadError()` puts it on the screen. */
    if (!f) { simSource = ''; simReadError = 'the gate does not name a simulator, so nothing can be '
      + 'said about which format it plays'; return false; }
    try { simSource = fs.readFileSync(D(f), 'utf8'); }
    catch (e) { simSource = ''; simReadError = 'could not read ' + f + ': ' + one(e); }
  }
  if (simReadError) return false;
  return simSource.includes(format);
}
/** Why "not simulated" might mean "not readable". Null when the simulator was read. */
function simulatorReadError() { return simReadError; }

/* ---- 3. THE GATE, AND WHICH MODEL IT CERTIFIES ----------------------------------------------- */

/* THE BINDING IS READ OFF THE GATE'S OWN `SIMULATOR` CONSTANT. Typing `{ MEDICHAM: 'quarantine.js' }`
 * would be a second statement of a fact the gate already makes, and the two would part the day the
 * file is renamed — the failure this repository calls "two files that both decide one fact". */
/* NO FALLBACK FILENAME. A first draft returned `'engine/medicham2-browser.js'` when the require
 * failed, which is a Pokemon-adjacent fact typed from memory standing in for one that was read — the
 * thing this repository has a rule against. If the gate cannot say what it measures, nothing here
 * knows, and `null` makes every caller say so instead of asserting a path that may not exist. */
let gateSimError = null;
function gateSimulator() {
  try { return require('./quarantine.js').SIMULATOR || null; }
  catch (e) { gateSimError = one(e); return null; }
}
/** The model a gate certifies: the shouted ledger name that the gate's simulator filename contains. */
function gatedModel(names) {
  const sim = gateSimulator();
  if (!sim) return null;                       // the gate cannot say what it measures: nothing is gated
  const base = path.basename(sim).toLowerCase();
  let best = null;
  for (const n of names) {
    if (!base.includes(n.toLowerCase())) continue;
    if (!best || n.length > best.length) best = n;       // longest match wins: MEDICHAM over MED
  }
  return best;
}

/** The gate's verdict, as the three states a gate can be in. CANNOT-ANSWER is never a pass. */
function gateVerdict() {
  let Q;
  try { Q = require('./quarantine.js'); }
  catch (e) { return { state: 'CANNOT-ANSWER', why: 'engine/quarantine.js did not load: ' + one(e), withhold: null }; }
  let s;
  try { s = Q.state(); }
  catch (e) { return { state: 'CANNOT-ANSWER', why: 'the gate did not compute: ' + one(e), withhold: null }; }
  const failing = (s.gate && s.gate.gate_failing) || [];
  const cannot = failing.filter(c => c && c.cannot_answer);
  const withhold = (f) => { try { return s.withhold(f); } catch (e) { return { why: 'withholder threw: ' + one(e) }; } };
  if (s.ok) return { state: 'OPEN', why: null, withhold, clauses: failing.length };
  return {
    state: cannot.length && cannot.length === failing.length ? 'CANNOT-ANSWER' : 'CLOSED',
    why: failing.map(c => (c.name || '?') + ' — ' + String(c.why || '').split('\n')[0]).slice(0, 4).join(' | '),
    withhold, clauses: failing.length,
  };
}
const one = (e) => String((e && e.message) || e).split('\n')[0];

/* ---- 4. THE VERSION OF A PAIR ----------------------------------------------------------------- */

/* THE CLAUSES, IN THE ORDER THAT DECIDES. Each one that fails is a REASON printed beside the number,
 * because a version with no reason is the caption this repository has twice proved gets skimmed. */
function versionOf(model, reg, gate) {
  const reasons = [];
  if (!reg.simulated) {
    return { version: '0.0.0', state: 'NOT STARTED', artifacts: [],
             reasons: [simulatorReadError()
               ? `whether ${reg.format} is simulated CANNOT BE ANSWERED — ${simulatorReadError()}`
               : `nothing is simulated for ${reg.format}: ${gateSimulator()} does not name it`] };
  }
  const artifacts = model.artifacts;
  const gated = gate.model === model.name;
  /* THE REASON IS WRITTEN WITHOUT THE MODEL'S NAME IN IT, so identical reasons group into one line
   * instead of thirty copies of the same sentence. A wall of text is how a real finding gets skimmed. */
  if (!gated) reasons.push('NO GATE — nothing certifies this model on this regulation, so it cannot '
    + 'leave 0.x. No bar is invented to make a number available: ' + GATE_FILE + ' certifies '
    + (gate.model || 'nothing') + ' and nothing else.');
  else if (gate.state !== 'OPEN') reasons.push('GATE ' + gate.state + ' — ' + (gate.why || 'no detail'));
  if (!artifacts.length) reasons.push('publishes no artifact this ledger cites, so there is nothing to certify');

  const withheld = [];
  if (gate.withhold) for (const a of artifacts) {
    const h = gate.withhold(a);
    if (h) withheld.push(a + (h && h.because ? ' — ' + h.because : ''));
  } else if (artifacts.length) {
    reasons.push('the withholder could not be asked, so no artifact is cleared — fail-closed');
  }
  if (withheld.length) reasons.push(`${withheld.length} of ${artifacts.length} published artifact(s) are `
    + 'WITHHELD: they were measured under an engine that has been repaired since. Re-running them is '
    + 'what moves this number, not a decision.');

  if (!reasons.length) return { version: '1.0.0', state: 'USABLE', artifacts, withheld, reasons };
  /* 0.0.0 means nothing exists. Anything with a section and an artifact EXISTS and is unfinished. */
  const started = artifacts.length > 0;
  return { version: started ? '0.1.0' : '0.0.0', state: started ? 'NOT USABLE YET' : 'NOT STARTED',
           artifacts, withheld, reasons };
}

function table({ all = false } = {}) {
  const M = models();
  const regs = regulations();
  const g = gateVerdict();
  const names = M.rows.map(r => r.name);
  const gate = { ...g, model: gatedModel(names), file: GATE_FILE, simulator: gateSimulator() };
  const rows = [];
  for (const m of M.rows) {
    for (const reg of regs) {
      const v = versionOf(m, reg, gate);
      if (!all && !v.artifacts.length && v.version === '0.0.0' && gate.model !== m.name) continue;
      rows.push({ model: m.name, line: reg.line, format: reg.format, ...v });
    }
  }
  return { ledger: LEDGER, ledger_error: M.error, gate, regulations: regs, models: M.rows.length, rows };
}

/* ---- 5. THE RED DEMONSTRATION, one case per clause and one against each ------------------------
 *
 * SYNTHETIC PAIRS THROUGH THE SHIPPING FUNCTION. `engine/quarantine.js` learned the other way the
 * expensive way: its first selftest asserted the rule against a five-line copy of it, and a
 * deliberate break left the copy reporting 210 passed, 0 failed.
 *
 * Every refusal carries its opposite. Without `gate-open-and-nothing-withheld-is-1.0.0`, every clause
 * below could be satisfied by a function that returns 0.1.0 unconditionally, which is the same
 * nothing as a function that returns 1.0.0 unconditionally. */
const CASES = [
  { id: 'gate-open-and-nothing-withheld-is-1.0.0', expect: '1.0.0',
    why: 'THE POSITIVE CONTROL. Without it every clause here is satisfied by a function that always '
       + 'answers 0.1.0, and a version that can never be 1.0.0 says nothing.',
    model: { name: 'M', artifacts: ['data/a.json'] }, reg: { simulated: true, format: 'f' },
    gate: { state: 'OPEN', model: 'M', withhold: () => null } },
  { id: 'a-withheld-artifact-caps-its-model-at-0.x', expect: '0.1.0',
    why: 'THE CENTRAL CASE, and the reason this file exists. A model whose figures were measured '
       + 'under a superseded engine must not read 1.0.0 even with its gate open.',
    model: { name: 'M', artifacts: ['data/a.json'] }, reg: { simulated: true, format: 'f' },
    gate: { state: 'OPEN', model: 'M', withhold: () => ({ because: 'downstream of the simulator' }) } },
  { id: 'no-gate-cannot-leave-0.x', expect: '0.1.0',
    why: 'A model with no gate has no bar, and inventing one to make a number available is the '
       + 'failure the brief names. It stays 0.x and the output says why.',
    model: { name: 'M', artifacts: ['data/a.json'] }, reg: { simulated: true, format: 'f' },
    gate: { state: 'OPEN', model: 'OTHER', withhold: () => null } },
  { id: 'a-gate-that-CANNOT-ANSWER-is-not-a-pass', expect: '0.1.0',
    why: 'A zero a clause cannot compute is not a zero — the rule the lattice gate already keeps. '
       + 'An unreadable gate must never read as an open one.',
    model: { name: 'M', artifacts: ['data/a.json'] }, reg: { simulated: true, format: 'f' },
    gate: { state: 'CANNOT-ANSWER', model: 'M', why: 'the authority would not load', withhold: () => null } },
  { id: 'an-unsimulated-regulation-is-0.0.0-not-0.1.0', expect: '0.0.0',
    why: 'Reg M-C has a checkout, a store of real games and a derived delta, and NOTHING simulated. '
       + 'Reading that as "started" would let a pair look under way with no engine behind it.',
    model: { name: 'M', artifacts: ['data/a.json'] }, reg: { simulated: false, format: 'f' },
    gate: { state: 'OPEN', model: 'M', withhold: () => null } },
  { id: 'a-model-with-no-artifact-cannot-be-certified', expect: '0.0.0',
    why: 'An open gate over nothing published is not a usable model. Certifying an empty set is how a '
       + 'capability that never ran reports success.',
    model: { name: 'M', artifacts: [] }, reg: { simulated: true, format: 'f' },
    gate: { state: 'OPEN', model: 'M', withhold: () => null } },
  { id: 'a-withholder-that-cannot-be-asked-fails-closed', expect: '0.1.0',
    why: 'No withholder means no artifact was cleared, not that every artifact is clean. Silence is '
       + 'never evidence here.',
    model: { name: 'M', artifacts: ['data/a.json'] }, reg: { simulated: true, format: 'f' },
    gate: { state: 'OPEN', model: 'M', withhold: null } },
];
function proof() {
  return CASES.map(c => {
    const got = versionOf(c.model, c.reg, c.gate).version;
    return { id: c.id, why: c.why, expected: c.expect, got, holds: got === c.expect };
  });
}

module.exports = { models, regulations, gateVerdict, gatedModel, gateSimulator, simulatorReadError,
                   versionOf, table, proof, CASES };

/* ---- CLI -------------------------------------------------------------------------------------- */
if (require.main === module) {
  const all = process.argv.includes('--all');
  if (process.argv.includes('--selftest')) {
    let bad = 0;
    for (const c of proof()) {
      if (!c.holds) bad++;
      console.log(`  ${c.holds ? 'ok  ' : 'FAIL'} ${c.id}   expected ${c.expected}, got ${c.got}`);
      if (!c.holds) console.log('         ' + c.why);
    }
    console.log(`\nMODEL VERSION SELFTEST: ${proof().length - bad} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }
  const t = table({ all });
  if (process.argv.includes('--json')) { console.log(JSON.stringify(t, null, 2)); process.exit(0); }

  console.log('MODEL VERSIONS — how done is each model, on each regulation. Derived, never typed.\n');
  if (t.ledger_error) console.log('  CANNOT READ ' + LEDGER + ': ' + t.ledger_error + '\n');
  console.log(`  gate        ${t.gate.file}  ->  ${t.gate.model || 'NO MODEL MATCHED ITS SIMULATOR'}`
    + `   ${t.gate.state}${t.gate.state === 'OPEN' ? '' : '  (never a pass)'}`);
  if (t.gate.why) console.log('              ' + String(t.gate.why).slice(0, 150));
  console.log(`  regulations ` + t.regulations.map(r => `${r.line} [${r.simulated ? 'simulated' : 'not simulated'}]`).join('   '));
  console.log(`  ledger      ${t.ledger} — ${t.models} model entr(ies)\n`);

  /* GROUPED BY THE REASON, because the reason is the finding and the names are the detail. Printing
   * the same "NO GATE" sentence thirty times is a wall of text, and a wall of text is not a report. */
  const groups = new Map();
  for (const r of t.rows) {
    /* A PRINTABLE SEPARATOR. A `` here put a NUL byte in this source file, and git then
     * classified it as BINARY — no diff, no blame, no review. A grouping key never needs one. */
    const key = [r.line, r.version, r.reasons[0] || ''].join(' :: ');
    if (!groups.has(key)) groups.set(key, { ...r, models: [] });
    groups.get(key).models.push(r.model);
  }
  for (const g2 of [...groups.values()].sort((a, b) => (b.version.localeCompare(a.version)) || a.line.localeCompare(b.line))) {
    console.log(`  ${g2.version.padEnd(7)} ${g2.line.padEnd(13)} ${g2.state}   ${g2.models.length} model(s)`);
    console.log(`          ${g2.models.join(', ')}`);
    for (const why of g2.reasons) console.log(`          ${why}`);
    if (g2.withheld && g2.withheld.length) for (const w of g2.withheld.slice(0, 4)) console.log(`            ${w}`);
  }
  if (!all) console.log('\n  (--all adds every ledger entry with no artifact and no gate; they are all 0.0.0)');
  console.log('\n  1.0.0 requires a gate, OPEN, over at least one artifact, none of it withheld.');
  console.log('  A model measured under a superseded engine cannot read 1.0.0 — that is the point.');
  process.exit(0);
}
