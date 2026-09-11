#!/usr/bin/env node
/* tests/probe_mutation_classA_sibling.js — ROADMAP #323, the per-row string the row says is wrong.
 * ==================================================================================================
 * DOES A CLASS-A ROW OF data/mutation-coverage.json SAY "NOTHING IMPLEMENTS THIS FACT" WHILE ANOTHER
 * TAG ON THE SAME CARRIER IS READ BY THE SIMULATOR?
 *
 * tests/mutation_harness.js grades a (carrier x tag) row A from two things only: no TAGS lookup names
 * the tag, and no NAME branch names the carrier. It never looks at the carrier's OTHER tags, which is
 * a third route by which a fact can be implemented — the row's own example is `move:leechseed /
 * immunityGate`, whose Grass immunity is carried by the sibling `perTurnHP` param `immuneType`. The
 * per-row `defectWhy` then reads "Nothing in the simulator implements this fact", which is a claim the
 * classifier did not check.
 *
 * WHAT THIS ASKS, AND WHAT IT DOES NOT. It does not decide whether a sibling IMPLEMENTS the fact —
 * nothing can decide that without reading the branch. It asks whether the sentence is SUPPORTED:
 * a row that has not examined a route it knows exists may not say "nothing". A cell is a class-A row
 * carrying that sentence whose carrier holds at least one sibling tag the simulator reads.
 *
 * THE SOURCE IS THE ARTIFACT'S OWN RELEASE. The artifact names the release it measured
 * (`engine_release`); that snapshot's medicham2-browser.js and data/tags.json are read through
 * engine/engine_release.js, so the sibling reads are the bytes the string was written about. The
 * same count on the pinned release (2b5a6585d8cf by default) is printed beside it for reference.
 *
 * CONTROL. The classifier's own premise is re-checked first: the graded tag itself must NOT be read
 * in the release (otherwise the row is not class A at all and this probe is reading a different
 * defect). And the rows whose carrier has NO read sibling are counted and NOT flagged.
 *
 * PLANT: `--artifact <path>` reads another mutation-coverage file (a re-run after the harness fix).
 * EXIT: 0 green / 1 red / 2 cannot answer. Plays no game.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const PIN = arg('--release', '2b5a6585d8cf');
const ART = arg('--artifact', path.join(ROOT, 'data', 'mutation-coverage.json'));
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const SENTENCE = /Nothing in the simulator implements this fact/i;
const PLURAL = { move: 'moves', ability: 'abilities', item: 'items' };

let j;
try { j = JSON.parse(fs.readFileSync(ART, 'utf8')); } catch (e) { cannot(ART + ' unreadable: ' + e.message); }
const artRel = j.engine_release;
console.log('\ntests/probe_mutation_classA_sibling.js — ROADMAP #323');
console.log('  artifact ' + path.relative(ROOT, ART) + '   generated ' + j.generated + '   measured on release ' + artRel);

/* every tag name that appears inside a TAGS.param/has/withTag/reactorsTo(...) argument list */
function tagsRead(src) {
  const out = new Set();
  const re = /TAGS\.(param|has|withTag|reactorsTo)\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = re.lastIndex;
    const start = i;
    while (i < src.length && depth > 0 && i - start < 600) { const c = src[i]; if (c === '(') depth++; else if (c === ')') depth--; i++; }
    for (const s of src.slice(start, i).matchAll(/['"]([A-Za-z][A-Za-z0-9]*)['"]/g)) out.add(s[1]);
  }
  return out;
}
function openRel(id) {
  try {
    const R = ER.open(id);
    return { id: R.id, src: R.read('engine/medicham2-browser.js'), tags: JSON.parse(R.read('data/tags.json')) };
  } catch (e) { return { id, err: String(e && e.message || e) }; }
}
const A = openRel(artRel);
if (A.err) cannot('the artifact\'s release ' + artRel + ' cannot be opened: ' + A.err);
const P = PIN === artRel ? A : openRel(PIN);

const rowsA = (j.operators || []).filter(o => o.defectClass === 'A');
if (!rowsA.length) cannot('the artifact carries no class-A operator rows');
const byCarrierTag = new Map();
for (const o of rowsA) {
  const k = o.kind + ':' + o.id + ' / ' + o.tag;
  if (!byCarrierTag.has(k)) byCarrierTag.set(k, o);
}
console.log('  class-A operator rows ' + rowsA.length + ', distinct carrier x tag ' + byCarrierTag.size
  + '   (artifact summary.classArows ' + (j.summary || {}).classArows + ')');

/* A SIBLING THAT EVERY CARRIER OF THE KIND HOLDS IS NOT A ROUTE TO ANY PARTICULAR FACT. The first run
 * of this probe flagged 36 of 36 on `pp`, `targetClass` and `formatSecondaryCount` — bookkeeping every
 * move carries — which is the over-match LESSONS §4 predicts. So a sibling counts only when it is
 * SPECIFIC: carried by at most GENERIC_FRAC of that kind's entities in the release's own tags. The
 * excluded set is derived and printed, never typed. */
const GENERIC_FRAC = 0.25;
function genericTags(rel) {
  const out = {};
  for (const kind of Object.values(PLURAL)) {
    const ents = Object.values(rel.tags[kind] || {});
    const n = {};
    for (const e of ents) for (const t of (e.tags || [])) n[t] = (n[t] || 0) + 1;
    out[kind] = new Map(Object.entries(n).filter(([, c]) => c / Math.max(1, ents.length) > GENERIC_FRAC)
      .map(([t, c]) => [t, (c / ents.length)]));
  }
  return out;
}
function judge(rel) {
  const read = tagsRead(rel.src);
  const GEN = genericTags(rel);
  const flagged = [], clean = [], premiseBroken = [];
  judge.generic = GEN;
  for (const [k, o] of byCarrierTag) {
    const ent = ((rel.tags[PLURAL[o.kind]] || {})[o.id]) || { tags: [] };
    const sibs = (ent.tags || []).filter(t => t !== o.tag && !GEN[PLURAL[o.kind]].has(t));
    const readSibs = sibs.filter(t => read.has(t));
    if (read.has(o.tag)) premiseBroken.push(k);
    const says = SENTENCE.test(o.defectWhy || '');
    if (says && readSibs.length) flagged.push({ k, readSibs, sibs });
    else clean.push({ k, says, readSibs });
  }
  return { read, flagged, clean, premiseBroken };
}
const JA = judge(A);
console.log('  release ' + A.id + ': ' + JA.read.size + ' tag names appear inside a TAGS lookup');
for (const [kind, m] of Object.entries(judge.generic))
  console.log('  GENERIC (excluded as siblings, carried by > ' + (100 * GENERIC_FRAC) + '% of ' + kind + '): '
    + ([...m].map(([t, f]) => t + ' ' + (100 * f).toFixed(0) + '%').join(', ') || '(none)'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

console.log('\n  CONTROL — the classifier\'s own premise on the release it graded:');
ok(JA.premiseBroken.length === 0, 'no class-A tag is itself read in release ' + A.id,
   JA.premiseBroken.length ? 'these are read, so they are not class A at all: ' + JA.premiseBroken.slice(0, 8).join('; ') : null);
console.log('      rows with NO read sibling (not flagged): ' + JA.clean.filter(c => !c.readSibs.length).length);

console.log('\n  THE CELLS — "Nothing in the simulator implements this fact", with a read sibling on the carrier:');
for (const f of JA.flagged) console.log('      ' + f.k.padEnd(44) + ' read siblings: ' + f.readSibs.join(', '));
const leech = JA.flagged.find(f => f.k === 'move:leechseed / immunityGate');
console.log('      the row\'s own example, move:leechseed / immunityGate: '
  + (leech ? 'FLAGGED (siblings read: ' + leech.readSibs.join(', ') + ')' : 'not flagged'));
if (P && !P.err && P !== A) {
  const JP = judge(P);
  console.log('      for reference, on the pinned release ' + P.id + ': ' + JP.flagged.length + ' of ' + byCarrierTag.size + ' would be flagged');
}
ok(JA.flagged.length === 0,
   'no class-A row asserts "nothing implements this fact" while a sibling tag on its carrier is read',
   JA.flagged.length ? JA.flagged.length + ' of ' + byCarrierTag.size + ' class-A carrier x tag rows; first cell: '
     + JA.flagged[0].k + ' (read siblings: ' + JA.flagged[0].readSibs.join(', ') + '). The fix is to the string and '
     + 'a sibling-tag column in tests/mutation_harness.js defectEvidence, then a re-run.' : null);

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
