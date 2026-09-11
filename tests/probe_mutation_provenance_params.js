#!/usr/bin/env node
/* tests/probe_mutation_provenance_params.js — ROADMAP #325.
 * ==================================================================================================
 * DOES THE MUTATION BATTERY SCORE A MUTATED CITATION AS `READ-AND-IGNORED`?
 *
 * `data/tags.json` carries provenance beside facts: `from: "DERIVED:..."`, `note: "condition not
 * derivable here ..."`, `via`, `cite`, `what`. The no-typing-from-memory rule requires them; nothing
 * in the simulator should ever read them. So mutating one and observing no change carries NO
 * information, yet tests/mutation_harness.js scores it READ-AND-IGNORED and it inflates that count.
 * The row asks that such params be skipped and COUNTED (`provenanceParamsSkipped`), the way
 * `nestedParamsSkipped` and `nullParamsSkipped` already are.
 *
 * THE MEMBERSHIP IS PRINTED BEFORE IT IS COUNTED (LESSONS §4). A param NAME is not enough: `what`
 * is a game fact on `blocksMove` (`what: 'priority'`) and a citation on `nameImplementedBySim`. So a
 * mutated param is PROVENANCE only when its name is in the set below AND its ORIGINAL value, read off
 * the tags the artifact's own release shipped, is a citation: it starts DERIVED:/READ:/HAND, or it is
 * prose (four or more words). Every name-match that fails the value test is printed as REJECTED.
 *
 * GREEN MEANS: the artifact publishes `summary.provenanceParamsSkipped` AND no provenance param is
 * scored READ-AND-IGNORED. RED names the cells.
 *
 * CONTROL: the non-provenance param rows are counted and untouched; the artifact's existing skip
 * counters (`nestedParamsSkipped`, `nullParamsSkipped`) are printed to show the skip mechanism
 * exists for other shapes.
 * PLANT: `--artifact <path>` to read a re-run.
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
const ART = arg('--artifact', path.join(ROOT, 'data', 'mutation-coverage.json'));
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const NAMES = new Set(['from', 'note', 'cite', 'via', 'what']);
const PLURAL = { move: 'moves', ability: 'abilities', item: 'items' };
/* `note` and `cite` are commentary by name; `from`, `via` and `what` also carry game facts (`from:
 * "Palafin"`, `via: "secondary"`, `what: "status moves at the holder"`), so for those the VALUE must
 * be citation-shaped. And a param the simulator DEREFERENCES is a fact whatever it looks like: the
 * artifact's own class D ("the simulator DOES dereference .x") rejects it. The first run of this
 * probe counted `ability:goodasgold / blocksMove.what`, which is class D — the over-match LESSONS §4
 * predicts, caught by printing the membership. */
const citationShaped = v => typeof v === 'string'
  && (/^(DERIVED|READ|HAND)\b/.test(v) || /[\w/.-]+\.(ts|js|json):\d+/.test(v) || v.trim().split(/\s+/).length >= 4);
const isCitation = (pname, v, cls) => cls !== 'D' && typeof v === 'string'
  && ((pname === 'note' || pname === 'cite') || citationShaped(v));

let j;
try { j = JSON.parse(fs.readFileSync(ART, 'utf8')); } catch (e) { cannot(ART + ' unreadable: ' + e.message); }
let tags;
try { tags = JSON.parse(ER.open(j.engine_release).read('data/tags.json')); }
catch (e) { cannot('the artifact\'s release ' + j.engine_release + ' cannot be opened: ' + String(e && e.message || e)); }

console.log('\ntests/probe_mutation_provenance_params.js — ROADMAP #325');
console.log('  artifact ' + path.relative(ROOT, ART) + '   generated ' + j.generated + '   release ' + j.engine_release);

const params = (j.operators || []).filter(o => o.family === 'param');
const rows = [];
for (const o of params) {
  const m = /^(move|ability|item):([^:]+):([A-Za-z0-9]+)\.([A-Za-z0-9_.]+):=/.exec(o.key || '');
  if (!m) continue;
  const pname = m[4].split('.').pop();
  if (!NAMES.has(pname)) continue;
  const ent = (tags[PLURAL[m[1]]] || {})[m[2]] || {};
  let v = ((ent.params || {})[m[3]]);
  for (const seg of m[4].split('.')) v = (v && typeof v === 'object') ? v[seg] : undefined;
  rows.push({ key: m[1] + ':' + m[2] + ' / ' + m[3] + '.' + m[4], verdict: o.verdict, value: v,
              cls: o.defectClass || '-', citation: isCitation(pname, v, o.defectClass) });
}
const prov = rows.filter(r => r.citation);
const rejected = rows.filter(r => !r.citation);
console.log('\n  MEMBERSHIP — param rows whose name is in {' + [...NAMES].join(', ') + '}: ' + rows.length);
for (const r of prov) console.log('      PROVENANCE  ' + r.key.padEnd(48) + ' ' + String(r.verdict).padEnd(18) + 'class ' + r.cls + '  ' + JSON.stringify(r.value).slice(0, 64));
for (const r of rejected) console.log('      REJECTED    ' + r.key.padEnd(48) + ' ' + String(r.verdict).padEnd(18) + 'class ' + r.cls + '  ' + JSON.stringify(r.value).slice(0, 64)
  + (r.cls === 'D' ? '   (dereferenced by the simulator — a fact)' : '   (a game fact, not a citation)'));

const S = j.summary || {};
console.log('\n  CONTROL — the non-provenance param rows: ' + (params.length - prov.length) + ' untouched;'
  + ' existing skip counters: nestedParamsSkipped ' + S.nestedParamsSkipped + ', nullParamsSkipped ' + S.nullParamsSkipped);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
if (!rows.length) cannot('no param row in the artifact names a provenance-shaped param — the membership rule matched nothing');
const scored = prov.filter(r => r.verdict === 'READ-AND-IGNORED');
ok(S.provenanceParamsSkipped != null, 'the artifact publishes summary.provenanceParamsSkipped',
   S.provenanceParamsSkipped == null ? 'absent — the battery has no provenance skip at all' : null);
ok(scored.length === 0, 'no mutated citation is scored READ-AND-IGNORED',
   scored.length ? scored.length + ' of ' + S.readAndIgnored + ' READ-AND-IGNORED rows mutate a citation; first cell: '
     + scored[0].key + ' = ' + JSON.stringify(scored[0].value).slice(0, 80) : null);

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
